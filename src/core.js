/* Independent toy-gallery planner. A* uses a Manhattan heuristic on four-neighbor cells; seeded genetic search explores visit orders without an optimality guarantee. */
(function (root) {
  'use strict';

  const W = 15,
    H = 11,
    start = [1, 9];
  const exhibits = [{
    id: 'A',
    pos: [2, 2],
    en: 'Prism tower',
    zh: '棱镜塔',
    color: '#509f9d',
    shape: 'tower'
  }, {
    id: 'B',
    pos: [7, 2],
    en: 'Orbit sculpture',
    zh: '轨道雕塑',
    color: '#b4935b',
    shape: 'orbit'
  }, {
    id: 'C',
    pos: [12, 2],
    en: 'Crystal study',
    zh: '晶体装置',
    color: '#688bb1',
    shape: 'crystal'
  }, {
    id: 'D',
    pos: [12, 8],
    en: 'Folded ribbon',
    zh: '折带艺术',
    color: '#a5819e',
    shape: 'ribbon'
  }];
  function blocked(extra = false) {
    const set = new Set();
    for (let x = 0; x < W; x++) {
      set.add(x + ',0');
      set.add(x + ',' + (H - 1));
    }
    for (let y = 0; y < H; y++) {
      set.add('0,' + y);
      set.add(W - 1 + ',' + y);
    }
    for (let y = 1; y <= 7; y++) if (y !== 4) set.add('4,' + y);
    for (let y = 3; y <= 9; y++) if (y !== 7) set.add('10,' + y);
    if (extra) set.add('4,4');
    return set;
  }
  function path(from, to, walls) {
    if ([from, to].some(p => p[0] < 0 || p[0] >= W || p[1] < 0 || p[1] >= H || walls.has(p.join(',')))) return null;
    const key = p => p.join(','),
      open = [{
        p: from,
        g: 0,
        f: 0
      }],
      best = new Map([[key(from), 0]]),
      prev = new Map();
    while (open.length) {
      open.sort((a, b) => a.f - b.f || a.g - b.g);
      const curr = open.shift(),
        ck = key(curr.p);
      if (curr.g !== best.get(ck)) continue;
      if (ck === key(to)) {
        const route = [to];
        let k = ck;
        while (prev.has(k)) {
          k = prev.get(k);
          route.push(k.split(',').map(Number));
        }
        return route.reverse();
      }
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const p = [curr.p[0] + dx, curr.p[1] + dy],
          k = key(p),
          g = curr.g + 1;
        if (p[0] < 0 || p[0] >= W || p[1] < 0 || p[1] >= H || walls.has(k) || g >= (best.get(k) ?? Infinity)) continue;
        best.set(k, g);
        prev.set(k, ck);
        open.push({
          p,
          g,
          f: g + Math.abs(p[0] - to[0]) + Math.abs(p[1] - to[1])
        });
      }
    }
    return null;
  }
  function random(seed) {
    let s = seed >>> 0;
    return () => {
      s = 1664525 * s + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  function optimize(ids, extra = false, seed = 42) {
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !exhibits.some(e => e.id === id))) throw Error('SELECTION');
    const walls = blocked(extra),
      points = {
        S: start,
        ...Object.fromEntries(exhibits.map(e => [e.id, e.pos]))
      },
      paths = new Map();
    for (const a of ['S', ...ids]) for (const b of ids) if (a !== b) {
      const p = path(points[a], points[b], walls);
      if (!p) throw Error('UNREACHABLE');
      paths.set(a + b, p);
    }
    const cost = order => {
      let prior = 'S',
        sum = 0;
      for (const id of order) {
        sum += paths.get(prior + id).length - 1;
        prior = id;
      }
      return sum;
    };
    const rng = random(seed),
      shuffle = a => {
        const out = [...a];
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      };
    let pop = [ids.slice(), ...Array.from({
        length: 23
      }, () => shuffle(ids))],
      history = [];
    for (let generation = 0; generation < 45; generation++) {
      pop.sort((a, b) => cost(a) - cost(b));
      history.push(cost(pop[0]));
      const next = pop.slice(0, 4).map(a => a.slice());
      while (next.length < 24) {
        const a = pop[Math.floor(rng() * 8)],
          b = pop[Math.floor(rng() * 8)],
          cut = Math.floor(rng() * (ids.length + 1));
        let child = a.slice(0, cut);
        child = child.concat(b.filter(x => !child.includes(x)));
        if (rng() < .4 && child.length > 1) {
          const i = Math.floor(rng() * child.length),
            j = Math.floor(rng() * child.length);
          [child[i], child[j]] = [child[j], child[i]];
        }
        next.push(child);
      }
      pop = next;
    }
    pop.sort((a, b) => cost(a) - cost(b));
    const order = pop[0],
      route = [start];
    let prior = 'S';
    for (const id of order) {
      route.push(...paths.get(prior + id).slice(1));
      prior = id;
    }
    return {
      order,
      route,
      steps: route.length - 1,
      initial: cost(ids),
      history,
      seed,
      extra,
      generations: 45,
      population: 24,
      algorithm: 'A* between stops; seeded genetic search for visit order; no return to entrance',
      synthetic: true
    };
  }
  const api = {
    W,
    H,
    start,
    exhibits,
    blocked,
    path,
    optimize,
    random
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;else root.GalleryCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
