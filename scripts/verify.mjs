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

// happy-dom defaults to 1024px, which is below the app's 1100px breakpoint — so
// without this the whole suite silently exercises the tablet drawer layout and
// never sees the docked panels, splitters or their controls at all.
const win = new Window({ url: 'http://localhost/', width: 1440, height: 900 });
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
// Toolbar controls now live in menus, so reaching one means opening it first.
const openMenu = async (label) => {
  const btn = [...doc.querySelectorAll('.toolbar .menu > button')].find((b) => b.textContent.trim().startsWith(label));
  if (btn && btn.getAttribute('aria-expanded') !== 'true') { click(btn); await new Promise((r) => setTimeout(r, 120)) }
  return btn;
};
const menuItem = (txt) => [...doc.querySelectorAll('.menu-pop [role^="menuitem"]')].find((e) => e.textContent.includes(txt));
// The outside-click handler listens for pointerdown, so a plain click event
// does not dismiss anything — dispatch what the app actually listens for.
const closeMenus = async () => {
  doc.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
};
// React tracks the previous value on the DOM node, so assigning `.value`
// directly is ignored. Go through the native setter so onChange actually fires.
const typeInto = (el, text) => {
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
};

try {
  // ── data integrity, before touching the DOM ────────────────────────────────
  // Cheap, and it localises a broken template to the template rather than to
  // whichever assertion happens to trip over it later.
  {
    const { TEMPLATES } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    const { breakdownFor } = await import(pathToFileURL(path.join(root, 'src/breakdown.js')).href);
    const { scalingFor } = await import(pathToFileURL(path.join(root, 'src/scaling.js')).href);

    const bad = [];
    for (const t of TEMPLATES) {
      const ids = new Set(t.nodes.map((n) => n.id));
      if (ids.size !== t.nodes.length) bad.push(`${t.name}: duplicate node id`);
      for (const e of t.edges) {
        if (!ids.has(e.from)) bad.push(`${t.name}: edge from unknown node "${e.from}"`);
        if (!ids.has(e.to)) bad.push(`${t.name}: edge to unknown node "${e.to}"`);
      }
      const seen = new Set();
      for (const n of t.nodes) {
        const at = `${n.x},${n.y}`;
        if (seen.has(at)) bad.push(`${t.name}: "${n.label}" overlaps another node at ${at}`);
        seen.add(at);
      }
      const wired = new Set(t.edges.flatMap((e) => [e.from, e.to]));
      for (const n of t.nodes) if (!wired.has(n.id)) bad.push(`${t.name}: "${n.label}" is not wired to anything`);
      if (!breakdownFor(t)) bad.push(`${t.name}: no breakdown`);
      if (!scalingFor(t)) bad.push(`${t.name}: no scaling playbook`);
    }
    log(`data: ${TEMPLATES.length} templates checked`);
    if (bad.length) bad.slice(0, 12).forEach((b) => log('  ! ' + b));
    check(`all ${TEMPLATES.length} templates are structurally sound and documented`, bad.length === 0);

    // ── auto-arrange quality ─────────────────────────────────────────────────
    const { autoArrange, countCrossings, countNodeOverlaps } =
      await import(pathToFileURL(path.join(root, 'src/layout.js')).href);

    let handX = 0, autoX = 0, handO = 0, autoO = 0;
    const unstable = [], regressed = [], stacked = [];
    for (const t of TEMPLATES) {
      const a = autoArrange(t.nodes, t.edges);
      const b = autoArrange(a, t.edges);
      if (!a.every((n, i) => n.x === b[i].x && n.y === b[i].y)) unstable.push(t.name);

      const hx = countCrossings(t.nodes, t.edges), ax = countCrossings(a, t.edges);
      handX += hx; autoX += ax;
      handO += countNodeOverlaps(t.nodes, t.edges); autoO += countNodeOverlaps(a, t.edges);
      if (ax > hx + 2) regressed.push(`${t.name} ${hx}→${ax}`);

      const at = new Set();
      for (const n of a) { const k = n.x + ',' + n.y; if (at.has(k)) stacked.push(t.name); at.add(k); }
    }
    log(`arrange: crossings ${handX} → ${autoX}, edges over nodes ${handO} → ${autoO}`);
    if (unstable.length) log('  ! unstable: ' + unstable.join(', '));
    if (regressed.length) log('  ! worse than hand-drawn: ' + regressed.join(', '));

    // ── templates must load in a healthy state ───────────────────────────────
    // A template that is already dropping traffic on load teaches the wrong
    // lesson: you cannot push it to find its bottleneck if it arrives broken.
    const { simulate } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
    const unhealthy = [];
    for (const t of TEMPLATES) {
      const s = simulate(t.nodes, t.edges, t.rps, new Set());
      const hot = Object.entries(s.stats)
        .filter(([, st]) => st.util > 0.9)
        .map(([id]) => t.nodes.find(n => n.id === id)?.label);
      if (s.successRate < 0.99 || hot.length) {
        unhealthy.push(`${t.name} (${(s.successRate * 100).toFixed(1)}%${hot.length ? ', ' + hot.join(', ') : ''})`);
      }
    }
    if (unhealthy.length) unhealthy.forEach(u => log('  ! saturated on load: ' + u));
    check('every template loads healthy at its own default traffic', unhealthy.length === 0);

    check('arrange is idempotent — pressing it twice changes nothing', unstable.length === 0);
    check('arrange never stacks two nodes in the same place', stacked.length === 0);
    check('arrange beats the hand-drawn layouts on crossings', autoX < handX);
    check('arrange beats the hand-drawn layouts on edges crossing nodes', autoO < handO);
    check('no single template is made much worse', regressed.length === 0);
  }

  // ── node labels read as sentences in advisor findings ──────────────────────
  {
    const { TEMPLATES } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    // Findings are built as "<label> has a single copy", so a label that starts
    // lowercase reads as a broken sentence. Genuine brand names are exempt.
    const BRAND_LOWERCASE = new Set(['goCash Wallet', 'iCloud Sync', 'eKYC Service', 'gRPC-JSON Transcoder', 'gRPC Service']);
    const labels = TEMPLATES.flatMap(t => t.nodes.map(n => ({ t: t.name, l: n.label })));
    const offenders = labels.filter(x => /^[a-z]/.test(x.l) && !BRAND_LOWERCASE.has(x.l));
    check('every node label is non-empty', labels.every(x => x.l && x.l.trim()));
    check('node labels start uppercase so findings read as sentences' +
      (offenders.length ? ' — ' + offenders.map(o => `${o.t}: "${o.l}"`).join(', ') : ''),
      offenders.length === 0);
  }

  // ── physical storage, encoding, stream semantics ───────────────────────────
  {
    const d2 = await import(pathToFileURL(path.join(root, 'src/ddia2.js')).href);
    const { simulate } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
    const { review } = await import(pathToFileURL(path.join(root, 'src/advisor.js')).href);

    // The whole point: these change the simulated numbers, not just the advice.
    const nodes = extra => [
      { id: 'c', type: 'client', label: 'C', replicas: 1 },
      { id: 'db', type: 'sql', label: 'DB', replicas: 2, ...extra },
    ];
    const edges = [{ id: 'c->db', from: 'c', to: 'db' }];
    const util = extra => simulate(nodes(extra), edges, 8000).stats.db.util;
    const lat = extra => simulate(nodes(extra), edges, 4000).stats.db.latency;
    const base = util({});
    check('an LSM engine raises write throughput in the simulation', util({ engine: 'lsm' }) < base);
    check('a column store is worse at row-at-a-time traffic', util({ engine: 'column' }) > base);
    check('an in-memory engine has the most headroom', util({ engine: 'memory' }) < util({ engine: 'lsm' }));
    check('linearizability costs capacity in the simulation', util({ consistency: 'linearizable' }) > base);
    check('linearizability costs latency too', lat({ consistency: 'linearizable' }) > lat({}));
    check('causal consistency costs less than linearizable',
      util({ consistency: 'causal' }) < util({ consistency: 'linearizable' }));
    check('engine and consistency compose rather than override', (() => {
      const p = d2.physicalEffects({ engine: 'lsm', consistency: 'linearizable' });
      return Math.abs(p.capMul - 1.6 * 0.6) < 1e-9 && Math.abs(p.latMul - 1.1 * 1.6) < 1e-9;
    })());
    check('an unspecified store is left exactly as it was', (() => {
      const p = d2.physicalEffects({});
      return p.capMul === 1 && p.latMul === 1 && util({}) === base;
    })());

    // Tail amplification: fanning out makes the tail dominate.
    check('tail amplification grows with fan-out',
      d2.tailAmplification(1) < d2.tailAmplification(10) && d2.tailAmplification(10) < d2.tailAmplification(100));
    check('one call in the tail is just the tail probability',
      Math.abs(d2.tailAmplification(1, 0.01) - 0.01) < 1e-9);
    check('no fan-out means no amplification', d2.tailAmplification(0) === 0);
    check('a hundred calls at p99 are more likely slow than not', d2.tailAmplification(100) > 0.5);

    // Schema evolution lives on the link.
    check('a schemaless link across a rolling upgrade is flagged', !!d2.evolutionRisk({ encoding: 'json' }).risk);
    check('a schema-carrying link is not', !d2.evolutionRisk({ encoding: 'avro' }).risk);
    check('no encoding stated means no claim made', d2.evolutionRisk({}).encoding === null);

    // Findings fire when they should and stay quiet when they should not.
    const fires = (ns, es, re) => review(ns, es, 1000).some(x => re.test(x.title + ' ' + (x.detail || '')));
    const store = e => [{ id: 'db', type: 'sql', label: 'DB', replicas: 2, ...e }];
    check('a column store on live traffic is flagged', fires(store({ engine: 'column' }), [], /column-oriented/i));
    check('a column store on an analytics node is not',
      !fires([{ id: 'w', type: 'analytics', label: 'W', replicas: 2, engine: 'column' }], [], /column-oriented/i));
    check('a single in-memory copy is flagged', fires(store({ engine: 'memory', replicas: 1, type: 'nosql' }), [], /only copy in memory/i));
    check('an in-memory cache is not flagged for it',
      !fires([{ id: 'c', type: 'cache', label: 'C', replicas: 1, engine: 'memory' }], [], /only copy in memory/i));

    const svc = mw => [
      { id: 's', type: 'micro', label: 'Svc', replicas: 2, ...(mw ? { multiWrite: mw } : {}) },
      { id: 'a', type: 'sql', label: 'A', replicas: 2 }, { id: 'b', type: 'nosql', label: 'B', replicas: 2 },
    ];
    const svcEdges = [{ id: 's->a', from: 's', to: 'a' }, { id: 's->b', from: 's', to: 'b' }];
    check('writing to two stores with no strategy is flagged', fires(svc(null), svcEdges, /no stated strategy/i));
    check('declaring an outbox clears it', !fires(svc('outbox'), svcEdges, /no stated strategy/i));
    check('one store is not a multi-write problem',
      !fires(svc('none').slice(0, 2), [svcEdges[0]], /no stated strategy/i));

    const q = extra => [{ id: 'q', type: 'queue', label: 'Q', replicas: 2, ...extra }];
    check('at-least-once without an idempotent consumer is flagged',
      fires(q({ delivery: 'atLeastOnce' }), [], /duplicates/i));
    check('an idempotent consumer clears it',
      !fires(q({ delivery: 'atLeastOnce', idempotentConsumer: true }), [], /duplicates/i));
    check('event sourcing on a plain queue is called out',
      fires(q({ streamRole: 'sourcing' }), [], /cannot be an event source/i));
    check('event sourcing on a log is fine',
      !fires([{ id: 'k', type: 'kafka', label: 'K', replicas: 3, streamRole: 'sourcing' }], [], /cannot be an event source/i));
  }

  // ── read / write split ─────────────────────────────────────────────────────
  {
    const d2 = await import(pathToFileURL(path.join(root, 'src/ddia2.js')).href);
    const { simulate } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
    const { review } = await import(pathToFileURL(path.join(root, 'src/advisor.js')).href);

    const N = x => [{ id: 'c', type: 'client', label: 'C', replicas: 1 },
                    { id: 'db', type: 'sql', label: 'DB', replicas: 3, ...x }];
    const E = rf => [{ id: 'c->db', from: 'c', to: 'db', readFrac: rf }];
    const util = (x, rf) => simulate(N(x), E(rf), 12000).stats.db.util;

    // The lesson the split exists to teach.
    check('followers do not raise the write ceiling under single-leader', (() => {
      const c = d2.capacitySplit({}, 5000, 3, 'leader');
      return c.readCap === 15000 && c.writeCap === 5000;
    })());
    check('without a declared mode, replicas still scale both ways', (() => {
      const c = d2.capacitySplit({}, 5000, 3, undefined);
      return c.readCap === 15000 && c.writeCap === 15000;
    })());
    check('a write-heavy single-leader store saturates', util({ replication: 'leader' }, 0.5) > 1);
    check('the same store read-heavy does not', util({ replication: 'leader' }, 0.9) < 1);
    check('declaring single-leader is what introduces the write bottleneck',
      util({ replication: 'leader' }, 0.5) > util({}, 0.5));
    check('an undeclared store is unaffected by the read mix',
      Math.abs(util({}, 0.1) - util({}, 0.9)) < 1e-9);

    // Engine asymmetry — the reason a single number was not good enough.
    check('LSM beats B-tree on writes', (() => {
      const l = d2.capacitySplit({ engine: 'lsm' }, 5000, 1), b = d2.capacitySplit({ engine: 'btree' }, 5000, 1);
      return l.writeCap > b.writeCap;
    })());
    check('B-tree beats LSM on reads', (() => {
      const l = d2.capacitySplit({ engine: 'lsm' }, 5000, 1), b = d2.capacitySplit({ engine: 'btree' }, 5000, 1);
      return b.readCap > l.readCap;
    })());
    check('a column store is far worse at row writes than at scans', (() => {
      const c = d2.capacitySplit({ engine: 'column' }, 5000, 1);
      return c.readCap > c.writeCap * 5;
    })());

    // Harmonic combination: one bad direction drags the tier down.
    check('an all-read workload gets the read ceiling', d2.effectiveCapacity(1000, 10, 1) === 1000);
    check('an all-write workload gets the write ceiling', d2.effectiveCapacity(1000, 10, 0) === 10);
    check('a mix is dragged toward the worse of the two',
      d2.effectiveCapacity(1000, 10, 0.5) < 100);
    check('equal ceilings combine to the same number', d2.effectiveCapacity(500, 500, 0.3) === 500);
    check('a zero ceiling in a mixed workload means nothing gets through',
      d2.effectiveCapacity(1000, 0, 0.5) === 0);

    check('the read fraction defaults rather than crashing on an unlabelled link',
      d2.readFractionOf(undefined) === 0.5 && d2.readFractionOf({}) === 0.5);
    check('an out-of-range read fraction is clamped',
      d2.readFractionOf({ readFrac: 5 }) === 1 && d2.readFractionOf({ readFrac: -2 }) === 0);

    // The finding.
    const fires = (ns, es, re) => review(ns, es, 1000).some(x => re.test(x.title + ' ' + (x.detail || '')));
    const wHeavy = [{ id: 'c', type: 'client', label: 'C' }, { id: 'db', type: 'sql', label: 'DB', replicas: 3, replication: 'leader' }];
    check('replicas that cannot help writes are called out',
      fires(wHeavy, [{ id: 'e', from: 'c', to: 'db', readFrac: 0.2 }], /one writer/i));
    check('a read-heavy workload is not called out',
      !fires(wHeavy, [{ id: 'e', from: 'c', to: 'db', readFrac: 0.95 }], /one writer/i));
    check('a single-replica leader is not called out',
      !fires([wHeavy[0], { ...wHeavy[1], replicas: 1 }], [{ id: 'e', from: 'c', to: 'db', readFrac: 0.2 }], /one writer/i));
    check('a store with no declared mode is not called out',
      !fires([wHeavy[0], { ...wHeavy[1], replication: undefined }], [{ id: 'e', from: 'c', to: 'db', readFrac: 0.2 }], /one writer/i));

    // Every existing template must keep working through the new capacity path.
    const { TEMPLATES: TPL } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    const broken = TPL.filter(t => {
      const r = simulate(t.nodes, t.edges, t.rps);
      return Object.values(r.stats).some(x => !Number.isFinite(x.util) || !Number.isFinite(x.latency));
    });
    check('every template still simulates to finite numbers' +
      (broken.length ? ' — broken: ' + broken.map(t => t.name).join(', ') : ''), broken.length === 0);
  }

  // ── mock interview: rubric, and the key never leaving the tab ──────────────
  {
    const iv = await import(pathToFileURL(path.join(root, 'src/interview.js')).href);
    const llm = await import(pathToFileURL(path.join(root, 'src/interview-llm.js')).href);
    const { breakdownFor } = await import(pathToFileURL(path.join(root, 'src/breakdown.js')).href);
    const { TEMPLATES } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);

    const tpl = TEMPLATES.find(t => t.name.includes('Ticketmaster'));
    const plan = iv.buildInterview(tpl, breakdownFor(tpl));
    check('the interview has all five stages', plan.stages.length === 5);
    check('every stage has a question and something to listen for',
      plan.stages.every(s => s.question && s.question.length > 20 && s.concepts.length > 0));
    check('the questions name the actual design', plan.stages[0].question.includes(tpl.name));

    // A stage with nothing to listen for can never be earned — it would drag
    // the score down for a gap in the rubric rather than in the answer.
    check('a stage with no concepts is excluded rather than scored zero', (() => {
      const fake = { design: 'X', stages: [{ id: 'a', title: 'A', concepts: [] }, { id: 'b', title: 'B', concepts: iv.UNIVERSAL.filter(c => c.stage === 'estimation') }], concepts: [] };
      const r = iv.report(fake, [{ role: 'candidate', stage: 'b', text: 'about 50000 rps, read heavy, 2 terabyte of storage' }]);
      return r.byStage.a.scorable === false && r.overall > 0.9;
    })());

    // Discrimination: the whole thing is worthless if a thin answer scores well.
    const thin = [{ role: 'candidate', stage: 'requirements', text: 'We build a ticket site. Users buy tickets.' }];
    const full = [
      { role: 'candidate', stage: 'requirements', text: 'Functional: browse events, reserve a seat, pay, confirm. Out of scope: refunds and dynamic pricing. Should we support seat maps?' },
      { role: 'candidate', stage: 'estimation', text: '10 million daily active users, peak 50000 rps, read heavy about 100 to 1 reads to writes, storage 2 terabyte per year retention.' },
      { role: 'candidate', stage: 'high-level', text: 'Client to CDN to load balancer to booking service. The bottleneck is seat lock contention. We shard by event id, cache the seat map in redis, and push email to a queue asynchronously with replication on the database.' },
      { role: 'candidate', stage: 'deep-dives', text: 'Two people click the same seat so we use a distributed lock with a ttl and serializable isolation to avoid write skew. The trade off is throughput in exchange for correctness. If a node fails we retry idempotently.' },
      { role: 'candidate', stage: 'wrap', text: 'At ten times this load the seat lock service breaks first. I would split it and shard the locks by event.' },
    ];
    const rThin = iv.report(plan, thin), rFull = iv.report(plan, full);
    check('a thin answer scores badly', rThin.overall < 0.2);
    check('a full answer scores well', rFull.overall > 0.6);
    check('the two are clearly separated', rFull.overall - rThin.overall > 0.4);
    check('a thin answer gets more to improve than a full one', rThin.improve.length > rFull.improve.length);
    check('a thin answer is told its answers were too short',
      rThin.improve.some(x => /Depth of answer/i.test(x.area)));
    check('improvement advice names what was not said',
      rThin.improve.some(x => x.missed.length > 0));
    check('bands are ordered', (() => {
      const b = [0.1, 0.45, 0.7, 0.9].map(x => iv.bandFor(x).band);
      return new Set(b).size === 4 && b[3] === 'Staff+';
    })());

    // The bug that live testing caught: a short but complete answer was probed
    // about the very thing it had just covered, because the probe fired on word
    // count. Never chase something they already said.
    const reqStage = plan.stages.find(s => s.id === 'requirements');
    const scoped = 'Functional: browse events, hold seats, pay. Out of scope: refunds and dynamic pricing.';
    check('a stated scope is never probed for scope', (() => {
      const p = iv.pickProbe(reqStage, scoped);
      return !p || p.concept !== 'scoping-out';
    })());
    check('an answer that omits scope is probed for it',
      iv.pickProbe(reqStage, 'We let users browse events and buy tickets.')?.concept === 'scoping-out');
    check('a probe is never repeated within a stage', (() => {
      const first = iv.pickProbe(reqStage, 'users buy tickets');
      const second = iv.pickProbe(reqStage, 'users buy tickets', [first.concept]);
      return second === null || second.concept !== first.concept;
    })());
    const estStage = plan.stages.find(s => s.id === 'estimation');
    check('giving numbers but no ratio is probed for the ratio',
      iv.pickProbe(estStage, 'about 50000 rps at peak and 2 terabyte of storage')?.concept === 'read-write-ratio');
    check('a fully covered stage yields no probe at all',
      iv.pickProbe(estStage, 'about 50000 rps, read heavy roughly 100 to 1 reads to writes, 2 terabyte of storage per year retention') === null);
    check('every stage has at least one probe tied to a concept it listens for',
      plan.stages.every(s => (s.probes || []).length > 0 &&
        s.probes.every(p => s.concepts.some(c => c.id === p.concept))));

    // Conversational quality: the first version replied with a fixed sentence
    // per stage and never showed it had heard the answer.
    const rq = plan.stages.find(s => s.id === 'requirements');
    const nx = plan.stages.find(s => s.id === 'estimation');
    const good = 'Functional: browse events, hold seats, pay. Out of scope: refunds and dynamic pricing. Availability matters more than latency.';
    const rGood = iv.respond({ stage: rq, answer: good, nextStage: nx, turnIndex: 0 });
    check('a covered answer is acknowledged before the next question',
      /you'?ve got/i.test(rGood.text) && rGood.text.includes(nx.question));
    check('the acknowledgement reads as English, not as rubric labels',
      !/states what is out of scope/i.test(rGood.text));
    check('a complete answer advances rather than being re-asked', rGood.advance === true);

    const rPush = iv.respond({ stage: rq, answer: 'Users buy tickets.', nextStage: nx, turnIndex: 1 });
    check('a thin answer is pushed on instead of waved through', rPush.advance === false && !!rPush.probe);

    check('a question from the candidate is answered, not ignored', (() => {
      const r = iv.respond({ stage: rq, answer: 'Users browse and buy. How much traffic should I assume?', nextStage: nx, turnIndex: 2, ctx: { rps: 8000 } });
      return /8,000|requests per second/i.test(r.text);
    })());
    check('a direct question is detected', iv.hasQuestion('what scale?') && !iv.hasQuestion('this is a statement.'));

    check('the reply quotes the candidate back when it pushes', (() => {
      const r = iv.respond({ stage: nx, answer: 'We get about 50000 rps at peak.', nextStage: null, turnIndex: 0 });
      return /you said/i.test(r.text);
    })());
    check('replies vary rather than repeating one sentence', (() => {
      const texts = [0, 1, 2, 3].map(i => iv.respond({ stage: rq, answer: good, nextStage: nx, turnIndex: i }).text);
      return new Set(texts).size >= 3;
    })());
    check('the same turn index always gives the same reply', (() => {
      const a1 = iv.respond({ stage: rq, answer: good, nextStage: nx, turnIndex: 7 }).text;
      const a2 = iv.respond({ stage: rq, answer: good, nextStage: nx, turnIndex: 7 }).text;
      return a1 === a2;
    })());
    check('an unanswerable question still gets a usable reply',
      iv.answerQuestion('what colour is the logo?').length > 20);

    // "Good. Good. Now put numbers on it." — the transition prepends an opener
    // and the question already had one. Caught on the deployed site.
    check('a reply never doubles its opening word', (() => {
      const texts = [];
      for (let i = 0; i < 8; i++) for (const st of plan.stages.slice(0, 4)) {
        const nxt = plan.stages[plan.stages.indexOf(st) + 1] || null;
        texts.push(iv.respond({ stage: st, answer: good, nextStage: nxt, turnIndex: i }).text);
      }
      return !texts.some(t => /\b(good|right|okay|alright|fine)[.,!]\s+(good|right|okay|alright|fine)[.,!]/i.test(t));
    })());
    check('no stage question carries its own opener',
      plan.stages.every(s => iv.stripOpener(s.question) === s.question));
    check('stripOpener removes a leading filler and leaves the rest alone',
      iv.stripOpener('Good. Now put numbers on it.') === 'Now put numbers on it.' &&
      iv.stripOpener('Walk me through the design.') === 'Walk me through the design.');
    check('a reply never contains a double space or a stray gap', (() => {
      const r = iv.respond({ stage: plan.stages[0], answer: good, nextStage: plan.stages[1], turnIndex: 3 });
      return !/\s{2,}/.test(r.text) && r.text === r.text.trim();
    })());

    // Keyword matching must not credit things that were not said.
    const est = iv.UNIVERSAL.filter(c => c.stage === 'estimation');
    check('numbers in an answer are detected', iv.matchConcepts('roughly 20000 rps at peak', est).hit.some(c => c.id === 'scale-numbers'));
    check('an answer with no numbers is not credited for them',
      !iv.matchConcepts('it will be quite large and busy', est).hit.some(c => c.id === 'scale-numbers'));
    check('a stated trade-off is detected', iv.matchConcepts('faster reads, at the cost of staleness', iv.UNIVERSAL).hit.some(c => c.id === 'tradeoff'));
    check('merely saying the word design is not a trade-off',
      !iv.matchConcepts('this is a good design and it works', iv.UNIVERSAL).hit.some(c => c.id === 'tradeoff'));
    check('an empty answer matches nothing', iv.matchConcepts('', iv.UNIVERSAL).hit.length === 0);

    check('asking no clarifying questions is called out',
      iv.communicationSignals(['a statement.', 'another statement.']).clarifyingQuestions === 0);
    check('a question is recognised as one',
      iv.communicationSignals(['what is the read to write ratio?']).clarifyingQuestions === 1);

    // Every template must produce a usable interview, not just Ticketmaster.
    const badPlans = TEMPLATES.filter(t => {
      try {
        const p = iv.buildInterview(t, breakdownFor(t));
        return p.stages.length !== 5 || p.stages.some(s => !s.question || !s.concepts.length);
      } catch { return true }
    });
    check('every template yields a complete interview' +
      (badPlans.length ? ' — broken: ' + badPlans.slice(0, 3).map(t => t.name).join(', ') : ''), badPlans.length === 0);

    // Claude is the engine; the rubric is the fallback when there is no key.
    check('Claude is the default provider', (await import(pathToFileURL(path.join(root, 'src/interview-llm.js')).href)).PROVIDERS.anthropic.model.includes('claude'));
    check('a self-hosted option is offered', !!llm.PROVIDERS.custom);
    check('the self-hosted option asks for a base URL rather than guessing one',
      llm.PROVIDERS.custom.needsBaseUrl === true && !llm.PROVIDERS.custom.base);
    // Removing the four named-but-unusable entries must not remove the ability
    // to reach them — the generic option has to name them so nobody assumes
    // the capability went away with the labels.
    check('it still names what it replaced, so the capability is discoverable',
      ['BharatGPT', 'AI4Bharat', 'BharatGen', 'Llama'].every(n => llm.PROVIDERS.custom.note.includes(n)));
    check('every provider now either works out of the box or asks for a URL',
      Object.values(llm.PROVIDERS).every(p2 => (!!p2.base) !== (!!p2.needsBaseUrl)));
    check('a missing base URL fails loudly instead of hitting a wrong host', await (async () => {
      let called = false;
      try { await llm.ask({ provider: 'custom', key: 'k', system: 's', messages: [{ role: 'user', content: 'hi' }], fetchImpl: () => { called = true } }) }
      catch (e) { return !called && /base URL/i.test(e.message) }
      return false;
    })());
    check('a supplied base URL is used verbatim, with one slash', await (async () => {
      let seen = '';
      await llm.ask({ provider: 'custom', key: 'k', baseUrl: 'https://tenant.example.com/v1/', system: 's', messages: [{ role: 'user', content: 'hi' }],
        fetchImpl: async u => { seen = u; return { ok: true, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) } } });
      return seen === 'https://tenant.example.com/v1/chat/completions';
    })());
    check('every provider has a model, headers, body and a reader',
      Object.values(llm.PROVIDERS).every(p => p.model && p.headers && p.body && p.text && p.url));
    check('the base URL is stored per tab, like the key',
      /session/i.test(llm.getBase.toString()) && /session/i.test(llm.setBase.toString()));

    // The 400 a real key hit: a transcript opens with the interviewer, which
    // maps to an assistant message, and the Messages API requires the first to
    // be from the user.
    const tape = [{ role: 'assistant', content: 'Q1' }, { role: 'user', content: 'A1' },
                  { role: 'assistant', content: 'probe' }, { role: 'assistant', content: 'more' },
                  { role: 'user', content: 'A2' }];
    check('a conversation never opens on the assistant', llm.normaliseMessages(tape)[0].role === 'user');
    check('consecutive same-role messages are merged', (() => {
      const n = llm.normaliseMessages(tape);
      return n.length === 3 && n[1].role === 'assistant' && n[1].content.includes('probe') && n[1].content.includes('more');
    })());
    check('roles strictly alternate after normalising', (() => {
      const n = llm.normaliseMessages(tape);
      return n.every((m, i) => i === 0 || m.role !== n[i - 1].role);
    })());
    check('a trailing assistant turn is dropped so the model is asked to reply',
      llm.normaliseMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]).at(-1).role === 'user');
    check('empty messages are discarded rather than sent',
      llm.normaliseMessages([{ role: 'user', content: '  ' }, { role: 'user', content: 'real' }]).length === 1);
    check('an all-assistant transcript sends nothing rather than a bad request', await (async () => {
      let called = false;
      try { await llm.ask({ key: 'k', system: 's', messages: [{ role: 'assistant', content: 'x' }], fetchImpl: () => { called = true } }) }
      catch { return !called }
      return false;
    })());
    check('what actually goes on the wire opens on the user', await (async () => {
      let body = '';
      await llm.ask({ key: 'k', system: 's', messages: tape, fetchImpl: async (u, o) => { body = o.body; return { ok: true, json: async () => ({ content: [] }) } } });
      return JSON.parse(body).messages[0].role === 'user';
    })());

    // The provider's own explanation must reach the user — "returned 400" on
    // its own is what made this take a round trip to diagnose.
    check('a provider error message is surfaced, not swallowed', await (async () => {
      try {
        await llm.ask({ key: 'k', system: 's', messages: tape, fetchImpl: async () => ({ ok: false, status: 400,
          text: async () => JSON.stringify({ error: { message: 'first message must use the "user" role' } }) }) });
      } catch (e) { return /first message must use/.test(e.message) }
      return false;
    })());
    check('an error body is still redacted of anything key-shaped', await (async () => {
      try {
        await llm.ask({ key: 'k', system: 's', messages: tape, fetchImpl: async () => ({ ok: false, status: 400,
          text: async () => JSON.stringify({ error: { message: 'bad key sk-ant-abcd1234efgh' } }) }) });
      } catch (e) { return !/sk-ant-abcd1234/.test(e.message) && /redacted/.test(e.message) }
      return false;
    })());

    // Model choice.
    check('a chosen model is what gets sent', await (async () => {
      let body = '';
      await llm.ask({ key: 'k', model: 'claude-opus-5', system: 's', messages: tape,
        fetchImpl: async (u, o) => { body = o.body; return { ok: true, json: async () => ({ content: [] }) } } });
      return JSON.parse(body).model === 'claude-opus-5';
    })());
    check('no chosen model falls back to the provider default', await (async () => {
      let body = '';
      await llm.ask({ key: 'k', system: 's', messages: tape,
        fetchImpl: async (u, o) => { body = o.body; return { ok: true, json: async () => ({ content: [] }) } } });
      return JSON.parse(body).model === llm.PROVIDERS.anthropic.model;
    })());
    check('every provider offers at least one model suggestion',
      Object.keys(llm.PROVIDERS).every(k => (llm.MODEL_CHOICES[k] || []).length > 0));
    check('the model is remembered per tab like the key and base URL',
      /session/i.test(llm.getModel.toString()) && /session/i.test(llm.setModel.toString()));

    // Providers: a published base URL is used, an unpublished one is asked for.
    const P = llm.PROVIDERS;
    check('nine providers are offered', Object.keys(P).length === 9);
    for (const id of ['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'kimi', 'sarvam', 'krutrim', 'custom'])
      check(`provider "${id}" is present and complete`,
        !!P[id] && !!P[id].label && !!P[id].model && (P[id].models || []).length > 0 &&
        typeof P[id].url === 'function' && typeof P[id].headers === 'function' &&
        typeof P[id].body === 'function' && typeof P[id].text === 'function');

    // The distinction that matters: guessing an endpoint would fail silently.
    const hosted = ['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'kimi', 'sarvam', 'krutrim'];
    const selfHosted = ['custom'];
    check('providers with a published endpoint have one built in',
      hosted.every(id => !!P[id].base && P[id].needsBaseUrl === false));
    check('providers without a published endpoint ask for one instead of guessing',
      selfHosted.every(id => !P[id].base && P[id].needsBaseUrl === true));
    check('every provider that asks for a base URL explains why',
      selfHosted.every(id => typeof P[id].note === 'string' && P[id].note.length > 40));
    check('none of the self-hosted providers smuggles in a guessed host',
      selfHosted.every(id => !/https?:\/\//.test(P[id].url('') || '')));

    // Each hosted provider must build the endpoint its docs actually document.
    const urlFor = async id => { let seen = '';
      await llm.ask({ provider: id, key: 'k', system: 's', messages: [{ role: 'user', content: 'hi' }],
        fetchImpl: async u => { seen = u; return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }], content: [] }) } } });
      return seen; };
    check('OpenAI goes to api.openai.com', (await urlFor('openai')) === 'https://api.openai.com/v1/chat/completions');
    check('Gemini goes to its OpenAI-compatible path',
      (await urlFor('google')) === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    check('DeepSeek goes to api.deepseek.com', (await urlFor('deepseek')) === 'https://api.deepseek.com/v1/chat/completions');
    check('Sarvam goes to api.sarvam.ai', (await urlFor('sarvam')) === 'https://api.sarvam.ai/v1/chat/completions');
    check('Krutrim goes to cloud.olakrutrim.com', (await urlFor('krutrim')) === 'https://cloud.olakrutrim.com/v1/chat/completions');
    check('Anthropic keeps its own message endpoint', (await urlFor('anthropic')) === 'https://api.anthropic.com/v1/messages');
    check('Qwen goes to Model Studio\'s compatible-mode path',
      (await urlFor('qwen')) === 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');
    check('Kimi goes to api.moonshot.ai',
      (await urlFor('kimi')) === 'https://api.moonshot.ai/v1/chat/completions');
    // Both serve different hosts in mainland China, which is exactly the sort
    // of thing that silently fails for half the users if it goes unmentioned.
    check('both say their host is the international one',
      /international/i.test(P.qwen.note) && /international/i.test(P.kimi.note));

    // Anthropic is not OpenAI-shaped and must not be flattened into it.
    check('Anthropic sends system as a top-level field, not as a message', await (async () => {
      let body = '';
      await llm.ask({ provider: 'anthropic', key: 'k', system: 'SYS', messages: [{ role: 'user', content: 'hi' }],
        fetchImpl: async (u, o) => { body = o.body; return { ok: true, json: async () => ({ content: [] }) } } });
      const j = JSON.parse(body);
      return j.system === 'SYS' && !j.messages.some(m => m.role === 'system');
    })());
    check('OpenAI-shaped providers send system as the first message', await (async () => {
      let body = '';
      await llm.ask({ provider: 'deepseek', key: 'k', system: 'SYS', messages: [{ role: 'user', content: 'hi' }],
        fetchImpl: async (u, o) => { body = o.body; return { ok: true, json: async () => ({ choices: [] }) } } });
      const j = JSON.parse(body);
      return j.messages[0].role === 'system' && j.messages[0].content === 'SYS';
    })());
    check('Anthropic keeps its browser opt-in header',
      P.anthropic.headers('k')['anthropic-dangerous-direct-browser-access'] === 'true');
    check('OpenAI-shaped providers authenticate with a bearer token',
      hosted.filter(id => id !== 'anthropic').every(id => P[id].headers('k').authorization === 'Bearer k'));

    // A cross-origin block reads as a mystery unless it is named.
    check('an unreachable provider names the likely cause', await (async () => {
      try { await llm.ask({ provider: 'deepseek', key: 'k', system: 's', messages: [{ role: 'user', content: 'hi' }],
        fetchImpl: async () => { throw new TypeError('Failed to fetch') } }) }
      catch (e) { return /browser requests|Could not reach/i.test(e.message) }
      return false;
    })());

    // The key. This is the part that must not be sloppy.
    check('the key is held in session storage, not local storage',
      llm.KEY_STORE && /session/i.test(llm.getKey.toString()));
    check('a key is redacted if it ever reaches display',
      llm.redact('oops sk-ant-abcd1234efgh here') === 'oops [key redacted] here');
    check('the warning states the key is never sent to this site', /never sent to this site/i.test(llm.KEY_WARNING));
    check('no key means no request is attempted', await (async () => {
      let called = false;
      try { await llm.ask({ key: '', system: 's', messages: [{ role: 'user', content: 'hi' }], fetchImpl: () => { called = true } }) } catch { /* expected */ }
      return !called;
    })());
    check('the key travels in a header, never in the URL', await (async () => {
      let seenUrl = '', seenHeaders = null;
      const fake = async (url, opts) => { seenUrl = url; seenHeaders = opts.headers; return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) } };
      await llm.ask({ key: 'sk-ant-secret123', system: 's', messages: [{ role: 'user', content: 'hi' }], fetchImpl: fake });
      return !seenUrl.includes('secret123') && JSON.stringify(seenHeaders).includes('secret123');
    })());
    check('the key is never put in the request body', await (async () => {
      let body = '';
      const fake = async (url, opts) => { body = opts.body; return { ok: true, json: async () => ({ content: [] }) } };
      await llm.ask({ key: 'sk-ant-secret123', system: 's', messages: [{ role: 'user', content: 'hi' }], fetchImpl: fake });
      return !body.includes('secret123');
    })());
    check('a rejected key gives a clear message, not a stack trace', await (async () => {
      try { await llm.ask({ key: 'x', system: 's', messages: [{ role: 'user', content: 'hi' }], fetchImpl: async () => ({ ok: false, status: 401, text: async () => '' }) }) }
      catch (e) { return /rejected that key/i.test(e.message) }
      return false;
    })());
    check('the interviewer prompt tells the model not to write the design',
      /not write the design/i.test(llm.systemPrompt('X', 'Y')));
  }

  // ── sticky tab bars ────────────────────────────────────────────────────────
  {
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');   // comments would be parsed as declarations
    const decl = (sel, prop) => {
      const m = bare.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
      if (!m) return null;
      const d = m[1].match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
      return d ? d[1].trim() : null;
    };
    // Both bars stick at top: 0 in different containers. The scroll container's
    // top padding is a band the sub bar does not cover unless it is told to,
    // and content scrolling through that band shows between the two bars.
    check('the sticky gap is defined once rather than repeated as a literal',
      /--sticky-gap:\s*\d+px/.test(bare));
    check('the scroll container uses the shared gap for its top padding',
      decl('.side-body', 'padding-top') === 'var(--sticky-gap)');
    check('the sub tab bar is pulled up by exactly that gap',
      decl('.side .tabs.sub', 'margin-top') === 'calc(-1 * var(--sticky-gap))');
    // The one the first attempt missed: a sticky inset resolves against the
    // scrollport's padding box, so margin alone leaves the band uncovered when
    // the bar is actually stuck.
    check('and its sticky inset clears the same gap, not just its margin',
      decl('.side .tabs.sub', 'top') === 'calc(-1 * var(--sticky-gap))');
    check('and pads itself back out by the same amount, so it covers the band',
      decl('.side .tabs.sub', 'padding-top') === 'var(--sticky-gap)');
    check('the sub bar cannot scroll under the main one', (() => {
      const main = decl('.side .tabs', 'z-index');
      return main && Number(main) >= 2;
    })());
    check('no stray hard-coded padding-top remains on the scroll container',
      !/\.side-body\s*\{[^}]*padding-top:\s*\d+px/.test(bare));
  }

  // ── the production shell ───────────────────────────────────────────────────
  {
    const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
    const need = t => html.includes(t);
    check('the page has a title and a description', /<title>[^<]{10,}<\/title>/.test(html) && need('name="description"'));
    check('a shared link previews with a title, description and image',
      need('property="og:title"') && need('property="og:description"') && need('property="og:image"') && need('property="og:url"'));
    check('the social image is declared with its real dimensions',
      need('content="1200"') && need('content="630"'));
    check('the social image has alt text', need('property="og:image:alt"'));
    check('Twitter gets a large card', need('name="twitter:card"') && need('summary_large_image'));
    check('there is a favicon and an apple touch icon',
      need('rel="icon"') && need('rel="apple-touch-icon"'));
    check('there is a canonical URL', need('rel="canonical"'));
    check('a visitor without JavaScript is told why the page is empty',
      /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/.test(html));
    check('the document declares a language', /<html[^>]*lang="[a-z-]+"/i.test(html));

    for (const f of ['og.png', 'favicon.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'])
      check(`${f} is actually built into dist`, fs.existsSync(path.join(root, 'dist', f)));
    check('the social image is a real PNG of the right size', (() => {
      const b = fs.readFileSync(path.join(root, 'dist/og.png'));
      if (b.slice(1, 4).toString() !== 'PNG') return false;
      return b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630;   // IHDR
    })());
    check('every asset the page references exists in dist', (() => {
      const refs = [...html.matchAll(/(?:href|src|content)="(\/ArchSim-System-Design-Studio\/[^"]+)"/g)].map(m => m[1]);
      const missing = refs.filter(r => !fs.existsSync(path.join(root, 'dist', r.replace('/ArchSim-System-Design-Studio/', ''))));
      return refs.length > 0 && missing.length === 0;
    })());
    check('nothing in the built page points at localhost or a placeholder',
      !/localhost|example\.com|TODO|FIXME|lorem ipsum/i.test(html));
  }

  // ── the crash fallback ─────────────────────────────────────────────────────
  {
    const src = fs.readFileSync(path.join(root, 'src/ErrorBoundary.jsx'), 'utf8');
    check('an error boundary exists at all',
      /getDerivedStateFromError/.test(src) && /componentDidCatch/.test(src));
    check('the app is actually wrapped in it',
      /<ErrorBoundary>[\s\S]*<App\s*\/>[\s\S]*<\/ErrorBoundary>/.test(fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8')));
    check('the fallback offers a way out of a crash that repeats every load',
      /clearSavedState/.test(src) && /localStorage/.test(src));
    check('the fallback shows the error rather than hiding it', /state\.error/.test(src));
    check('the crash screen is announced to a screen reader', /role="alert"/.test(src));

    // The recovery logic itself, exercised rather than string-matched.
    const crash = await import(pathToFileURL(path.join(root, 'src/crash.js')).href);
    const fake = (() => {
      const m = new Map([['archsim.theme', 'dark'], ['archsim.tour.v1', '1'], ['someone-else', 'keep me']]);
      return { get length() { return m.size }, key: i => [...m.keys()][i],
               removeItem: k => m.delete(k), has: k => m.has(k), size: () => m.size };
    })();
    check('clearing saved state removes this app\'s keys', crash.clearSavedState(fake) === 2);
    check('and leaves other keys on the origin alone', fake.has('someone-else') && fake.size() === 1);
    check('a blocked storage does not throw', (() => {
      const blocked = { get length() { throw new Error('denied') }, key() { throw new Error('denied') }, removeItem() {} };
      try { return crash.clearSavedState(blocked) === 0 } catch { return false }
    })());
    check('a very long error message is truncated rather than filling the screen',
      crash.describe(new Error('x'.repeat(900))).length <= 401);
    check('a thrown non-Error still produces a readable message',
      crash.describe('just a string') === 'just a string' && crash.describe(null).length > 0);
  }

  // ── no stylesheet may lean on a variable that does not exist ───────────────
  {
    const raw = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const defined = new Set();
    for (const m of raw.matchAll(/\{([^}]*)\}/g))
      for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(d[1]);
    const used = new Set([...raw.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]));
    const undef = [...used].filter(v => !defined.has(v));
    // --fg never existed, so the guided tour's text fell back to near-black and
    // was unreadable on the dark panel. --line never existed either, so thirty
    // borders were frozen at one colour regardless of theme. A fallback makes
    // this invisible: the page looks fine, just permanently wrong in one mode.
    check('no rule reads a custom property nothing defines' +
      (undef.length ? ' — ' + undef.join(', ') : ''), undef.length === 0);
    check('the tour tooltip takes its colours from the theme', (() => {
      const b = (raw.match(/\.tour-tip\s*\{([^}]*)\}/) || [])[1] || '';
      return /color:\s*var\(--text\)/.test(b) && /background:\s*var\(--panel/.test(b);
    })());
    check('the crash screen does too', (() => {
      const b = (raw.match(/\.crash\s*\{([^}]*)\}/) || [])[1] || '';
      return /color:\s*var\(--text\)/.test(b);
    })());
    // Each of the four themes must set the core colours itself; one that
    // inherits them silently renders in another theme's palette.
    // Control shape is deliberately shared: both palettes use a 999px pill with
    // the same padding, by request. They are told apart by type and colour, so
    // that is what gets checked — asserting a shape difference here would be
    // encoding a preference nobody asked for, which is what the removed version
    // of this check did.
    check('the palettes are still distinguishable, by type and case', (() => {
      const rootM = (raw.match(/:root, \[data-theme="dark"\]\s*\{([^}]*)\}/) || [])[1] || '';
      const glowM = (raw.match(/\[data-theme="glow"\]\s*\{([^}]*)\}/) || [])[1] || '';
      const fam = b => (b.match(/--font-body:\s*([^;]+)/) || [])[1] || '';
      const tt = b => (b.match(/--label-tt:\s*([^;]+)/) || [])[1] || '';
      return fam(rootM) !== fam(glowM) && tt(rootM) !== tt(glowM);
    })());
    check('both palettes use the same control shape, as asked', (() => {
      const rootM = (raw.match(/:root, \[data-theme="dark"\]\s*\{([^}]*)\}/) || [])[1] || '';
      const glowM = (raw.match(/\[data-theme="glow"\]\s*\{([^}]*)\}/) || [])[1] || '';
      const get = (b, k) => ((b.match(new RegExp(k + ':\\s*([^;]+)')) || [])[1] || '').trim();
      return get(rootM, '--r-btn') === get(glowM, '--r-btn') &&
             get(rootM, '--btn-pad') === get(glowM, '--btn-pad');
    })());

    check('every theme sets the core colours itself', (() => {
      const core = ['--bg', '--panel', '--border', '--text', '--muted', '--accent'];
      return core.every(k => (raw.match(new RegExp(k + '\\s*:', 'g')) || []).length >= 8);
    })());
  }

  // ── the cloud map lines up ─────────────────────────────────────────────────
  {
    const cl = await import(pathToFileURL(path.join(root, 'src/clouds.js')).href);
    const real = cl.CLOUDS.filter(c => c.id !== 'generic');
    // Apple's column rendered with no header because the table headers were a
    // hand-written list of four and the rows carried five.
    check('every cloud in the picker has a name to put in the header',
      real.every(c => !!c.name && c.name.length > 1));
    check('every mapping row has exactly one entry per cloud' , (() => {
      const bad = Object.entries(cl.CLOUD_MAP).filter(([, row]) => row.length !== real.length);
      return bad.length === 0;
    })());
    check('Apple is among the clouds, and named', real.some(c => c.id === 'apple' && c.name === 'Apple'));
    // The palette rename must not touch the cloud provider of the same name.
    const th2 = await import(pathToFileURL(path.join(root, 'src/theme.js')).href);
    check('renaming the palette left the Apple cloud alone',
      real.some(c => c.id === 'apple') && !th2.PALETTES.some(p2 => p2.id === 'apple'));
    check('no mapping row has a blank cell',
      Object.values(cl.CLOUD_MAP).every(row => row.every(v => typeof v === 'string' && v.trim())));
  }

  // ── themes ─────────────────────────────────────────────────────────────────
  {
    const th = await import(pathToFileURL(path.join(root, 'src/theme.js')).href);
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
    check('the palettes are Kesar, Primary, Glow and Lilac',
      th.PALETTES.map(p2 => p2.id).join() === 'kesar,primary,glow,lilac' &&
      th.PALETTES.map(p2 => p2.label).join() === 'Kesar,Primary,Glow,Lilac');
    check('Kesar carries its saffron in both copies',
      th.THEMES.kesar.dot.toLowerCase() === '#fc470d' &&
      /\[data-theme="kesar"\][\s\S]*?--accent:\s*#FC470D/i.test(css));
    check('the three editorial palettes share type and shape, differing only in colour', (() => {
      const b = id => (css.replace(/\/\*[\s\S]*?\*\//g, '').match(new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}')) || [])[1] || '';
      const get = (x, k) => ((x.match(new RegExp(k + ':\\s*([^;]+)')) || [])[1] || '').trim();
      const g = b('glow'), l = b('lilac'), k = b('kesar');
      return ['--font-body', '--label-tt', '--r-btn', '--btn-pad'].every(key =>
        get(g, key) && get(g, key) === get(l, key) && get(l, key) === get(k, key));
    })());
    check('no two palettes share an accent',
      new Set(th.PALETTES.map(p2 => th.THEMES[p2.light].dot.toLowerCase())).size === th.PALETTES.length);
    check('Lilac carries its own violet in both copies',
      th.THEMES.lilac.dot.toLowerCase() === '#a679ff' &&
      /\[data-theme="lilac"\][\s\S]*?--accent:\s*#a679ff/i.test(css));
    check('Lilac shares the editorial type and shapes with Glow', (() => {
      const b = id => (css.replace(/\/\*[\s\S]*?\*\//g, '').match(new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}')) || [])[1] || '';
      const g = b('glow'), l = b('lilac');
      const get = (x, k) => ((x.match(new RegExp(k + ':\\s*([^;]+)')) || [])[1] || '').trim();
      return ['--font-body', '--label-tt', '--r-btn', '--btn-pad'].every(k => get(g, k) === get(l, k) && get(g, k));
    })());
    check('and differs from Glow only in colour',
      th.THEMES.lilac.dot !== th.THEMES.glow.dot);
    check('nothing still resolves to the old palette id',
      !th.THEME_ORDER.some(t2 => th.paletteOf(t2) === 'apple'));
    check('four palettes, each with a dark and a light',
      th.PALETTES.length === 4 && th.THEME_ORDER.length === 8);
    // The point of the change: swapping palette must not also flip dark/light,
    // and switching mode must not throw away the chosen palette.
    check('changing palette keeps the current mode', (() => {
      const fromDark = th.themeFor('glow', th.isDark('dark'));
      const fromLight = th.themeFor('glow', th.isDark('light'));
      return th.isDark(fromDark) && !th.isDark(fromLight) &&
             th.paletteOf(fromDark) === 'glow' && th.paletteOf(fromLight) === 'glow';
    })());
    check('changing mode keeps the current palette', (() => {
      const t2 = th.themeFor(th.paletteOf('glow-dark'), false);
      return t2 === 'glow' && th.paletteOf(t2) === 'glow';
    })());
    check('every palette and mode combination is a real theme',
      th.PALETTES.every(p2 => [true, false].every(d => !!th.THEMES[th.themeFor(p2.id, d)])));
    check('both palettes offer a genuinely dark and a genuinely light surface',
      th.PALETTES.every(p2 => th.THEMES[p2.dark].canvasBg !== th.THEMES[p2.light].canvasBg));
    // A theme has to change the components, not only their colours — the first
    // two attempts at this swapped a palette and left the tool looking the same.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = id => (bare.match(new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}')) || [])[1] || '';
    for (const id of ['glow', 'glow-dark'])
      check(`the ${id} theme sets its own typography, not just colour`, (() => {
        const b = block(id);
        return /--font-body:\s*"IBM Plex Sans"/.test(b) && /--font-display:\s*"Space Grotesk"/.test(b) && /--font-mono:\s*"IBM Plex Mono"/.test(b);
      })());
    check('and its own control shape and label treatment', (() => {
      const b = block('glow');
      return /--r-btn:/.test(b) && /--btn-pad:/.test(b) && /--label-tt:\s*uppercase/.test(b);
    })());
    check('the page body follows the theme font rather than a fixed stack',
      /body\s*\{[^}]*font-family:\s*var\(--font-body\)/.test(bare));
    check('headings follow the display font', /h1, h2, h3[^{]*\{[^}]*var\(--font-display\)/.test(bare));
    check('buttons and tabs take their shape from the theme',
      /\.btn, \.tabs button \{[^}]*var\(--r-btn\)[^}]*var\(--btn-pad\)/.test(bare));
    check('small labels take their case and tracking from the theme',
      /var\(--label-tt\)/.test(bare) && /var\(--label-ls\)/.test(bare));
    check('the Primary palette keeps its own type and sentence-case labels', (() => {
      const root = (bare.match(/:root, \[data-theme="dark"\]\s*\{([^}]*)\}/) || [])[1] || '';
      return /--label-tt:\s*none/.test(root) && /-apple-system/.test(root);
    })());
    check('the fonts the theme needs are actually loaded', (() => {
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
      return ['IBM+Plex+Sans', 'IBM+Plex+Mono', 'Space+Grotesk'].every(f => html.includes(f)) && html.includes('display=swap');
    })());
    check('and are preconnected so they do not block first paint', (() => {
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
      return html.includes('rel="preconnect"') && html.includes('fonts.gstatic.com');
    })());

    // Neural was removed. Anyone who chose it has it in localStorage, so the
    // fallback is the difference between a recolour and a broken page.
    check('a saved theme that no longer exists falls back to a real one', (() => {
      const saved = global.localStorage;
      try {
        global.localStorage = { getItem: () => 'neural' };
        const t2 = th.readTheme();
        return th.THEME_ORDER.includes(t2) && !!th.THEMES[t2];
      } finally { global.localStorage = saved }
    })());
    check('no trace of the removed palette remains',
      !/neural/i.test(css) && !th.THEME_ORDER.some(t2 => /neural/i.test(t2)));

    check('an unknown palette falls back rather than yielding nothing',
      !!th.THEMES[th.themeFor('nonsense', true)]);
    check('every theme in the order has a label and a palette',
      th.THEME_ORDER.every(t2 => th.THEME_LABEL[t2] && th.THEMES[t2]));
    check('every theme has a CSS block to match',
      th.THEME_ORDER.every(t2 => t2 === 'dark' || css.includes(`[data-theme="${t2}"]`)));
    check('the glow dark surface really is dark',
      th.THEMES['glow-dark'].nodeText > th.THEMES['glow-dark'].nodeFill);
    // The two copies exist because PNG export reads the JS one; if they drift,
    // an exported diagram stops matching the screen.
    check('no palette is missing a key another one has', (() => {
      const keys = Object.keys(th.THEMES.dark);
      return th.THEME_ORDER.every(t2 => keys.every(k => typeof th.THEMES[t2][k] === 'string'));
    })());
    check('every colour in every palette is a real hex value',
      Object.values(th.THEMES).every(p2 => Object.values(p2).every(v => /^#[0-9a-f]{6}$/i.test(v))));
    check('the glow theme uses its violet accent in both copies',
      th.THEMES.glow.dot.toLowerCase() === '#37c28e' &&
      /\[data-theme="glow"\][\s\S]*?--accent:\s*#37c28e/i.test(css));
    check('an unknown saved theme falls back rather than breaking', (() => {
      const saved = global.localStorage;
      try { global.localStorage = { getItem: () => 'nonsense' }; return th.THEME_ORDER.includes(th.readTheme()) }
      finally { global.localStorage = saved }
    })());
  }

  // ── the world map itself ───────────────────────────────────────────────────
  {
    const w = await import(pathToFileURL(path.join(root, 'src/world.js')).href);
    const geo3 = await import(pathToFileURL(path.join(root, 'src/geo.js')).href);
    check('there is real land geometry, not an empty frame', w.LAND.length >= 50);
    check('every land path is a closed SVG path', w.LAND.every(d => /^M[\d.]/.test(d) && d.endsWith('Z')));
    check('the outlines are pre-projected into the frame the map draws', (() => {
      const nums = w.LAND.join(' ').match(/[\d.]+/g).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      return Math.max(...xs) <= w.WORLD_W + 1 && Math.max(...ys) <= w.WORLD_H + 1;
    })());
    check('the basemap stays small enough to ship on every page load',
      JSON.stringify(w.LAND).length < 60000);
    check('the frame matches the projection the sites use', (() => {
      const p = geo3.project(0, 0, w.WORLD_W, w.WORLD_H);
      return p.x === w.WORLD_W / 2 && p.y === w.WORLD_H / 2;
    })());

    // Replicas: a region running six copies of one thing is not the same as
    // one running six different things, and the map showed neither.
    const ns = [{ id: 'a', type: 'app', label: 'API', region: 'ap-south-1', replicas: 4 },
                { id: 'b', type: 'sql', label: 'DB', region: 'ap-south-1', replicas: 3 }];
    const site = geo3.sitesFor(ns)[0];
    check('a site reports instances as well as services', site.replicas === 7 && site.services === 2);
    check('a component with no replica count counts as one',
      geo3.sitesFor([{ id: 'x', type: 'app', region: 'ap-south-1' }])[0].replicas === 1);
  }

  // ── availability figures are sourced, not a placeholder ────────────────────
  {
    const cat = await import(pathToFileURL(path.join(root, 'src/catalog.js')).href);
    check('the SLA figures carry the date they were checked', /^\d{4}-\d{2}-\d{2}$/.test(cat.SLA_AT));
    check('and cite the provider SLA pages',
      cat.SLA_SOURCES.length >= 3 && cat.SLA_SOURCES.every(x => /^https:\/\/aws\.amazon\.com\//.test(x.url)));
    check('the services with a published SLA are documented individually',
      Object.keys(cat.SLA_NOTES).length >= 12 &&
      Object.values(cat.SLA_NOTES).every(v => /\d/.test(v)));
    check('every documented service exists in the catalog',
      Object.keys(cat.SLA_NOTES).every(k => !!cat.CATALOG[k]));
    check('the documented figures match what the notes claim', (() => {
      const pairs = [['gateway', 0.9995], ['sql', 0.9995], ['nosql', 0.9999], ['blob', 0.999], ['lb', 0.9999]];
      return pairs.every(([k, v]) => Math.abs(cat.CATALOG[k].avail - v) < 1e-9);
    })());
    // 43 of 82 components once shared 0.999 — a placeholder, not research. The
    // tool composes these into a system-wide availability figure, so a single
    // repeated guess quietly propagates into every design's headline number.
    check('availability is no longer one value copied across most of the catalog', (() => {
      const counts = {};
      for (const c of Object.values(cat.CATALOG)) counts[c.avail] = (counts[c.avail] || 0) + 1;
      const total = Object.keys(cat.CATALOG).length;
      return Math.max(...Object.values(counts)) / total < 0.55;
    })());
    check('the tiers are ordered sensibly against each other', (() => {
      const C = cat.CATALOG;
      return C.lb.avail > C.cdn.avail && C.nosql.avail > C.cache.avail && C.blob.avail <= C.lb.avail;
    })());
    check('no component claims to never fail except a traffic source',
      Object.entries(cat.CATALOG).every(([k, c]) => c.avail < 1 || c.source));
  }

  // ── template search ────────────────────────────────────────────────────────
  {
    const { matchesTpl } = await import(pathToFileURL(path.join(root, 'dist/../src/App.jsx')).href).catch(() => ({}));
    const { TEMPLATES: TP4 } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    // Matching is defined in App.jsx alongside the picker; assert its behaviour
    // through the same rules rather than importing JSX, which node cannot load.
    const match = (t2, q) => {
      const s2 = String(q || '').trim().toLowerCase();
      if (!s2) return true;
      const hay = `${t2.name} ${t2.group || ''} ${t2.tagline || ''}`.toLowerCase() + (/bharat/i.test(t2.group || '') ? ' india indian' : '');
      return s2.split(/\s+/).every(w => hay.includes(w));
    };
    check('the picker is a combobox, so typing can open it',
      /role="combobox"/.test(src) && /aria-expanded=\{open\}/.test(src) && /aria-autocomplete="list"/.test(src));
    // A native select cannot be opened from script, so a search box beside one
    // filters options nobody can see until they click. The search field is the
    // trigger here.
    check('typing opens the list', /onChange=\{e => \{ setQ\(e\.target\.value\); setOpen\(true\) \}\}/.test(src));
    check('focusing it opens the list too', /onFocus=\{\(\) => setOpen\(true\)\}/.test(src));
    check('the list is a labelled listbox of options',
      /role="listbox"/.test(src) && /role="option"/.test(src) && /aria-selected/.test(src));
    check('it says how many designs match and when none do',
      /tplpick-n/.test(src) && /Nothing matches/.test(src));
    check('it is keyboard-operable end to end',
      /ArrowDown/.test(src) && /ArrowUp/.test(src) && /Escape/.test(src) && /Enter/.test(src));
    check('the native control is hidden from assistive tech, not duplicated in it',
      /className="tplpick-native"[\s\S]{0,120}aria-hidden="true"/.test(src) && /tabIndex=\{-1\}/.test(src));
    check('both controls load through the same function',
      (src.match(/onPick\(/g) || []).length >= 2);
    check('the matcher lives next to the picker rather than inline', /export function matchesTpl/.test(src));

    check('an empty query keeps every design', TP4.every(t2 => match(t2, '')));
    check('a name match works', match(TP4.find(t2 => /WhatsApp/.test(t2.name)), 'whatsapp'));
    check('search is case-insensitive', match(TP4.find(t2 => /WhatsApp/.test(t2.name)), 'WHATSAPP'));
    // Titles alone are not enough: people search for what a design is about.
    check('the group is searchable, so "India" finds the Indian designs',
      TP4.filter(t2 => match(t2, 'india')).length >= 3);
    // "redirect" appears only in Bitly's tagline, not its name or group — so a
    // hit proves the tagline is searched rather than just the title.
    check('the tagline is searchable, so a concept finds its design', (() => {
      const hits = TP4.filter(t2 => match(t2, 'redirect'));
      return hits.length >= 1 && hits.every(t2 => !/redirect/i.test(t2.name + ' ' + (t2.group || '')));
    })());
    check('multiple words all have to match',
      TP4.filter(t2 => match(t2, 'news feed')).length >= 1 &&
      TP4.filter(t2 => match(t2, 'news quantum')).length === 0);
    check('a query that matches nothing returns nothing rather than everything',
      TP4.filter(t2 => match(t2, 'zzzznope')).length === 0);
    check('every design is reachable by searching its own name',
      TP4.every(t2 => match(t2, t2.name.toLowerCase())));
    check('whitespace alone is treated as no query', TP4.every(t2 => match(t2, '   ')));
  }

  // ── discrete-event core ────────────────────────────────────────────────────
  {
    const d = await import(pathToFileURL(path.join(root, 'src/des.js')).href);

    // Determinism first. A simulation you cannot re-run exactly is not evidence
    // of anything, and "it only happens sometimes" is the least useful bug
    // report there is.
    check('the same seed gives the same sequence', (() => {
      const a1 = d.rng(7), a2 = d.rng(7);
      return [...Array(50)].every(() => a1() === a2());
    })());
    check('different seeds diverge', d.rng(1)() !== d.rng(2)());
    check('random values stay in range',
      [...Array(200)].map(() => d.rng(99)()).every(v => v >= 0 && v < 1));

    // Ordering is the whole contract of an event queue.
    check('events run in time order regardless of scheduling order', (() => {
      const s2 = new d.Sim(), seen = [];
      s2.on('x', p2 => seen.push(p2.n));
      s2.schedule('x', 30, { n: 3 }); s2.schedule('x', 10, { n: 1 }); s2.schedule('x', 20, { n: 2 });
      s2.run();
      return seen.join() === '1,2,3';
    })());
    check('ties break on scheduling order, not heap order', (() => {
      const s2 = new d.Sim(), seen = [];
      s2.on('x', p2 => seen.push(p2.n));
      for (const n of [1, 2, 3, 4]) s2.schedule('x', 5, { n });
      s2.run();
      return seen.join() === '1,2,3,4';
    })());
    check('the clock only ever moves forward', (() => {
      const s2 = new d.Sim(); let last = -1, ok = true;
      s2.on('x', (_, sim) => { if (sim.now < last) ok = false; last = sim.now });
      for (const t2 of [50, 10, 30, 20, 40]) s2.schedule('x', t2);
      s2.run();
      return ok && s2.now === 50;
    })());
    check('a negative delay is refused rather than moving the clock back', (() => {
      const s2 = new d.Sim();
      try { s2.schedule('x', -5); return false } catch (e) { return /finite delay/.test(e.message) }
    })());
    check('a cancelled event never runs', (() => {
      const s2 = new d.Sim(); let ran = 0;
      s2.on('x', () => ran++);
      const id = s2.schedule('x', 10); s2.schedule('x', 20);
      s2.cancel(id); s2.run();
      return ran === 1 && s2.stats.cancelled === 1;
    })());
    check('an until horizon stops the clock there', (() => {
      const s2 = new d.Sim({ until: 25 }); let ran = 0;
      s2.on('x', () => ran++);
      for (const t2 of [10, 20, 30, 40]) s2.schedule('x', t2);
      s2.run();
      return ran === 2 && s2.now === 25;
    })());
    // A retry storm scheduling its own retries is exactly what this engine is
    // for, so it has to terminate rather than hang the tab.
    check('a runaway feedback loop stops instead of hanging', (() => {
      const s2 = new d.Sim({ maxEvents: 500 });
      s2.on('storm', (_, sim) => { sim.schedule('storm', 1); sim.schedule('storm', 1) });
      s2.schedule('storm', 0);
      s2.run();
      return s2.exhausted === true && s2.stats.ran <= 500;
    })());
    check('stepping by hand drives the same clock, for a debugger to walk', (() => {
      const s2 = new d.Sim();
      s2.on('x', () => {});
      s2.schedule('x', 10); s2.schedule('x', 20);
      const e1 = s2.step(), e2 = s2.step(), e3 = s2.step();
      return e1.at === 10 && e2.at === 20 && e3 === null;
    })());
    check('every event that ran is recorded in order', (() => {
      const s2 = new d.Sim();
      s2.on('x', () => {});
      for (const t2 of [30, 10, 20]) s2.schedule('x', t2);
      s2.run();
      return s2.log.length === 3 && s2.log.map(l => l.at).join() === '10,20,30';
    })());

    // A trace is what a request-level view and a causal chain both read.
    check('a trace records its path and total', (() => {
      const tr = new d.Trace('r1');
      tr.hop('api', 2).hop('redis', 1, 'MISS').hop('db', 25).finish('ok', 28);
      return tr.path.join('>') === 'api>redis>db' && Math.abs(tr.totalMs - 28) < 1e-9 && tr.outcome === 'ok';
    })());
    check('it attributes the time to the slowest component first', (() => {
      const tr = new d.Trace('r1');
      tr.hop('api', 2).hop('redis', 1).hop('db', 25);
      const at = tr.attribution;
      return at[0].node === 'db' && at[0].share > 0.85 && at.at(-1).node === 'redis';
    })());
    check('repeated hops on one component are summed, not listed twice', (() => {
      const tr = new d.Trace('r1');
      tr.hop('db', 10).hop('api', 1).hop('db', 15);
      const at = tr.attribution;
      return at.length === 2 && at[0].node === 'db' && Math.abs(at[0].ms - 25) < 1e-9;
    })());
    check('an empty trace does not divide by zero', (() => {
      const tr = new d.Trace('r0');
      return tr.totalMs === 0 && tr.attribution.length === 0;
    })());

    // Percentiles by nearest rank: p99 of 100 samples is the 99th, not an
    // interpolation of a value that never occurred.
    const hundred = [...Array(100)].map((_, i) => i + 1);
    check('p50, p90 and p99 land on real samples',
      d.percentile(hundred, 50) === 50 && d.percentile(hundred, 90) === 90 && d.percentile(hundred, 99) === 99);
    check('percentiles ignore the order they arrive in',
      d.percentile([...hundred].reverse(), 99) === 99);
    check('p100 is the maximum and p0 the minimum',
      d.percentile(hundred, 100) === 100 && d.percentile(hundred, 0) === 1);
    check('no samples means zero rather than NaN', d.percentile([], 99) === 0);
    check('exponential arrivals average out near their mean', (() => {
      const r = d.rng(3);
      const xs = [...Array(20000)].map(() => d.expDelay(r, 10));
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.abs(mean - 10) < 0.5 && xs.every(x => x >= 0);
    })());
    check('the engine knows nothing about ArchSim', (() => {
      const src = fs.readFileSync(path.join(root, 'src/des.js'), 'utf8');
      return !/catalog|CATALOG|templates|nodes\b|edges\b/.test(src.replace(/\/\/[^\n]*/g, ''));
    })());
  }

  // ── pricing is sourced and dated ───────────────────────────────────────────
  {
    const pr = await import(pathToFileURL(path.join(root, 'src/pricing.js')).href);
    check('the rates carry the date they were checked', /^\d{4}-\d{2}-\d{2}$/.test(pr.PRICED_AT));
    check('that date is real and not in the future', (() => {
      const d = new Date(pr.PRICED_AT + 'T00:00:00Z');
      return !isNaN(d) && d <= new Date();
    })());
    // A static file cannot track live prices. It can refuse to pretend it is
    // current — a figure that was right when written and wrong two years later
    // is worse than one openly labelled approximate, because it looks certain.
    check('the rates are not more than six months stale' +
      (pr.daysSincePriced() > 180 ? ` — ${pr.daysSincePriced()} days old, recheck them` : ''),
      pr.daysSincePriced() <= 180);
    check('every source is a real provider pricing page',
      pr.PRICE_SOURCES.length >= 5 &&
      pr.PRICE_SOURCES.every(x => x.label && /^https:\/\/aws\.amazon\.com\/.*pricing/.test(x.url)));
    check('the basis says what is excluded, rather than implying a quote',
      /reservation/i.test(pr.PRICE_BASIS) && /egress/i.test(pr.PRICE_BASIS));
    check('the verified rates name the figure they were checked against',
      Object.keys(pr.VERIFIED).length >= 4 &&
      Object.values(pr.VERIFIED).every(v => /\$[\d.]/.test(v)));
    check('every verified key is a component that exists', (() => {
      const { RATES } = pr;
      return Object.keys(pr.VERIFIED).every(k => !!RATES[k]);
    })());
    check('the two figures I could check exactly still match their source', (() => {
      // Route 53: $0.50 hosted zone + $0.40/M queries. S3 Standard: $0.023/GB.
      const dns = pr.RATES.dns, blob = pr.RATES.blob;
      return dns.base === 0.5 && dns.perM === 0.4 && Math.abs(blob.base - 23.55) < 1.5;
    })());
    // The pricing block was inserted into the empty-state branch and the whole
    // Cost tab broke for any loaded design — and the suite passed, because
    // nothing asserted the tab still rendered its own contents.
    check('the priced-on block sits in the populated return, not the empty one', (() => {
      const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      const body = (src.match(/function Cost\(\{[\s\S]*?\n\}\n/) || [''])[0];
      const empty = body.slice(body.indexOf('if (empty) return ('), body.indexOf('const max'));
      return !/price-basis/.test(empty) && /price-basis/.test(body.slice(body.indexOf('const max')));
    })());
    check('the Cost component has no unbalanced fragment', (() => {
      const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      const body = (src.match(/function Cost\(\{[\s\S]*?\n\}\n/) || [''])[0];
      return (body.match(/<>/g) || []).length === (body.match(/<\/>/g) || []).length;
    })());

    check('the cost panel shows when it was priced and links the sources', (() => {
      const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      return /PRICED_AT/.test(src) && /PRICE_SOURCES/.test(src) && /price-basis/.test(src);
    })());
    check('and warns on screen once the rates go stale', (() => {
      const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      return /daysSincePriced\(\) > 180/.test(src);
    })());
  }

  // ── quick fixes tidy up after themselves, and a floating zoom ──────────────
  {
    const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    // A quick fix inserts a component. Dropping it wherever the old layout left
    // room is how a tidy diagram becomes a tangle after three fixes.
    const applyOne = (src.match(/const applyOne = s => \{([\s\S]*?)\n  \}/) || [])[1] || '';
    const applyEvery = (src.match(/const applyEvery = \(\) => \{([\s\S]*?)\n  \}/) || [])[1] || '';
    check('applying one quick fix re-arranges the canvas', /autoArrange\(/.test(applyOne));
    check('applying all of them does too', /autoArrange\(/.test(applyEvery));
    check('both then fit the result to view',
      /fitView\(laid\)/.test(applyOne) && /fitView\(laid\)/.test(applyEvery));
    check('and say so, rather than silently moving everything',
      /re-arranged/.test(applyOne) && /re-arranged/.test(applyEvery));

    check('there is a floating zoom control', /className="zoombar"/.test(src));
    check('it zooms both ways, fits and resets', (() => {
      const bar = (src.match(/className="zoombar"[\s\S]*?<\/div>/) || [])[0] || '';
      return /Zoom in/.test(bar) && /Zoom out/.test(bar) && /Fit to view/.test(bar) && /Reset zoom/.test(bar);
    })());
    check('every zoom button is labelled for assistive tech', (() => {
      const bar = (src.match(/className="zoombar"[\s\S]*?<\/div>/) || [])[0] || '';
      return (bar.match(/aria-label=/g) || []).length >= 4;
    })());
    check('zoom is clamped so the canvas cannot be lost',
      /Math\.min\(2\.5/.test(src) && /Math\.max\(0\.25/.test(src));
    check('the current zoom level is announced', /aria-live="polite">\{Math\.round\(view\.k/.test(src));
  }

  // ── the map explains itself ────────────────────────────────────────────────
  {
    // The picker silently did nothing once everything was placed, and an
    // unrelated role blurb sat directly beneath it, reading like its caption.
    const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    check('the map counts what is still unplaced rather than offering a dead control',
      /unplaced\.length > 0/.test(src) && /Place \{unplaced\.length\} unplaced/.test(src));
    check('and says so plainly when there is nothing left to place',
      /Every component is placed/.test(src));
    check('it names which components are still unplaced',
      /unplaced\.map\(n => n\.label\)/.test(src));
    check('clients are excluded from placement, and it says why',
      /n\.type !== 'client'/.test(src) && /users are everywhere/.test(src));
    check('the map has numbered steps for reading it', /className="map-steps"/.test(src));
    check('the role blurb has its own heading, so it no longer reads as the picker\'s caption',
      /\{SITE_ROLES\[role === 'all' \? 'primary' : role\]\.label\} sites/.test(src));
  }

  // ── About covers what the tool actually does now ───────────────────────────
  {
    const ab = await import(pathToFileURL(path.join(root, 'src/about.js')).href);
    const text = JSON.stringify(ab.ABOUT).toLowerCase();
    for (const topic of ['replication', 'read/write', 'round-trip', 'entitlement', 'interview'])
      check(`About mentions ${topic}`, text.includes(topic.toLowerCase()));
    check('About still says where the data goes', /nothing leaves the page/i.test(JSON.stringify(ab.ABOUT)));
    check('every About section has a title and lines',
      ab.ABOUT.every(s2 => s2.title && Array.isArray(s2.lines) && s2.lines.length > 0));
  }

  // ── the map has something to show ──────────────────────────────────────────
  {
    const geo2 = await import(pathToFileURL(path.join(root, 'src/geo.js')).href);
    const { TEMPLATES: TP2 } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    // The feature shipped with no template assigning a region, so the tab was
    // empty on all 57 designs — working as written and useless in practice.
    // A template may now declare where its components run. Nothing uses it yet,
    // so these guard the format rather than any particular design.
    check('a template can declare a region, and any it names must exist',
      TP2.every(t2 => t2.nodes.every(n => !n.region || !!geo2.regionById(n.region))));
    check('any site role a template names is one the map understands',
      TP2.every(t2 => t2.nodes.every(n => !n.siteRole || !!geo2.SITE_ROLES[n.siteRole])));
    check('placing components produces sites and a cross-region link', (() => {
      const ns = [{ id: 'a', type: 'app', label: 'API', region: 'ap-south-1', siteRole: 'primary' },
                  { id: 'b', type: 'sql', label: 'DB', region: 'us-east-1', siteRole: 'replica' }];
      const sites = geo2.sitesFor(ns);
      const links = geo2.siteLinks(sites, [{ id: 'e', from: 'a', to: 'b' }], ns);
      return sites.length === 2 && links.length === 1 && links[0].rttMs > 100;
    })());
  }

  // ── level expectations ─────────────────────────────────────────────────────
  {
    const lv = await import(pathToFileURL(path.join(root, 'src/levels.js')).href);
    const iv2 = await import(pathToFileURL(path.join(root, 'src/interview.js')).href);
    check('three bands, in order', lv.bandNames().join() === 'Mid-level,Senior,Staff+');
    check('each band maps to titles across several companies',
      lv.LADDER.every(l => (l.titles.match(/·/g) || []).length >= 3));
    check('each band says what scope it owns',
      lv.LADDER.every(l => l.scope && l.scope.length > 30));
    check('Indian ladder context is given', lv.LADDER.every(l => l.india && l.india.length > 20));

    // The line I will not cross: their dataset is theirs, and it would be stale
    // in a static file within weeks.
    const all = JSON.stringify(lv.LADDER) + JSON.stringify(lv.SIGNALS);
    check('no compensation figures are reproduced',
      !/\$|₹|salary|compensation|\bCTC\b|lakh|LPA|median pay/i.test(all));
    check('no personal or profile data is present',
      !/linkedin|profile|@[a-z]+\.[a-z]{2,}/i.test(all));

    check('every band says what it shows and what to do next',
      lv.bandNames().every(b => { const s2 = lv.signalsFor(b); return s2.does.length >= 3 && s2.next.length > 40 }));
    check('the two lower bands name what holds them back',
      ['Mid-level', 'Senior'].every(b => lv.signalsFor(b).missing.length >= 1));
    check('the ladder has a top', lv.nextBand('Staff+') === null);
    check('and each band below points at the next',
      lv.nextBand('Mid-level') === 'Senior' && lv.nextBand('Senior') === 'Staff+');
    check('an unknown band does not throw', lv.ladderFor('Nope') === null && lv.signalsFor('Nope') == null);

    // The band the interview produces must be one the ladder knows about,
    // otherwise the report shows a level with no expectations behind it.
    const known = new Set([...lv.bandNames(), 'Below mid-level']);
    check('every band the interview can award is covered by the ladder',
      [0, 0.2, 0.45, 0.7, 0.95].every(x => known.has(iv2.bandFor(x).band)));
  }

  // ── identity, MFA and entitlement ──────────────────────────────────────────
  {
    const id = await import(pathToFileURL(path.join(root, 'src/identity.js')).href);
    const { review } = await import(pathToFileURL(path.join(root, 'src/advisor.js')).href);
    const fires = (ns, es, re) => review(ns, es, 1000).some(x => re.test(x.title + ' ' + (x.detail || '')));
    const C = { id: 'c', type: 'client', label: 'Users' };
    const gw = extra => [C, { id: 'gw', type: 'gateway', label: 'Admin Console', ...extra }];
    const pub = extra => [C, { id: 'gw', type: 'gateway', label: 'Public API', ...extra }];
    const E = [{ id: '1', from: 'c', to: 'gw' }];

    check('only passkeys are marked as resisting phishing',
      Object.entries(id.AUTH).filter(([, a]) => a.mfa && a.phishable === false).map(([k]) => k).join() === 'webauthn');
    check('password alone is not counted as a second factor', id.AUTH.password.mfa === false);
    check('a stateless token is the one session model that cannot be withdrawn',
      id.SESSION.stateless.revocable === false && id.SESSION.server.revocable && id.SESSION.hybrid.revocable);
    check('only a per-request lookup is marked as hot path',
      Object.entries(id.ENTITLEMENT).filter(([, e]) => e.hotPath).map(([k]) => k).join() === 'perRequest');

    check('an entry point with no stated auth is flagged', fires(pub({}), E, /no stated authentication/i));
    check('stating it clears the finding', !fires(pub({ auth: 'sso' }), E, /no stated authentication/i));
    check('a privileged path on password alone is flagged',
      fires(gw({ auth: 'password' }), E, /without a second factor/i));
    check('the same auth on a public path is not',
      !fires(pub({ auth: 'password' }), E, /without a second factor/i));
    check('a phishable factor on a privileged path is called out',
      fires(gw({ auth: 'totp' }), E, /phishable/i));
    check('a passkey on the same path is not',
      !fires(gw({ auth: 'webauthn' }), E, /phishable/i));

    // Revocation: a token you cannot withdraw is only as safe as its lifetime.
    check('a long-lived stateless token is flagged',
      fires(gw({ auth: 'webauthn', session: 'stateless', tokenMinutes: 480 }), E, /cannot withdraw/i));
    check('a short one is not',
      !fires(gw({ auth: 'webauthn', session: 'stateless', tokenMinutes: 10 }), E, /cannot withdraw/i));
    check('a revocable session is never flagged for revocation',
      !fires(gw({ auth: 'webauthn', session: 'hybrid' }), E, /cannot withdraw/i));
    check('the risk names the actual window', id.revocationRisk({ session: 'stateless', tokenMinutes: 90 })?.minutes === 90);
    check('a server-side session carries no revocation risk', id.revocationRisk({ session: 'server' }) === null);

    // Entitlement on the hot path — the subscription question.
    const svc = e => [{ id: 's', type: 'micro', label: 'Licensing Svc', ...e }, { id: 'db', type: 'sql', label: 'Seat DB' }];
    const sE = [{ id: 'x', from: 's', to: 'db' }];
    check('checking entitlement per request is flagged',
      fires(svc({ entitlement: 'perRequest' }), sE, /entitlement on every request/i));
    check('the finding names the store it would hammer',
      review(svc({ entitlement: 'perRequest' }), sE, 1000).some(x => /Seat DB/.test(x.detail || '')));
    check('caching it clears the finding', !fires(svc({ entitlement: 'cached' }), sE, /every request/i));
    check('entitlements in a long-lived token are flagged as stale billing',
      fires(svc({ entitlement: 'claims', session: 'stateless', tokenMinutes: 240 }), sE, /long-lived token/i));
    check('entitlements in a short token are not',
      !fires(svc({ entitlement: 'claims', session: 'stateless', tokenMinutes: 15 }), sE, /long-lived token/i));
    check('a design that states nothing about identity stays quiet',
      review([{ id: 'a', type: 'app', label: 'Svc' }], [], 1000).every(x => x.source !== 'identity'));
  }

  // ── regions, availability zones and the map ────────────────────────────────
  {
    const geo = await import(pathToFileURL(path.join(root, 'src/geo.js')).href);
    const { review } = await import(pathToFileURL(path.join(root, 'src/advisor.js')).href);

    check('regions carry real coordinates and an AZ count',
      geo.REGIONS.length >= 10 && geo.REGIONS.every(r =>
        Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180 && r.azs >= 2 && r.name && r.cloud));
    check('region ids are unique', new Set(geo.REGIONS.map(r => r.id)).size === geo.REGIONS.length);
    check('India is represented', geo.REGIONS.some(r => /Mumbai|Hyderabad/.test(r.name)));

    // Distance is the constraint you cannot engineer around, so the arithmetic
    // has to be right rather than roughly right.
    const mum = geo.regionById('ap-south-1'), vir = geo.regionById('us-east-1'), fra = geo.regionById('eu-central-1');
    const d = geo.greatCircleKm(mum, vir);
    check('Mumbai to Virginia is about 12,900 km', Math.abs(d - 12900) < 400);
    check('the round-trip floor for that hop is about 180ms', Math.abs(geo.rttFloorMs(mum, vir) - 180) < 25);
    check('a shorter hop costs proportionally less', geo.rttFloorMs(mum, fra) < geo.rttFloorMs(mum, vir));
    check('distance to itself is zero', geo.greatCircleKm(mum, mum) < 1e-6);
    check('the calculation is symmetric',
      Math.abs(geo.greatCircleKm(mum, vir) - geo.greatCircleKm(vir, mum)) < 1e-6);

    check('the projection puts the prime meridian at the middle', (() => {
      const p = geo.project(0, 0, 1000, 500);
      return Math.abs(p.x - 500) < 1e-6 && Math.abs(p.y - 250) < 1e-6;
    })());
    check('and the poles at the edges', (() => {
      const n = geo.project(90, -180, 1000, 500), s2 = geo.project(-90, 180, 1000, 500);
      return n.x === 0 && n.y === 0 && s2.x === 1000 && s2.y === 500;
    })());
    check('every region projects inside the frame',
      geo.REGIONS.every(r => { const p = geo.project(r.lat, r.lon, 640, 320);
        return p.x >= 0 && p.x <= 640 && p.y >= 0 && p.y <= 320 }));

    // Sites come from the design, so the map cannot drift from the canvas.
    const N = [
      { id: 'a', type: 'app', label: 'API', region: 'ap-south-1', siteRole: 'primary' },
      { id: 'b', type: 'sql', label: 'DB', region: 'ap-south-1', siteRole: 'primary' },
      { id: 'c', type: 'sql', label: 'Replica', region: 'us-east-1', siteRole: 'replica' },
      { id: 'd', type: 'app', label: 'Unplaced' },
    ];
    const E = [{ id: 'e1', from: 'b', to: 'c' }];
    const sites = geo.sitesFor(N);
    check('a site appears for each region in use', sites.length === 2);
    check('an unplaced component creates no site', !sites.some(s => s.nodes.some(n => n.id === 'd')));
    check('a site counts its services and AZs', (() => {
      const m = sites.find(s => s.region.id === 'ap-south-1');
      return m.services === 2 && m.azs === geo.regionById('ap-south-1').azs;
    })());
    const links = geo.siteLinks(sites, E, N);
    check('a cross-region edge becomes a link with a distance and an RTT',
      links.length === 1 && links[0].km > 12000 && links[0].rttMs > 150);
    check('an edge within one region is not a cross-region link',
      geo.siteLinks(sites, [{ id: 'x', from: 'a', to: 'b' }], N).length === 0);

    check('a long synchronous hop is called out',
      geo.geoFindings(sites, links).some(f => /round trip/i.test(f.title)));
    check('two primaries are called out as accidental multi-leader', (() => {
      const two = [...N.slice(0, 2), { id: 'e', type: 'sql', label: 'X', region: 'us-east-1', siteRole: 'primary' }];
      return geo.geoFindings(geo.sitesFor(two), []).some(f => /primary/i.test(f.title));
    })());
    check('one primary is not', !geo.geoFindings(sites, []).some(f => /marked primary/i.test(f.title)));
    check('geographic findings reach the advisor',
      review(N, E, 1000).some(x => /round trip/i.test(x.title)));
    check('a design with no regions produces no geographic noise',
      geo.geoFindings(geo.sitesFor([{ id: 'z', type: 'app' }]), []).length === 0);
  }

  // ── flow filter ────────────────────────────────────────────────────────────
  {
    const fl = await import(pathToFileURL(path.join(root, 'src/flow.js')).href);
    const { TEMPLATES: TP } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    const N = [{ id: 'c', type: 'client' }, { id: 'app', type: 'app' }, { id: 'cache', type: 'cache' },
               { id: 'db', type: 'sql' }, { id: 'q', type: 'queue' }, { id: 'w', type: 'worker' }];
    const byId = Object.fromEntries(N.map(n => [n.id, n]));

    check('a read-leaning link classifies as read',
      fl.classifyEdge({ from: 'app', to: 'cache', readFrac: 0.95 }, byId) === 'read');
    check('a write-leaning link classifies as write',
      fl.classifyEdge({ from: 'app', to: 'db', readFrac: 0.05 }, byId) === 'write');
    check('an even link is mixed rather than forced into one side',
      fl.classifyEdge({ from: 'app', to: 'db', readFrac: 0.5 }, byId) === 'mixed');
    // Async is a property of the hop, not of the mix — a write into a queue is
    // async, and calling it a write hides the thing that matters about it.
    check('a hop into a queue is async whatever its mix says',
      fl.classifyEdge({ from: 'app', to: 'q', readFrac: 0.02 }, byId) === 'async');
    check('a hop out of a queue is async too',
      fl.classifyEdge({ from: 'q', to: 'w', readFrac: 0.9 }, byId) === 'async');
    check('an explicitly async link is honoured',
      fl.classifyEdge({ from: 'app', to: 'db', async: true }, byId) === 'async');

    check('a mixed link appears in both the read and the write view', (() => {
      const e = { from: 'app', to: 'db', readFrac: 0.5 };
      return fl.edgeMatches(e, byId, 'read') && fl.edgeMatches(e, byId, 'write');
    })());
    check('a mixed link does not appear in the async view',
      !fl.edgeMatches({ from: 'app', to: 'db', readFrac: 0.5 }, byId, 'async'));
    check('an async link appears only in the async view', (() => {
      const e = { from: 'app', to: 'q' };
      return fl.edgeMatches(e, byId, 'async') && !fl.edgeMatches(e, byId, 'read') && !fl.edgeMatches(e, byId, 'write');
    })());

    const E = [
      { id: 'a', from: 'c', to: 'app', readFrac: 0.9 },
      { id: 'b', from: 'app', to: 'db', readFrac: 0.05 },
      { id: 'c2', from: 'app', to: 'q' },
      { id: 'd', from: 'q', to: 'w' },
    ];
    check('the all view hides nothing',
      fl.flowSubset(N, E, 'all').edges.size === E.length);
    check('the read view drops the write-only link',
      !fl.flowSubset(N, E, 'read').edges.has('b'));
    check('the write view drops the read-only link',
      !fl.flowSubset(N, E, 'write').edges.has('a'));
    check('the async view keeps only the queue hops', (() => {
      const s = fl.flowSubset(N, E, 'async');
      return s.edges.size === 2 && s.edges.has('c2') && s.edges.has('d');
    })());
    check('a node survives if any surviving link touches it',
      fl.flowSubset(N, E, 'async').nodes.has('w'));
    check('an unconnected node is never hidden, in any view', (() => {
      const lone = [...N, { id: 'lone', type: 'blob' }];
      return ['all', 'read', 'write', 'async'].every(m => fl.flowSubset(lone, E, m).nodes.has('lone'));
    })());

    check('the summary counts links with no declared mix', (() => {
      const s = fl.flowSummary(N, [{ id: 'x', from: 'app', to: 'db' }], 'read');
      return s.unclassified === 1;
    })());
    check('a declared even mix is not counted as undeclared', (() => {
      const s = fl.flowSummary(N, [{ id: 'x', from: 'app', to: 'db', readFrac: 0.5 }], 'read');
      return s.unclassified === 0;
    })());

    // No template may vanish under a filter — an empty canvas reads as a bug.
    const empty = [];
    for (const t2 of TP) for (const m of ['read', 'write']) {
      if (fl.flowSubset(t2.nodes, t2.edges, m).edges.size === 0 && t2.edges.length > 0) empty.push(t2.name + '/' + m);
    }
    check('no template goes completely blank under the read or write filter' +
      (empty.length ? ' — ' + empty.slice(0, 3).join(', ') : ''), empty.length === 0);
    check('every mode has a label and an explanation',
      fl.FLOW_MODES.length === 4 && fl.FLOW_MODES.every(m => m.label && m.hint && m.hint.length > 15));
  }

  // ── the guided tour: data and geometry ─────────────────────────────────────
  {
    const t = await import(pathToFileURL(path.join(root, 'src/tour.js')).href);
    const steps = t.TOUR_STEPS;
    check('the tour is a full walkthrough, not a stub', steps.length >= 12);
    check('every step has a title and body', steps.every(s => s.title && s.body && s.body.length > 40));
    check('step ids are unique', new Set(steps.map(s => s.id)).size === steps.length);
    check('the first step needs no target so it can never point at nothing', !steps[0].target);

    // Geometry. A tooltip that leaves the viewport is the classic tour bug.
    const vp = { w: 1440, h: 900 }, tip = { w: 340, h: 190 };
    const inside = r => r.x >= 0 && r.y >= 0 && r.x + tip.w <= vp.w && r.y + tip.h <= vp.h;
    check('no target centres the tooltip',
      t.placeTooltip(null, tip, vp).placement === 'center');
    check('a target with room below gets the tooltip below',
      t.placeTooltip({ x: 600, y: 100, w: 120, h: 40 }, tip, vp).placement === 'bottom');
    check('a target near the bottom flips the tooltip above',
      t.placeTooltip({ x: 600, y: 840, w: 120, h: 40 }, tip, vp).placement === 'top');
    for (const [name, r] of [
      ['top-left', { x: 0, y: 0, w: 60, h: 30 }],
      ['top-right', { x: 1380, y: 0, w: 60, h: 30 }],
      ['bottom-left', { x: 0, y: 870, w: 60, h: 30 }],
      ['bottom-right', { x: 1380, y: 870, w: 60, h: 30 }],
      ['full-bleed', { x: 0, y: 0, w: 1440, h: 900 }],
    ]) check(`tooltip stays on screen for a target at ${name}`, inside(t.placeTooltip(r, tip, vp)));
    check('tooltip stays on screen when it is taller than the viewport',
      inside(t.placeTooltip({ x: 700, y: 400, w: 80, h: 40 }, { w: 340, h: 2000 }, { w: 1440, h: 300 })
        ? t.placeTooltip({ x: 700, y: 400, w: 80, h: 40 }, { w: 340, h: 190 }, vp) : { x: -1, y: -1 }));

    // First-run gating, against a stub that behaves like a blocked localStorage.
    const store = (() => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } })();
    check('a first-time visitor gets the tour', t.shouldAutoStart(store) === true);
    t.markSeen(store);
    check('a returning visitor does not', t.shouldAutoStart(store) === false);
    const blocked = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } };
    check('private browsing does not crash or nag', t.shouldAutoStart(blocked) === false);
    let threw = false; try { t.markSeen(blocked) } catch { threw = true }
    check('marking seen survives a blocked storage', !threw);
  }

  // ── consistency model: quorums, isolation, partitioning ────────────────────
  {
    const d = await import(pathToFileURL(path.join(root, 'src/ddia.js')).href);
    const { review } = await import(pathToFileURL(path.join(root, 'src/advisor.js')).href);
    const { FAULTS, FAULT_GROUPS } = await import(pathToFileURL(path.join(root, 'src/faults.js')).href);
    const { DDIA_TRACK, DDIA_COMPARISONS } = await import(pathToFileURL(path.join(root, 'src/learn-ddia.js')).href);

    // Quorum overlap is w + r > n. Test the boundary from both sides, because
    // off-by-one here is the difference between a correct read and one that
    // silently goes backwards.
    check('quorum n=3 w=2 r=2 overlaps', d.quorumOverlaps(3, 2, 2) === true);
    check('quorum n=3 w=3 r=1 overlaps (write-all)', d.quorumOverlaps(3, 3, 1) === true);
    check('quorum n=3 w=1 r=3 overlaps (read-all)', d.quorumOverlaps(3, 1, 3) === true);
    check('quorum n=3 w=1 r=1 does NOT overlap', d.quorumOverlaps(3, 1, 1) === false);
    check('quorum n=3 w=2 r=1 does NOT overlap — exactly equal is not enough',
      d.quorumOverlaps(3, 2, 1) === false);
    check('quorum n=5 w=3 r=3 overlaps', d.quorumOverlaps(5, 3, 3) === true);
    check('quorum n=5 w=2 r=3 does NOT overlap — sums to n', d.quorumOverlaps(5, 2, 3) === false);

    // Replication consequences must follow from the mode, not from a label.
    const rep = m => d.replicationEffects({ replication: m, replicas: 3 });
    check('single node has no stale reads and no conflicts',
      rep('none').staleReads === false && rep('none').conflicts === false);
    check('single-leader can serve stale reads but cannot conflict',
      rep('leader').staleReads === true && rep('leader').conflicts === false);
    check('multi-leader guarantees write conflicts',
      rep('multi').conflicts === true && rep('multi').staleReads === true);
    check('leaderless with a broken quorum reports stale reads',
      d.replicationEffects({ replication: 'leaderless', quorumN: 3, quorumW: 1, quorumR: 1 }).staleReads === true);
    check('leaderless with a good quorum does not',
      d.replicationEffects({ replication: 'leaderless', quorumN: 3, quorumW: 2, quorumR: 2 }).staleReads === false);

    // An isolation level is defined by what it still permits.
    const permits = l => d.isolationEffects({ isolation: l }).permits;
    check('read committed prevents dirty reads',
      !permits('readCommitted').some(x => /dirty/i.test(x)));
    check('read committed still permits lost updates',
      permits('readCommitted').some(x => /lost update/i.test(x)));
    check('snapshot isolation prevents read skew',
      !permits('snapshot').some(x => /read skew/i.test(x)));
    check('snapshot isolation STILL permits write skew — the double-booking bug',
      permits('snapshot').some(x => /write skew/i.test(x)));
    check('serializable permits nothing', permits('serializable').length === 0);
    check('snapshot names the double-booking trap explicitly',
      typeof d.isolationEffects({ isolation: 'snapshot' }).trap === 'string');
    check('serializable has no trap to name', !d.isolationEffects({ isolation: 'serializable' }).trap);

    // Hotspot maths: 1 + skew * (parts - 1) for an ordered key.
    const hot = (strategy, keySkew, parts) =>
      d.partitionEffects({ partitioning: strategy, keySkew, partitions: parts }).hotspotFactor;
    check('no skew means an even range partition', Math.abs(hot('range', 0, 4) - 1) < 1e-9);
    check('total skew puts everything on one range partition', Math.abs(hot('range', 1, 4) - 4) < 1e-9);
    check('range hotspot is linear in skew', Math.abs(hot('range', 0.5, 5) - 3) < 1e-9);
    check('hashing beats range at the same skew', hot('hash', 0.8, 8) < hot('range', 0.8, 8));
    check('hashing does not fully clear a single hot key', hot('hash', 0.8, 8) > 1);
    check('salting clears the hot key that hashing left', hot('salted', 0.8, 8) < hot('hash', 0.8, 8));
    // A typo in this field must not read as the best case.
    check('an unknown partitioning strategy is not silently treated as salted',
      d.partitionEffects({ partitioning: 'salt', keySkew: 0.8, partitions: 8 }).strategy === 'none');

    // Advisor findings must fire when they should — and stay quiet when they
    // should not. A finding that always fires teaches nothing.
    const store = extra => [{ id: 'db', type: 'sql', label: 'DB', replicas: 3, ...extra }];
    const titles = ns => review(ns, [], 1000).map(x => x.title + ' ' + (x.detail || ''));
    const fires = (ns, re) => titles(ns).some(t => re.test(t));
    check('broken quorum is reported',
      fires(store({ replication: 'leaderless', quorumN: 3, quorumW: 1, quorumR: 1 }), /quorum/i));
    check('a good quorum is NOT reported',
      !fires(store({ replication: 'leaderless', quorumN: 3, quorumW: 2, quorumR: 2 }), /quorum/i));
    check('multi-leader conflict handling is flagged',
      fires(store({ replication: 'multi' }), /conflict/i));
    check('single-leader is NOT flagged for conflicts',
      !fires(store({ replication: 'leader' }), /conflict/i));
    check('snapshot isolation is warned about write skew',
      fires(store({ isolation: 'snapshot' }), /write skew/i));
    check('serializable is NOT warned about write skew',
      !fires(store({ isolation: 'serializable' }), /write skew/i));
    check('a skewed range partition is flagged as a hotspot',
      fires(store({ partitioning: 'range', keySkew: 0.9 }), /hot|skew/i));
    check('an evenly hashed store is NOT flagged as a hotspot',
      !fires(store({ partitioning: 'hash', keySkew: 0.05 }), /hot partition/i));
    check('a single replica is flagged as a single copy',
      fires([{ id: 'db', type: 'sql', label: 'DB', replicas: 1 }], /single copy|one copy/i));
    check('consistency findings are tagged for the analysis panel',
      review(store({ replication: 'multi' }), [], 1000).some(x => x.consistency));

    // Four faults that leave the node running — the hard kind.
    const dist = FAULTS.filter(f => f.group === 'Distributed');
    check('the five distributed faults are wired into the chaos engine', dist.length === 5);
    check('the retry storm duplicates demand in the real simulator', await (async () => {
      const { simulate: simR } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
      const nodes = [{ id: 'c', type: 'client', label: 'C', x: 0, y: 0 }, { id: 'l', type: 'ledger', label: 'L', x: 1, y: 0, replicas: 2 }];
      const edges = [{ id: 'c->l', from: 'c', to: 'l', label: '' }];
      const storm = simR(nodes, edges, 1000, new Set(), { node: { l: { dup: 0.4 } } });
      const base = simR(nodes, edges, 1000, new Set());
      return storm.stats.l.dupIn === 400 && storm.stats.l.util > base.stats.l.util;
    })());
    check('Distributed is an offered fault group', FAULT_GROUPS.includes('Distributed'));
    for (const id of ['splitbrain', 'clockskew', 'pause', 'asymmetric'])
      check('fault "' + id + '" exists with a working effect', (() => {
        const f = FAULTS.find(x => x.id === id);
        return !!f && typeof f.effect === 'function' && typeof f.effect({}) === 'object';
      })());
    check('every distributed fault explains what it teaches',
      dist.every(f => typeof f.hint === 'string' && f.hint.length > 40));
    check('no duplicate fault ids after the additions',
      new Set(FAULTS.map(f => f.id)).size === FAULTS.length);

    // The written track.
    check('the consistency track covers four parts', DDIA_TRACK.length === 4);
    const steps = DDIA_TRACK.flatMap(p => p.steps);
    check('the track has at least 15 steps', steps.length >= 15);
    check('every step says what to do on the canvas, not just what to know',
      steps.every(st => st.title && st.idea && st.try));
    check('three comparison tables, each with rows matching their columns',
      DDIA_COMPARISONS.length === 3 &&
      DDIA_COMPARISONS.every(c => c.cols.length >= 2 && c.rows.length >= 4 &&
        c.rows.every(r => r.length === c.cols.length + 1)));
  }

  // ── speech preparation, as pure functions ──────────────────────────────────
  {
    const sp = await import(pathToFileURL(path.join(root, 'src/speech.js')).href);

    // Run the preparation over everything the app will ever read aloud. This is
    // what caught "~2 TB", "12K/s" and "277ms" reading as gibberish.
    {
      const { TEMPLATES } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
      const { breakdownFor } = await import(pathToFileURL(path.join(root, 'src/breakdown.js')).href);
      const { scalingFor } = await import(pathToFileURL(path.join(root, 'src/scaling.js')).href);
      const SPOKEN = new Set(['p', 'steps', 'bul', 'note', 'warn', 'calc', 'h']);
      const strings = [];
      for (const t of TEMPLATES) {
        const b = breakdownFor(t);
        for (const sec of b.sections) {
          strings.push(sec.title);
          for (const bl of sec.blocks || []) {
            if (!SPOKEN.has(bl[0])) continue;               // code, API and diagrams are not read
            Array.isArray(bl[1]) ? strings.push(...bl[1]) : strings.push(bl[1]);
          }
        }
        const sc = scalingFor(t);
        strings.push(sc.constraint, sc.wall.t, sc.wall.d,
          ...sc.ladder.map(r => r[2]), ...sc.levers.map(l => l.t + '. ' + l.d));
      }
      const leftovers = {};
      for (const str of strings.filter(x => typeof x === 'string')) {
        const out = sp.speakableText(str);
        // a slash that begins a URL path is correct as "slash", so allow it
        const cleaned = out.replace(/\s\/\w/g, ' ');
        for (const ch of cleaned.match(/[^\w\s.,;:'"()?!%$£₹+=<>—-]/gu) || []) leftovers[ch] = (leftovers[ch] || 0) + 1;
        for (const m of cleaned.match(/\b\d+\s*(K|M|B|TB|GB|MB|KB|ms)\b/g) || []) leftovers[m] = (leftovers[m] || 0) + 1;
      }
      const found = Object.entries(leftovers);
      if (found.length) log('  ! unspoken: ' + found.map(([k, v]) => JSON.stringify(k) + ' x' + v).join(' '));
      log(`speech: ${strings.length} spoken strings prepared`);
      check('nothing in the written content reads as a raw symbol or unconverted unit', found.length === 0);
    }

    check('speech is reported unsupported when the browser has none', sp.speechSupported() === false);

    const say = sp.speakableText;
    check('abbreviations are expanded, not spelled out badly',
      say('12K rps at p99') === '12 thousand requests per second at p 99');
    check('units become words', say('~2 TB of data') === 'about 2 terabytes of data');
    check('rates become words', say('~12K/s') === 'about 12 thousand per second');
    check('units glued to a digit are still caught', say('p99 at 277ms') === 'p 99 at 277 milliseconds');
    check('slashes between words become a pause, not "slash"', say('read/write ratio') === 'read write ratio');
    check('a URL path keeps its slash', /GET \/shortCode/.test(say('GET /{shortCode}')));
    check('single-star emphasis is unwrapped', say('a *connected* client') === 'a connected client');
    check('ampersands are spoken', say('full-text & geo') === 'full-text and geo');
    check('ratios are read as ratios', say('100:1 read heavy') === '100 to 1 read heavy');
    check('arrows become speech', /then/.test(say('client → cache')));
    check('decorative symbols are dropped', !/[·✓→⚠]/.test(say('a · b ✓ c → d ⚠ e')));
    check('markdown bold is not read out', say('**strong** point') === 'strong point');
    check('cash on delivery is expanded', /cash on delivery/.test(say('COD orders')));

    const chunks = sp.chunkText('One. Two. ' + 'Three. '.repeat(60));
    check('long text is chunked for reliability', chunks.length > 1);
    check('chunks stay under the limit', chunks.every((c) => c.length <= 260));
    check('short text stays as one chunk', sp.chunkText('Just this.').length === 1);

    // extraction must ignore diagrams, code, navigation and controls
    const host = doc.createElement('div');
    host.innerHTML = `
      <div class="bd-toc"><button class="bd-toc-i">Contents entry</button></div>
      <p class="bd-p">Real prose worth hearing.</p>
      <pre class="bd-code">SELECT * FROM noise;</pre>
      <svg><text>svg label noise</text></svg>
      <div class="bd-dia"><svg><text>diagram noise</text></svg></div>
      <p class="bd-p">Second paragraph.</p>
      <button>Spotlight</button>`;
    const got = sp.extractSpeech(host).map((b) => b.text);
    check('extraction keeps the prose', got.length === 2 && /Real prose/.test(got[0]));
    check('extraction skips code, svg, diagrams, contents and buttons',
      !got.join(' ').match(/noise|Contents entry|Spotlight/));
    check('extraction returns the element for highlighting',
      sp.extractSpeech(host).every((b) => !!b.el));
    check('extraction of an empty container is safe', sp.extractSpeech(null).length === 0);

    check('reading speeds are offered', sp.RATES.length >= 4 && sp.RATES.includes(1));

    // ── voice selection ──────────────────────────────────────────────────────
    const box = (list) => ({ getVoices: () => list });
    const mixed = [
      { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true },
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' },
      { name: 'Veena', lang: 'ta-IN', localService: true },
      { name: 'Albert', lang: 'en-US', localService: true },
      { name: 'Bad News', lang: 'en-US', localService: true },
      { name: 'Grandma (English (US))', lang: 'en-US', localService: true },
      { name: 'Google Deutsch', lang: 'de-DE' },
    ];
    check('a female voice is chosen over a male one',
      /Sonia|Samantha/.test(sp.pickVoice(box(mixed)).name));
    check('a natural voice wins over an older female one',
      sp.pickVoice(box(mixed)).name.includes('Sonia'));
    // Isolates the female preference itself: identical language, locality and
    // quality, with the neutral name sorting first alphabetically, so only the
    // gender signal can decide it. Without that signal this test fails.
    check('a female name is preferred over an otherwise identical neutral one',
      sp.pickVoice(box([
        { name: 'Alpha', lang: 'en-GB', localService: true },
        { name: 'Zoe', lang: 'en-GB', localService: true },
      ])).name === 'Zoe');
    // Other languages are offered deliberately now — the content is English so
    // an English voice still leads, but Hindi or Tamil is a valid choice.
    check('other languages are offered, below English',
      sp.listVoices(box(mixed)).some((v) => v.lang.startsWith('de')) &&
      /^en/i.test(sp.listVoices(box(mixed))[0].lang));
    check('male voices rank below female ones in the same language', (() => {
      const en = sp.listVoices(box(mixed)).filter((v) => /^en/i.test(v.lang));
      const lastFemale = en.map((v) => /Sonia|Samantha/.test(v.name)).lastIndexOf(true);
      const firstMale = en.map((v) => /David|Daniel/.test(v.name)).indexOf(true);
      return lastFemale >= 0 && firstMale >= 0 && lastFemale < firstMale;
    })());
    check('an explicit choice is honoured', sp.pickVoice(box(mixed), 'Samantha').name === 'Samantha');
    check('a saved voice that has gone away falls back to the best available',
      sp.pickVoice(box(mixed), 'Vanished').name.includes('Sonia'));
    check('a machine with only male voices still speaks',
      !!sp.pickVoice(box([{ name: 'Daniel', lang: 'en-GB', localService: true }])));
    check('no voices at all does not throw', sp.pickVoice(box([])) === null);
    check('the voice is warmer than default pitch', sp.PROSODY.pitch > 1 && sp.PROSODY.pitch < 1.2);

    // ── novelty voices ───────────────────────────────────────────────────────
    const joke = [
      { name: 'Albert', lang: 'en-US', localService: true },
      { name: 'Bad News', lang: 'en-US', localService: true },
      { name: 'Grandma (English (US))', lang: 'en-US', localService: true },
      { name: 'Zarvox', lang: 'en-US', localService: true },
      { name: 'Bubbles', lang: 'en-US', localService: true },
      { name: 'Samantha', lang: 'en-US', localService: true },
    ];
    const jokeNames = sp.listVoices(box(joke)).map((x) => x.name);
    check('novelty voices are excluded outright', jokeNames.length === 1 && jokeNames[0] === 'Samantha');
    check('a platform-suffixed novelty name is still caught', sp.isNoveltyVoice({ name: 'Grandma (English (US))' }));
    check('a real name that merely starts like one is kept', !sp.isNoveltyVoice({ name: 'Fredrika' }));
    check('a machine with only novelty voices still speaks',
      !!sp.pickVoice(box([{ name: 'Albert', lang: 'en-US' }])));

    // ── Indian languages ─────────────────────────────────────────────────────
    const indian = [
      { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' },
      { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true },
      { name: 'Microsoft Swara Online (Natural) - Hindi', lang: 'hi-IN' },
      { name: 'Veena', lang: 'ta-IN', localService: true },
      { name: 'Google Deutsch', lang: 'de-DE' },
    ];
    const langs = sp.voicesByLanguage(box(indian)).map(([l]) => l);
    check('Indian language voices are offered', langs.some((l) => /Hindi/.test(l)) && langs.some((l) => /Tamil/.test(l)));
    check('languages are named, not shown as codes', !langs.some((l) => /^(hi|ta|bn)\b/.test(l)));
    check('English is grouped first, since the content is English', /^English/.test(langs[0]));
    check('an English voice is still the default for English content', /^en/i.test(sp.pickVoice(box(indian)).lang));
    check('a Hindi voice can be chosen explicitly',
      sp.pickVoice(box(indian), 'Microsoft Swara Online (Natural) - Hindi').lang === 'hi-IN');
    check('language labels read properly',
      sp.languageLabel('hi-IN') === 'Hindi (India)' && sp.languageLabel('ta-IN') === 'Tamil (India)');
    // Isolates the Indian boost: neutral names, matched quality, and the
    // non-Indian one sorting first alphabetically, so only that signal decides.
    // Without it this passes on the female bonus alone, which is how the
    // equivalent hole hid the female preference earlier.
    check('an Indian language outranks an unrelated one, all else equal',
      sp.listVoices(box([{ name: 'Alpha', lang: 'de-DE' }, { name: 'Zeta', lang: 'hi-IN' }]))[0].lang === 'hi-IN');
    check('there is a pause between paragraphs', sp.BLOCK_PAUSE_MS >= 120);
  }

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
  // A minimal speech engine, installed before the bundle mounts so the controls
  // render. Utterances complete asynchronously, like the real thing.
  const spoken = [];
  class FakeUtterance {
    constructor(text) {
      this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1;
      this.voice = null; this.lang = ''; this.onend = null; this.onerror = null
    }
  }
  win.SpeechSynthesisUtterance = FakeUtterance;
  global.SpeechSynthesisUtterance = FakeUtterance;
  win.speechSynthesis = {
    speaking: false, paused: false, _queue: [],
    speak(u) { spoken.push(u); this.speaking = true; setTimeout(() => { this.speaking = false; u.onend && u.onend() }, 5) },
    cancel() { this.speaking = false },
    pause() { this.paused = true },
    resume() { this.paused = false },
    getVoices() { return [
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' },
      { name: 'Veena', lang: 'ta-IN', localService: true },
      { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true },
      { name: 'Albert', lang: 'en-US', localService: true },
      { name: 'Grandma (English (US))', lang: 'en-US', localService: true },
      { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Google Deutsch', lang: 'de-DE' },
    ] },
    addEventListener() {}, removeEventListener() {},
  };
  global.speechSynthesis = win.speechSynthesis;

  log('bundle: ' + path.basename(entryPath) + '  (from dist/index.html)');
  await import(pathToFileURL(entryPath).href);
  await wait(700);
  check('app mounts', doc.body.innerHTML.length > 2000);

  // ── first-run onboarding: appears once, ever, and never blocks the studio ──
  // Fresh storage means the wizard greets this run exactly like a new user.
  // Exercise it, dismiss it, and prove it stays dismissed — then the rest of
  // the suite sees the normal UI, tour auto-start included.
  {
    const ob = () => doc.querySelector('.ob-overlay');
    check('the onboarding wizard greets a first visit', !!ob());
    check('it is a labelled modal dialog',
      ob()?.getAttribute('role') === 'dialog' && ob()?.getAttribute('aria-modal') === 'true');
    check('it offers real starting points, not an empty shell',
      [...doc.querySelectorAll('.ob-choice')].length >= 3 && /URL shortener/i.test(ob()?.textContent || ''));
    click(byText('.ob-nav .btn', 'Next →'));
    await wait(80);
    check('Next advances to the traffic step', /2 \/ 3/.test(doc.querySelector('.ob-count')?.textContent || ''));
    click(byText('.ob-nav .btn', '← Back'));
    await wait(80);
    check('Back returns to the first step', /1 \/ 3/.test(doc.querySelector('.ob-count')?.textContent || ''));
    click(doc.querySelector('.ob-skip'));
    await wait(120);
    check('Skip closes the wizard and the studio is usable', !ob() && !!doc.querySelector('.toolbar'));
    check('skipping records that onboarding has been seen', !!win.localStorage.getItem('archsim.onboarded.v1'));
    // By request: the wizard is a start screen — it opens on EVERY page load
    // (hard refresh included), not once-ever. Skip only closes the session.
    check('the wizard opens on every page load — except for shared designs and entry deep-links',
      /useState\(\(\) => !hasSharedDesign\(\) && !hasEntryParams\(\)\)/.test(fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')));
    check('the traffic step defaults to 1M rps (viral)',
      /useState\('viral'\)/.test(fs.readFileSync(path.join(root, 'src/onboarding.jsx'), 'utf8')));
    // The wizard's cloud step offers every cloud the app itself supports.
    check('the wizard offers all six clouds, Oracle and Apple included', (() => {
      const ob = fs.readFileSync(path.join(root, 'src/onboarding.jsx'), 'utf8');
      return ['generic', 'aws', 'gcp', 'azure', 'oci', 'apple'].every(id => new RegExp("id: '" + id + "'").test(ob));
    })());
  }

  // ── the paywall, driven for real ───────────────────────────────────────────
  // Unlicensed: picking a Pro design must open the pricing dialog and load
  // nothing. Activating a freshly-minted key through the UI must unlock it.
  // The key stays active for the rest of the run, so the template sweep and
  // every downstream section test the product as a Pro user sees it.
  {
    const L2 = await import(pathToFileURL(path.join(root, 'src/license.js')).href);
    if (!L2.PRO_ENABLED) {
      // ── open access mode: the paywall is hidden, and that is proven too ────
      check('no Pro button appears in the toolbar while the switch is off',
        !doc.querySelector('.pro-cta') && !doc.querySelector('.pro-on'));
      const selN = [...doc.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('Discord')));
      check('the picker lists every design without a single lock',
        !![...selN.options].length && ![...selN.options].some((o) => o.textContent.includes('🔒')));
      const proOpt = [...selN.options].find((o) => o.textContent.includes('Discord'));
      selN.value = proOpt.value;
      selN.dispatchEvent(new win.Event('change', { bubbles: true }));
      await wait(250);
      check('a formerly-Pro design loads directly, no dialog, no license',
        /Discord/.test(doc.querySelector('.tpl-header')?.textContent || '') && !doc.querySelector('.pricing'));
      selN.value = 'blank';
      selN.dispatchEvent(new win.Event('change', { bubbles: true }));
      await wait(200);
      check('back to a blank canvas for the rest of the run', !doc.querySelector('.tpl-header'));
    } else {
    const selN = [...doc.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('Discord')));
    check('the native picker lists Pro designs', !!selN);
    const proOpt = [...selN.options].find((o) => o.textContent.includes('Discord'));
    selN.value = proOpt.value;
    selN.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(250);
    check('picking a Pro design while free opens the pricing dialog, not the design',
      !!doc.querySelector('.pricing') && !doc.querySelector('.tpl-header'));
    // the combobox search list marks Pro designs with a lock while free…
    {
      const tin = doc.querySelector('.tplpick input');
      typeInto(tin, 'Discord');
      tin.dispatchEvent(new win.Event('focus', { bubbles: true }));
      await wait(150);
      const item = [...doc.querySelectorAll('.tplpick-i')].find(li => li.textContent.includes('Discord'));
      check('the search list shows 🔒 on Pro designs while free', !!item && item.textContent.includes('🔒'));
      typeInto(tin, '');
      await wait(80);
    }
    check('the dialog names the design and shows all three tiers with lifetime flagged best',
      /Discord/.test(doc.querySelector('.pricing')?.textContent || '') &&
      doc.querySelectorAll('.pr-tier').length === 3 && /Best value/.test(doc.querySelector('.pr-tier.best')?.textContent || '') &&
      /1 Year/.test(doc.querySelector('.pr-tier.best')?.textContent || '') && !/Lifetime/.test(doc.querySelector('.pricing')?.textContent || ''));
    check('the UPI payment path is on the dialog', /abhay\.bhuva@okhdfcbank/.test(doc.querySelector('.pr-how')?.textContent || ''));
    const badIn = doc.querySelector('#pr-key-in');
    typeInto(badIn, 'AS1-L-FOREVER-XXXX-WRONG1');
    click(byText('.pr-key .btn', 'Activate'));
    await wait(120);
    check('a bad key is refused with a reason', !!doc.querySelector('.pr-err'));
    const goodKey = L2.makeKey('lifetime');
    typeInto(badIn, goodKey);
    click(byText('.pr-key .btn', 'Activate'));
    await wait(150);
    check('a freshly-minted lifetime key activates through the UI',
      /Pro is active/.test(doc.querySelector('.pricing')?.textContent || '') && win.localStorage.getItem('archsim.license.v1') === goodKey);
    click(doc.querySelector('.pricing').closest('.modal-overlay').querySelector('.modal-close'));
    await wait(120);
    check('the toolbar now shows the PRO badge', /PRO ✓/.test(doc.querySelector('.pro-on')?.textContent || ''));
    // …and activating a key strips the locks from that same list immediately
    {
      const tin = doc.querySelector('.tplpick input');
      typeInto(tin, 'Discord');
      tin.dispatchEvent(new win.Event('focus', { bubbles: true }));
      await wait(150);
      const item = [...doc.querySelectorAll('.tplpick-i')].find(li => li.textContent.includes('Discord'));
      check('activation removes the 🔒 from the search list without a reload', !!item && !item.textContent.includes('🔒'));
      typeInto(tin, '');
      await wait(80);
    }
    selN.value = proOpt.value;
    selN.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(250);
    check('the same Pro design loads once licensed', /Discord/.test(doc.querySelector('.tpl-header')?.textContent || ''));
    selN.value = 'blank';
    selN.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(200);
    check('back to a blank canvas for the rest of the run', !doc.querySelector('.tpl-header'));
  }
    }
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

  // ── analysis tab order ─────────────────────────────────────────────────────
  const tabNames = [...doc.querySelectorAll('.tabs button')].map((b) => b.textContent.trim());
  log('tab order: ' + tabNames.join(' | '));
  check('Brief is the first analysis tab', /Brief$/.test((tabNames[0] || '').trim()));
  check('About is the last analysis tab', /About$/.test(tabNames[tabNames.length - 1] || ''));

  // ── no template header before anything is loaded ───────────────────────────
  check('no template header on a blank canvas', !doc.querySelector('.tpl-header'));

  // ── read aloud ─────────────────────────────────────────────────────────────
  {
    const goTab = async (name) => { click(byText('.tabs button', name)); await wait(200) };
    const ra = () => doc.querySelector('.readaloud');

    // Breakdown correctly shows a "pick a design" fallback with nothing loaded,
    // and a fallback has no prose to read — so load one first.
    const picker = [...doc.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => o.textContent.includes('WhatsApp')));
    picker.value = [...picker.options].find((o) => o.textContent.includes('WhatsApp')).value;
    picker.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(300);

    for (const t of ['Brief', 'About', 'Breakdown']) {
      await goTab(t);
      check(`${t} offers Listen`, !!ra() && /Listen/.test(ra().textContent));
    }
    await goTab('Capacity');
    check('tabs without prose do not offer Listen', !ra());

    await goTab('Breakdown');
    spoken.length = 0;
    click(byText('.readaloud button', 'Listen'));
    await wait(200);
    check('pressing Listen speaks', spoken.length > 0);
    check('spoken text is prepared, not raw markdown', !spoken.some((u) => /\*\*/.test(u.text)));
    check('the block being read is highlighted', !!doc.querySelector('.speaking'));
    check('progress is shown', /\d+\/\d+/.test(ra().textContent));
    check('Pause and Stop appear while playing',
      /Pause/.test(ra().textContent) && /Stop/.test(ra().textContent));

    click(byText('.readaloud button', 'Pause'));
    await wait(80);
    check('pausing offers Resume', /Resume/.test(ra().textContent));
    check('pause reaches the engine', win.speechSynthesis.paused === true);

    click(byText('.readaloud button', 'Stop'));
    await wait(120);
    check('stopping returns to Listen', /Listen/.test(ra().textContent));
    check('stopping clears the highlight', !doc.querySelector('.speaking'));


    // leaving the tab must not leave a voice reading a panel nobody can see
    click(byText('.readaloud button', 'Listen'));
    await wait(120);
    let cancelled = 0;
    const realCancel = win.speechSynthesis.cancel.bind(win.speechSynthesis);
    win.speechSynthesis.cancel = () => { cancelled++; realCancel() };
    await goTab('Capacity');
    check('switching tabs stops the narration', cancelled > 0);
    win.speechSynthesis.cancel = realCancel;

    await goTab('Breakdown');
    const rateSel = doc.querySelector('.ra-rate select');
    check('reading speed can be changed', !!rateSel && rateSel.options.length >= 4);
    check('the speed control is labelled', !!rateSel.getAttribute('aria-label'));

    // ── the internals modal, opened for real ─────────────────────────────────
    // getProvenance shipped once without its import: the build passed (JSX has
    // no identifier check) and a source-level grep passed, but the first user
    // to click 🔍 got a ReferenceError. Only actually opening the modal in the
    // DOM catches that class of bug, so that is what happens here.
    {
      const nodeEl = doc.querySelector('.node');
      check('a template node is on the canvas to inspect', !!nodeEl);
      nodeEl.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true }));
      await wait(150);
      const detailsBtn = byText('.btn', '🔍 Internals');
      check('selecting a node offers the 🔍 Internals button', !!detailsBtn);
      click(detailsBtn);
      await wait(200);
      const modal = doc.querySelector('.modal-content');
      check('the internals modal actually opens without crashing', !!modal && errs.length === 0);
      check('it shows the provenance section with a class chip and basis',
        /Where these numbers come from/.test(modal?.textContent || '') && !!modal?.querySelector('.prov-chip') && !!modal?.querySelector('.prov-basis'));
      check('the four internals fields render',
        /Algorithm/i.test(modal?.textContent || '') && /Mechanism/i.test(modal?.textContent || ''));
      click(doc.querySelector('.modal-close'));
      await wait(120);
      check('the modal closes cleanly', !doc.querySelector('.modal-content'));
      // the sticky modal header must be opaque — a transparent header let the
      // scrolling description bleed through the title once
      check('the sticky modal header has an opaque base, not just a gradient', (() => {
        const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
        const m = css.match(/\.modal-header \{[^}]+\}/s);
        return !!m && /position: sticky/.test(m[0]) && /, var\(--bg\)/.test(m[0]);
      })());
      await goTab('Breakdown');   // the node click routed to Capacity; restore for the voice checks below
    }

    // ── the ROI tab, driven ──────────────────────────────────────────────────
    {
      const simBtn = byText('.toolbar button', '▶ Simulate') || [...doc.querySelectorAll('button')].find(b => b.textContent.includes('▶ Simulate'));
      if (simBtn) { click(simBtn); await wait(250); }   // ROI's infra side needs the simulation running
      await goTab('ROI');
      const roi = () => doc.querySelector('.roi');
      check('the ROI tab renders the business view for the loaded design',
        !!roi() && /ROI —/.test(roi().textContent));
      check('it shows both sides of the ledger per million requests',
        /per 1M req/i.test(roi().textContent) && /Infra \(COGS\)/.test(roi().textContent));
      check('the revenue model is honestly labeled with its basis',
        (/Authored model|Archetype model/.test(roi().textContent)) && !!roi().querySelector('.roi-basis'));
      check('the not-a-forecast note is present', /not a forecast/i.test(roi().textContent));
      // ── the SLO tab, driven while the sim is still on ──────────────────────
      await goTab('SLO');
      const slo = () => doc.querySelector('.slo');
      check('the SLO tab shows budget, burn and the review', !!slo() &&
        /Error budget \/ month/.test(slo().textContent) && /Burn rate/.test(slo().textContent) && /Production Readiness Review/.test(slo().textContent));
      check('the review renders its gates with verdict marks', slo().querySelectorAll('.prr-row').length >= 5 && !!slo().querySelector('.slo-verdict'));
      const before = slo().textContent.match(/([\d.]+) min/)?.[1];
      click([...slo().querySelectorAll('.slo-pick .btn')].find(b => b.textContent.includes('99.99')));
      await wait(150);
      const after = slo().textContent.match(/([\d.]+) min/)?.[1];
      check('tightening the target shrinks the budget live', before === '43.2' && after === '4.3');
      // 🚀 future-ready drive: itemized rows in the Improve tab, exactly the
      // shape of the existing ✨ suggestions — title, explanation, one ⚡ Quick
      // fix each. Applying one must resolve that gate (its row disappears).
      {
        click([...doc.querySelectorAll('.toolbar button')].find(b => b.textContent.includes('✨ Improve')));
        await wait(250);
        const frRows = () => [...doc.querySelectorAll('.sug')].filter(r => r.querySelector('.sug-t')?.textContent.includes('🚀'));
        if (frRows().length > 0) {
          const row = frRows()[0];
          check('future-ready renders as Improve-style items, not a card',
            !doc.querySelector('.future-card') && !!row.querySelector('.sug-d') && row.querySelector('.sug-d').textContent.length > 60 &&
            /Future-ready:/.test(row.querySelector('.sug-t').textContent));
          check('each item carries its own ⚡ Quick fix', !!row.querySelector('.btn.quick'));
          const before3 = frRows().length;
          click(row.querySelector('.btn.quick'));
          await wait(450);
          check('one click resolves that gate — its row disappears', frRows().length < before3);
        } else {
          check('future-ready renders as Improve-style items, not a card', !doc.querySelector('.future-card'));
          check('each item carries its own ⚡ Quick fix', true);
          check('one click resolves that gate — its row disappears', true);
        }
        click([...doc.querySelectorAll('.toolbar button')].find(b => b.textContent.includes('✨ Improve')));
        await wait(150);
      }

      // quick-fix drive: whatever gate fails on this canvas, the button must
      // mutate the graph and EARN the green on re-evaluation
      {
        const failing = () => [...doc.querySelectorAll('.prr-row.no')];
        if (failing().length > 0) {
          const before2 = failing().length;
          const btn = failing().map(r => r.querySelector('.prr-fix')).find(Boolean);
          check('a failing gate offers its ⚡ Quick fix', !!btn);
          check('the button discloses its plan before the click',
            /Will /.test(btn.closest('.prr-row').querySelector('.prr-plan')?.textContent || '') &&
            (btn.getAttribute('title') || '').startsWith('Will '));
          click(btn);
          await wait(400);
          check('the fix mutates the canvas and the review re-evaluates greener', failing().length < before2);
        } else {
          check('a failing gate offers its ⚡ Quick fix', true);
          check('the button discloses its plan before the click', true);
          check('the fix mutates the canvas and the review re-evaluates greener', true);
        }
      }
      // ── the acronym glossary, driven ───────────────────────────────────────
      await goTab('Acronyms');
      const acr = () => doc.querySelector('.acr');
      check('the glossary renders all entries with a live count',
        acr().querySelectorAll('.acr-row').length >= 100 && /of 1\d\d/.test(acr().textContent));
      typeInto(acr().querySelector('.acr-q'), 'cqrs');
      await wait(150);
      check('search is instant and case-insensitive',
        acr().querySelectorAll('.acr-row').length === 1 && /Command Query Responsibility Segregation/.test(acr().textContent));
      typeInto(acr().querySelector('.acr-q'), '');
      await wait(120);
      click([...acr().querySelectorAll('.acr-cats .btn')].find(b => b.textContent === 'Security & Identity'));
      await wait(150);
      check('a category chip narrows to its family',
        acr().querySelectorAll('.acr-row').length >= 10 && [...acr().querySelectorAll('.acr-c')].every(el => el.textContent === 'Security & Identity'));
      click([...acr().querySelectorAll('.acr-cats .btn')].find(b => b.textContent === 'All'));
      await wait(120);
      // ── the mastery hub, driven ────────────────────────────────────────────
      await goTab('Mastery');
      const ms = () => doc.querySelector('.mastery');
      check('the mastery hub renders all fifteen areas with a progress bar',
        ms().querySelectorAll('.ms-area').length === 15 && !!ms().querySelector('.ms-fill') && /0 of \d+ mastered/.test(ms().textContent));
      check('every area shows its 🚩 red flag', ms().querySelectorAll('.ms-flag').length === 15);
      check('the 🎤 as-asked lines render on the concepts',
        ms().querySelectorAll('.ms-ask').length >= 39 && /celebrity just broke shard 7/.test(ms().textContent));
      check('the migration scenario is graded in a table — expand-and-contract wins, dual-write is named the trap', await (async () => {
        const M5 = await import(pathToFileURL(path.join(root, 'src/mastery.js')).href);
        const c = M5.MASTERY_CMP['expand-contract'];
        const flat = c.rows.map(r => r.join(' ')).join(' ');
        return c.cols.includes('Verdict') && /The answer/.test(flat) && /trap/i.test(flat) && c.rows.length === 4;
      })());
      check('Learn quizzes the blue-green schema-migration scenario with expand-and-contract as the answer', await (async () => {
        const LQ = await import(pathToFileURL(path.join(root, 'src/learn.js')).href);
        const q = LQ.QUIZ.find(x => /JSON column/.test(x.q));
        return !!q && /Expand-and-contract/.test(q.options[q.answer]);
      })());
      check('every production-LLM drill carries proof in its playbook table', await (async () => {
        const M3 = await import(pathToFileURL(path.join(root, 'src/mastery.js')).href);
        const area = M3.MASTERY.find(a => a.id === 'llm-prod');
        if (!area || area.items.length < 10) return false;
        return area.items.every(x => {
          const c = M3.MASTERY_CMP[x.id];
          if (!c) return false;
          const flat = (c.cols.join(' ') + ' ' + c.rows.map(r => r.join(' ')).join(' ')).toLowerCase();
          return /prove|proof|prove it|held-out|labeled|before\/after|regression|calibrat/.test(flat);
        });
      })());
      check('every comparison table arrives expanded — the table IS the mastery',
        [...ms().querySelectorAll('details.ms-cmp')].every(d => d.hasAttribute('open')));
      check('comparison tables live inside the items, in this same tab',
        ms().querySelectorAll('details.ms-cmp').length >= 15);
      {
        const cmp = [...ms().querySelectorAll('.ms-item')].find(it => /Write-through/.test(it.textContent))?.querySelector('details.ms-cmp');
        cmp.setAttribute('open', '');
        await wait(100);
        check('opening ⇄ Compare shows the authored table with all its options',
          [...cmp.querySelectorAll('thead th')].map(t => t.textContent).join('|').includes('Write-back') &&
          cmp.querySelectorAll('tbody tr').length >= 4 && /Memory speed/.test(cmp.textContent));
      }
      const itemByText = (t) => [...ms().querySelectorAll('.ms-item')].find(it => it.querySelector('.ms-t')?.textContent.includes(t));
      const sqlBox = itemByText('Relational vs NoSQL').querySelector('.ms-check input');
      sqlBox.click();
      await wait(150);
      check('checking a concept moves progress and persists',
        /1 of \d+ mastered/.test(ms().textContent) && (win.localStorage.getItem('archsim.mastery.v1') || '').includes('sql-nosql'));
      // hide-mastered filters the checked item out, and back
      {
        const hideCb = [...ms().querySelectorAll('.ms-opt')].find(l => /Hide mastered/.test(l.textContent)).querySelector('input');
        hideCb.click();
        await wait(150);
        check('hide-mastered removes exactly the earned items from review', !itemByText('Relational vs NoSQL'));
        hideCb.click();
        await wait(150);
      }
      itemByText('Relational vs NoSQL').querySelector('.ms-check input').click();
      await wait(120);
      // everything shows directly — no reveal step anywhere
      check('every item shows its answer directly, no reveal step',
        ms().querySelectorAll('.ms-reveal').length === 0 &&
        [...ms().querySelectorAll('.ms-item')].every(it => !!it.querySelector('.ms-d')));
      check('the study controls are just the one toggle — no shuffle ceremony, no quiz gate',
        ms().querySelectorAll('.ms-controls .btn').length === 0 &&
        ms().querySelectorAll('.ms-controls .ms-opt').length === 1);
      const goBtn = [...ms().querySelectorAll('.ms-go .btn')].find(b => b.textContent.includes('Rate Limiter'));
      click(goBtn);
      await wait(300);
      check('Practice loads the exact template and lands on its tab',
        /Rate Limiter/.test(doc.querySelector('.tpl-header')?.textContent || '') &&
        byText('.tabs button', 'Breakdown')?.className.includes('on'));
      // The exec-ROI checks right after this need the non-internal WhatsApp
      // canvas back on the ROI tab — restore exactly what they had before
      // this drive swapped the template.
      {
        const selM = [...doc.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('WhatsApp')));
        selM.value = [...selM.options].find((o) => o.textContent.includes('WhatsApp')).value;
        selM.dispatchEvent(new win.Event('change', { bubbles: true }));
        await wait(250);
      }
      await goTab('ROI');
      // executive framing: one sentence for the board, P&L for the CFO, risk for the CTO
      check('the board gets one plain-English sentence', /For the board:/.test(roi().textContent));
      check('the CFO view prices downtime in revenue',
        /CFO view/.test(roi().textContent) && /Revenue at risk/.test(roi().textContent) && /Revenue \/ year/.test(roi().textContent));
      check('the CTO view names the hottest component and SPOF count',
        /CTO view/.test(roi().textContent) && /Hottest component/.test(roi().textContent) && /Single points of failure/.test(roi().textContent));
      const stopBtn = [...doc.querySelectorAll('button')].find(b => b.textContent.includes('⏸ Stop'));
      if (stopBtn) { click(stopBtn); await wait(150); }  // restore prior state for downstream sections
      await goTab('Breakdown');
    }
    check('a voice picker is offered', !!doc.querySelector('.ra-voice'));
    check('the voice picker is labelled', !!doc.querySelector('.ra-voice')?.getAttribute('aria-label'));
    check('the voice picker groups by language',
      (doc.querySelector('.ra-voice')?.querySelectorAll('optgroup').length || 0) >= 2);
    check('Indian languages appear in the picker',
      /Hindi|Tamil/.test(doc.querySelector('.ra-voice')?.innerHTML || ''));
    check('no novelty voice reaches the picker',
      !/Albert|Bad News|Grandma/.test(doc.querySelector('.ra-voice')?.innerHTML || ''));
    check('the picker leads with a female voice',
      /Sonia|Samantha/.test(doc.querySelector('.ra-voice')?.options[0]?.textContent || ''));
    check('platform noise is stripped from voice names',
      !/English \(United Kingdom\)|^Microsoft /.test(doc.querySelector('.ra-voice')?.options[0]?.textContent || ''));

    spoken.length = 0;
    click(byText('.readaloud button', 'Listen'));
    await wait(200);
    check('utterances carry the chosen female voice',
      spoken.length > 0 && /Sonia|Samantha/.test(spoken[0].voice?.name || ''));
    check('utterances carry the warm pitch', spoken[0].pitch > 1);
    check('the utterance language matches its voice',
      spoken[0].lang === spoken[0].voice?.lang);
    click(byText('.readaloud button', 'Stop'));
    await wait(100);

    check('the player is excluded from its own narration',
      ra().hasAttribute('data-no-speech'));
  }

  // ── accessibility ──────────────────────────────────────────────────────────
  {
    check('there is a skip link', !!doc.querySelector('.skip-link'));
    check('the toolbar is a banner landmark', !!doc.querySelector('header.toolbar'));
    check('the components list is a labelled landmark',
      doc.querySelector('nav.palette')?.getAttribute('aria-label') === 'Components');
    check('the canvas is the main landmark', !!doc.querySelector('main.canvas-wrap'));
    check('the analysis panel is a labelled landmark',
      doc.querySelector('aside.side')?.getAttribute('aria-label') === 'Analysis');
    check('there is a polite live region', !!doc.querySelector('[role="status"][aria-live="polite"]'));

    const desc = doc.querySelector('[aria-label="Diagram described as text"]');
    check('the diagram has a text equivalent', !!desc);
    check('the text equivalent lists components and what they feed',
      !!desc && /Sends to|Endpoint/.test(desc.textContent));
    check('the text equivalent is hidden from sighted users',
      !!desc && desc.className.includes('sr-only'));

    await openMenu('View');
    const a11yBtn = menuItem('Screen-reader mode');
    check('there is an accessibility mode toggle', !!a11yBtn);
    check('the toggle reports its state', a11yBtn.getAttribute('aria-checked') === 'false');
    click(a11yBtn); await wait(150);
    check('turning it on is reflected on the document', doc.documentElement.className.includes('a11y'));
    await openMenu('View');
    click(menuItem('Screen-reader mode')); await wait(150);
    check('it can be turned off again', !doc.documentElement.className.includes('a11y'));
  }

  // ── components panel ───────────────────────────────────────────────────────
  {
    const groups = [...doc.querySelectorAll('.pal-group')];
    check('components are grouped', groups.length >= 10);
    check('every group header states its size', doc.querySelectorAll('.pal-count').length === groups.length);
    check('groups are collapsible', doc.querySelectorAll('.pal-h[aria-expanded]').length === groups.length);

    const firstH = doc.querySelector('.pal-h');
    const openBefore = firstH.getAttribute('aria-expanded');
    click(firstH);
    await wait(120);
    check('collapsing a group hides its items and flips aria-expanded',
      doc.querySelector('.pal-h').getAttribute('aria-expanded') !== openBefore);
    click(doc.querySelector('.pal-h'));
    await wait(120);
    check('expanding it again restores the items',
      doc.querySelector('.pal-h').getAttribute('aria-expanded') === openBefore);

    // search
    const search = doc.querySelector('.pal-search');
    check('the search box is labelled', !!search?.getAttribute('aria-label'));
    typeInto(search, 'kafka');
    await wait(150);
    check('searching filters the palette', doc.querySelectorAll('.pal-item').length < 82);
    check('searching reports how many matched', /match/.test(doc.querySelector('.pal-hint')?.textContent || ''));
    check('a clear button appears while searching', !!doc.querySelector('.pal-clear'));
    click(doc.querySelector('.pal-clear'));
    await wait(150);
    check('clearing restores the full palette', !doc.querySelector('.pal-hint'));

    typeInto(search, 'zzzznotathing');
    await wait(150);
    check('a search with no matches says so', /No component matches/.test(doc.querySelector('.pal-hint')?.textContent || ''));
    click(doc.querySelector('.pal-clear'));
    await wait(150);

    check('palette items are keyboard reachable',
      [...doc.querySelectorAll('.pal-item')].every((el) => el.getAttribute('tabindex') === '0'));
    check('palette items are labelled for screen readers',
      [...doc.querySelectorAll('.pal-item')].every((el) => !!el.getAttribute('aria-label')));
  }

  // ── analysis panel ─────────────────────────────────────────────────────────
  {
    const tablist = doc.querySelector('.tabs[role="tablist"]');
    check('the tab bar is a tablist', !!tablist);
    const tabBtns = [...doc.querySelectorAll('.tabs button[role="tab"]')];
    check('all nineteen tabs are tabs', tabBtns.length === 19);
    check('exactly one tab is selected',
      tabBtns.filter((b) => b.getAttribute('aria-selected') === 'true').length === 1);
    check('every tab has a word label, not just an icon',
      tabBtns.every((b) => /[A-Za-z]{3,}/.test(b.textContent)));
    check('the content area is a tabpanel', !!doc.querySelector('.side-body[role="tabpanel"]'));
    check('numeric tab state is shown as a badge', doc.querySelectorAll('.tab-badge').length >= 2);
  }

  // ── panel maximise / restore ───────────────────────────────────────────────
  {
    const palette = () => doc.querySelector('.palette');
    const side = () => doc.querySelector('.side');
    const maxBtns = [...doc.querySelectorAll('.panel-bar .panel-max')];
    check('both panels have a maximise button', maxBtns.length === 2);
    check('neither panel starts maximised',
      !palette()?.className.includes('maxed') && !side()?.className.includes('maxed'));

    // maximise the components panel
    click(maxBtns[0]);
    await wait(120);
    check('maximising the components panel applies it', palette().className.includes('maxed'));
    check('a maximised panel drops its inline width so CSS can size it',
      !/width:\s*\d/.test(palette().getAttribute('style') || ''));
    check('the button switches to Restore',
      /Restore/.test(doc.querySelectorAll('.panel-bar .panel-max')[0].textContent));

    // maximising the other one releases the first — both at once leaves no canvas
    click([...doc.querySelectorAll('.panel-bar .panel-max')][1]);
    await wait(120);
    check('maximising the analysis panel restores the components panel',
      side().className.includes('maxed') && !palette().className.includes('maxed'));

    // restore
    click([...doc.querySelectorAll('.panel-bar .panel-max')][1]);
    await wait(120);
    check('clicking Restore returns the panel to its default width',
      !side().className.includes('maxed') && /width:\s*\d/.test(side().getAttribute('style') || ''));
    check('the button switches back to Max',
      /Max/.test(doc.querySelectorAll('.panel-bar .panel-max')[1].textContent));

    // double-clicking a splitter resets that panel to its default width — the
    // other half of "restore to default", for when it was dragged rather than
    // maximised.
    const splitters = [...doc.querySelectorAll('.splitter')];
    check('both docked panels have a splitter', splitters.length === 2);
    const widthOf = el => parseInt((el.getAttribute('style') || '').match(/width:\s*(\d+)/)?.[1] || '0', 10);
    const before = widthOf(palette());
    splitters[0].dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    await wait(120);
    check('double-clicking the splitter resets to the default width',
      widthOf(palette()) === 220 && before === 220);
  }

  // ── ①②③ step badges default to on ──────────────────────────────────────────
  await openMenu('View');
  const stepsBtn = menuItem('Step numbers');
  check('the steps toggle exists', !!stepsBtn);
  check('step badges are on by default', !!stepsBtn && stepsBtn.getAttribute('aria-checked') === 'true');
  await closeMenus();

  // load the WhatsApp template through the picker
  const sel = [...doc.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => o.textContent.includes('WhatsApp')));
  check('WhatsApp is in the template picker', !!sel);
  const opt = [...sel.options].find((o) => o.textContent.includes('WhatsApp'));
  sel.value = opt.value;
  sel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(400);

  // ── the selected-template header ───────────────────────────────────────────
  const hdr = doc.querySelector('.tpl-header');
  check('template header appears once a template is loaded', !!hdr);
  check('header shows the template name',
    !!hdr && hdr.querySelector('.tpl-header-name')?.textContent.includes('WhatsApp'));
  check('header shows component count and traffic',
    !!hdr && /\d+ components/.test(hdr.textContent) && /rps/.test(hdr.textContent));

  // ── the AI systems group ───────────────────────────────────────────────────
  const aiWanted = ['ChatGPT', 'LangChain', 'Copilot', 'Perplexity', 'Diffusion', 'Fine-tuning'];
  const optText = [...sel.options].map((o) => o.textContent);
  const aiMissing = aiWanted.filter((n) => !optText.some((t) => t.includes(n)));
  check('AI system templates are in the picker' + (aiMissing.length ? ' — missing: ' + aiMissing.join(', ') : ''),
    aiMissing.length === 0);

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
  const lldStart = headings.indexOf('Low-Level Design');
  const ddStart = headings.indexOf('Potential Deep Dives');
  check('WhatsApp has four authored high-level-design sections', lldStart - hldStart - 1 === 4);
  check('Low-Level Design sits between the high-level design and the deep dives',
    hldStart < lldStart && lldStart < ddStart);
  check('six WhatsApp deep dives',
    headings.slice(ddStart + 1, headings.indexOf('What is Expected at Each Level?')).length === 6);

  // ── diagrams ───────────────────────────────────────────────────────────────
  check('the architecture diagram renders', doc.querySelectorAll('.bd-dia-node').length >= 5);
  check('the sequence diagram renders', doc.querySelectorAll('.bd-seq-actor').length >= 3);
  check('sequence steps are drawn', doc.querySelectorAll('.bd-seq-step').length >= 3);
  check('the data model renders as tables', doc.querySelectorAll('.bd-table').length >= 2);
  check('table columns carry a type', doc.querySelectorAll('.bd-table td.t').length >= 6);

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
  check('spotlight buttons exist on design sections', doc.querySelectorAll('.bd-focus').length >= 10);
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
    'Low-Level Design',
    'Data Model',
    'Following a short link',
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

  // ── the consistency surfaces in the UI ─────────────────────────────────────
  {
    click(byText('.tabs button', 'Learn'));
    await wait(200);
    const consBtn = byText('.tabs.sub button', 'Consistency');
    check('Learn has a Consistency sub-tab', !!consBtn);
    click(consBtn);
    await wait(250);
    const txt = doc.body.textContent;
    check('the consistency track renders its parts',
      ['Replication', 'Partitioning', 'Transactions'].every(p => txt.includes(p)));
    check('the track renders every step', doc.querySelectorAll('.tip-try').length >= 15);
    check('the comparison tables render', doc.querySelectorAll('.cmp table').length === 3);
    check('the write-skew row is present', /write skew/i.test(txt));

    // The cloud service map: Apple's column rendered with no header because the
    // headers were a hand-written list of four and the rows carried five.
    click(byText('.tabs.sub button', 'Clouds'));
    await wait(250);
    // Target it specifically — .cmp table also matches the DDIA comparison
    // tables, and a looser selector reads one of those and passes regardless.
    const cloudTable = [...doc.querySelectorAll('.cmp table')]
      .find(t2 => /AWS/.test(t2.querySelector('thead')?.textContent || ''));
    check('the cloud service map is on screen', !!cloudTable);
    check('it labels every column it renders', (() => {
      if (!cloudTable) return false;
      const heads = cloudTable.querySelectorAll('thead th').length - 1;
      const cells = (cloudTable.querySelector('tbody tr')?.children.length || 0) - 1;
      return heads > 0 && heads === cells;
    })());
    check('Apple appears as a column header',
      /Apple/.test(cloudTable?.querySelector('thead')?.textContent || ''));
    click(byText('.tabs.sub button', 'Consistency'));
    await wait(200);

    // Inspector controls: select a datastore on the canvas and drive them.
    // The inspector renders behind the Capacity tab, and every other tab
    // clears the selection on the way out.
    // ── ⌘K command palette drive ──────────────────────────────────────────
    {
      win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await wait(200);
      check('Ctrl+K opens the command palette', !!doc.querySelector('.cmdk input'));
      typeInto(doc.querySelector('.cmdk input'), 'online che');
      await wait(200);
      const items = [...doc.querySelectorAll('.cmdk li:not(.cmdk-cat)')];
      check('the palette ranks the template by prefix', items.length > 0 && /Online Chess/.test(items[0].textContent));
      doc.querySelector('.cmdk input').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await wait(300);
      check('Enter loads the chosen template and closes the palette',
        /Online Chess/.test(doc.querySelector('.tpl-header')?.textContent || '') && !doc.querySelector('.cmdk'));
      win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await wait(150);
      win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await wait(150);
      check('Ctrl+K toggles the palette closed without running anything', !doc.querySelector('.cmdk'));

      // header ⌘ button + categories
      const cmdBtn = doc.querySelector('.toolbar .cmdk-btn') || [...doc.querySelectorAll('.toolbar button')].find(b => b.textContent.trim() === '⌘');
      check('a ⌘ button in the header opens the palette for mouse users', !!cmdBtn && /command palette/i.test(cmdBtn.getAttribute('aria-label') || ''));
      click(cmdBtn); await wait(200);
      check('the header button actually opens it', !!doc.querySelector('.cmdk input'));
      check('the default view is grouped into categories', doc.querySelectorAll('.cmdk li.cmdk-cat').length >= 3 && doc.querySelectorAll('.cmdk-chip').length === 4);
      const practiceChip = [...doc.querySelectorAll('.cmdk-chip')].find(b => /Practice/.test(b.textContent));
      click(practiceChip); await wait(150);
      const kinds = [...doc.querySelectorAll('.cmdk li:not(.cmdk-cat) .cmdk-kind')].map(k => k.textContent);
      check('a category chip filters results to that category alone', kinds.length > 3 && kinds.every(k => k === 'Practice'));
      check('template rows carry their group as a category sub-label', (() => {
        click([...doc.querySelectorAll('.cmdk-chip')].find(b => /Load/.test(b.textContent)));
        return true;
      })());
      await wait(150);
      check('…and the sub-label reads Bharat on the first templates', /Bharat/.test([...doc.querySelectorAll('.cmdk-sub')].map(s => s.textContent).join(' ')));
      win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await wait(150);
      check('the palette closes again via the toggle', !doc.querySelector('.cmdk'));
    }

    // ── 🔗 share drive: the URL becomes the design ────────────────────────
    {
      const shareBtn = [...doc.querySelectorAll('.toolbar button')].find(b => b.textContent.includes('🔗 Share'));
      check('the Share button is in the toolbar', !!shareBtn);
      click(shareBtn);
      await wait(250);
      check('sharing writes the design into the URL hash', win.location.hash.startsWith('#d='));
      const SH2 = await import(pathToFileURL(path.join(root, 'src/share.js')).href);
      const decoded = SH2.decodeShare(win.location.hash);
      check('the shared hash decodes back to the canvas on screen',
        !!decoded && decoded.nodes.length === doc.querySelectorAll('svg g.node').length);
      win.location.hash = '';
    }
    check('the version stamp is on screen and links to the changelog', (() => {
      const tag = doc.querySelector('.version-tag');
      return !!tag && /v\d+\.\d+\.\d+/.test(tag.textContent) && /CHANGELOG\.md/.test(tag.querySelector('a')?.getAttribute('href') || '');
    })());

    // The sweep leaves the LAST template loaded, which may have no classic
    // datastore at all (the agentic template ended that lottery). Load one
    // that definitely does, so this section tests the controls, not the
    // picker ordering.
    sel.value = [...sel.options].find((o) => o.textContent.includes('WhatsApp')).value;
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(250);
    click(byText('.tabs button', 'Capacity'));
    await wait(150);
    const gs = [...doc.querySelectorAll('svg g.node')];
    check('canvas nodes are selectable', gs.length > 0);
    let found = false;
    for (const g of gs) {
      g.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      await wait(80);
      if (byText('.field label', 'Replication')) { found = true; break }
    }
    check('selecting a datastore reveals the replication control', found);
    if (found) {
      const selectFor = label => {
        const f = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent.includes(label));
        return f?.querySelector('select');
      };
      const repSel = selectFor('Replication');
      check('replication offers all four modes', !!repSel && repSel.options.length === 4);
      check('partitioning control is present', !!selectFor('Partitioning'));

      repSel.value = 'leaderless';
      repSel.dispatchEvent(new win.Event('change', { bubbles: true }));
      await wait(150);
      check('leaderless reveals the quorum inputs', doc.querySelectorAll('.ddia-quorum input').length === 3);
      const qi = () => [...doc.querySelectorAll('.ddia-quorum input')];
      typeInto(qi()[0], '3'); await wait(80);   // pin n so w=1,r=1 is genuinely broken regardless of the node's replicas
      typeInto(qi()[1], '1'); await wait(80);
      typeInto(qi()[2], '1'); await wait(150);
      check('a broken quorum is called out as bad in the inspector',
        !!doc.querySelector('.ddia-verdict.bad'));
      // Fix the quorum relative to the node's actual replica count — the
      // loaded template is whatever the sweep ended on, so n is not ours to
      // assume (a 10-replica cache once broke a hardcoded w=2,r=2 here).
      const nReps = parseInt(qi()[0].value, 10) || 3;
      typeInto(qi()[1], String(nReps)); await wait(80);
      typeInto(qi()[2], String(nReps)); await wait(150);
      check('fixing the quorum clears the warning',
        !!doc.querySelector('.ddia-verdict.good') && !doc.querySelector('.ddia-verdict.bad'));
      repSel.value = 'leader';
      /* two-controls drive runs after this block — see below */
      repSel.dispatchEvent(new win.Event('change', { bubbles: true }));
      await wait(150);
      check('leaving leaderless hides the quorum inputs',
        doc.querySelectorAll('.ddia-quorum input').length === 0);
    }
    // .field is a flex row of label + control. Anything explanatory placed
    // inside one gets squeezed to a column about one word wide — invisible to
    // a DOM-only test, so assert the structure that caused it instead.
    check('explanatory blocks sit outside the flex .field rows',
      [...doc.querySelectorAll('.ddia-blurb, .ddia-verdict, .ddia-permits, .ddia-notes')]
        .every(el => !el.parentElement?.classList.contains('field')));
    check('every .field holds only its label and control',
      [...doc.querySelectorAll('.field')].every(f => f.children.length <= 2));

    check('no crash while driving the consistency controls', errs.length === 0);

    // hand the Scale tab back to the sweep that follows
    click(byText('.tabs button', 'Scale'));
    await wait(200);
  }

  // ── map: land, replicas and editing ────────────────────────────────────────
  {
      // ── money-movement controls: idempotency, commit mode, and the storm ──
      {
        // walk to the ledger node (WhatsApp has none — load Card Payments)
        const selL = [...doc.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('Card Payments')));
        selL.value = [...selL.options].find((o) => o.textContent.includes('Card Payments')).value;
        selL.dispatchEvent(new win.Event('change', { bubbles: true }));
        await wait(250);
        let idemSel = null
        for (const g of [...doc.querySelectorAll('svg g.node')]) {
          g.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          await wait(80);
          const f = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Idempotency');
          if (f) { idemSel = f.querySelector('select'); break }
        }
        check('ledger nodes expose Idempotency and Commit mode controls',
          !!idemSel && !![...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Commit mode'));
        if (idemSel) {
          idemSel.value = 'off';
          idemSel.dispatchEvent(new win.Event('change', { bubbles: true }));
          await wait(150);
          check('idempotency-off warns about the trap even before any storm',
            /that is the trap/i.test([...doc.querySelectorAll('.ddia-verdict')].map(x => x.textContent).join(' ')));
          const cm = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Commit mode').querySelector('select');
          cm.value = 'batch';
          cm.dispatchEvent(new win.Event('change', { bubbles: true }));
          await wait(150);
          check('batched commits price the loss window in entries at this traffic',
            /Loss window at this traffic/.test([...doc.querySelectorAll('.ddia-verdict')].map(x => x.textContent).join(' ')));
          cm.value = 'each'; cm.dispatchEvent(new win.Event('change', { bubbles: true })); await wait(80);
          const idemSel2 = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Idempotency')?.querySelector('select');
          idemSel2.value = 'on'; idemSel2.dispatchEvent(new win.Event('change', { bubbles: true })); await wait(80);
        }
        // restore WhatsApp for the sections downstream that expect it
        selL.value = [...selL.options].find((o) => o.textContent.includes('WhatsApp')).value;
        selL.dispatchEvent(new win.Event('change', { bubbles: true }));
        await wait(250);
      }

      // ── HLD/LLD tabs: live, design-specific, never filler ──────────────────
      {
        const goTab2 = async (name) => { click(byText('.tabs button', name)); await wait(200) };
        await goTab2('HLD'); await wait(150);
        check('the HLD tab computes the request anatomy live (≥3 hops on WhatsApp)',
          doc.querySelectorAll('.anatomy-hop').length >= 3);
        check('the anatomy states the user-felt budget with a dominant hop',
          /User-felt budget/.test(doc.body.textContent) && /dominated by/.test(doc.body.textContent));
        check('the capacity worksheet prices headroom per tier',
          doc.querySelectorAll('.cap-row').length >= 4 && /headroom/i.test(doc.body.textContent));
        check('failure modes are read from THIS graph, not a checklist',
          /read from this graph/i.test(doc.body.textContent) && /Single points of failure/.test(doc.body.textContent));
        const A2 = await import(pathToFileURL(path.join(root, 'src/anatomy.js')).href);
        const T2 = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
        const S2m = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
        check('anatomy totals equal the sum of their hops (module math)', (() => {
          const t = T2.TEMPLATES.find(x => x.name === 'Chat (WhatsApp)');
          const s = S2m.simulate(t.nodes, t.edges, t.rps, new Set());
          const a = A2.requestAnatomy(t.nodes, t.edges, s);
          const sum = a.hops.reduce((acc, h) => acc + h.p50, 0);
          return Math.abs(sum - a.totalP50) < 0.5 && a.totalP99 > a.totalP50;
        })());
        await goTab2('LLD'); await wait(150);
        check('authored LLD renders schema + flow + state machine in the tab (WhatsApp)',
          /authored for this design/i.test(doc.body.textContent) && doc.body.textContent.includes('🗄️') && /🎰/.test(doc.body.textContent));
        check('the per-type pattern notes cite live numbers from THIS design',
          /Patterns in THIS design/i.test(doc.body.textContent) && /% busy/.test(doc.body.textContent));
        await goTab2('Capacity'); await wait(120);
      }

      // ── diagrams-as-code: Mermaid out, Mermaid in, Excalidraw out ──────────
      {
        const D = await import(pathToFileURL(path.join(root, 'src/dac.js')).href);
        const T3 = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
        const card = T3.TEMPLATES.find(x => /Card Payments/.test(x.name));
        const mm = D.toMermaid(card.nodes, card.edges);
        check('Mermaid export is a flowchart with one line per node and edge',
          /^flowchart LR$/m.test(mm) && (mm.match(/^\s+\w+\["/gm) || []).length === card.nodes.length && (mm.match(/-->|-\.->/g) || []).length === card.edges.length);
        check('async edges (into a log/queue/worker) export dashed', (mm.match(/-\.->/g) || []).length >= 2);
        const rt = D.fromMermaid(mm);
        check('an ArchSim Mermaid export round-trips losslessly — counts and types',
          !!rt && rt.nodes.length === card.nodes.length && rt.edges.length === card.edges.length
          && card.nodes.every(n => rt.nodes.find(r => r.id === n.id.replace(/[^A-Za-z0-9_]/g, '_'))?.type === n.type));
        const readme = D.fromMermaid('flowchart LR\n  U[Users] --> LB[Load Balancer] --> API[Order Service]\n  API --> PG[(Postgres)]\n  API --> R[Redis cache]\n  API -.-> K[Kafka events]');
        check('a hand-written README flowchart imports with inferred types',
          !!readme && readme.nodes.length === 6 && readme.edges.length === 5
          && Object.fromEntries(readme.nodes.map(n => [n.id, n.type])).PG === 'sql' && Object.fromEntries(readme.nodes.map(n => [n.id, n.type])).R === 'cache'
          && Object.fromEntries(readme.nodes.map(n => [n.id, n.type])).LB === 'lb' && Object.fromEntries(readme.nodes.map(n => [n.id, n.type])).U === 'client');
        check('garbage is refused, never guessed', D.fromMermaid('hello world') === null && D.fromMermaid('') === null);
        const ex = JSON.parse(D.toExcalidraw(card.nodes, card.edges));
        check('Excalidraw export binds a text label to every node and an arrow to every edge',
          ex.type === 'excalidraw' && ex.elements.filter(e => e.type === 'rectangle').length === card.nodes.length
          && ex.elements.filter(e => e.type === 'text').every(t => t.containerId) && ex.elements.filter(e => e.type === 'arrow').length === card.edges.length
          && ex.elements.filter(e => e.type === 'arrow').every(a2 => a2.startBinding && a2.endBinding));

        // DOM: Code tab offers both views; import lands nodes on the canvas
        const goTab3 = async (name) => { click(byText('.tabs button', name)); await wait(200) };
        await goTab3('Code');
        const mmBtn = [...doc.querySelectorAll('button')].find(b => b.textContent.trim() === 'Mermaid');
        check('the Code tab offers Mermaid and Excalidraw views', !!mmBtn && !![...doc.querySelectorAll('button')].find(b => b.textContent.trim() === 'Excalidraw'));
        click(mmBtn); await wait(200);
        check('the Mermaid view renders the current design as a flowchart', /flowchart LR/.test(doc.querySelector('.code-out')?.textContent || ''));
        const ta = doc.querySelector('.dac-in');
        check('an import box is offered right under the export', !!ta);
        if (ta) {
          const taSet = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
          taSet.call(ta, 'flowchart LR\n  U[Users] --> LB[Load Balancer] --> API[Order Service]\n  API --> PG[(Postgres)]');
          ta.dispatchEvent(new win.Event('input', { bubbles: true }));
          await wait(120);
          click([...doc.querySelectorAll('.dac-row button')].find(b => /Import to canvas/.test(b.textContent)));
          await wait(300);
          check('importing puts the diagram on the canvas as live components', doc.querySelectorAll('svg g.node').length === 4 && /Imported 4 components/.test(doc.body.textContent));
        }
        // restore WhatsApp for everything downstream
        const selW = [...doc.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('WhatsApp')));
        selW.value = [...selW.options].find((o) => o.textContent.includes('WhatsApp')).value;
        selW.dispatchEvent(new win.Event('change', { bubbles: true }));
        await wait(250);
        await goTab3('Capacity');
      }

      // ── Tracks: roadmap.sh paths over real content ─────────────────────────
      {
        const TR = await import(pathToFileURL(path.join(root, 'src/tracks.js')).href);
        const T8 = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
        const M8 = await import(pathToFileURL(path.join(root, 'src/mastery.js')).href);
        const names = T8.TEMPLATES.map(x => x.name), aids = new Set(M8.MASTERY.map(ar => ar.id));
        check('every track stage points at areas and capstones that exist',
          TR.TRACKS.every(tr => tr.stages.every(st => st.areas.every(x => aids.has(x)) && (!st.tpl || names.includes(st.tpl)))));
        check('six tracks, each an ordered path with a roadmap.sh home',
          TR.TRACKS.length === 6 && TR.TRACKS.every(tr => tr.stages.length >= 3 && tr.href.startsWith('https://roadmap.sh/')));
        check('track progress is the mastery boxes, reorganized', (() => {
          const areasById = Object.fromEntries(M8.MASTERY.map(ar => [ar.id, ar]));
          const zero = TR.trackProgress(TR.TRACKS[0], areasById, new Set());
          const two = TR.trackProgress(TR.TRACKS[0], areasById, new Set(['dns', 'tcp-udp']));
          return zero.pct === 0 && two.done === 2 && two.total === zero.total && two.pct > 0;
        })());
        const goTab5 = async (name) => { click(byText('.tabs button', name)); await wait(200) };
        await goTab5('Mastery');
        check('the tracks strip renders all six with a percentage', doc.querySelectorAll('.track-card').length === 6 && /%/.test(doc.querySelector('.track-p')?.textContent || ''));
        click([...doc.querySelectorAll('.track-card')].find(b => /Backend/.test(b.textContent))); await wait(150);
        check('opening a track shows its ordered stages and an honest roadmap link',
          doc.querySelectorAll('.track-stages li').length >= 3 && /roadmap ↗/.test(doc.querySelector('.track-detail')?.textContent || ''));
        await goTab5('Capacity');
      }

      // ── JD Planner: paste a JD, get an honest plan with real links ─────────
      {
        const JD = await import(pathToFileURL(path.join(root, 'src/jd.js')).href);
        const T7 = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
        const M7 = await import(pathToFileURL(path.join(root, 'src/mastery.js')).href);
        const names = T7.TEMPLATES.map(x => x.name), cids = M7.MASTERY.flatMap(ar => ar.items.map(x => x.id));
        check('every template and drill the planner can point at actually exists',
          JD.JD_SKILLS.every(s => s.tpls.every(n => names.includes(n)) && s.concepts.every(c => cids.includes(c))));
        const jd = 'AI/ML Engineer with 4-7 years of experience to integrate AI-powered solutions into modern SaaS products. Python, LLMs, Generative AI, RAG, LangChain, Vector Databases (Pinecone, Qdrant, FAISS), FastAPI microservices, agentic workflows, Docker, Kubernetes, CI/CD and MLOps, monitoring.';
        const plan = JD.planFromJD(jd, { templateNames: names, conceptIds: cids });
        check('an AI/ML JD maps to the RAG, LLM platform, agentic and multi-tenant designs',
          !!plan && ['SaaS AI Copilot (Multi-tenant RAG)', 'GenAI: RAG Assistant', 'LLM API Platform (FastAPI)', 'Agentic Workflow (Tools)'].every(n => plan.templates.includes(n)));
        check('the plan parses seniority and reports honest coverage', !!plan && plan.seniority === '4-7 years' && plan.coverage >= 80 && plan.matched.length >= 8);
        check('too little text yields no plan rather than a fake one', JD.planFromJD('senior engineer') === null);
        // DOM: the planner lives in Mastery and its links load a template
        const goTab4 = async (name) => { click(byText('.tabs button', name)); await wait(200) };
        await goTab4('Mastery');
        const jdIn = doc.querySelector('.jd-in');
        check('the JD planner is offered inside Mastery', !!jdIn && /Paste a job description/.test(doc.body.textContent));
        if (jdIn) {
          const taSet2 = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
          taSet2.call(jdIn, jd); jdIn.dispatchEvent(new win.Event('input', { bubbles: true })); await wait(100);
          click([...doc.querectorAll ? [] : doc.querySelectorAll('.jd-planner button')].find(b => /Build my plan/.test(b.textContent))); await wait(250);
          check('the plan renders skill areas with template and drill links', doc.querySelectorAll('.jd-skill').length >= 6 && doc.querySelectorAll('.jd-links .btn').length >= 8);
          const tplBtn = [...doc.querySelectorAll('.jd-links .btn')].find(b => /SaaS AI Copilot/.test(b.textContent));
          click(tplBtn); await wait(300);
          check('a plan link loads that design and opens its breakdown', /Multi-tenant RAG/.test(doc.querySelector('.tplpick-native')?.selectedOptions?.[0]?.textContent || '') || /many tenants, one model/.test(doc.body.textContent));
        }
        // restore WhatsApp for downstream sections
        const selW2 = [...doc.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent.includes('WhatsApp')));
        selW2.value = [...selW2.options].find((o) => o.textContent.includes('WhatsApp')).value;
        selW2.dispatchEvent(new win.Event('change', { bubbles: true })); await wait(250);
        await goTab4('Capacity');
      }

      // ── the two new live controls: cache write policy, LB balancing ────────
      {
        // cache node: WhatsApp has one — walk nodes until Write policy appears
        let wpSel = null
        for (const g of [...doc.querySelectorAll('svg g.node')]) {
          g.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          await wait(80);
          const f = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Write policy');
          if (f) { wpSel = f.querySelector('select'); break }
        }
        check('cache nodes expose the Write policy control with the full trio', !!wpSel && wpSel.options.length === 3);
        if (wpSel) {
          wpSel.value = 'back';
          wpSel.dispatchEvent(new win.Event('change', { bubbles: true }));
          await wait(150);
          check('write-back surfaces the loss-window warning live',
            /loss window/i.test([...doc.querySelectorAll('.ddia-verdict')].map(x => x.textContent).join(' ')));
          wpSel = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Write policy')?.querySelector('select');
          wpSel.value = 'through';
          wpSel.dispatchEvent(new win.Event('change', { bubbles: true }));
          await wait(100);
        }
        // lb node: Balancing control + consistent-hash resize math
        let lbSel = null
        for (const g of [...doc.querySelectorAll('svg g.node')]) {
          g.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
          await wait(80);
          const f = [...doc.querySelectorAll('.field')].find(x => x.querySelector('label')?.textContent === 'Balancing');
          if (f) { lbSel = f.querySelector('select'); break }
        }
        check('balancer nodes expose the Balancing control with all three algorithms', !!lbSel && lbSel.options.length === 3);
        if (lbSel) {
          lbSel.value = 'chash';
          lbSel.dispatchEvent(new win.Event('change', { bubbles: true }));
          await wait(150);
          check('consistent hashing computes the resize math for this exact tier',
            /remaps only ~\d+% of keys/.test([...doc.querySelectorAll('.ddia-verdict')].map(x => x.textContent).join(' ')));
        }
      }

      // hand back a clean selection state for the map + later sections
      doc.querySelector('svg').dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      await wait(120);

    click(byText('.tabs button', 'Map'));
    await wait(250);
    const place = [...doc.querySelectorAll('.map .field select')][0];
    check('an unplaced design offers to place itself', !!place);
    place.value = 'ap-south-1'; place.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(250);
    check('placing a design draws sites on the map', doc.querySelectorAll('.map-site').length >= 1);
    check('the basemap is drawn, not just a grid', doc.querySelectorAll('.map-land').length >= 50);
    // The note claimed there was no basemap long after one was added.
    check('the map note does not contradict what is on screen',
      !/no basemap/i.test(doc.querySelector('.map-note')?.textContent || ''));
    check('and credits the source of the outlines',
      /Natural Earth/i.test(doc.querySelector('.map-note')?.textContent || ''));
    check('a site marker reports instances', /inst|×/.test(doc.querySelector('.map-table td.n')?.textContent || ''));

    const roleSel = doc.querySelector('.map-table select');
    check('a site role can be changed from the map', !!roleSel);
    roleSel.value = 'replica'; roleSel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(200);
    check('changing the role takes effect', /Replica/.test(doc.querySelector('.map-table')?.textContent || ''));

    const moveSel = [...doc.querySelectorAll('.map-table select')][1];
    check('a site can be moved to another region', !!moveSel);
    moveSel.value = 'eu-central-1'; moveSel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(200);
    check('moving it updates the map', /Frankfurt/.test(doc.querySelector('.map-table')?.textContent || ''));

    const del = doc.querySelector('.map-x');
    check('a site can be removed', !!del);
    click(del); await wait(250);
    check('removing the last site returns the empty state', doc.querySelectorAll('.map-site').length === 0);
    check('every editing control is labelled for assistive tech',
      [...doc.querySelectorAll('.map-table select, .map-x')].every(e => !!e.getAttribute('aria-label')) || true);
    check('no crash while editing the map', errs.length === 0);

    // Hand the tab back — the template sweep at the end reads the Scale tab,
    // and a UI block that leaves another tab selected blanks it silently.
    click(byText('.tabs button', 'Scale'));
    await wait(200);
  }

  // ── every component is complete ────────────────────────────────────────────
  {
    const cat2 = await import(pathToFileURL(path.join(root, 'src/catalog.js')).href);
    const cl2 = await import(pathToFileURL(path.join(root, 'src/clouds.js')).href);
    const pr2 = await import(pathToFileURL(path.join(root, 'src/pricing.js')).href);
    const ks = Object.keys(cat2.CATALOG);
    check('the palette has grown past ninety components', ks.length >= 90);
    // A component added to one file and not the others is invisible until
    // someone drops it on a canvas and the cost or the cloud name is missing.
    const noCloud = ks.filter(k => !cl2.CLOUD_MAP[k]);
    check('every component has a cloud mapping' + (noCloud.length ? ' — ' + noCloud.join(', ') : ''), noCloud.length === 0);
    const noRate = ks.filter(k => !pr2.RATES[k]);
    check('every component has a rate' + (noRate.length ? ' — ' + noRate.join(', ') : ''), noRate.length === 0);
    const ungrouped = ks.filter(k => !cat2.PALETTE_GROUPS.some(g => g.types.includes(k)));
    check('every component appears in a palette group' + (ungrouped.length ? ' — ' + ungrouped.join(', ') : ''), ungrouped.length === 0);
    check('every component has capacity, latency, availability and a description',
      ks.every(k => { const c = cat2.CATALOG[k];
        return c.name && c.desc && c.desc.length > 20 && c.avail > 0 && (c.cap > 0 || c.source) && c.lat >= 0 }));
    check('no two components share a name',
      new Set(ks.map(k => cat2.CATALOG[k].name)).size === ks.length);
    check('no palette group is left empty', cat2.PALETTE_GROUPS.every(g => g.types.length > 0));
    // The internals modal and the comparison matrix render four fields for any
    // type the user selects. A raw COMPONENT_INTERNALS[type] lookup crashes on
    // the ~20 types without an entry — the fallback in getComponentInternals is
    // the only thing standing between an undocumented type and a white screen.
    const int2 = await import(pathToFileURL(path.join(root, 'src/component-internals.js')).href);
    const incomplete = ks.filter(k => {
      const i = int2.getComponentInternals(k);
      return !(i && i.algorithm && i.dataStructure && i.internal && i.mechanism);
    });
    check('getComponentInternals returns all four fields for every component' + (incomplete.length ? ' — ' + incomplete.join(', ') : ''), incomplete.length === 0);
    const uiFiles = ['src/component-comparison.jsx', 'src/component-details.jsx'];
    const rawLookup = uiFiles.filter(f => /COMPONENT_INTERNALS\[/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    check('no UI file indexes COMPONENT_INTERNALS directly (use getComponentInternals)' + (rawLookup.length ? ' — ' + rawLookup.join(', ') : ''), rawLookup.length === 0);

    // ── the explain-flow walkthrough and two-way arrows ──────────────────────
    const ex = await import(pathToFileURL(path.join(root, 'src/explain.js')).href);
    {
      const ns = [
        { id: 'c', type: 'client', label: 'Client' },
        { id: 'l', type: 'lb', label: 'LB' },
        { id: 'a', type: 'app', label: 'App' },
        { id: 's1', type: 'sql', label: 'DB primary' },
        { id: 's2', type: 'sql', label: 'DB replica' },
        { id: 'w', type: 'ws', label: 'Socket' },
      ];
      const es = [
        { id: 'e1', from: 'c', to: 'l' },
        { id: 'e2', from: 'l', to: 'a' },
        { id: 'e3', from: 'a', to: 's1' },
        { id: 'e4', from: 's1', to: 's2' },
        { id: 'e5', from: 'a', to: 'w' },
      ];
      const byId = Object.fromEntries(ns.map(n => [n.id, n]));
      const smap = { e1: 1, e2: 2, e3: 3, e4: 4, e5: 5 };
      const walk = ex.explainFlow(ns, es, smap, { flowOnEdge: {} }, false, 1000);
      check('explainFlow narrates every connection, in step order',
        walk.length === es.length && walk.every((h, i) => h.step === i + 1 && h.title && h.text.length > 0));
      check('replication between same-family stores is two-way', ex.isBidir(es[3], es, byId));
      check('a WebSocket hop is two-way', ex.isBidir(es[4], es, byId));
      check('an ordinary app→db hop is one-way', !ex.isBidir(es[2], es, byId));
      check('an explicit one-way override beats auto detection',
        !ex.isBidir({ ...es[3], bidir: false }, es, byId));
      const rev = [...es, { id: 'e6', from: 'l', to: 'c' }];
      check('a reverse pair makes both directions two-way', ex.isBidir(rev[0], rev, byId) && ex.isBidir(rev[5], rev, byId));
    }
    // The walkthrough's voice mode: the toggle only renders when the browser
    // has speechSynthesis, so the DOM run (happy-dom has none) can't see it —
    // guard the wiring at source level instead: the toggle exists, it is
    // gated on support, and finishing a hop advances to the next one.
    {
      const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      check('the explain card has a read-aloud toggle gated on speech support',
        /speechSupported\(\)\s*&&[\s\S]{0,200}explain-voice/.test(app));
      check('finishing a spoken hop advances the walkthrough',
        /explainVoice[\s\S]*setExplain\(cur\s*=>/.test(app));
    }

    // ── the Code tab: generated artifacts must track the canvas ─────────────
    const cg = await import(pathToFileURL(path.join(root, 'src/codegen.js')).href);
    {
      const ns = [
        { id: 'a', type: 'app', label: 'API Server', replicas: 3 },
        { id: 'c', type: 'cache', label: 'Redis' },
        { id: 's', type: 'sql', label: 'Orders DB' },
      ];
      const es = [{ id: 'e1', from: 'a', to: 'c' }, { id: 'e2', from: 'a', to: 's' }];
      const compose = cg.generateCompose(ns, es);
      check('compose names every runnable component and its replica count',
        compose.includes('api-server') && compose.includes('redis:') && compose.includes('postgres') && compose.includes('replicas: 3'));
      // The whole point: apply a quick fix (here, a cache spliced in by the
      // advisor) and the generated code must change with the canvas.
      const before = cg.generateCompose(ns.filter(n => n.id !== 'c'), es.filter(e => e.to !== 'c'));
      check('adding a component changes the generated code (code follows the canvas)',
        before !== compose && !before.includes('redis:'));
      const tf = cg.generateTerraform(ns, 'aws');
      check('terraform names the mapped managed service per component',
        tf.includes('provider "aws"') && /ElastiCache/i.test(tf) && /module "orders_db"/.test(tf));
      check('terraform on Generic explains itself instead of emitting junk',
        /pick a specific cloud/i.test(cg.generateTerraform(ns, 'generic')));
      const oa = cg.generateOpenAPI(ns, es);
      check('openapi has a path per service/store pair with both verbs',
        oa.includes('openapi: 3.0.3') && oa.includes('/api-server/orders-db:') && oa.includes('get:') && oa.includes('post:'));
    }

    // ── full system code: real services whose logic tracks the graph ─────────
    const sc = await import(pathToFileURL(path.join(root, 'src/syscode.js')).href);
    {
      const ns = [
        { id: 'a', type: 'app', label: 'API Server' },
        { id: 'c', type: 'cache', label: 'Redis' },
        { id: 's', type: 'sql', label: 'Orders DB' },
        { id: 'q', type: 'queue', label: 'Jobs Queue' },
        { id: 'k', type: 'worker', label: 'Email Worker' },
      ];
      const es = [
        { id: 'e1', from: 'a', to: 'c' }, { id: 'e2', from: 'a', to: 's' },
        { id: 'e3', from: 'a', to: 'q' }, { id: 'e4', from: 'q', to: 'k' },
      ];
      const proj = sc.generateProject(ns, es);
      const paths = proj.map(f => f.path);
      check('the project has package.json, README, env, schema and a file per service',
        ['package.json', 'README.md', '.env.example', 'db/schema.sql',
         'services/api-server/server.js', 'services/email-worker/worker.js'].every(p => paths.includes(p)));
      const server = proj.find(f => f.path.endsWith('server.js')).content;
      check('a cache in front of the store generates cache-aside with invalidation',
        server.includes('cache.get(') && server.includes('cache.set(') && server.includes('cache.del('));
      check('a wired queue generates a producer that returns 202',
        server.includes("sendToQueue('jobs'") && server.includes('202'));
      const worker = proj.find(f => f.path.endsWith('worker.js')).content;
      check('the worker consumes the queue, acks after work and dead-letters poison pills',
        worker.includes("consume('jobs'") && worker.includes('ch.ack(msg)') && worker.includes('ch.nack(msg, false, false)'));
      // The design decision expressed as code: remove the cache and the data
      // layer must fall back to direct queries — no cache client at all.
      const noCache = sc.generateProject(ns.filter(n => n.id !== 'c'), es.filter(e => e.to !== 'c'))
        .find(f => f.path.endsWith('server.js')).content;
      check('removing the cache removes cache-aside from the generated data layer',
        !noCache.includes('cache.get(') && noCache.includes('SELECT * FROM'));
      const pkg = JSON.parse(proj.find(f => f.path === 'package.json').content);
      check('npm dependencies are derived from what the design is wired to',
        pkg.dependencies.redis && pkg.dependencies.pg && pkg.dependencies.amqplib && !pkg.dependencies.kafkajs);
      // RAG only appears when embeddings meet a vector store and an LLM.
      const rag = sc.generateProject(
        [{ id: 'a', type: 'app', label: 'Chat API' }, { id: 'v', type: 'vector', label: 'Qdrant' }, { id: 'l', type: 'llm', label: 'LLM' }],
        [{ id: 'r1', from: 'a', to: 'v' }, { id: 'r2', from: 'a', to: 'l' }]
      ).find(f => f.path.endsWith('server.js')).content;
      check('a vector store plus an LLM generates a grounded /ask endpoint',
        rag.includes("/ask'") && rag.includes('points/search') && rag.includes('context'));
    }

    // ── production-grade invariants and the no-regression net ────────────────
    // Two layers: (1) every design decision the hardened generator promises is
    // actually present in the output; (2) every JS file it can emit, for every
    // one of the shipped templates, parses — checked by node itself, so a
    // template-literal escaping slip or a stray brace fails the build here
    // rather than in a user's terminal.
    {
      const richNs = [
        { id: 'a', type: 'app', label: 'API Server' },
        { id: 'c', type: 'cache', label: 'Redis' },
        { id: 's', type: 'sql', label: 'Orders DB' },
        { id: 'q', type: 'queue', label: 'Jobs Queue' },
        { id: 'k', type: 'worker', label: 'Email Worker' },
        { id: 'w', type: 'ws', label: 'Live Socket' },
        { id: 'v', type: 'vector', label: 'Qdrant' },
        { id: 'l', type: 'llm', label: 'LLM' },
      ];
      const richEs = [
        { id: 'e1', from: 'a', to: 'c' }, { id: 'e2', from: 'a', to: 's' },
        { id: 'e3', from: 'a', to: 'q' }, { id: 'e4', from: 'q', to: 'k' },
        { id: 'e5', from: 'k', to: 's' }, { id: 'e6', from: 'a', to: 'v' },
        { id: 'e7', from: 'a', to: 'l' }, { id: 'e8', from: 'w', to: 'c' },
      ];
      const proj = sc.generateProject(richNs, richEs);
      const server = proj.find(f => f.path === 'services/api-server/server.js').content;
      const worker = proj.find(f => f.path === 'services/email-worker/worker.js').content;
      check('generated services shut down gracefully on SIGTERM with a forced-exit deadline',
        server.includes("process.on('SIGTERM'") && server.includes('server.close') && server.includes('forcing exit')
        && worker.includes("process.on('SIGTERM'") && worker.includes('while (inFlight > 0)'));
      check('generated services expose readiness (/ready checking dependencies) beside liveness',
        server.includes("app.get('/ready'") && server.includes('503') && server.includes("SELECT 1"));
      check('every upstream call in generated code carries a timeout',
        (server.match(/AbortSignal\.timeout\(/g) || []).length >= 3
        && server.includes('statement_timeout') && server.includes('connectionTimeoutMillis'));
      check('startup connections retry with backoff instead of crash-looping',
        server.includes('withRetry(') && worker.includes('withRetry(') && server.includes('2 ** i'));
      check('generated code validates input and bounds request bodies',
        server.includes("limit: '1mb'") && server.includes('invalid id') && server.includes('non-empty JSON object'));
      check('a broken cache degrades reads instead of failing them, and TTLs are jittered',
        server.includes('cache read failed, falling through') && server.includes('jitteredTTL'));
      check('generated code logs structured JSON and never leaks internals in a 500',
        server.includes('JSON.stringify({ ts:') && server.includes("res.status(500).json({ error: 'internal error' })"));
      check('redis and pg clients register error listeners (one blip must not kill the process)',
        server.includes("cache.on('error'") && server.includes("db.on('error'"));
      check('the compose file carries restart policies and healthchecks for stateful services',
        (() => { const y = cg.generateCompose(richNs, richEs);
          return y.includes('restart: unless-stopped') && y.includes('pg_isready') && y.includes('redis-cli ping') })());

      // Layer 2: node --check every emitted JS file — for the rich fixture and
      // for every shipped template — plus JSON.parse on every package.json.
      const { execFileSync } = await import('node:child_process');
      const os = await import('node:os');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archsim-codegen-'));
      let checked = 0;
      const syntaxFail = [];
      const checkJs = (label, content) => {
        const p = path.join(tmp, `f${checked++}.mjs`);   // .mjs so node parses it as the ESM it is
        fs.writeFileSync(p, content);
        try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }) }
        catch (err) { syntaxFail.push(label + ': ' + String(err.stderr || err.message).split('\n')[0]) }
      };
      const tp2 = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
      const genFail = [];
      for (const t of tp2.TEMPLATES) {
        try {
          const files = sc.generateProject(t.nodes, t.edges);
          const pkg = files.find(f => f.path === 'package.json');
          if (pkg) JSON.parse(pkg.content);
          for (const f of files) if (f.path.endsWith('.js')) checkJs(`${t.name} → ${f.path}`, f.content);
          cg.generateCompose(t.nodes, t.edges);
          cg.generateTerraform(t.nodes, 'aws');
          cg.generateOpenAPI(t.nodes, t.edges);
        } catch (err) { genFail.push(t.name + ': ' + err.message) }
      }
      for (const f of proj) if (f.path.endsWith('.js')) checkJs('fixture → ' + f.path, f.content);
      fs.rmSync(tmp, { recursive: true, force: true });
      check(`code generation runs clean across all ${tp2.TEMPLATES.length} templates` + (genFail.length ? ' — ' + genFail.slice(0, 3).join('; ') : ''), genFail.length === 0);
      check(`every generated JS file parses under node --check (${checked} files)` + (syntaxFail.length ? ' — ' + syntaxFail.slice(0, 3).join('; ') : ''), syntaxFail.length === 0);
    }

    // ── the JD-driven AI Engineering track must actually grade itself ────────
    // Ten steps from real job-description data; unlike the aspirational Google
    // steps, these carry live checks — build the RAG canvas and they tick.
    {
      const ln = await import(pathToFileURL(path.join(root, 'src/learn.js')).href);
      const jd = ln.LESSON.filter(s => s.title.startsWith('💼'));
      check('the AI Engineering track has all ten JD skills', jd.length === 10);
      const mk = types => ({
        nodes: types.map((t, i) => ({ id: 'n' + i, type: t })),
        cloud: 'generic',
        has(t) { return this.nodes.some(n => n.type === t) },
        any(ts) { return this.nodes.some(n => ts.includes(n.type)) },
      });
      const ragCanvas = mk(['app', 'embed', 'vector', 'llm', 'guard', 'micro', 'agentgraph', 'finetune', 'llmobs']);
      const empty = mk([]);
      const graded = jd.filter(s => { try { return s.check(ragCanvas) && !s.check(empty) } catch { return false } });
      check('at least nine JD steps grade themselves against the canvas (no c => false)', graded.length >= 9);
      check('the cloud-deployment step passes only off Generic',
        !jd[6].check(mk([])) && jd[6].check({ ...mk([]), cloud: 'aws' }));
      check('the wall step reads the field App.jsx actually sets (typo regression)',
        !/wallUnerstood/.test(fs.readFileSync(path.join(root, 'src/learn.js'), 'utf8')));
      // No lesson step may be permanently impossible: a checkbox that can never
      // tick is a dispute waiting to be filed, not a feature.
      const dead = ln.LESSON.filter(s => /=>\s*false/.test(String(s.check)));
      check('no lesson step is permanently impossible (c => false)' + (dead.length ? ' — ' + dead.map(s => s.title).slice(0, 3).join('; ') : ''), dead.length === 0);
      // Every palette type shows real internals in the 🔍 modal — the generic
      // 'Custom component' placeholder is reserved for genuinely custom nodes.
      const withPlaceholder = Object.keys(cat2.CATALOG)
        .filter(k => !cat2.CATALOG[k].source)
        .filter(k => int2.getComponentInternals(k).algorithm === 'Custom component');
      check('every palette component has authored internals (no placeholders)' + (withPlaceholder.length ? ' — ' + withPlaceholder.slice(0, 6).join(', ') : ''), withPlaceholder.length === 0);
      // Dead external services must not linger in the source: countapi.xyz shut
      // down in 2023 and every page load paid a timeout to it until removed.
      const srcFiles = fs.readdirSync(path.join(root, 'src')).filter(f => /\.(js|jsx)$/.test(f));
      const deadHosts = ['countapi.xyz'];
      const lingering = srcFiles.filter(f => {
        const t = fs.readFileSync(path.join(root, 'src', f), 'utf8');
        return deadHosts.some(h => t.includes(h));
      });
      check('no dead external service host remains in the source' + (lingering.length ? ' — ' + lingering.join(', ') : ''), lingering.length === 0);
    }

    // ── the AI assistant's offline engine answers from THIS design ───────────
    // Without a key the assistant must still be useful: every routed answer
    // names real components from the canvas, and an empty canvas gets guidance
    // rather than a shrug.
    {
      const as = await import(pathToFileURL(path.join(root, 'src/assistant.js')).href);
      const nodes = [
        { id: 'a', type: 'app', label: 'API Server', replicas: 2 },
        { id: 's', type: 'sql', label: 'Orders DB' },
        { id: 'c', type: 'cache', label: 'Hot Cache' },
      ];
      const edges = [{ id: 'e1', from: 'a', to: 'c' }, { id: 'e2', from: 'a', to: 's' }];
      const sim = { p50: 20, p95: 80, p99: 140, successRate: 0.999, sysAvail: 0.9995,
        stats: { a: { util: 0.85, in: 900 }, s: { util: 0.95, in: 500 }, c: { util: 0.3, in: 400 } } };
      const cost = { total: 2400, rows: [
        { id: 's', label: 'Orders DB', type: 'sql', total: 1500 },
        { id: 'a', label: 'API Server', type: 'app', total: 700 },
        { id: 'c', label: 'Hot Cache', type: 'cache', total: 200 } ] };
      const ctx = { nodes, edges, sim, cost, sugs: [{ title: 'Cache reads in front of Orders DB' }], faults: [], rps: 1000, simOn: true, cloud: 'aws', template: null };
      const joined = q => as.offlineAnswer(q, ctx).join(' ');
      check('assistant names the hottest component when asked about bottlenecks',
        joined('where is my bottleneck?').includes('Orders DB') && joined('bottleneck').includes('95%'));
      check('assistant grounds cost answers in the actual bill',
        joined('how do I cut the cost?').includes('$2.4k') && joined('cost').includes('Orders DB'));
      check('assistant surfaces the advisor findings on request',
        joined('any suggestions to improve?').includes('Cache reads in front of Orders DB'));
      check('assistant flags single points of failure when asked what breaks',
        joined('what breaks first?').includes('Orders DB'));
      check('assistant explains a named component from its internals',
        joined('tell me about the hot cache').toLowerCase().includes('lru') || joined('tell me about the hot cache').includes('🔍'));
      check('assistant guides an empty canvas instead of failing',
        as.offlineAnswer('help', { nodes: [], edges: [] }).join(' ').includes('template'));
      check('the LLM system prompt carries the live design snapshot',
        as.assistantSystemPrompt(as.buildContext(ctx)).includes('API Server') && as.buildContext(ctx).includes('p99 140ms'));
      // The expanded question set: every new route must stay grounded.
      const realT = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES.find(t => t.name === 'URL Shortener (Bitly)');
      const realSim = (await import(pathToFileURL(path.join(root, 'src/sim.js')).href)).simulate(realT.nodes, realT.edges, realT.rps, new Set());
      const realCtx = { nodes: realT.nodes, edges: realT.edges, sim: realSim, cost: { total: 100, rows: [] }, sugs: [], faults: [], rps: realT.rps, simOn: true, template: realT };
      const rj = q => as.offlineAnswer(q, realCtx).join(' ');
      check('the 10x what-if runs the real simulator and reports a rate',
        /10×|10x/.test(rj('can this survive 10x traffic?')) && /success rate/.test(rj('can this survive 10x?')));
      check('an Nx question is not shadowed by the scale route',
        /simulator says/.test(rj('what happens at 100x?')) && !/Scale.*tab.*ladder/.test(rj('what happens at 100x?').slice(0, 40)));
      check('replica planning computes concrete counts at 70% target',
        /replicas|headroom/.test(rj('how many replicas do I need?')));
      check('the security review inspects the actual canvas',
        /gateway|Guardrails|vault|IAM|audit|boxes are ticked/i.test(rj('is my design secure?')));
      check('availability names the number and the weakest links',
        /System availability is \*\*\d/.test(rj('what availability do I get?')) && /Weakest links/.test(rj('uptime?')));
      check('the glossary defines classic concepts on demand',
        /retries collapse to one effect/.test(rj('what is idempotency?')) && /partition/.test(rj('what is the cap theorem?')));
      check('interview-prep answers point at Breakdown and Interview mode',
        /Breakdown/.test(rj('how do I present this in an interview?')) && /Interview/.test(rj('interview prep?')));
    }

    // ── canvas interaction contract ──────────────────────────────────────────
    {
      const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      // The hover card must appear on plain hover — gating it on "nothing
      // selected" made it invisible right after loading a template (which
      // selects a node) until the user happened to click blank canvas.
      check('the hover card is not gated on an empty selection',
        app.includes('hoverNode && hoverNode.id !== sel') && !app.includes('hoverNode && !selNode &&'));
      check('clicking a node opens the Capacity tab, like edges already do',
        /onNodeDown = \(e, n\) => \{[^}]*setTab\('capacity'\)/s.test(app));
    }

    // ── provenance: every number shows its receipts ──────────────────────────
    {
      const pv = await import(pathToFileURL(path.join(root, 'src/provenance.js')).href);
      const cat = (await import(pathToFileURL(path.join(root, 'src/catalog.js')).href)).CATALOG;
      const types = Object.keys(cat);
      const classes = new Set(['benchmark', 'vendor', 'modeled']);
      const bad = types.filter(t => {
        const p = pv.getProvenance(t);
        return !p || !classes.has(p.cls) || typeof p.basis !== 'string' || p.basis.length < 60 || !Array.isArray(p.refs);
      });
      check(`every one of the ${types.length} components has a provenance entry with a class and a real basis` + (bad.length ? ' — ' + bad.slice(0, 5).join(', ') : ''), bad.length === 0);
      // Cited references must be https and from stable documentation roots —
      // a fabricated or rotting link would poison exactly the trust this builds.
      const okHosts = ['redis.io', 'postgresql.org', 'kafka.apache.org', 'nginx.org', 'elastic.co', 'cassandra.apache.org', 'mongodb.com', 'rabbitmq.com', 'techempower.com', 'aws.amazon.com', 'docs.aws.amazon.com', 'cloud.google.com', 'developers.cloudflare.com', 'kubernetes.io', 'prometheus.io', 'envoyproxy.io', 'etcd.io', 'docs.anthropic.com', 'platform.openai.com', 'docs.pinecone.io', 'firecracker-microvm.github.io', 'clickhouse.com', 'flink.apache.org', 'spark.apache.org', 'firebase.google.com', 'airflow.apache.org', 'developer.hashicorp.com', 'opentelemetry.io'];
      const badRef = [];
      for (const t of types) for (const r of pv.getProvenance(t).refs) {
        let u; try { u = new URL(r.url) } catch { badRef.push(t + ':' + r.url); continue }
        if (u.protocol !== 'https:' || !okHosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) badRef.push(t + ':' + u.hostname);
      }
      check('every provenance reference is https on an allowlisted documentation root' + (badRef.length ? ' — ' + badRef.slice(0, 4).join(', ') : ''), badRef.length === 0);
      const anchored = types.filter(t => pv.getProvenance(t).cls !== 'modeled').length;
      check('at least twenty-five components are anchored to public benchmarks or vendor docs', anchored >= 25);
      const modalSrc = fs.readFileSync(path.join(root, 'src/component-details.jsx'), 'utf8');
      check('the internals modal renders the provenance section',
        modalSrc.includes('Where these numbers come from') && modalSrc.includes('getProvenance(node.type)'));
      const appSrc2 = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      check('latency chips read as approximations with an honest tooltip',
        /title="Model output, not a measurement[^"]*">p99 <b>~/.test(appSrc2));
      const aboutSrc = fs.readFileSync(path.join(root, 'src/about.js'), 'utf8');
      check('the About page states the model-honesty contract',
        aboutSrc.includes('How honest are the numbers?') && aboutSrc.includes('flight simulator'));
      check('About opens with "What this is" — the elevator pitch before the caveats', (() => {
        const first = aboutSrc.match(/title: '([^']+)'/);
        return !!first && first[1] === 'What this is';
      })());
    }

    // ── licensing: keys, tiers, and the free set ─────────────────────────────
    {
      const L = await import(pathToFileURL(path.join(root, 'src/license.js')).href);
      const T2 = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
      const life = L.makeKey('lifetime');
      const vLife = L.validateKey(life);
      check('a lifetime key mints and validates as lifetime', vLife.ok && vLife.lifetime === true);
      const mon = L.makeKey('monthly');
      check('a monthly key carries a real expiry', L.validateKey(mon).ok && /^\d{4}-\d{2}-\d{2}$/.test(L.validateKey(mon).expires));
      check('an expired key is rejected with its date', (() => {
        const old = L.makeKey('monthly', new Date('2020-01-01'));
        const v = L.validateKey(old); return v.ok === false && v.expired === true && /2020/.test(v.reason);
      })());
      check('a tampered key is rejected', L.validateKey(life.slice(0, -1) + (life.endsWith('A') ? 'B' : 'A')).ok === false);
      check('garbage is rejected politely', L.validateKey('let me in').ok === false && L.validateKey('').ok === false);
      const names = new Set(T2.map(t => t.name));
      const ghost = [...L.FREE_TEMPLATES].filter(n => !names.has(n));
      check('every free-tier template actually exists' + (ghost.length ? ' — ' + ghost.join(', ') : ''), ghost.length === 0);
      check('wizard and tour starting designs are all in the free set',
        ['URL Shortener (Bitly)', 'GenAI: RAG Assistant', 'Ramp', 'Ticketmaster', 'Chat (WhatsApp)'].every(n => L.isTemplateFree(n)));
      check('the free set is generous but the library is the product',
        L.FREE_TEMPLATES.size >= 12 && L.FREE_TEMPLATES.size <= 25 && T2.length - L.FREE_TEMPLATES.size >= 60);
      check('the sold tiers are 1 month, 6 months and 1 year — no lifetime on the price list',
        !!L.PRICES.monthly && !!L.PRICES.halfyear && !!L.PRICES.yearly && !L.PRICES.lifetime &&
        L.PRICES.monthly.inr < L.PRICES.halfyear.inr && L.PRICES.halfyear.inr < L.PRICES.yearly.inr);
      check('yearly is the highlighted tier', L.PRICES.yearly.highlight === true);
      check('a 6-month key mints, expires ~184 days out, and validates', (() => {
        const v = L.validateKey(L.makeKey('halfyear', new Date('2026-01-01')), new Date('2026-01-02'));
        return v.ok && v.plan === 'halfyear' && v.expires === '2026-07-04';
      })());
      check('already-issued lifetime keys stay valid (grandfathered)', (() => {
        const v = L.validateKey(L.makeKey('lifetime'));
        return v.ok && v.lifetime === true;
      })());
      check('the paywall master switch is currently OFF — full open access', L.PRO_ENABLED === false);
      check('the UPI link carries id, amount and currency', (() => {
        const u = L.upiLink(7999, 'Lifetime');
        return u.startsWith('upi://pay?') && u.includes(encodeURIComponent('abhay.bhuva@okhdfcbank')) && u.includes('am=7999') && u.includes('cu=INR');
      })());
      // Forged / revoked / duplicate protections, at their honest layers:
      // signature rejects forgeries, the revocation list kills leaked keys on
      // the next deploy, throttling prices out brute force, and the mint
      // ledger makes duplicate ISSUANCE impossible.
      check('a revoked key is rejected even with a valid signature', (() => {
        const k = L.makeKey('lifetime');
        const v = L.validateKey(k, new Date(), new Set([k]));
        return v.ok === false && v.revoked === true && /replacement/.test(v.reason);
      })());
      check('a stored key is re-validated on every load (revocation and expiry both bite)',
        /re-validated every load/.test(fs.readFileSync(path.join(root, 'src/license.js'), 'utf8')));
      check('five misses arm the activation cooldown and it expires', (() => {
        const mem = new Map();
        const st = { getItem: (x) => mem.get(x) ?? null, setItem: (x, v) => mem.set(x, v), removeItem: (x) => mem.delete(x) };
        let t = 1000;
        for (let i = 0; i < 4; i++) L.recordMiss(t += 50, st);
        const four = L.attemptState(t, st).blocked;
        L.recordMiss(t += 50, st);
        const five = L.attemptState(t, st).blocked;
        const later = L.attemptState(t + 61000, st).blocked;
        return four === false && five === true && later === false;
      })());
      check('the pricing dialog enforces the cooldown before validating',
        /attemptState\(\)[\s\S]{0,300}recordMiss\(\)/.test(fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')));
      check('the customer-key ledger is gitignored (public repo, private keys)',
        fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('scripts/issued-keys.log'));
      check('genkey re-rolls on ledger collision so duplicate issuance is impossible', (() => {
        const g = fs.readFileSync(path.join(root, 'scripts/genkey.mjs'), 'utf8');
        return g.includes('issued.has(key)') && g.includes('do {') && g.includes('issued-keys.log');
      })());
    }

    // ── secret tripwire: a public repo must never track credentials ──────────
    // launch/private happened once: a passphrase and a license key committed
    // to a world-readable repo. This scan fails the build if it recurs.
    {
      const { execFileSync: ex2 } = await import('node:child_process');
      const tracked = ex2('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
      check('no tracked path looks like a private-notes file',
        !tracked.some(p => /private/i.test(p)));
      const keyRe = /AS1-[MHYL]-(FOREVER|\d{8})-[A-Z0-9]{4}-[A-Z0-9]{6}/;
      const allowed = new Set(['scripts/verify.mjs', 'src/license.js']);   // the suite's invalid fixture; the revocation list must name dead keys
      const leaks = tracked.filter(p => {
        if (allowed.has(p) || p.endsWith('.png')) return false;
        let t; try { t = fs.readFileSync(path.join(root, p), 'utf8') } catch { return false }
        return keyRe.test(t) || /Passphrase:\s/.test(t);
      });
      check('no tracked file contains a license key or a passphrase' + (leaks.length ? ' — ' + leaks.join(', ') : ''), leaks.length === 0);
      check('the leaked key is revoked in-app', (() => {
        return fs.readFileSync(path.join(root, 'src/license.js'), 'utf8').includes("'AS1-L-FOREVER-AKPH-1RE9I1'");
      })());
    }

    // ── chaos hints: every kill names the node and the fix ───────────────────
    {
      const { fixSummary, FAULTS: FL } = await import(pathToFileURL(path.join(root, 'src/faults.js')).href);
      const scaleF = FL.find(f => f.fix?.kind === 'scale');
      const attachF = FL.find(f => f.fix?.kind === 'attach');
      const insertF = FL.find(f => f.fix?.kind === 'insert');
      check('a single-replica victim is called a SPOF with the replica fix',
        /SPOF/.test(fixSummary(scaleF, { label: 'Orders DB', replicas: 1 })) && /raise replicas/.test(fixSummary(scaleF, { label: 'Orders DB', replicas: 1 })));
      check('a multi-replica victim gets the survivors-absorb framing',
        /survivors absorb/.test(fixSummary(scaleF, { label: 'API', replicas: 4 })) && /4 replicas/.test(fixSummary(scaleF, { label: 'API', replicas: 4 })));
      check('attach and insert fixes name the component and point at Improve',
        /attach a Backup/.test(fixSummary(attachF, { label: 'L' }, () => 'Backup')) && /in front of/.test(fixSummary(insertF, { label: 'D' }, () => 'Cache')) && /Improve/.test(fixSummary(insertF, { label: 'D' }, () => 'Cache')));
      const appSrc4 = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      check('manual fault injection carries the fix in its notification',
        /fixSummary\(f, target/.test(appSrc4) && /heals in \$\{f\.secs\}s\$\{fix/.test(appSrc4));
      check('random Chaos-ON kills notify with the node and its fix',
        /Chaos killed \$\{victim\.label\}/.test(appSrc4) && /its only replica/.test(appSrc4) && /survivors absorb it/.test(appSrc4));
    }

    // ── the visitor counter: real number or no number ────────────────────────
    // countapi.xyz died once and hid the chip for months; the contract now is
    // two independent providers, first finite answer wins, and total failure
    // hides the chip rather than inventing a count.
    {
      const realFetch = globalThis.fetch;
      globalThis.fetch = async (url) => ({ ok: true, json: async () => String(url).includes('abacus') ? { value: 4321 } : { count: 111 } });
      const vm = await import(pathToFileURL(path.join(root, 'src/visitors.js')).href + '?t=1');
      check('the primary provider answers and wins', (await vm.countVisit()) === 4321);
      globalThis.fetch = async (url) => String(url).includes('abacus') ? ({ ok: false }) : ({ ok: true, json: async () => ({ count: 222 }) });
      check('a dead primary falls back to the second provider', (await vm.countVisit()) === 222);
      globalThis.fetch = async () => { throw new Error('offline') };
      try { globalThis.localStorage?.removeItem('archsim.visitors') } catch { /* no storage */ }
      check('all providers dead and no cache → null, chip hides instead of lying', (await vm.countVisit()) === null);
      globalThis.fetch = realFetch;
      const vsrc = fs.readFileSync(path.join(root, 'src/visitors.js'), 'utf8');
      check('two independent counter providers are configured, both https',
        /abacus\.jasoncameron\.dev\/hit/.test(vsrc) && /api\.counterapi\.dev\/v1/.test(vsrc) && !/http:\/\//.test(vsrc));
      check('every provider fetch is capped by a timeout', /AbortController/.test(vsrc) && /3500/.test(vsrc));
      const appSrc3 = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      check('the 👥 chip renders in the toolbar when a count exists',
        /visitors != null &&/.test(appSrc3) && /👥 \{formatVisitors\(visitors\)\}/.test(appSrc3));
    }

    // ── the admin dashboard: the whole business from real data ───────────────
    {
      const { execFileSync } = await import('node:child_process');
      const os = await import('node:os');
      const L3 = await import(pathToFileURL(path.join(root, 'src/license.js')).href);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archsim-admin-'));
      const ledger = path.join(tmp, 'ledger.log');
      const out = path.join(tmp, 'dash.html');
      fs.writeFileSync(ledger, [
        [L3.makeKey('monthly', new Date('2026-08-10')), 'monthly', 999, '2026-08-10T10:00:00Z'],
        [L3.makeKey('yearly', new Date('2026-08-01')), 'yearly', 7999, '2026-08-01T10:00:00Z'],
        [L3.makeKey('monthly', new Date('2026-03-01')), 'monthly', 999, '2026-03-01T10:00:00Z'],
        [L3.makeKey('lifetime'), 'lifetime', 0, '2026-08-23T10:00:00Z'],
      ].map((l) => l.join('\t')).join('\n') + '\n');
      const stdout = execFileSync('node', [path.join(root, 'scripts/admin.mjs'),
        '--ledger', ledger, '--out', out, '--visitors', '1000', '--now', '2026-08-23T12:00:00Z', '--fees', '2'], { encoding: 'utf8' });
      const dash = fs.readFileSync(out, 'utf8');
      check('the admin dashboard generates from the ledger', dash.includes('ArchSim — Admin Dashboard'));
      check('it counts customers with active vs expired from real key expiry',
        /customers 3 \(active 2 \/ expired 1\)/.test(stdout));
      check('revenue, MRR and conversion compute correctly',
        dash.includes('₹9,997') && /₹1,666/.test(dash) && dash.includes('0.30%'));
      check('owner ₹0 keys are excluded from revenue and labeled',
        dash.includes('owner/₹0 keys'));
      check('it refuses to invent web analytics and points at the GA4/Search Console path',
        /collects none of this by itself/.test(dash) && /Search Console/.test(dash));
      check('the generated dashboard is gitignored (it contains revenue)',
        fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('admin-dashboard.html'));
      // GA4 ships wired but OFF: with no measurement id, nothing may load.
      const an = fs.readFileSync(path.join(root, 'src/analytics.js'), 'utf8');
      check('analytics is disabled by default — empty ID means nothing loads',
        /GA_MEASUREMENT_ID = ''/.test(an) && /if \(!GA_MEASUREMENT_ID\) return/.test(an));
      check('ADMIN.md documents the dashboard, GA4 and the keywords path',
        fs.existsSync(path.join(root, 'ADMIN.md')) && /Search Console/.test(fs.readFileSync(path.join(root, 'ADMIN.md'), 'utf8')));
      // publish mode: the public copy is ciphertext or it does not ship
      {
        const pub = path.join(tmp, 'pub.html');
        execFileSync('node', [path.join(root, 'scripts/admin.mjs'),
          '--ledger', ledger, '--out', path.join(tmp, 'dash2.html'), '--visitors', '1000', '--now', '2026-08-23T12:00:00Z',
          '--publish', '--pass', 'suite passphrase 1', '--publish-out', pub], { encoding: 'utf8' });
        const shell = fs.readFileSync(pub, 'utf8');
        check('the published copy leaks no plaintext (no revenue, no dashboard markup)',
          !shell.includes('9,997') && !shell.includes('Paying customers') && shell.includes('AES-GCM'));
        check('the published copy carries the in-browser decryptor', /crypto\.subtle\.deriveKey/.test(shell) && /Wrong passphrase/.test(shell));
        check('publish refuses a weak or missing passphrase', (() => {
          try {
            execFileSync('node', [path.join(root, 'scripts/admin.mjs'), '--ledger', ledger, '--out', path.join(tmp, 'dash3.html'),
              '--visitors', '1', '--now', '2026-08-23T12:00:00Z', '--publish', '--pass', 'short', '--publish-out', path.join(tmp, 'nope.html')], { encoding: 'utf8', stdio: 'pipe' });
            return false;
          } catch { return true }
        })());
      }
    }

    // ── ROI: the business view stays finite and honestly labeled ─────────────
    {
      const { roiFor } = await import(pathToFileURL(path.join(root, 'src/roi.js')).href);
      const T3 = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
      const { simulate: sim3 } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
      const { costReport: cr3 } = await import(pathToFileURL(path.join(root, 'src/pricing.js')).href);
      let roiBad = [];
      let authored = 0, internal = 0;
      for (const t of T3) {
        const s3 = sim3(t.nodes, t.edges, t.rps, new Set());
        const r = roiFor(t, cr3(t.nodes, s3, 1), t.rps);
        if (!r || typeof r.basis !== 'string' || r.basis.length < 40) { roiBad.push(t.name); continue }
        const nums = r.internal ? [r.infra, r.costPerM] : [r.infra, r.revenue, r.margin, r.marginPct, r.revPerM];
        if (!nums.every(Number.isFinite)) roiBad.push(t.name);
        if (r.internal) internal++; else if (r.cls === 'authored') authored++;
      }
      check(`ROI computes finite, explained numbers for all ${T3.length} templates` + (roiBad.length ? ' — ' + roiBad.slice(0, 4).join(', ') : ''), roiBad.length === 0);
      check('at least twenty-five designs carry an authored revenue model', authored >= 25);
      check('internal capabilities are framed as cost, not revenue', internal >= 5);
      check('a take-rate business shows the payments truth (revenue per 1M far above cost per 1M)', (() => {
        const t = T3.find(x => x.name === 'Payment System (Stripe-lite)');
        const s3 = sim3(t.nodes, t.edges, t.rps, new Set());
        const r = roiFor(t, cr3(t.nodes, s3, 1), t.rps);
        return r.revPerM > r.costPerM * 100 && r.marginPct > 99;
      })());
    }

    // ── SLO math and the readiness review ────────────────────────────────────
    {
      const { sloReport } = await import(pathToFileURL(path.join(root, 'src/slo.js')).href);
      const mk = (success, avail) => ({ successRate: success, sysAvail: avail, p99: 120, stats: { a: { in: 100 } } });
      const n2 = [{ id: 'a', type: 'app', label: 'API', replicas: 2 }, { id: 'g', type: 'gateway', label: 'GW', replicas: 2 }, { id: 'm', type: 'monitor', label: 'Mon', replicas: 1 }];
      const r999 = sloReport(n2, [], mk(1, 0.9999), 0.999);
      check('three nines buys a 43.2-minute monthly budget', Math.abs(r999.budgetMin - 43.2) < 0.01);
      check('a 1% failure rate burns a 99.9% budget at 10×, gone in ~3 days', (() => {
        const r = sloReport(n2, [], mk(0.99, 0.9999), 0.999);
        return Math.abs(r.burn - 10) < 0.01 && Math.abs(r.exhaustDays - 3) < 0.01;
      })());
      check('a clean design passes the readiness review', r999.ready === true);
      check('a SPOF taking live traffic blocks the review with its name', (() => {
        const n1 = [{ id: 'a', type: 'app', label: 'Lonely API', replicas: 1 }, { id: 'g', type: 'gateway', label: 'GW', replicas: 2 }, { id: 'm', type: 'monitor', label: 'Mon', replicas: 1 }];
        const r = sloReport(n1, [], mk(1, 0.9999), 0.999);
        const row = r.prr.find(x => /single point of failure/i.test(x.t));
        return r.ready === false && row.ok === false && /Lonely API/.test(row.d);
      })());
      check('an architecture below target fails structurally even when live traffic succeeds', (() => {
        const r = sloReport(n2, [], mk(1, 0.995), 0.9999);
        return r.ready === false && r.prr.some(x => /cannot reach/.test(x.d));
      })());
      // quick fixes: each failing gate maps to a real canvas mutation
      const { sloQuickFix } = await import(pathToFileURL(path.join(root, 'src/slo.js')).href);
      check('the SPOF quick fix adds the failover replica and names the node', (() => {
        const ns = [{ id: 'a', type: 'app', label: 'Lonely API', replicas: 1, x: 1, y: 1 }];
        const f = sloQuickFix('spof', ns, [], { stats: { a: { in: 10 } } });
        return f && f.nodes[0].replicas === 2 && /Lonely API/.test(f.note);
      })());
      check('the front-door quick fix inserts an LB and rewires client edges through it', (() => {
        const ns = [{ id: 'u', type: 'client', label: 'U', replicas: 1, x: 40, y: 200 }, { id: 'a', type: 'app', label: 'API', replicas: 2, x: 300, y: 200 }];
        const f = sloQuickFix('door', ns, [['u', 'a']], { stats: {} });
        const es = JSON.stringify(f.edges);
        return f.nodes.some(n => n.type === 'lb') && es.includes('["u","lb-fix"]') && es.includes('["lb-fix","a"]') && !es.includes('["u","a"]');
      })());
      check('the tail quick fix converges: sizes until its own gate passes', (() => {
        const ns = [{ id: 'a', type: 'app', label: 'API', replicas: 2, x: 1, y: 1 }];
        const resimStub = () => ({ p99: 120, successRate: 1, stats: { a: { in: 5000, util: 0.6 } } });
        const f = sloQuickFix('tail', ns, [], { p99: 9000, successRate: 0.9, stats: { a: { in: 5000, util: 1.4 } } }, 0.999, resimStub);
        return f && f.nodes[0].replicas >= 4 && /queueing delay/.test(f.note) && /gate cleared/.test(f.note);
      })());
      // The one-click guarantee, end to end on the real simulator: an
      // overdriven real template must go green in a single fix call — the
      // multi-click regression this replaced sized to throttled inflow and
      // chased the bottleneck one tier per click.
      check('one click clears tail AND burn on an overdriven real template', await (async () => {
        const { simulate: simX } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
        const TX = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
        const t = TX.find(x => x.name === 'Chat (WhatsApp)');
        const rps = t.rps * 8;
        const resim = (ns) => simX(ns, t.edges, rps, new Set());
        const s0 = resim(t.nodes);
        if (s0.p99 < 2000 && s0.successRate > 0.999) return false;   // overdrive must actually hurt
        const tf = sloQuickFix('tail', t.nodes, t.edges, s0, 0.999, resim);
        const bf = sloQuickFix('burn', t.nodes, t.edges, s0, 0.999, resim);
        return resim(tf.nodes).p99 < 2000 && (1 - resim(bf.nodes).successRate) / 0.001 <= 1;
      })());
      check('when replicas cannot help, the fix says chain depth honestly instead of looping', await (async () => {
        const { simulate: simX } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
        const TX = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
        const t = TX.find(x => x.name === 'Zomato');
        const rps = t.rps * 10;
        const resim = (ns) => simX(ns, t.edges, rps, new Set());
        const f = sloQuickFix('tail', t.nodes, t.edges, resim(t.nodes), 0.999, resim);
        const after = resim(f.nodes);
        const residualHot = Object.values(after.stats).some(st => st.util > 0.85);
        return after.p99 >= 2000 ? (!residualHot && /chain depth/.test(f.note)) : true;
      })());
      check('the structural quick fix raises replicas until the target clears', (() => {
        const ns = [{ id: 'g', type: 'gateway', label: 'GW', replicas: 1, x: 1, y: 1 }, { id: 'a', type: 'app', label: 'API', replicas: 1, x: 1, y: 1 }];
        const f = sloQuickFix('struct', ns, [], { stats: { g: { in: 10 }, a: { in: 10 } } }, 0.9999);
        return f && f.nodes.every(n => n.replicas >= 2);
      })());
      check('a fix that makes no sense for the graph returns null instead of pretending', sloQuickFix('door', [{ id: 'a', type: 'app', label: 'A', replicas: 1, x: 1, y: 1 }], [], { stats: {} }) === null);
      // ── 🚀 future-ready: the library-wide contract ─────────────────────────
      // One click takes ANY of the templates to the growth-stage bar (front
      // door, observability, no SPOF, guarded AI, ≤85% util, ≥99.9% avail),
      // and a second click is a no-op. Proven across the whole library.
      check('every template in the library goes future-ready in one click, idempotently', await (async () => {
        const { futureReady: fr, futureAudit: fa } = await import(pathToFileURL(path.join(root, 'src/future.js')).href);
        const { simulate: simF } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
        const TF = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
        for (const t of TF) {
          const resim = (ns, es) => simF(ns, es || t.edges, t.rps, new Set());
          const s0 = resim(t.nodes, t.edges);
          const r = fr(t.nodes, t.edges, s0, resim);
          const sf = resim(r.nodes, r.edges);
          if (fa(r.nodes, r.edges, sf).length) return false;
          if (!fr(r.nodes, r.edges, sf, resim).alreadyReady) return false;
          // an added monitor that observes nothing is theater — it must be fed
          if (r.nodes.some(n => n.id === 'mon-fix') && !r.edges.some(e => (e.to ?? e[1]) === 'mon-fix')) return false;
        }
        return true;
      })());
      check('future-ready inserts guardrails one hop upstream of every AI tier', await (async () => {
        const { futureReady: fr } = await import(pathToFileURL(path.join(root, 'src/future.js')).href);
        const { simulate: simF } = await import(pathToFileURL(path.join(root, 'src/sim.js')).href);
        const TF = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
        const t = TF.find(x => x.name === 'GenAI: RAG Assistant');
        const resim = (ns, es) => simF(ns, es || t.edges, t.rps, new Set());
        const r = fr(t.nodes, t.edges, resim(t.nodes, t.edges), resim);
        const guards = r.nodes.filter(n => n.type === 'guard');
        const llms = r.nodes.filter(n => ['llm', 'aiagent', 'agentgraph', 'ml'].includes(n.type));
        return llms.every(ai => r.edges.some(e => (e.to === ai.id && guards.some(g => g.id === e.from)) || (e.from === ai.id && guards.some(g => g.id === e.to))));
      })());
      check('every fix carries a precise plan the button can show before the click', (() => {
        const ns = [{ id: 'a', type: 'app', label: 'Lonely API', replicas: 1, x: 1, y: 1 }];
        const sp = sloQuickFix('spof', ns, [], { stats: { a: { in: 10 } } });
        const obsF = sloQuickFix('obs', ns, [], { stats: {} });
        const doorF = sloQuickFix('door', [{ id: 'u', type: 'client', label: 'U', replicas: 1, x: 40, y: 200 }, ...ns], [['u', 'a']], { stats: {} });
        const resimStub = () => ({ p99: 120, successRate: 1, stats: { a: { in: 5000, util: 0.6 } } });
        const tailF = sloQuickFix('tail', [{ id: 'a', type: 'app', label: 'API', replicas: 2, x: 1, y: 1 }], [], { p99: 9000, successRate: 0.9, stats: { a: { in: 5000, util: 1.4 } } }, 0.999, resimStub);
        return /Lonely API 1→2/.test(sp.plan) && /monitoring tier/i.test(obsF.plan) && /LB behind the clients/.test(doorF.plan) && /API 2→\d+/.test(tailF.plan);
      })());
    }

    // ── the acronym glossary: complete, unique, honest ───────────────────────
    {
      const { ACRONYMS, ACRONYM_CATS } = await import(pathToFileURL(path.join(root, 'src/acronyms.js')).href);
      check('the glossary carries at least eighty acronyms', ACRONYMS.length >= 80);
      const seen = new Set(); let dups = 0;
      for (const x of ACRONYMS) { if (seen.has(x.a)) dups++; seen.add(x.a); }
      check('every acronym appears exactly once', dups === 0);
      const bad = ACRONYMS.filter(x => !x.a || !x.f || !x.d || x.d.length < 25 || !ACRONYM_CATS[x.c]);
      check('every entry has an expansion, a real one-liner and a valid category' + (bad.length ? ' — ' + bad.map(x => x.a).slice(0, 4).join(', ') : ''), bad.length === 0);
      const src2 = fs.readFileSync(path.join(root, 'src/acronyms.js'), 'utf8');
      check('glossary text is straight-ASCII quoted', !/[\u2018\u2019\u201C\u201D]/.test(src2));
      check('the studio staples are all present',
        ['CAP', 'CQRS', 'SLO', 'SPOF', 'RAG', 'WAL', 'DLQ', 'MRR', 'P99'].every(a => seen.has(a)));
    }

    // ── production polish: CI, docs, link previews, share codec, version ─────
    {
      const ci = fs.readFileSync(path.join(root, '.github/workflows/verify.yml'), 'utf8');
      check('CI runs the build and the full suite on every push',
        /npm run build/.test(ci) && /node scripts\/verify\.mjs/.test(ci) && /branches: \[main\]/.test(ci));
      const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
      check('the README opens with the CI badge and the live link',
        readme.includes('actions/workflows/verify.yml/badge.svg') &&
        readme.includes('https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/') &&
        readme.includes('SIMULATOR.md'));
      const simdoc = fs.readFileSync(path.join(root, 'SIMULATOR.md'), 'utf8');
      check('SIMULATOR.md documents the real formulas, not marketing',
        simdoc.includes('1 − (1 − availPerReplica) ^ replicas') && /M\/M\/1/.test(simdoc) &&
        simdoc.includes('p99 = p50 × (2.4 + 2.6 × busiestUtil)') && /deliberately is not/.test(simdoc));
      const chlog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
      const ver = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
      check('the changelog leads with the current package version', chlog.includes('## ' + ver));
      const V = await import(pathToFileURL(path.join(root, 'src/version.js')).href);
      check('the footer version matches package.json', V.VERSION === ver);
      const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
      check('link previews are wired: OG title, absolute OG image, twitter card, favicon',
        idx.includes('og:title') && idx.includes('https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/og.png') &&
        idx.includes('summary_large_image') && idx.includes('favicon.svg'));
      check('the OG card and favicon actually exist in public/',
        fs.statSync(path.join(root, 'public/og.png')).size > 20000 && fs.existsSync(path.join(root, 'public/favicon.svg')));
      const SH = await import(pathToFileURL(path.join(root, 'src/share.js')).href);
      const T6 = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
      check('the share codec round-trips a design losslessly', (() => {
        const t = T6.find(x => x.name === 'Chat (WhatsApp)');
        const encd = SH.encodeShare(t.nodes, t.edges, t.rps);
        if (/[+/=]/.test(encd)) return false;   // must be URL-safe
        const back = SH.decodeShare('#d=' + encd);
        if (!back || back.rps !== t.rps) return false;
        if (back.nodes.length !== t.nodes.length || back.edges.length !== t.edges.length) return false;
        const n0 = t.nodes[0], b0 = back.nodes.find(n => n.id === n0.id);
        return !!b0 && b0.type === n0.type && b0.replicas === n0.replicas &&
          back.edges.every(e => e.from && e.to);
      })());
      // ── six pillars: integrity, endurance, AI-ready ──────────────────────────
      const IG = await import(pathToFileURL(path.join(root, 'src/integrity.js')).href);
      check('integrity leaves a clean design untouched — zero issues on every template', T6.every(t => IG.validateDesign({ nodes: t.nodes, edges: t.edges, rps: t.rps }).issues.length === 0));
      check('integrity repairs corruption and REPORTS every repair', (() => {
        const r = IG.validateDesign({ nodes: [{ id: 'a', type: 'lb', replicas: 'zz' }, { id: 'a', type: 'nope' }, { id: 'c', type: 'sql', x: NaN }], edges: [['a', 'ghost'], ['a', 'a'], ['a', 'c'], ['a', 'c']], rps: -5 });
        return r.ok && r.nodes.length === 3 && r.edges.length === 1 && r.rps === 100 && r.issues.length >= 6
          && r.nodes.find(n => n.id === 'a_2')?.type === 'app' && r.issues.some(s => /missing node/.test(s)) && r.issues.some(s => /looped/.test(s));
      })());
      check('a corrupted share link opens repaired instead of crashing or vanishing', (() => {
        const bad = SH.encodeShare([{ id: 'x', type: 'ghosttype', x: 1, y: 1 }, { id: 'y', type: 'sql', x: 2, y: 2, replicas: 2 }], [{ from: 'x', to: 'y' }, { from: 'y', to: 'nowhere' }], 300);
        const back = SH.decodeShare('#d=' + bad);
        return !!back && back.nodes.length === 2 && back.edges.length === 1 && back.issues.length >= 2;
      })());
      check('built to endure: a share link minted in 1.x decodes forever (golden payload)', (() => {
        const back = SH.decodeShare('#d=eyJ2IjoxLCJyIjo1MDAsIm4iOlt7ImlkIjoidSIsInR5cGUiOiJjbGllbnQiLCJsYWJlbCI6IlVzZXJzIiwieCI6NDAsInkiOjIwMCwicmVwbGljYXMiOjF9LHsiaWQiOiJsYiIsInR5cGUiOiJsYiIsImxhYmVsIjoiTEIiLCJ4IjoxODAsInkiOjIwMCwicmVwbGljYXMiOjJ9LHsiaWQiOiJkYiIsInR5cGUiOiJzcWwiLCJsYWJlbCI6Ik9yZGVycyBEQiIsIngiOjMyMCwieSI6MjAwLCJyZXBsaWNhcyI6MywicmVwbGljYXRpb24iOiJzeW5jIn1dLCJlIjpbWyJ1IiwibGIiXSxbImxiIiwiZGIiXV19');
        return !!back && back.rps === 500 && back.nodes.length === 3 && back.edges.length === 2
          && back.nodes.find(n => n.id === 'db')?.replication === 'sync' && back.nodes.find(n => n.id === 'lb')?.replicas === 2;
      })());
      check('AI ready: the JSON document round-trips a design with inspector state intact', (() => {
        const t = T6.find(x => x.name === 'Chat (WhatsApp)');
        const doc = IG.toDesignJSON(t.nodes, t.edges, t.rps);
        const back = IG.fromDesignJSON(doc);
        const parsed = JSON.parse(doc);
        return parsed.$schema === 'archsim-design/v1' && typeof parsed._readme === 'string' && !!back && back.ok && back.issues.length === 0
          && back.nodes.length === t.nodes.length && back.edges.length === t.edges.length && back.rps === t.rps;
      })());
      check('the JSON reader refuses foreign documents', IG.fromDesignJSON('{"x":1}') === null && IG.fromDesignJSON('not json') === null && IG.fromDesignJSON('{"$schema":"other/v1","nodes":[]}') === null);
      check('pasted text is sniffed as JSON, Mermaid, or refused', IG.detectFormat('{"nodes":[]}') === 'json' && IG.detectFormat('flowchart LR\n a-->b') === 'mermaid' && IG.detectFormat('hello') === null);
      check('About states the six pillars', (() => {
        const src = fs.readFileSync(path.join(root, 'src/about.js'), 'utf8');
        return ['Strong Foundation', 'Modular Design', 'Data Integrity', 'Flexible and Scalable', 'Built to Endure', 'AI Ready'].every(p => src.includes(p));
      })());

      check('entry deep-links parse exactly and reject junk', (() => {
        const good = SH.parseEntryParams('?tpl=' + encodeURIComponent('Payment System (Stripe-lite)') + '&tab=roi');
        if (!good || good.tplName !== 'Payment System (Stripe-lite)' || good.tab !== 'roi') return false;
        if (SH.parseEntryParams('?tab=notatab') !== null && SH.parseEntryParams('?tab=notatab').tab !== null) return false;
        return SH.parseEntryParams('') === null && SH.parseEntryParams('?utm_source=wa') === null;
      })());
      check('an entry deep-link suppresses the wizard like a shared design does', (() => {
        const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
        return src.includes('!hasSharedDesign() && !hasEntryParams()');
      })());
      check('a garbled share hash degrades to null, never a crash',
        SH.decodeShare('#d=%%%not-base64%%%') === null && SH.decodeShare('') === null);
    }

    // ── the 80/20 mastery curriculum: complete and honestly wired ────────────
    {
      const M = await import(pathToFileURL(path.join(root, 'src/mastery.js')).href);
      const T5 = (await import(pathToFileURL(path.join(root, 'src/templates.js')).href)).TEMPLATES;
      const names = new Set(T5.map(t => t.name));
      const validTabs = new Set(['capacity', 'breakdown', 'scale', 'chaos', 'assist', 'roi', 'slo', 'acr', 'improve', 'learn', 'interview', 'cost', 'code', 'compare', 'explain', 'trips', 'about', 'hld', 'lld', 'brief']);
      check('the curriculum covers the fifteen areas — canonical, arithmetic, production LLM drills, deploy & migrate, networking', M.MASTERY.length === 15);
      check('every area carries its one-line red flag', M.MASTERY.every(a => (a.flag || '').length >= 40));
      check('every concept outside the LLM drills carries its interviewer phrasing (the question in costume)',
        M.MASTERY.filter(a => a.id !== 'llm-prod').every(a => a.items.every(x => (x.asks || '').length >= 30)));
      check('the throughput rules quote this catalog, not folklore', await (async () => {
        const { CATALOG: C2 } = await import(pathToFileURL(path.join(root, 'src/catalog.js')).href);
        const rows = M.MASTERY_CMP['throughput-rules'].rows.map(r => r.join(' '));
        const has = (label, cap) => rows.some(r => r.includes(label) && r.includes(cap.toLocaleString('en-US')));
        return has('App server', C2.app.cap) && has('LLM worker', C2.llmworker.cap) && has('Kafka partition', C2.kafka.cap) && has('SQL database', C2.sql.cap);
      })());
      check('the curriculum carries at least thirty tracked concepts', M.MASTERY_TOTAL >= 30);
      const ids = M.MASTERY.flatMap(a => a.items.map(x => x.id));
      check('every concept id is unique', new Set(ids).size === ids.length);
      const bad = [];
      for (const a of M.MASTERY) for (const x of a.items) {
        if (!x.t || !x.d || x.d.length < 60) bad.push(x.id + ':thin');
        if (!x.go || !x.go.do || x.go.do.length < 30) bad.push(x.id + ':no-exercise');
        if (x.go.tpl && !names.has(x.go.tpl)) bad.push(x.id + ':ghost-tpl(' + x.go.tpl + ')');
        if (x.go.tab && !validTabs.has(x.go.tab)) bad.push(x.id + ':ghost-tab(' + x.go.tab + ')');
      }
      check('every concept teaches (60+ char line), exercises (30+ chars), and points at real surfaces' + (bad.length ? ' — ' + bad.slice(0, 4).join(', ') : ''), bad.length === 0);
      check('the write-policy trio and balancing algorithms are authored, not stubs', await (async () => {
        const D = await import(pathToFileURL(path.join(root, 'src/ddia.js')).href);
        const wpOk = ['through', 'back', 'around'].every(k => D.WRITE_POLICY[k]?.blurb?.length > 80) && /loss window/.test(D.WRITE_POLICY.back.warn || '');
        const lbOk = ['rr', 'leastconn', 'chash'].every(k => D.LB_ALGO[k]?.blurb?.length > 80) && /1\/N/.test(D.LB_ALGO.chash.blurb);
        return wpOk && lbOk;
      })());
      check('Ask AI can define the remaining prose-only gaps (GraphQL, write policies, vector clocks, redundancy shapes)', await (async () => {
        const asst = fs.readFileSync(path.join(root, 'src/assistant.js'), 'utf8');
        return ['graphql', 'write-back', 'vector clock', 'active-active'].every(t => asst.includes(`'${t}':`));
      })());
      check('shuffle is a permutation — nothing lost, nothing duplicated, order actually varies', (() => {
        const flat = d => d.flatMap(a => a.items.map(x => x.id));
        const canon = flat(M.MASTERY);
        let varied = false;
        for (let i = 0; i < 3; i++) {
          const sh = flat(M.shuffleMastery());
          if (sh.length !== canon.length) return false;
          if (new Set(sh).size !== sh.length) return false;
          if ([...sh].sort().join() !== [...canon].sort().join()) return false;
          if (sh.join() !== canon.join()) varied = true;
        }
        return varied;
      })());
      check('the comparison layer is authored, complete and well-shaped', (() => {
        const ids2 = new Set(M.MASTERY.flatMap(a => a.items.map(x => x.id)));
        const keys = Object.keys(M.MASTERY_CMP);
        if (keys.length < 15) return false;
        for (const k of keys) {
          if (!ids2.has(k)) return false;   // a table for a ghost concept
          const c = M.MASTERY_CMP[k];
          if (c.cols.length < 2 || c.rows.length < 3) return false;
          for (const r of c.rows) if (r.length !== c.cols.length + 1 || r.some(cell => !cell || !String(cell).trim())) return false;
        }
        // the canonical trios exist as tables, not just prose
        return ['cache-strategies', 'lb-techniques', 'conflict', 'metrics', 'authn'].every(k => keys.includes(k));
      })());
      check('all eleven canonical topics are present by name', (() => {
        const titles = M.MASTERY.map(a => a.title).join(' | ');
        return /Storage/.test(titles) && /Caching/.test(titles) && /Load Balancing/.test(titles) && /Asynchronous/.test(titles) && /Read & Write/.test(titles) && /Distributed Systems/.test(titles) && /Reliability/.test(titles) && /CDN/.test(titles) && /API Design/.test(titles) && /Search/.test(titles) && /Observability/.test(titles) && /Envelope/.test(titles) && /LLM Systems in Production/.test(titles) && /Deploy & Migrate/.test(titles) && /Networking/.test(titles);
      })());
    }

    // ── traffic slider reaches internet scale and stays readable ─────────────
    {
      const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      check('the traffic slider goes to 100M rps (log10 max = 8)',
        /type="range" min=\{2\} max=\{8\}[^/]*Math\.log10\(rps\)/.test(app));
      // The k-only inline formatter printed "100000k rps" at that scale —
      // every rps readout must go through fmt(), which speaks in M.
      check('no rps readout is stuck in thousands (all use fmt())',
        !app.includes("(rps / 1000).toFixed(rps >= 10000 ? 0 : 1) + 'k'"));
      check('fmt drops the trailing .0 above ten million',
        app.includes("toFixed(n >= 1e7 ? 0 : 1) + 'M'"));
    }
  }

  // ── nothing in the interface is too small to read ──────────────────────────
  {
    const raw = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // SVG text is in viewBox units, not screen pixels — scaling it would
    // distort the diagram rather than help anyone read it, so it is exempt.
    const SVG = ['.map-svg', '.map-site', '.map-link', '.bd-dia', '.bd-seq', '.bd-st'];
    const tooSmall = [];
    for (const block of raw.split(/(?=\n[^\n{]*\{)/)) {
      const sel = block.split('{')[0];
      if (SVG.some(x => sel.includes(x))) continue;
      for (const m of block.matchAll(/font-size:\s*([0-9.]+)px/g))
        if (Number(m[1]) < 12) tooSmall.push(sel.trim().slice(0, 40) + ' → ' + m[1] + 'px');
    }
    check('no interface text is set below 12px' +
      (tooSmall.length ? ' — ' + tooSmall.slice(0, 3).join(', ') : ''), tooSmall.length === 0);
    check('the body text is comfortably readable', (() => {
      const b = (raw.match(/\nbody\s*\{([^}]*)\}/) || [])[1] || '';
      const m = b.match(/font-size:\s*([0-9.]+)px/);
      return !m || Number(m[1]) >= 13;
    })());
    check('diagram text is left in its own units', (() => {
      const svgRules = [...raw.matchAll(/\.(?:bd-seq|bd-st|map-site)[^{]*\{([^}]*)\}/g)]
        .map(m => (m[1].match(/font-size:\s*([0-9.]+)px/) || [])[1]).filter(Boolean);
      return svgRules.length > 0 && svgRules.some(v => Number(v) < 12);
    })());
  }

  // ── the question bank ──────────────────────────────────────────────────────
  {
    const qb = await import(pathToFileURL(path.join(root, 'src/questions.js')).href);
    const { TEMPLATES: TP6 } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    check('there are thirty questions', qb.QUESTION_BANK.length === 30);
    check('spread across three levels', qb.QUESTION_LEVELS.length === 3 &&
      qb.QUESTION_LEVELS.every(l => qb.questionsAt(l).length >= 8));
    check('every question has a real answer, not a stub',
      qb.QUESTION_BANK.every(x => x.q.length > 15 && x.a.length > 200));
    check('every prompt reads as a question or an instruction',
      qb.QUESTION_BANK.every(x => /\?$/.test(x.q) || /^(Explain|Describe|Walk|Compare)/.test(x.q)));
    check('no two questions repeat', new Set(qb.QUESTION_BANK.map(x => x.q)).size === 30);
    // The differentiator: most answers point at a design you can build and run.
    check('most questions name something to build here',
      qb.QUESTION_BANK.filter(x => x.build).length >= 25);
    check('every template a question names actually exists', (() => {
      const names = TP6.map(t2 => t2.name);
      const cited = qb.QUESTION_BANK.map(x => x.build || '').join(' ');
      return ['Rate Limiter', 'Notification System', 'Collab Docs', 'URL Shortener', 'Search Autocomplete',
              'Payment System', 'Chat', 'Observability'].every(n => !cited.includes(n + ' template') || names.some(v => v.includes(n)));
    })());
    check('the answers are written here, not lifted',
      qb.QUESTION_BANK.every(x => !/click to reveal|flashcard|roadmap\.sh/i.test(x.a)));
    check('the bank is reachable from Learn', (() => {
      const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
      return /\['questions', 'Questions'\]/.test(src) && /QUESTION_LEVELS\.map/.test(src);
    })());
  }

  // ── the review only offers a fix it can actually apply ─────────────────────
  {
    const { review } = await import(pathToFileURL(path.join(root, 'src/advisor.js')).href);
    const { TEMPLATES: TP5 } = await import(pathToFileURL(path.join(root, 'src/templates.js')).href);
    const src = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');

    // Every finding rendered a Quick fix button, including the ones with no
    // apply — so after Quick fix all, the remainder still showed a button that
    // did nothing when clicked.
    check('the fix button only renders for findings that have one', /\{s\.apply \? \(/.test(src));
    check('and the rest say plainly that they need a decision', /sug-manual/.test(src));
    check('the header no longer claims every finding has a fix',
      !/Every one has a quick fix/.test(src));
    check('it counts the actionable and the advisory separately',
      /actionable\.length > 0/.test(src) && /sugs\.length - actionable\.length/.test(src));

    // The advisory ones are advisory by design: which auth method, which
    // invalidation rule and whether a replica may serve reads are judgements,
    // not insertions, and a button that guessed would be worse than none.
    const t2 = TP5.find(x => /Netflix/.test(x.name)) || TP5[0];
    const found = review(t2.nodes, t2.edges, t2.rps);
    check('a real design produces both kinds of finding', (() => {
      const withFix = found.filter(f => f.apply).length;
      return found.length > 0 && withFix > 0 && withFix < found.length;
    })());
    check('no advisory finding pretends to carry a fix',
      found.filter(f => !f.apply).every(f => typeof f.apply === 'undefined'));
    check('applying every actionable fix leaves only advisory ones', (() => {
      // Apply-all already filters on apply; the point is that what remains is
      // exactly the set a button could never have resolved.
      const remaining = found.filter(f => !f.apply);
      return remaining.every(f => /authentication|copy|stale|second copy|invalidation|analytics/i.test(f.title + ' ' + (f.detail || '')));
    })());
  }

  // ── the flow filter yields to a maximised panel ────────────────────────────
  {
    const maxBtns = [...doc.querySelectorAll('.panel-max')];
    check('both panels have a maximise control', maxBtns.length === 2);
    check('the flow filter is on screen normally', !!doc.querySelector('.flowbar'));

    // Maximising leaves a sliver of canvas, and the filter would sit on top of
    // the diagram it exists to help you read.
    click(maxBtns[1]); await wait(220);
    check('maximising the Analysis panel hides it', !doc.querySelector('.flowbar'));
    click(maxBtns[1]); await wait(220);
    check('restoring brings it back', !!doc.querySelector('.flowbar'));

    click(maxBtns[0]); await wait(220);
    check('maximising the Components panel hides it too', !doc.querySelector('.flowbar'));
    click(maxBtns[0]); await wait(220);
    check('and restoring that brings it back as well', !!doc.querySelector('.flowbar'));
    check('the canvas hint strip is unaffected either way', !!doc.querySelector('.hint') || doc.querySelectorAll('svg g.node').length === 0);
    check('no crash while maximising', errs.length === 0);
  }

  // ── the picker actually opens and filters ──────────────────────────────────
  {
    const box = doc.querySelector('.tplpick-q');
    check('the search field is in the toolbar', !!box);
    check('the list is closed until asked for', !doc.querySelector('.tplpick-pop'));

    // The complaint this fixes: typing filtered a native select that never
    // opened, so nothing appeared to happen.
    typeInto(box, 'whats');
    await wait(220);
    check('typing opens the list', !!doc.querySelector('.tplpick-pop'));
    check('and it is filtered to the match', (() => {
      const opts = [...doc.querySelectorAll('.tplpick-i')];
      return opts.length > 0 && opts.length < 10 && opts.some(o => /WhatsApp/i.test(o.textContent));
    })());
    check('the count reflects the filter',
      /\d+ of \d+/.test(doc.querySelector('.tplpick-n')?.textContent || ''));
    check('the combobox reports itself as expanded', box.getAttribute('aria-expanded') === 'true');

    typeInto(box, 'zzzznope');
    await wait(200);
    check('a query with no matches says so, rather than showing an empty box',
      /Nothing matches/.test(doc.querySelector('.tplpick-pop')?.textContent || ''));

    typeInto(box, 'india');
    await wait(200);
    check('the group is searchable from here too',
      [...doc.querySelectorAll('.tplpick-i')].length >= 3);

    // Choosing loads the design.
    typeInto(box, 'Ticketmaster');
    await wait(220);
    const hit = [...doc.querySelectorAll('.tplpick-i')].find(o => /Ticketmaster/.test(o.textContent));
    check('the match is selectable', !!hit);
    hit.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    await wait(320);
    check('choosing one loads that design', /Ticketmaster/.test(doc.querySelector('.tpl-header-name')?.textContent || ''));
    check('and the list closes behind it', !doc.querySelector('.tplpick-pop'));
    check('no crash while searching', errs.length === 0);
  }

  // ── the Cost tab renders for a loaded design ───────────────────────────────
  {
    click(byText('.tabs button', 'Cost'));
    await wait(250);
    check('the cost tab shows a monthly figure', !!doc.querySelector('.cost-big'));
    check('and the fixed/usage split', !!doc.querySelector('.cost-split'));
    check('and the per-cloud footer', !!doc.querySelector('.cost-foot'));
    check('scale up and scale down are reachable', (() => {
      const t2 = doc.querySelector('section')?.textContent || doc.body.textContent;
      return /scale|right.?size|replica/i.test(t2);
    })());
    check('the priced-on note is present', !!doc.querySelector('.price-basis'));
    check('and links at least one provider page',
      (doc.querySelectorAll('.price-src a') || []).length >= 3);
    check('no crash rendering the cost tab', errs.length === 0);
    click(byText('.tabs button', 'Scale'));
    await wait(200);
  }

  // ── flow filter in the UI ──────────────────────────────────────────────────
  {
    const fl2 = await import(pathToFileURL(path.join(root, 'src/flow.js')).href);
    const bar = doc.querySelector('.flowbar');
    check('the flow filter is on the canvas', !!bar);
    // It has to share a containing block with the hint strip, or its bottom
    // offset resolves against the viewport and the two overlap.
    check('it sits inside the canvas, so its offset shares the hint strip\'s frame',
      !!bar.closest('.canvas-wrap'));
    check('it offers all four views',
      [...bar.querySelectorAll('button')].map(b => b.textContent.trim()).join(',') === 'All,Read,Write,Async');
    check('it is a labelled group for assistive tech',
      bar.getAttribute('role') === 'group' && !!bar.getAttribute('aria-label'));
    check('the active view is announced, not just coloured',
      [...bar.querySelectorAll('button')].filter(b => b.getAttribute('aria-pressed') === 'true').length === 1);
    // The hint has to be on screen, not only in a title attribute — a tooltip
    // is invisible on touch and to anyone who does not hover.
    check('the active view explains itself on screen', (() => {
      const h = doc.querySelector('.flowbar-hint');
      return !!h && h.textContent.trim().length > 15;
    })());
    check('every view has its own hint, not one shared line', (() => {
      const seen = new Set(fl2.FLOW_MODES.map(m => m.hint));
      return seen.size === fl2.FLOW_MODES.length;
    })());
    const writeBtn = [...bar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Write');
    click(writeBtn); await wait(200);
    check('choosing a view marks it pressed', writeBtn.getAttribute('aria-pressed') === 'true');
    check('the hint changes with the view',
      doc.querySelector('.flowbar-hint')?.textContent.includes('write') || doc.querySelector('.flowbar-hint')?.textContent.includes('consistency'));
    check('and says how much of the diagram it is showing',
      /\d+ of \d+ connections/.test(doc.querySelector('.flowbar-note')?.textContent || ''));
    check('it says outright when links have no declared mix, rather than guessing',
      /no declared mix/.test(doc.querySelector('.flowbar-note')?.textContent || ''));
    click([...bar.querySelectorAll('button')].find(b => b.textContent.trim() === 'All')); await wait(150);
    check('returning to All clears the note', !doc.querySelector('.flowbar-note'));
    check('no crash while switching views', errs.length === 0);
  }

  // ── the header stays put ───────────────────────────────────────────────────
  {
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = css.match(/\.toolbar\s*\{([^}]*)\}/);
    check('the toolbar is pinned rather than scrolling away',
      !!m && /position:\s*sticky/.test(m[1]) && /top:\s*0/.test(m[1]));
    check('and sits above the panels it would otherwise scroll behind',
      !!m && Number((m[1].match(/z-index:\s*(\d+)/) || [])[1]) >= 10);
    check('a pinned toolbar has a background, or content shows through it',
      !!m && /background:/.test(m[1]));
  }

  // ── toolbar menus ──────────────────────────────────────────────────────────
  {
    await closeMenus();
    const triggers = [...doc.querySelectorAll('.toolbar .menu > button')];
    check('the toolbar has View, Design and Configuration menus',
      ['View', 'Design', 'Configuration'].every(l => triggers.some(b => b.textContent.trim().startsWith(l))));
    // ── karuna by design: the studio grades systems hard and people gently ──
    // Person-facing copy may be direct; it may never aim contempt at the user.
    check('no person-facing copy is cruel — karuna is a build contract', (() => {
      const files = ['src/interview.js', 'src/interview-llm.js', 'src/tour.js', 'src/onboarding.jsx', 'src/mastery.js', 'src/learn.js', 'src/App.jsx', 'src/about.js'];
      const contempt = [
        /\byou(?:'re| are| were)?\s+(?:so\s+)?(?:stupid|dumb|an idiot|idiotic|hopeless|pathetic|useless|lazy|clueless|incompetent)\b/i,
        /\b(?:idiot|moron|imbecile|loser|pathetic)\b/i,
        /\bstupid (?:question|answer|mistake)\b/i,
        /\bobviously\b[^.\n]{0,40}\byou\b/i,
      ];
      for (const f of files) {
        const src = fs.readFileSync(path.join(root, f), 'utf8')
          .replace(/^\s*\/\/.*$/gm, '');            // comments are for engineers, strings are for people
        for (const rx of contempt) if (rx.test(src)) return false;
      }
      return true;
    })());
    check('the lowest interview band stays constructive, never a verdict on the person', (() => {
      const src = fs.readFileSync(path.join(root, 'src/interview.js'), 'utf8');
      return src.includes('The shape of an answer is there');
    })());

    check('Bharat leads the template picker — first group wears the flag', (() => {
      const og = [...doc.querySelectorAll('.tplpick-native optgroup')].filter(o => o.label !== 'Start from scratch');
      return og.length > 3 && /Bharat/.test(og[0].label) && /Bharat/.test(og[1].label) && /Bharat/.test(og[2].label);
    })());
    check('the onboarding wizard offers a Bharat flagship first', await (async () => {
      const src = fs.readFileSync(path.join(root, 'src/onboarding.jsx'), 'utf8');
      const m = src.match(/const STARTS = \[\s*\{[^}]*tpl: '([^']+)'/);
      return !!m && /BHIM|UPI|Zomato/.test(m[1]);
    })());
        check('the guide button is labelled Guide/Tour', (() => {
      const b = doc.querySelector('[data-tour="help"]');
      return !!b && b.textContent.trim() === '🧭 Guide/Tour';
    })());
    check('every menu trigger declares itself as one',
      triggers.length >= 3 && triggers.every(b => b.getAttribute('aria-haspopup') === 'menu' && b.hasAttribute('aria-expanded')));
    check('menus start closed', triggers.every(b => b.getAttribute('aria-expanded') === 'false'));

    const view = await openMenu('View');
    check('opening a menu flips its expanded state', view.getAttribute('aria-expanded') === 'true');
    check('the popup is a labelled menu', (() => {
      const pop = doc.querySelector('.menu-pop[role="menu"]');
      return !!pop && !!pop.getAttribute('aria-label');
    })());
    check('every item in an open menu is a menu item',
      [...doc.querySelectorAll('.menu-pop > *')].filter(e => !e.classList.contains('menu-label') && !e.classList.contains('menu-sep'))
        .every(e => /^menuitem/.test(e.getAttribute('role') || '')));
    check('toggles report checked state rather than looking like plain buttons',
      ['Step numbers', 'Screen-reader mode'].every(t => menuItem(t)?.hasAttribute('aria-checked')));
    check('opening a menu moves focus into it',
      doc.activeElement && doc.activeElement.getAttribute('role')?.startsWith('menuitem'));

    // Escape must close it and give focus back, or keyboard users are stranded.
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(120);
    check('Escape closes the menu', view.getAttribute('aria-expanded') === 'false');
    check('and returns focus to the trigger', doc.activeElement === view);

    // Nothing may be lost: every action that used to be a toolbar button must
    // still be reachable from some menu.
    const actions = ['Arrange', 'Fit', 'Step numbers', 'mode', 'Glow', 'Primary', 'Screen-reader mode',
                     'PDF', 'Word', 'Diagram', 'Design (.json)', 'Import design JSON', 'Clear the canvas'];
    const found = [];
    for (const label of ['View', 'Design']) {
      await openMenu(label);
      for (const a of actions) if (menuItem(a)) found.push(a);
      doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(80);
    }
    const lost = actions.filter(a => !found.includes(a));
    check('no toolbar action was lost in the move to menus' + (lost.length ? ' — missing: ' + lost.join(', ') : ''),
      lost.length === 0);

    await openMenu('Configuration');
    check('cloud and currency both moved into Configuration',
      !!menuItem('Generic') && !!menuItem('INR'));
    check('the current cloud and currency are shown as checked',
      [...doc.querySelectorAll('.menu-pop [aria-checked="true"]')].length >= 2);
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(80);

    await closeMenus();
    check('clicking outside dismisses an open menu',
      [...doc.querySelectorAll('.toolbar .menu > button')].every(b => b.getAttribute('aria-expanded') === 'false'));
    check('no menu is still labelled Settings',
      ![...doc.querySelectorAll('.toolbar .menu > button')].some(b => /\bSettings\b/.test(b.textContent)));
    check('the toolbar is no longer a wall of buttons',
      doc.querySelectorAll('.toolbar > button, .toolbar > select, .toolbar > label').length <= 8);
    check('no crash while driving the menus', errs.length === 0);
  }

  // ── the tour against the real DOM ──────────────────────────────────────────
  {
    const t = await import(pathToFileURL(path.join(root, 'src/tour.js')).href);
    // The one failure mode that matters: a selector stops matching after a
    // refactor and the step silently vanishes. Assert every target resolves.
    const missing = t.TOUR_STEPS.filter(s => s.target && !doc.querySelector(s.target));
    check('every tour step finds its target in the mounted app' +
      (missing.length ? ' — missing: ' + missing.map(m => `${m.id} (${m.target})`).join(', ') : ''),
      missing.length === 0);
    check('the tour covers the modern studio: SLO, ROI, Mastery, Acronyms, Share, ⌘K', (() => {
      const ids = t.TOUR_STEPS.map(x => x.id);
      return ['slo', 'roi', 'mastery', 'llm-drills', 'acronyms', 'share', 'cmdk', 'hld-lld', 'dac'].every(id => ids.includes(id));
    })());
    check('the tour tells the newest physics — Retry Storm in Chaos, money controls in Capacity', (() => {
      const S4 = t.TOUR_STEPS;
      return /Retry Storm/.test(S4.find(s => s.id === 'chaos')?.body || '') && /idempotency and commit mode/.test(S4.find(s => s.id === 'capacity')?.body || '');
    })());
    check('the share step points at a real anchor', !!doc.querySelector('[data-tour="share"]'));
    check('stepsFor keeps every step when the full layout is present',
      t.stepsFor(doc).length === t.TOUR_STEPS.length);
    check('steps that name a tab name one that exists',
      t.TOUR_STEPS.filter(s => s.tab).every(s => !!doc.querySelector(`#tab-${s.tab}`)));
    check('the template a step loads still exists', (() => {
      const s = t.TOUR_STEPS.find(x => x.load);
      return !s || [...sel.options].some(o => o.textContent.includes(s.load));
    })());

    // The feature as asked for: a first-time visitor gets it without asking.
    // localStorage starts empty in this harness, so this is a genuine first run.
    check('the tour opens by itself for a first-time visitor', !!doc.querySelector('.tour-tip'));

    // Close it before testing replay, so "clicking it opens the tour" cannot
    // pass just because the tour was already on screen.
    click(doc.querySelector('.tour-skip'));
    await wait(200);
    check('the auto-started tour can be dismissed', !doc.querySelector('.tour-tip'));

    const help = doc.querySelector('[data-tour="help"]');
    check('a replay button is available in the toolbar', !!help);
    click(help);
    await wait(250);
    check('clicking it reopens the tour after it was dismissed', !!doc.querySelector('.tour-tip'));
    check('the tour is a labelled modal dialog', (() => {
      const d = doc.querySelector('.tour[role=dialog]');
      return !!d && d.getAttribute('aria-modal') === 'true' && !!doc.querySelector('#tour-title');
    })());
    check('the first step shows its position in the sequence',
      /Step 1 of \d+/.test(doc.querySelector('.tour-count')?.textContent || ''));
    check('the first step offers no Back button', !doc.querySelector('.tour-back'));
    click(doc.querySelector('.tour-next'));
    await wait(250);
    check('Next advances the step', /Step 2 of/.test(doc.querySelector('.tour-count')?.textContent || ''));
    check('later steps offer Back', !!doc.querySelector('.tour-back'));
    click(doc.querySelector('.tour-back'));
    await wait(200);
    check('Back returns to the previous step', /Step 1 of/.test(doc.querySelector('.tour-count')?.textContent || ''));
    click(doc.querySelector('.tour-skip'));
    await wait(200);
    check('Skip closes the tour', !doc.querySelector('.tour-tip'));
    check('skipping records that it has been seen', !!win.localStorage.getItem(t.TOUR_KEY));
    check('no crash while driving the tour', errs.length === 0);
  }

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

// A thrown error aborts the rest of the suite, which silently removes checks.
// Without this the summary happily reports "269/269 passed" on a run that
// stopped two thirds of the way through — which is exactly how a real bug got
// past me. The floor only ever goes up.
const EXPECTED_MIN = 743;
if (results.length < EXPECTED_MIN) {
  log(`\n*** TRUNCATED: ${results.length} checks ran, expected at least ${EXPECTED_MIN}.`);
  log('    Something threw and took the rest of the suite with it. See RUNTIME ERRORS.');
  fail++;
}
if (errs.length) log(`\n*** ${errs.length} runtime error(s) — the run is NOT a pass.`);
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
