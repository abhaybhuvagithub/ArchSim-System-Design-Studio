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
    const BRAND_LOWERCASE = new Set(['goCash Wallet', 'iCloud Sync', 'eKYC Service']);
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

    // The key. This is the part that must not be sloppy.
    check('the key is held in session storage, not local storage',
      llm.KEY_STORE && /session/i.test(llm.getKey.toString()));
    check('a key is redacted if it ever reaches display',
      llm.redact('oops sk-ant-abcd1234efgh here') === 'oops [key redacted] here');
    check('the warning states the key is never sent to this site', /never sent to this site/i.test(llm.KEY_WARNING));
    check('no key means no request is attempted', await (async () => {
      let called = false;
      try { await llm.ask({ key: '', system: 's', messages: [], fetchImpl: () => { called = true } }) } catch { /* expected */ }
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
      try { await llm.ask({ key: 'x', system: 's', messages: [], fetchImpl: async () => ({ ok: false, status: 401 }) }) }
      catch (e) { return /rejected that key/i.test(e.message) }
      return false;
    })());
    check('the interviewer prompt tells the model not to write the design',
      /not write the design/i.test(llm.systemPrompt('X', 'Y')));
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
    check('the four distributed faults are wired into the chaos engine', dist.length === 4);
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
  check('Brief is the first analysis tab', /^Brief/.test(tabNames[0] || ''));
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

    const a11yBtn = byText('.toolbar button', 'A11y');
    check('there is an accessibility mode toggle', !!a11yBtn);
    check('the toggle reports its state', a11yBtn.getAttribute('aria-pressed') === 'false');
    click(a11yBtn); await wait(150);
    check('turning it on is reflected on the document', doc.documentElement.className.includes('a11y'));
    click(byText('.toolbar button', 'A11y')); await wait(150);
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
    check('all ten tabs are tabs', tabBtns.length === 10);
    check('exactly one tab is selected',
      tabBtns.filter((b) => b.getAttribute('aria-selected') === 'true').length === 1);
    check('every tab has a word label, not just an icon',
      tabBtns.every((b) => /[A-Za-z]{4,}/.test(b.textContent)));
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
      widthOf(palette()) === 168 && before === 168);
  }

  // ── ①②③ step badges default to on ──────────────────────────────────────────
  const stepsBtn = [...doc.querySelectorAll('.toolbar button')]
    .find((b) => /Steps|①/.test(b.textContent));
  check('the steps toggle exists', !!stepsBtn);
  check('step badges are on by default', !!stepsBtn && stepsBtn.className.includes('active'));

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

    // Inspector controls: select a datastore on the canvas and drive them.
    // The inspector renders behind the Capacity tab, and every other tab
    // clears the selection on the way out.
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
      typeInto(qi()[1], '1'); await wait(80);
      typeInto(qi()[2], '1'); await wait(150);
      check('a broken quorum is called out as bad in the inspector',
        !!doc.querySelector('.ddia-verdict.bad'));
      typeInto(qi()[1], '2'); await wait(80);
      typeInto(qi()[2], '2'); await wait(150);
      check('fixing the quorum clears the warning',
        !!doc.querySelector('.ddia-verdict.good') && !doc.querySelector('.ddia-verdict.bad'));
      repSel.value = 'leader';
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

  // ── the tour against the real DOM ──────────────────────────────────────────
  {
    const t = await import(pathToFileURL(path.join(root, 'src/tour.js')).href);
    // The one failure mode that matters: a selector stops matching after a
    // refactor and the step silently vanishes. Assert every target resolves.
    const missing = t.TOUR_STEPS.filter(s => s.target && !doc.querySelector(s.target));
    check('every tour step finds its target in the mounted app' +
      (missing.length ? ' — missing: ' + missing.map(m => `${m.id} (${m.target})`).join(', ') : ''),
      missing.length === 0);
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
const EXPECTED_MIN = 372;
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
