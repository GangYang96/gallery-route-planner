const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), { spawnSync } = require('node:child_process');
const P = require('../src/planner.js');
function permutations(a) { return a.length ? a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(t=>[v,...t])) : [[]]; }
function bfs(map,from,to) {
  const walls=new Set(map.blocked.map(p=>p.join(','))), queue=[[from,0]], seen=new Set([from.join(',')]);
  for(let i=0;i<queue.length;i++) { const [p,n]=queue[i]; if(p.join(',')===to.join(','))return n;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const q=[p[0]+dx,p[1]+dy],key=q.join(','); if(q[0]>=0&&q[0]<map.width&&q[1]>=0&&q[1]<map.height&&!walls.has(key)&&!seen.has(key)){seen.add(key);queue.push([q,n+1]);} }
  } return Infinity;
}
test('exact solver agrees with exhaustive tours using independently computed BFS distances', () => {
  const map=P.defaultMap(), points=Object.fromEntries([['S',map.entrance],...map.exhibits.map(e=>[e.id,e.pos])]);
  for(const returnToStart of [false,true]) for(let mask=1;mask<16;mask++) {
    const ids=map.exhibits.filter((_,i)=>mask&(1<<i)).map(e=>e.id);
    const expected=Math.min(...permutations(ids).map(order=>{const nodes=['S',...order,...(returnToStart?['S']:[])];return nodes.slice(1).reduce((sum,id,i)=>sum+bfs(map,points[nodes[i]],points[id]),0);}));
    const result=P.plan(map,ids,{returnToStart});assert.equal(result.steps,expected);assert.equal(result.comparison.gap_steps,0);
  }
});
test('round-trip route visits each requested stop and ends at the entrance', () => {
  const map=P.defaultMap(),r=P.plan(map,['D','A','C'],{returnToStart:true});
  assert.deepEqual(r.route.at(-1),map.entrance);assert.equal(r.segments.at(-1).to,'S');
  assert.equal(r.segments.reduce((sum,s)=>sum+s.steps,0),r.steps);
  assert.equal(r.estimated_minutes,r.steps/60+6);
});
test('temporary closures alter the route, preserve input, and report disconnected stops', () => {
  const map=P.defaultMap(),before=JSON.stringify(map);
  const a=P.plan(map,['C','A','D','B']),b=P.plan(map,['C','A','D','B'],{closedCells:[[4,4]]});
  assert.equal(a.steps,28);assert.equal(b.steps,36);assert.ok(b.route.every(p=>p.join(',')!=='4,4'));assert.equal(JSON.stringify(map),before);
  assert.throws(()=>P.plan(map,['A'],{closedCells:[[1,2],[3,2],[2,1],[2,3]]}),/UNREACHABLE/);
});
test('custom dimensions and labels are supported with deterministic solver comparisons', () => {
  const map={schema_version:1,name:'Small synthetic map',width:5,height:4,entrance:[0,0],blocked:[[2,0],[2,1]],exhibits:[{id:'X',label:'X',pos:[4,0],dwell_minutes:1},{id:'Y',label:'Y',pos:[1,3],dwell_minutes:0}]};
  for(const method of ['exact','nearest','genetic']) {
    const r=P.plan(map,['X','Y'],{method,seed:0});assert.deepEqual(r,P.plan(map,['X','Y'],{method,seed:0}));
    assert.ok(r.steps>=r.comparison.exact);assert.ok(r.steps<=r.initial || method==='nearest');
    r.route.forEach((p,i)=>{assert.ok(p[0]<5&&p[1]<4);if(i)assert.equal(Math.abs(p[0]-r.route[i-1][0])+Math.abs(p[1]-r.route[i-1][1]),1);});
  }
});
test('invalid maps, duplicate coordinates and reserved stop IDs fail at the boundary', () => {
  for(const mutate of [m=>m.width=41,m=>m.entrance=[0.5,0],m=>m.exhibits[0].id='S',m=>m.exhibits[0].pos=m.entrance,m=>m.exhibits[0].dwell_minutes=-1,m=>m.blocked.push(m.blocked[0])]) {const m=P.defaultMap();mutate(m);assert.throws(()=>P.validateMap(m));}
  for(const options of [{seed:-1},{secondsPerStep:0},{method:'magic'},{closedCells:[[99,0]]}])assert.throws(()=>P.plan(P.defaultMap(),['A'],options));
});
test('six-stop fixture is reproducible and CLI validates custom-map options', () => {
  const run=args=>spawnSync(process.execPath,['scripts/plan.cjs',...args],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  const args=['--map','examples/gallery-six.json','--stops','F,A,E,B,D,C','--method','exact','--return'];
  const a=run(args),b=run(args);assert.equal(a.status,0,a.stderr);assert.equal(a.stdout,b.stdout);
  const r=JSON.parse(a.stdout);assert.equal(r.order.length,6);assert.deepEqual(r.route.at(-1),r.map.entrance);
  assert.equal(run([...args,'--closed']).status,1);
});
