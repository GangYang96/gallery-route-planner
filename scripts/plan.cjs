const C = require('../src/core.js');
const P = require('../src/planner.js');
const {options, read, emit, main} = require('./common.cjs');
main(() => {
  const args = options(process.argv.slice(2), ['stops','seed','map','method','closures','seconds-per-step','output'], ['closed','return','help']);
  if (args.help) { console.log('node scripts/plan.cjs --stops C,A,D,B [--map MAP_JSON] [--method exact|nearest|genetic] [--seed 42] [--closed] [--closures CELLS_JSON] [--return] [--seconds-per-step 1] [--output NEW_FILE]'); return; }
  if (!args.stops) throw Error('Provide --stops');
  const seed = args.seed===undefined ? 42 : Number(args.seed);
  if (!Number.isInteger(seed) || seed<0 || seed>4294967295) throw Error('Seed must be an unsigned 32-bit integer');
  const stops = args.stops.split(',').map(s=>s.trim());
  const advanced = args.map || args.method || args.closures || args.return || args['seconds-per-step'];
  if (!advanced) { emit(C.optimize(stops, Boolean(args.closed), seed), args.output); return; }
  if (args.map && args.closed) throw Error('--closed is only available for the default map; use --closures with custom maps');
  const map = args.map ? JSON.parse(read(args.map, 200000)) : P.defaultMap();
  const closedCells = args.closures ? JSON.parse(read(args.closures, 30000)) : [];
  if (args.closed) closedCells.push([4, 4]);
  emit(P.plan(map, stops, {method: args.method || 'exact', seed, returnToStart: Boolean(args.return), closedCells, secondsPerStep: args['seconds-per-step'] ? Number(args['seconds-per-step']) : 1}), args.output);
});
