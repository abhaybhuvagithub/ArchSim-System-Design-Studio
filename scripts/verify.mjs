// Headless verification of the Breakdown and Scale tabs against a built tree.
//
//   npm run build && npm run verify
//
// Mounts the production bundle in happy-dom, drives the real UI, and asserts
// the written content actually renders — outline order, option cards, canvas
// spotlighting — then sweeps all 49 templates for completeness. Exits non-zero
// on any failure, so CI can gate on it. Writes verify-report.txt alongside.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Window } from 'happy-dom';

// Resolve to an absolute path: a relative root would make the dynamic import
// below look like a bare package specifier rather than a file.
const root = path.resolve(process.argv[2] || process.cwd());
const OUT = [];
const log = (...a) => OUT.push(a.join(' '));
const results = [];
const check = (n, ok) => results.push([n, !!ok]);

const win = new Window({ url: 'http://localhost/' });
const doc = win.document;
doc.body.innerHTML = '<div id="root"></div>';
global.window = win;
global.document = doc;
Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true });
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = clearTimeout;
global.SVGElement = win.SVGElement;
global.HTMLElement = win.HTMLElement;
global.Image = win.Image;
global.Blob = win.Blob;
global.URL = win.URL;
global.FileReader = win.FileReader;
global.XMLSerializer = win.XMLSerializer;
global.getComputedStyle = win.getComputedStyle.bind(win);
global.matchMedia = win.matchMedia?.bind(win) || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
global.localStorage = win.localStorage;
global.fetch = () => Promise.reject(new Error('offline in test'));
global.confirm = () => true;
global.alert = () => {};
win.HTMLElement.prototype.scrollIntoView = function () {};

const errs = [];
process.on('uncaughtException', (e) => errs.push(e));
process.on('unhandledRejection', (e) => errs.push(e));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el && el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
const byText = (sel, txt) => [...doc.querySelectorAll(sel)].find((e) => e.textContent.includes(txt));

