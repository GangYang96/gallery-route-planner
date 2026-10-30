(() => {
  'use strict';

  const {
      t,
      esc,
      $
    } = Demo,
    C = GalleryCore, P = GalleryPlanner;
  let gallery = P.defaultMap(), closedCells = [];
  let selected = ['C', 'A', 'D', 'B'],
    active = C.exhibits[0],
    result = null,
    tourFrame = 0,
    touring = false,
    angle = .65,
    tilt = .35,
    drag = null,
    timer = null;
  const cell = 34;
  Demo.mount('gallery-lab', t('3D Gallery and Route Planning', '三维展品与路线规划'), t('Interactive 3D objects and obstacle-aware indoor guidance.', '三维展品交互与考虑通道障碍的室内导览。'), `<div class="notice">${t('Independent reconstruction from the XR project description. Synthetic gallery; software-projected 3D objects, A* paths and genetic visit-order search. No headset or indoor positioning service.', '依据 XR 项目介绍独立实现。虚构展馆使用软件投影三维模型、A* 寻路与遗传算法参观排序，不连接头显或室内定位服务。')}</div><div class="grid"><div><section class="card"><h2><span class="section-no">01</span>${t('Gallery floor plan', '展馆平面图')}<span class="badge">${t('15 × 11 grid', '15 × 11 网格')}</span></h2><div class="map-wrap" id="map"></div><div class="map-key"><span>${t('Exhibit', '展品')}</span><span>${t('Suggested route', '规划路线')}</span><span>${t('Wall / closed passage', '墙体 / 封闭通道')}</span></div><div class="metrics"><div class="metric"><div class="value" id="stops">4</div><div class="label">${t('Selected stops', '参观展品')}</div></div><div class="metric"><div class="value" id="steps">—</div><div class="label">${t('Grid steps', '网格步数')}</div></div><div class="metric"><div class="value" id="saved">—</div><div class="label">${t('Steps saved vs input order', '比输入顺序减少步数')}</div></div></div><div class="tour-message" id="tourMessage" aria-live="polite"></div><div class="actions"><button class="btn primary" id="plan">${t('Plan visit', '规划参观')} →</button><button class="btn" id="walk" disabled>${t('Walk the route', '沿路线参观')}</button><button class="btn" id="export" disabled>${t('Export route', '导出路线')}</button></div></section><section class="card"><h2>${t('How the route is built', '路线如何生成')}</h2><div class="route-summary" id="routeSummary">${t('A* connects stops through walkable cells. Genetic search explores visit orders with a fixed seed.', 'A* 计算展品之间可通行的路径，遗传算法以固定种子探索参观顺序。')}</div><p class="note-bottom">${t('Distances are grid steps, not measured meters. Genetic search does not certify a globally optimal tour.', '距离为网格步数，不是实测米数。遗传算法搜索不保证全局最优。')}</p></section></div><aside><section class="card"><h2><span class="section-no">02</span>${t('Inspect a 3D exhibit', '查看三维展品')}</h2><div class="viewer"><span class="viewer-label" id="viewerTitle"></span><canvas id="model" width="640" height="380" tabindex="0" aria-label="${t('3D exhibit, drag or use arrow keys to rotate', '三维展品，拖动或使用方向键旋转')}"></canvas><span class="viewer-hint">${t('Drag to rotate · arrow keys supported', '拖动旋转 · 支持方向键')}</span></div><div class="actions" id="modelButtons">${C.exhibits.map(e => `<button class="btn" data-model="${e.id}" aria-label="${esc(t(e.en, e.zh))}">${e.id}</button>`).join('')}</div></section><section class="card"><h2><span class="section-no">03</span>${t('Choose your stops', '选择参观展品')}</h2><div class="exhibit-list" id="exhibits"></div><p class="hint">${t('Click to add or remove a stop.', '点击可添加或移除参观展品。')}</p><label style="display:flex;gap:8px;align-items:center;margin-top:16px"><input type="checkbox" id="closure">${t('Close the western shortcut', '封闭西侧快捷通道')}</label><div class="evidence" id="algorithm">${t('Seed 42 · 24 individuals · 45 generations', '种子42 · 种群24 · 迭代45代')}</div></section></aside></div>`);
  $('algorithm').insertAdjacentHTML('beforebegin', `<div class="controls"><label>${t('Solver', '排序算法')}<select id="method"><option value="exact">${t('Exact ordering', '精确排序')}</option><option value="nearest">${t('Nearest neighbor', '最近邻')}</option><option value="genetic">${t('Genetic search', '遗传搜索')}</option></select></label><label>${t('Seed', '随机种子')}<input id="seed" type="number" min="0" max="4294967295" value="42"></label><label>${t('Seconds per grid step', '每步秒数')}<input id="stepTime" type="number" min="0.1" max="60" step="0.1" value="1"></label></div><label><input type="checkbox" id="roundTrip"> ${t('Return to entrance', '返回入口')}</label>`);
  document.querySelector('.grid').insertAdjacentHTML('afterend', `<section class="card"><h2>${t('Map configuration', '地图配置')}</h2><p>${t('Import a map with up to 10 exhibits and a 40 × 40 grid. Custom maps change the floor plan; the 3D viewer retains the four bundled models.', '可导入最多10个展品、40 × 40网格的地图。自定义地图修改平面布局；三维查看器保留四个内置模型。')}</p><label>${t('Map JSON', '地图 JSON')}<input id="mapFile" type="file" accept=".json"></label><div class="actions"><button class="btn" id="downloadMap">${t('Export map', '导出地图')}</button><button class="btn" id="defaultMap">${t('Reset map', '恢复默认地图')}</button></div><div class="controls"><label>X<input id="closeX" type="number" min="0" value="4"></label><label>Y<input id="closeY" type="number" min="0" value="4"></label><button class="btn" id="toggleCell">${t('Close / reopen cell', '封闭 / 开放网格')}</button><button class="btn" id="clearCells">${t('Clear temporary closures', '清除临时封闭')}</button></div><p id="closedList"></p><p id="mapError" class="error" role="alert"></p></section><section class="card"><h2>${t('Solver comparison', '算法对比')}</h2><div id="comparison" class="table-scroll"></div><p>${t('Times are estimates from configured grid speed and exhibit dwell time; they are not measurements. Exact ordering applies to this small static map.', '时间由每步秒数和展品停留时间估算，不是实测数据。精确排序适用于当前小规模静态地图。')}</p><div id="segments" class="table-scroll"></div></section>`);
  $('algorithm').textContent = t('A* segments · 32 individuals · 50 generations · exact DP baseline', 'A* 分段寻路 · 32个体 · 50代 · 动态规划精确基准');
  function allClosures() { return [...closedCells, ...($('closure').checked ? [[4, 4]] : [])]; }
  function drawMap() {
    const walls = new Set([...gallery.blocked, ...allClosures()].map(p => p.join(',')));
    $('map').closest('.card').querySelector('.badge').textContent = `${gallery.width} × ${gallery.height}`;
    $('closedList').textContent = `${t('Temporary closures', '临时封闭')}：${allClosures().map(p => p.join(',')).join(' / ') || '—'}`;
    let svg = `<svg viewBox="0 0 ${gallery.width * cell} ${gallery.height * cell}" role="img" aria-label="${t('Synthetic gallery map and route', '虚构展馆平面图与参观路线')}"><defs><pattern id="grid" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M ${cell} 0 H 0 V ${cell}" fill="none" stroke="#e0e8ed" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#f7fafb"/><rect width="100%" height="100%" fill="url(#grid)"/>`;
    for (const k of walls) {
      const [x, y] = k.split(',').map(Number);
      svg += `<rect x="${x * cell + 1}" y="${y * cell + 1}" width="${cell - 2}" height="${cell - 2}" rx="3" fill="#708898"/>`;
    }
    if (result) svg += `<polyline points="${result.route.map(([x, y]) => `${x * cell + cell / 2},${y * cell + cell / 2}`).join(' ')}" fill="none" stroke="#26957e" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity=".8"/>`;
    for (const e of gallery.exhibits) {
      const [x, y] = e.pos;
      svg += `<g><rect x="${x * cell + 4}" y="${y * cell + 4}" width="${cell - 8}" height="${cell - 8}" rx="6" fill="${selected.includes(e.id) ? '#c79f63' : '#d9e2e7'}"/><text x="${x * cell + cell / 2}" y="${y * cell + cell / 2 + 4}" text-anchor="middle" fill="${selected.includes(e.id) ? '#fff' : '#6b8090'}" font-size="12" font-family="Arial">${e.id}</text></g>`;
    }
    const [sx, sy] = gallery.entrance;
    svg += `<circle cx="${sx * cell + cell / 2}" cy="${sy * cell + cell / 2}" r="10" fill="#2b607e"/><text x="${sx * cell + cell / 2}" y="${sy * cell + cell / 2 + 4}" text-anchor="middle" fill="white" font-size="10">S</text>`;
    const pos = result ? result.route[Math.min(tourFrame, result.route.length - 1)] : gallery.entrance;
    svg += `<circle id="visitor" cx="${pos[0] * cell + cell / 2}" cy="${pos[1] * cell + cell / 2}" r="7" fill="#173148" stroke="white" stroke-width="3"/></svg>`;
    $('map').innerHTML = svg;
  }
  function list() {
    $('exhibits').innerHTML = gallery.exhibits.map(e => {
      const original = C.exhibits.find(item => item.id === e.id && item.en === e.label);
      return `<button class="exhibit" data-stop="${e.id}" aria-pressed="${selected.includes(e.id)}"><span class="exhibit-code">${e.id}</span>${esc(original ? t(original.en, original.zh) : e.label)}</button>`;
    }).join('');
    $('stops').textContent = selected.length;
  }
  function stop() {
    clearInterval(timer);
    touring = false;
    $('walk').textContent = t('Walk the route', '沿路线参观');
  }
  function clear() {
    stop();
    result = null;
    $('comparison').innerHTML = '';
    $('segments').innerHTML = '';
    tourFrame = 0;
    $('routeSummary').textContent = t('Plan a new route for the current selection.', '请按当前选择重新规划路线。');
    $('steps').textContent = '—';
    $('saved').textContent = '—';
    $('walk').disabled = true;
    $('export').disabled = true;
    $('tourMessage').textContent = t('Selection changed. Plan a new route.', '选择已改变，请重新规划路线。');
    drawMap();
    list();
  }
  function plan() {
    stop();
    try {
      result = P.plan(gallery, selected, {method: $('method').value, returnToStart: $('roundTrip').checked, seed: Number($('seed').value), closedCells: allClosures(), secondsPerStep: Number($('stepTime').value)});
      $('mapError').textContent = '';
      $('comparison').innerHTML = `<table><thead><tr><th>${t('Method', '算法')}</th><th>${t('Steps', '步数')}</th></tr></thead><tbody>${[['input', t('Input order', '输入顺序')], ['nearest', t('Nearest neighbor', '最近邻')], ['genetic', t('Genetic search', '遗传搜索')], ['exact', t('Exact optimum', '精确最优')]].map(([key, label]) => `<tr><td>${label}</td><td>${result.comparison[key]}</td></tr>`).join('')}</tbody></table><p>${t('Gap to optimum', '距精确最优差距')}：${result.comparison.gap_steps} · ${t('Estimated minutes including dwell', '含停留的预计分钟')}：${result.estimated_minutes.toFixed(1)}</p>`;
      $('segments').innerHTML = `<table><thead><tr><th>${t('Segment', '分段')}</th><th>${t('Steps', '步数')}</th></tr></thead><tbody>${result.segments.map(s => `<tr><td>${esc(s.from)} → ${esc(s.to)}</td><td>${s.steps}</td></tr>`).join('')}</tbody></table>`;
      tourFrame = 0;
      $('steps').textContent = result.steps;
      $('saved').textContent = result.initial - result.steps;
      $('walk').disabled = false;
      $('export').disabled = false;
      $('routeSummary').textContent = `${t('Entrance', '入口')} → ${result.order.join(' → ')}${result.options.returnToStart ? ' → S' : ''}\n${t('Input order', '输入顺序')}: ${selected.join(' → ')} (${result.initial}) · ${t('Planned', '规划后')}: ${result.steps}`;
      $('tourMessage').textContent = t('Route ready. Every segment follows a walkable cell.', '路线已生成，各段均沿可通行网格行走。');
      drawMap();
    } catch (error) {
      clear();
      $('tourMessage').textContent = t('Cannot plan this route: ', '无法规划当前路线：') + error.message;
    }
  }
  $('exhibits').onclick = e => {
    const b = e.target.closest('[data-stop]');
    if (b) {
      const id = b.dataset.stop;
      selected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
      clear();
    }
  };
  $('closure').onchange = clear;
  for (const id of ['method', 'seed', 'stepTime', 'roundTrip']) $(id).oninput = clear;
  $('toggleCell').onclick = () => {
    const p = [Number($('closeX').value), Number($('closeY').value)], key = p.join(',');
    if (!p.every(Number.isInteger) || p[0] < 0 || p[0] >= gallery.width || p[1] < 0 || p[1] >= gallery.height || [gallery.entrance, ...gallery.exhibits.map(e => e.pos), ...gallery.blocked].some(q => q.join(',') === key)) {
      $('mapError').textContent = t('Choose a walkable cell that is not an entrance or exhibit.', '请选择有效的可通行网格，不能是入口、展品或固定墙体。'); return;
    }
    closedCells = closedCells.some(q => q.join(',') === key) ? closedCells.filter(q => q.join(',') !== key) : [...closedCells, p];
    $('mapError').textContent = ''; clear();
  };
  $('clearCells').onclick = () => { closedCells = []; $('closure').checked = false; clear(); };
  $('downloadMap').onclick = () => Demo.download('gallery-map.json', { ...gallery, blocked: [...new Map([...gallery.blocked, ...allClosures()].map(p => [p.join(','), p])).values()] });
  $('defaultMap').onclick = () => { gallery = P.defaultMap(); selected = ['C', 'A', 'D', 'B']; closedCells = []; $('closure').disabled = false; $('closure').checked = false; clear(); };
  $('mapFile').onchange = async event => {
    const file = event.target.files[0];
    try {
      if (!file) return;
      if (file.size > 200000) throw Error('MAP_SIZE');
      const next = P.validateMap(JSON.parse(await file.text()));
      gallery = next; selected = next.exhibits.map(e => e.id); closedCells = []; $('closure').checked = false; $('closure').disabled = true; $('mapError').textContent = ''; clear();
    } catch (error) { $('mapError').textContent = t('Map rejected; previous map retained: ', '地图未通过校验，原地图保留：') + error.message; }
    finally { event.target.value = ''; }
  };
  $('plan').onclick = plan;
  $('walk').onclick = () => {
    if (!result) return;
    if (touring) {
      stop();
      return;
    }
    touring = true;
    if (tourFrame >= result.route.length - 1) tourFrame = 0;
    $('walk').textContent = t('Pause walk', '暂停参观');
    timer = setInterval(() => {
      tourFrame++;
      if (tourFrame >= result.route.length - 1) {
        tourFrame = result.route.length - 1;
        stop();
        $('tourMessage').textContent = t('Tour complete.', '参观路线已完成。');
      } else $('tourMessage').textContent = `${t('Walking', '正在参观')} · ${tourFrame}/${result.steps}`;
      drawMap();
    }, 120);
  };
  $('export').onclick = () => {
    if (result) Demo.download('gallery-route-demo.json', result);
  };
  const canvas = $('model'),
    ctx = canvas.getContext('2d');
  function mesh() {
    const v = [],
      f = [];
    if (active.shape === 'tower') {
      for (let y = 0; y < 3; y++) {
        const r = 1 - y * .2;
        for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) v.push([x, (y - 1) * 1.05, z]);
      }
      for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) f.push([k * 4 + i, k * 4 + (i + 1) % 4, (k + 1) * 4 + (i + 1) % 4, (k + 1) * 4 + i]);
      f.push([8, 9, 10, 11]);
    } else if (active.shape === 'crystal') {
      v.push([0, -1.6, 0], [0, 1.6, 0], [-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]);
      for (let i = 0; i < 4; i++) {
        f.push([0, 2 + i, 2 + (i + 1) % 4]);
        f.push([1, 2 + (i + 1) % 4, 2 + i]);
      }
    } else {
      const n = 36;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const r = active.shape === 'orbit' ? 1.25 : 1 + .28 * Math.sin(a * 3);
        for (const edge of [-1, 1]) v.push([Math.cos(a) * r, Math.sin(a) * (active.shape === 'orbit' ? .9 : 1.1) + edge * .24, Math.sin(a * 2) * .4 + edge * .2]);
      }
      for (let i = 0; i < n; i++) f.push([i * 2, i * 2 + 1, (i + 1) % n * 2 + 1, (i + 1) % n * 2]);
    }
    return {
      v,
      f
    };
  }
  function render3D() {
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e5edef';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * .82, 125, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b9cdd1';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * .82, 146, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    const {
      v,
      f
    } = mesh();
    const verts = v.map(([x, y, z]) => {
      const rx = x * Math.cos(angle) - z * Math.sin(angle),
        rz = x * Math.sin(angle) + z * Math.cos(angle),
        ry = y * Math.cos(tilt) - rz * Math.sin(tilt),
        zz = y * Math.sin(tilt) + rz * Math.cos(tilt);
      return {
        xy: [w / 2 + rx * 77, h * .47 - ry * 77],
        z: zz
      };
    });
    f.map(face => ({
      face,
      depth: face.reduce((s, i) => s + verts[i].z, 0) / face.length
    })).sort((a, b) => a.depth - b.depth).forEach(({
      face,
      depth
    }) => {
      ctx.beginPath();
      face.forEach((i, j) => ctx[j ? 'lineTo' : 'moveTo'](...verts[i].xy));
      ctx.closePath();
      ctx.fillStyle = active.color;
      ctx.fill();
      ctx.fillStyle = `rgba(${depth > 0 ? '255,255,255' : '18,43,58'},${Math.min(.32, Math.abs(depth) * .18)})`;
      ctx.fill();
      ctx.strokeStyle = '#ffffff77';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    $('viewerTitle').textContent = active.id + ' / ' + t(active.en, active.zh);
  }
  $('modelButtons').onclick = e => {
    const b = e.target.closest('[data-model]');
    if (b) {
      active = C.exhibits.find(x => x.id === b.dataset.model);
      render3D();
    }
  };
  canvas.onpointerdown = e => {
    drag = {
      x: e.clientX,
      y: e.clientY
    };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (drag) {
      angle += (e.clientX - drag.x) * .015;
      tilt = Math.max(-1.2, Math.min(1.2, tilt + (e.clientY - drag.y) * .01));
      drag = {
        x: e.clientX,
        y: e.clientY
      };
      render3D();
    }
  };
  canvas.onpointerup = canvas.onpointercancel = () => drag = null;
  canvas.onkeydown = e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      angle += e.key === 'ArrowLeft' ? -.15 : e.key === 'ArrowRight' ? .15 : 0;
      tilt = Math.max(-1.2, Math.min(1.2, tilt + (e.key === 'ArrowUp' ? .1 : e.key === 'ArrowDown' ? -.1 : 0)));
      render3D();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  list();
  drawMap();
  render3D();
})();
