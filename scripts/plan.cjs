const C = require('../src/core.js');
const {options, emit, main} = require('./common.cjs');
main(() => {
  const args = options(process.argv.slice(2), ['stops','seed','output'], ['closed','help']);
  if (args.help) { console.log('node scripts/plan.cjs --stops C,A,D,B [--seed 42] [--closed] [--output NEW_FILE]'); return; }
  if (!args.stops) throw Error('Provide --stops');
  const seed = args.seed===undefined ? 42 : Number(args.seed);
  if (!Number.isInteger(seed) || seed<0 || seed>4294967295) throw Error('Seed must be an unsigned 32-bit integer');
  const stops = args.stops.split(',').map(s=>s.trim());
  emit(C.optimize(stops,Boolean(args.closed),seed),args.output);
});