try {
  // Take the entry point from the built index.html. A single build emits
  // several chunks with identical mtimes, so picking by mtime or size will
  // sooner or later load a vendor chunk instead of the app — which is exactly
  // what happened the first time this ran in CI.
  const indexHtml = path.join(root, 'dist/index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error('dist/index.html not found — run `npm run build` first');
  }
  const m = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(fs.readFileSync(indexHtml, 'utf8'));
  if (!m) throw new Error('no module script tag found in dist/index.html');
  const entryPath = path.join(root, 'dist/assets', path.basename(m[1]));
  if (!fs.existsSync(entryPath)) {
    throw new Error(`entry ${path.basename(m[1])} referenced by index.html is missing from dist/assets`);
  }
  log('bundle: ' + path.basename(entryPath) + '  (from dist/index.html)');
  await import(pathToFileURL(entryPath).href);
  await wait(700);
  check('app mounts', doc.body.innerHTML.length > 2000);
  // Everything downstream assumes a mounted app. Without this, a bad bundle
  // produces a cascade of "cannot read properties of undefined" that says
  // nothing about the actual cause.
  if (doc.body.innerHTML.length <= 2000) {
    throw new Error(
      'app did not mount (body was ' + doc.body.innerHTML.length + ' chars). ' +
      'Either the wrong chunk was loaded or it threw on startup. ' +
      'First captured error: ' + (errs[0]?.message || 'none')
    );
  }

  // load the WhatsApp template through the picker
  const sel = [...doc.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => o.textContent.includes('WhatsApp')));
  check('WhatsApp is in the template picker', !!sel);
  const opt = [...sel.options].find((o) => o.textContent.includes('WhatsApp'));
  sel.value = opt.value;
  sel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(400);

  const nodeCount = () => doc.querySelectorAll('svg g[data-nid], svg g.node').length;
  check('template loaded onto the canvas', doc.body.innerHTML.includes('Chat Servers'));

  // open the Breakdown tab
  const tabBtn = byText('.tabs button', 'Breakdown');
  check('Breakdown tab button exists', !!tabBtn);
  click(tabBtn);
  await wait(300);

  const html = () => doc.body.innerHTML;
  check('breakdown renders', !!doc.querySelector('.bd'));

  // the exact outline the tab must contain
  // Required of every breakdown. "Planning the Approach" is optional (Bitly
  // omits it) and the API heading is per-template, so neither is in the spine.
  const core = [
    'Understanding the Problem',
    'Functional Requirements',
    'Non-Functional Requirements',
    'The Set Up',
    'Defining the Core Entities',
    'High-Level Design',
  ];
  const spine = [
    'Understanding the Problem',
    'Functional Requirements',
    'Non-Functional Requirements',
    'The Set Up',
    'Planning the Approach',
    'Defining the Core Entities',
    'API or System Interface',
    'High-Level Design',
  ];
  const tail = ['Potential Deep Dives'];
  const closing = ['What is Expected at Each Level?', 'Mid-level', 'Senior', 'Staff+'];
  const headings = [...doc.querySelectorAll('[data-bd-sec]')].map((h) => h.textContent.trim());
  log('');
  log('WhatsApp outline (' + headings.length + ' sections):');
  headings.forEach((h) => log('  · ' + h));
  log('');
  check('opening spine in order', JSON.stringify(headings.slice(0, spine.length)) === JSON.stringify(spine));
  check('deep dives section present', headings.includes(tail[0]));
  check('closes with the level expectations',
    JSON.stringify(headings.slice(-4)) === JSON.stringify(closing));
  check('References section is gone', !headings.includes('References'));
  check('no reference links rendered anywhere', doc.querySelectorAll('.bd-ref').length === 0);
  const hldStart = headings.indexOf('High-Level Design');
  const ddStart = headings.indexOf('Potential Deep Dives');
  check('WhatsApp has four authored high-level-design sections', ddStart - hldStart - 1 === 4);
  check('six WhatsApp deep dives',
    headings.slice(ddStart + 1, headings.indexOf('What is Expected at Each Level?')).length === 6);

  check('contents rail lists every section',
    doc.querySelectorAll('.bd-toc-i').length === headings.length);
  check('requirements show "below the line" scoping', doc.querySelectorAll('.bd-below').length >= 2);
  check('back-of-envelope cards render', doc.querySelectorAll('.bd-num').length >= 6);
  check('core entities render', doc.querySelectorAll('.bd-ent').length >= 4);
  check('API commands render', doc.querySelectorAll('.bd-api').length >= 4);
  check('Bad/Good/Great cards render', doc.querySelectorAll('.bd-rate').length >= 12);

  // Bad/Good/Great: the "Great" option is expanded by default; clicking a
  // different card moves the expansion, clicking the open one collapses it.
  const g1 = () => doc.querySelector('.bd-opts');                       // first option group only
  const openTitle = () => g1().querySelector('.bd-opt.open .bd-opt-t')?.textContent || '';
  check('the recommended option is expanded by default', !!g1().querySelector('.bd-opt.great.open'));
  const was = openTitle();
  click(g1().querySelector('.bd-opt-h'));                                // first card in that group
  await wait(120);
  check('clicking another option moves the expansion', openTitle() !== was && openTitle() !== '');
  click(g1().querySelector('.bd-opt.open .bd-opt-h'));                   // click the now-open one
  await wait(120);
  check('clicking the open option collapses it', openTitle() === '');
  check('collapsing one group leaves the others untouched',
    doc.querySelectorAll('.bd-opt.open').length >= 4);

  // spotlight
  const spot = doc.querySelector('.bd-focus');
  check('spotlight buttons exist on design sections', doc.querySelectorAll('.bd-focus').length === 10);
  click(spot);
  await wait(200);
  check('spotlight activates', !!doc.querySelector('.bd-focus.on'));
  const dimmed = [...doc.querySelectorAll('svg g')].filter((g) => (g.getAttribute('style') || '').includes('0.32')).length;
  check('spotlight dims components outside the section', dimmed > 0);
  click(doc.querySelector('.bd-focus.on'));
  await wait(200);
  check('spotlight clears', !doc.querySelector('.bd-focus.on'));

  // contents rail navigation
  click([...doc.querySelectorAll('.bd-toc-i')].find((b) => b.textContent.includes('Potential Deep Dives')));
  await wait(150);
  const marked = doc.querySelector('.bd-toc-i.on');
  check('contents rail marks the jumped-to section',
    !!marked && marked.textContent.includes('Potential Deep Dives'));

  // Bitly follows its own outline exactly: no Planning section, "The API"
  // rather than the default heading, and a Final Design before the level bars.
  const bitlyOpt = [...sel.options].find((o) => o.textContent.includes('Bitly'));
  sel.value = bitlyOpt.value;
  sel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(300);
  const bitly = [...doc.querySelectorAll('[data-bd-sec]')].map((h) => h.textContent.trim());
  const bitlyExpected = [
    'Understanding the Problem',
    'Functional Requirements',
    'Non-Functional Requirements',
    'The Set Up',
    'Defining the Core Entities',
    'The API',
    'High-Level Design',
    '1) Users should be able to submit a long URL and receive a shortened version',
    '2) Users should be able to access the original URL by using the shortened URL',
    'Potential Deep Dives',
    '1) How can we ensure short urls are unique?',
    '2) How can we ensure that redirects are fast?',
    '3) How can we scale to support 1B shortened urls and 100M DAU?',
    'Final Design',
    'What is Expected at Each Level?',
    'Mid-level',
    'Senior',
    'Staff+',
  ];
  log('');
  log('Bitly outline (' + bitly.length + ' sections):');
  bitly.forEach((h) => log('  · ' + h));
  log('');
  const bitlyDiff = bitlyExpected.filter((h, i) => bitly[i] !== h);
  check('Bitly matches its requested outline exactly, in order' +
    (bitlyDiff.length ? ' — mismatched: ' + bitlyDiff.join(' | ') : ''),
    JSON.stringify(bitly) === JSON.stringify(bitlyExpected));
  check('Bitly has no Planning the Approach section', !bitly.includes('Planning the Approach'));
  check('Bitly uses "The API" heading', bitly.includes('The API') && !bitly.includes('API or System Interface'));
  check('Bitly has a Final Design section', bitly.includes('Final Design'));
  check('Bitly deep dive 1 has Bad/Good/Great options', doc.querySelectorAll('.bd-rate').length >= 3);

  // every template must produce a complete breakdown, with HLD read off its graph
  const allOpts = [...sel.options].filter((o) => o.value !== '' && o.value !== 'blank' && o.value !== 'starter');
  let full = 0;
  const bdGaps = [];
  let sawDerivedPath = 0;
  let withPlanning = 0;
  let withFinalDesign = 0;
  for (const o of allOpts) {
    sel.value = o.value;
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(60);
    const hs = [...doc.querySelectorAll('[data-bd-sec]')].map((h) => h.textContent.trim());
    const hasApi = hs.some((h) => h === 'The API' || h === 'API or System Interface');
    const ok = core.every((s) => hs.includes(s)) && hasApi && hs.includes('Potential Deep Dives')
      && hs.includes('Staff+') && !hs.includes('References');
    if (hs.some((h) => h.includes('The request path'))) sawDerivedPath++;
    if (hs.includes('Planning the Approach')) withPlanning++;
    if (hs.includes('Final Design')) withFinalDesign++;
    if (ok) full++; else bdGaps.push(o.textContent.trim());
  }
  log('');
  log(`Breakdown coverage: ${full}/${allOpts.length} templates` + (bdGaps.length ? ' — gaps: ' + bdGaps.join(', ') : ''));
  log(`  high-level design derived from the graph: ${sawDerivedPath}`);
  log(`  with a Planning section: ${withPlanning}   with a Final Design section: ${withFinalDesign}`);
  check(`every one of the ${allOpts.length} templates has a complete breakdown`, bdGaps.length === 0);
  check('optional sections are genuinely optional', withPlanning < allOpts.length && withFinalDesign >= 1);
  check('high-level design is derived from the diagram for most templates', sawDerivedPath >= 45);
  check('no template still shows a References section', true);

  // ── Scale tab ──────────────────────────────────────────────────────────────
  const scaleBtn = byText('.tabs button', 'Scale');
  check('Scale tab button exists', !!scaleBtn);
  click(scaleBtn);
  await wait(250);
  check('scale panel renders', !!doc.querySelector('.sc'));
  check('binding constraint is shown', !!doc.querySelector('.sc-constraint p')?.textContent.trim());
  check('ladder has four rungs', doc.querySelectorAll('.sc-rung').length === 4);
  check('ladder rungs carry a throughput figure',
    [...doc.querySelectorAll('.sc-rung-l span')].every((s) => s.textContent.trim().length > 0));

  click(byText('.tabs.sub button', 'Levers'));
  await wait(150);
  const leverCount = doc.querySelectorAll('.sc-lever').length;
  check('levers render', leverCount >= 4);
  click(doc.querySelector('.sc-lever .bd-focus'));
  await wait(200);
  check('lever spotlight activates', !!doc.querySelector('.sc-lever.on'));
  check('lever spotlight dims the rest of the canvas',
    [...doc.querySelectorAll('svg g')].some((g) => (g.getAttribute('style') || '').includes('0.32')));
  click(doc.querySelector('.sc-lever.on .bd-focus'));
  await wait(150);
  check('lever spotlight clears', !doc.querySelector('.sc-lever.on'));

  click(byText('.tabs.sub button', 'The wall'));
  await wait(150);
  check('the wall renders', !!doc.querySelector('.sc-wall-t'));

  click(byText('.tabs.sub button', 'Rules'));
  await wait(150);
  check('shared principles render', doc.querySelectorAll('.sc-rule').length >= 10);

  // every template must produce a complete Scale tab without crashing
  click(byText('.tabs.sub button', 'Ladder'));   // back to the rung view before sweeping
  await wait(150);
  const names = [...sel.options].filter((o) => o.value !== '' && o.value !== 'blank' && o.value !== 'starter');
  let covered = 0;
  const gaps = [];
  for (const o of names) {
    sel.value = o.value;
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(60);
    const hasConstraint = !!doc.querySelector('.sc-constraint p')?.textContent.trim();
    const rungCount = doc.querySelectorAll('.sc-rung').length;
    if (hasConstraint && rungCount === 4) covered++;
    else gaps.push(o.textContent.trim());
  }
  log('');
  log(`Scale coverage: ${covered}/${names.length} templates` + (gaps.length ? ' — gaps: ' + gaps.join(', ') : ''));
  check(`every one of the ${names.length} templates has a complete scaling playbook`, gaps.length === 0);
  check('no crash while cycling all templates', errs.length === 0);
} catch (e) {
  errs.push(e);
}

let fail = 0;
for (const [n, ok] of results) { log(`  ${ok ? '✓' : '✗'} ${n}`); if (!ok) fail++; }
log(errs.length
  ? '\nRUNTIME ERRORS:\n  ' + errs.map((e) => (e.stack || e.message).split('\n').slice(0, 3).join('\n  ')).join('\n  ')
  : '\nNo runtime errors');
log(`\n${results.length - fail}/${results.length} checks passed`);

const report = OUT.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'verify-report.txt'), report);
// happy-dom keeps timers alive, so we exit explicitly — which means stdout has
// to be written synchronously or CI logs get truncated mid-report.
fs.writeSync(1, report);
process.exit(fail || errs.length ? 1 : 0);
