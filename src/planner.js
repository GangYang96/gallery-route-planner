/* Map contracts and tour solvers. Exact ordering is bounded to ten requested stops. */
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.GalleryCore;
  const clone = value => JSON.parse(JSON.stringify(value));
  function defaultMap() {
    return { schema_version: 1, name: 'Synthetic gallery', width: C.W, height: C.H, entrance: [...C.start],
      blocked: [...C.blocked()].map(key => key.split(',').map(Number)),
      exhibits: C.exhibits.map(e => ({ id: e.id, label: e.en, pos: [...e.pos], dwell_minutes: 2 })) };
  }
  function validateMap(map) {
    if (!map || map.schema_version !== 1 || typeof map.name !== 'string' || !map.name.trim() || map.name.length > 80) throw Error('MAP_SCHEMA');
    if (![map.width, map.height].every(n => Number.isInteger(n) && n >= 3 && n <= 40)) throw Error('MAP_SIZE');
    const validPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isInteger) && point[0] >= 0 && point[0] < map.width && point[1] >= 0 && point[1] < map.height;
    if (!Array.isArray(map.blocked) || map.blocked.length > 1600 || !map.blocked.every(validPoint) || !validPoint(map.entrance)) throw Error('MAP_COORDINATES');
    const walls = new Set(map.blocked.map(p => p.join(',')));
    if (walls.size !== map.blocked.length || walls.has(map.entrance.join(','))) throw Error('MAP_BLOCKED_ENTRANCE');
    if (!Array.isArray(map.exhibits) || !map.exhibits.length || map.exhibits.length > 10) throw Error('MAP_EXHIBITS');
    const ids = new Set(['S']), positions = new Set([map.entrance.join(',')]);
    for (const e of map.exhibits) {
      if (!e || !/^[A-Z][A-Z0-9_-]{0,15}$/.test(e.id) || ids.has(e.id) || typeof e.label !== 'string' || !e.label.trim() || e.label.length > 80 || !validPoint(e.pos) || walls.has(e.pos.join(',')) || positions.has(e.pos.join(','))) throw Error('MAP_EXHIBIT');
      if (!Number.isFinite(e.dwell_minutes) || e.dwell_minutes < 0 || e.dwell_minutes > 120) throw Error('DWELL_TIME');
      ids.add(e.id); positions.add(e.pos.join(','));
    }
    return clone(map);
  }
  function plan(input, ids, options = {}) {
    const map = validateMap(input), { method = 'exact', returnToStart = false, seed = 42, closedCells = [], secondsPerStep = 1 } = options;
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !map.exhibits.some(e => e.id === id))) throw Error('SELECTION');
    if (!['exact', 'nearest', 'genetic'].includes(method) || typeof returnToStart !== 'boolean') throw Error('METHOD');
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('SEED');
    if (!Number.isFinite(secondsPerStep) || secondsPerStep <= 0 || secondsPerStep > 60) throw Error('STEP_TIME');
    if (!Array.isArray(closedCells) || closedCells.length > 1600 || closedCells.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || p[0] < 0 || p[0] >= map.width || p[1] < 0 || p[1] >= map.height)) throw Error('CLOSURE');
    const walls = new Set([...map.blocked, ...closedCells].map(p => p.join(',')));
    const points = Object.fromEntries([['S', map.entrance], ...map.exhibits.map(e => [e.id, e.pos])]);
    const paths = new Map(), nodes = ['S', ...ids];
    for (const a of nodes) for (const b of nodes) if (a !== b) {
      const segment = C.path(points[a], points[b], walls, map);
      if (!segment) throw Error(`UNREACHABLE:${a}:${b}`);
      paths.set(a + ':' + b, segment);
    }
    const distance = (a, b) => paths.get(a + ':' + b).length - 1;
    const cost = order => order.reduce((sum, id, index) => sum + distance(index ? order[index - 1] : 'S', id), 0) + (returnToStart ? distance(order.at(-1), 'S') : 0);
    const nearest = [], remaining = [...ids];
    while (remaining.length) {
      const from = nearest.at(-1) || 'S';
      remaining.sort((a, b) => distance(from, a) - distance(from, b) || a.localeCompare(b));
      nearest.push(remaining.shift());
    }
    // Held-Karp dynamic programming: each state is (visited bitmask, last stop).
    const count = ids.length, full = (1 << count) - 1, dp = new Map(), parent = new Map();
    const key = (mask, last) => mask * count + last;
    for (let i = 0; i < count; i++) dp.set(key(1 << i, i), distance('S', ids[i]));
    for (let mask = 1; mask <= full; mask++) for (let last = 0; last < count; last++) {
      const value = dp.get(key(mask, last));
      if (value === undefined) continue;
      for (let next = 0; next < count; next++) if (!(mask & (1 << next))) {
        const nextMask = mask | (1 << next), candidate = value + distance(ids[last], ids[next]), nextKey = key(nextMask, next);
        if (candidate < (dp.get(nextKey) ?? Infinity)) { dp.set(nextKey, candidate); parent.set(nextKey, last); }
      }
    }
    let last = 0, optimum = Infinity;
    for (let i = 0; i < count; i++) {
      const value = dp.get(key(full, i)) + (returnToStart ? distance(ids[i], 'S') : 0);
      if (value < optimum) { optimum = value; last = i; }
    }
    const exact = [];
    for (let mask = full; mask;) { exact.push(ids[last]); const prior = parent.get(key(mask, last)); mask ^= 1 << last; last = prior; }
    exact.reverse();
    const rng = C.random(seed);
    function shuffle(order) { const a = [...order]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    let population = [[...ids], nearest, ...Array.from({ length: 30 }, () => shuffle(ids))];
    const history = [];
    for (let generation = 0; generation < 50; generation++) {
      population.sort((a, b) => cost(a) - cost(b)); history.push(cost(population[0]));
      const next = population.slice(0, 4).map(a => [...a]);
      while (next.length < 32) {
        const a = population[Math.floor(rng() * 8)], b = population[Math.floor(rng() * 8)], cut = Math.floor(rng() * (count + 1));
        const child = a.slice(0, cut); child.push(...b.filter(id => !child.includes(id)));
        if (rng() < 0.4) { const i = Math.floor(rng() * count), j = Math.floor(rng() * count); [child[i], child[j]] = [child[j], child[i]]; }
        next.push(child);
      }
      population = next;
    }
    population.sort((a, b) => cost(a) - cost(b));
    const genetic = population[0], order = { exact, nearest, genetic }[method], route = [[...map.entrance]], segments = [];
    let prior = 'S';
    for (const id of [...order, ...(returnToStart ? ['S'] : [])]) {
      const cells = paths.get(prior + ':' + id);
      segments.push({ from: prior, to: id, steps: cells.length - 1 }); route.push(...cells.slice(1)); prior = id;
    }
    const steps = route.length - 1;
    return { schema_version: 2, map, options: { method, returnToStart, seed, closedCells: clone(closedCells), secondsPerStep },
      order, route, segments, steps, initial: cost(ids), history,
      comparison: { input: cost(ids), nearest: cost(nearest), genetic: cost(genetic), exact: optimum, gap_steps: steps - optimum },
      estimated_minutes: steps * secondsPerStep / 60 + map.exhibits.filter(e => ids.includes(e.id)).reduce((sum, e) => sum + e.dwell_minutes, 0),
      scope: 'Synthetic grid; estimates use configured step time and dwell time. Exact ordering for requested stops only.' };
  }
  const api = { defaultMap, validateMap, plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GalleryPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
