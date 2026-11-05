/* Organograma + memórias como neurônios (canvas). Dados reais: nada é inventado.
   - nós grandes = agentes (hierarquia da cadeia Nirvana)
   - neurônios pequenos ao redor = itens da memória própria do agente
   - nuvem inferior = memória compartilhada (docs/knowledge, memória do Claude, CLAUDE.md)
   Linhas finas entre neurônios = itens vizinhos na mesma seção do arquivo. */
const Brain = (() => {
  const ROLE_RULES = [
    ['po', /product owner|dono do produto|\bpo\b/], ['tl', /tech lead|lider t[eé]cnico|líder técnico/],
    ['arch', /arquitet|architect/], ['be', /backend|back-end/], ['fe', /frontend|front-end/],
    ['des', /design|ux/], ['qa', /\bqa\b|quality|qualidade/], ['rd', /reader|leitor|leitura/], ['wr', /writer|escrit/],
  ];
  const ROWS = [['po'], ['tl', 'rd'], ['arch'], ['be', 'fe', 'des'], ['qa', 'wr']];
  const EDGES = [['po', 'tl'], ['po', 'rd', 1], ['tl', 'arch'], ['arch', 'be'], ['arch', 'fe'], ['arch', 'des'], ['be', 'qa'], ['fe', 'qa'], ['des', 'qa'], ['qa', 'wr'], ['rd', 'wr', 1]];
  const SX = 340, SY = 215;

  let cv, cx, raf = 0, W = 0, H = 0, dpr = 1, ro = null;
  let cam = { x: 0, y: 0, k: 1 };
  let nodes = [], neurons = [], edges = [], shared = [], broker = null, hover = null, sel = null, handlers = {}, drag = null, t0 = 0, fitted = false, wbound = false;

  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const norm = (s) => String(s || '').toLowerCase();

  function roleKey(a) {
    const r = norm(a.role);
    for (const [k, re] of ROLE_RULES) if (re.test(r)) return k;
    const d = norm(a.name + ' ' + a.slug);
    for (const [k, re] of ROLE_RULES) if (re.test(d)) return k;
    return 'other';
  }

  function layout(model) {
    nodes = []; neurons = []; edges = []; shared = [];
    broker = { type: 'broker', key: '__broker', name: 'Broker', role: 'Mestre · você fala com ele', x: 0, y: 0, r: 34, color: '#e9d5ff' };
    const byRole = {};
    const others = [];
    for (const a of model.agents) { const k = roleKey(a); if (k === 'other') others.push(a); else (byRole[k] = byRole[k] || a); }
    const rows = ROWS.map((r) => r.filter((k) => byRole[k]).map((k) => byRole[k]));
    others.forEach((o) => rows[3].push(o)); // sem papel conhecido: junto dos devs
    rows.forEach((row, ri) => {
      row.forEach((a, i) => {
        nodes.push({ type: 'agent', key: a.key, slug: a.slug, name: a.name, role: a.role, color: a.color, active: a.active, x: (i - (row.length - 1) / 2) * SX, y: (ri + 1) * SY, r: 26, a });
      });
    });
    const nodeFor = (k) => byRole[k] && nodes.find((n) => n.a === byRole[k]);
    const hasIn = new Set();
    for (const [p, c, dashed] of EDGES) {
      const A = nodeFor(p) || (p === 'po' ? broker : null), B = nodeFor(c);
      if (A && B) { edges.push({ a: A, b: B, dashed: !!dashed }); if (!dashed) hasIn.add(B); }
    }
    // quem ficou sem pai (papel desconhecido, cadeia incompleta) liga ao nó mais próximo acima, ou ao broker
    for (const n of [...nodes].sort((x, y) => x.y - y.y)) {
      if (hasIn.has(n)) continue;
      const above = nodes.filter((q) => q.y < n.y).sort((x, y) => y.y - x.y || Math.abs(x.x - n.x) - Math.abs(y.x - n.x))[0];
      edges.push({ a: above || broker, b: n }); hasIn.add(n);
    }
    // neurônios próprios
    for (const n of nodes) {
      const list = (n.a.neurons || []).slice(0, 30);
      n.hidden = Math.max(0, (n.a.neurons || []).length - list.length);
      const ph = (hash(n.key) % 628) / 100;
      list.forEach((m, i) => {
        const ang = ph + i * 2.39996, rr = 56 + 15 * Math.sqrt(i + 1);
        neurons.push({ type: 'neuron', own: n, id: n.key + ':' + m.id, m, x: n.x + Math.cos(ang) * rr, y: n.y + Math.sin(ang) * rr * 0.82, r: 4.2 + Math.min(4.5, m.text.length / 70), color: n.color, seed: hash(m.id + n.key) % 1000 / 100, prev: i > 0 ? i - 1 : -1, base: neurons.length });
      });
    }
    // memória compartilhada: nuvem abaixo
    const cy = (ROWS.length + 1.55) * SY;
    shared = (model.shared || []).slice(0, 90).map((m, i, arr) => {
      const ang = i * 2.39996, rr = 34 + 17 * Math.sqrt(i + 1);
      return { type: 'shared', id: m.path, m, x: Math.cos(ang) * rr * 1.5, y: cy + Math.sin(ang) * rr * 0.8, r: 4.5 + Math.min(5, m.bytes / 4000), color: model.sharedColor(m.group), seed: hash(m.path) % 1000 / 100 };
    });
    broker.cloud = { x: 0, y: cy, n: (model.shared || []).length };
  }

  const toWorld = (px, py) => ({ x: (px - cam.x) / cam.k, y: (py - cam.y) / cam.k });

  function fit(all = true) {
    const pts = [...nodes, broker, ...neurons, ...shared];
    if (!pts.length || !W) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p.x - 70); x1 = Math.max(x1, p.x + 70); y0 = Math.min(y0, p.y - 60); y1 = Math.max(y1, p.y + 80); }
    let k = Math.min(W / (x1 - x0), H / (y1 - y0), 1.2);
    if (!all) { // visão inicial: organograma legível, nuvem de memória fica abaixo (arraste/zoom ou "Ajustar")
      k = Math.max(k, Math.min(0.72, W / (x1 - x0)));
      cam = { k, x: W / 2 - ((x0 + x1) / 2) * k, y: 16 - (y0 + 40) * k };
    } else cam = { k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k - 18 };
    fitted = true;
  }

  function resize() {
    if (!cv) return;
    const r = cv.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    if (!fitted) fit(false);
  }

  const isSelAgent = (n) => sel && ((sel.type === 'agent' && sel.key === n.key) || (sel.type === 'neuron' && sel.own === n));
  const dim = (n) => (sel && (sel.type === 'agent' || sel.type === 'neuron') && !isSelAgent(n) ? 0.3 : 1);
  const recency = (mt) => { const d = (Date.now() - (mt || 0)) / 864e5; return d < 1 ? 1 : d < 7 ? 0.8 : d < 30 ? 0.62 : 0.45; };

  function curve(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    return { mx: mx + dx * 0.0, my, cx: a.x, cy: my };
  }
  function pointOn(a, b, t) {
    const c = curve(a, b);
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.cx + t * t * b.x, y: u * u * a.y + 2 * u * t * c.cy + t * t * b.y };
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!cx) return;
    const t = (now - t0) / 1000;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    cx.save();
    cx.translate(cam.x, cam.y); cx.scale(cam.k, cam.k);
    // hierarquia
    for (const e of edges) {
      cx.beginPath(); cx.moveTo(e.a.x, e.a.y + e.a.r);
      const c = curve({ x: e.a.x, y: e.a.y + e.a.r }, { x: e.b.x, y: e.b.y - e.b.r });
      cx.quadraticCurveTo(c.cx, c.cy, e.b.x, e.b.y - e.b.r);
      cx.setLineDash(e.dashed ? [6, 6] : []);
      cx.strokeStyle = 'rgba(167,139,250,.34)'; cx.lineWidth = 1.6; cx.stroke();
      // pulso: sinal viajando pela hierarquia
      const live = e.b.active || e.a.active;
      const sp = live ? 0.35 : 0.08;
      const p = pointOn({ x: e.a.x, y: e.a.y + e.a.r }, { x: e.b.x, y: e.b.y - e.b.r }, (t * sp + (hash(e.b.key || 'x') % 10) / 10) % 1);
      cx.setLineDash([]);
      cx.beginPath(); cx.arc(p.x, p.y, live ? 3.4 : 2.2, 0, 7); cx.fillStyle = live ? '#2dd4bf' : 'rgba(167,139,250,.7)'; cx.fill();
    }
    cx.setLineDash([]);
    // escrita da memória compartilhada (Writer -> nuvem)
    const wr = nodes.find((n) => roleKey(n.a) === 'wr');
    if (wr && shared.length) {
      for (let i = 0; i < shared.length; i += Math.ceil(shared.length / 24)) {
        const s = shared[i];
        cx.beginPath(); cx.moveTo(wr.x, wr.y + wr.r); cx.quadraticCurveTo(wr.x, s.y, s.x, s.y);
        cx.strokeStyle = 'rgba(45,212,191,.12)'; cx.lineWidth = 1; cx.stroke();
      }
    }
    // consulta: agente selecionado/hover -> nuvem
    const cons = (hover && hover.type === 'agent') ? hover : (sel && sel.type === 'agent' ? sel : null);
    if (cons && shared.length) {
      const n = nodes.find((q) => q.key === cons.key);
      if (n) { cx.beginPath(); cx.moveTo(n.x, n.y + n.r); cx.quadraticCurveTo(n.x + 120, (n.y + broker.cloud.y) / 2, 0, broker.cloud.y - 70); cx.setLineDash([3, 5]); cx.strokeStyle = 'rgba(45,212,191,.5)'; cx.lineWidth = 1.2; cx.stroke(); cx.setLineDash([]); }
    }
    // sinapses entre neurônios vizinhos + fio até o agente
    for (const n of neurons) {
      const al = dim(n.own);
      const prev = n.prev >= 0 ? neurons[n.base - 1] : null;
      if (prev && prev.own === n.own && prev.m.sec === n.m.sec) {
        cx.beginPath(); cx.moveTo(prev.x, prev.y); cx.lineTo(n.x, n.y); cx.strokeStyle = n.color; cx.globalAlpha = 0.28 * al; cx.lineWidth = 0.8; cx.stroke();
      }
      cx.beginPath(); cx.moveTo(n.own.x, n.own.y); cx.lineTo(n.x, n.y); cx.strokeStyle = n.color; cx.globalAlpha = 0.1 * al; cx.lineWidth = 0.6; cx.stroke();
      cx.globalAlpha = 1;
    }
    // neurônios
    for (const n of neurons) {
      const al = dim(n.own) * recency(n.m.mtime);
      const tw = 0.82 + 0.18 * Math.sin(t * 1.6 + n.seed);
      const hot = hover === n || sel === n;
      cx.globalAlpha = Math.min(1, al * tw + (hot ? 0.4 : 0));
      cx.shadowColor = n.color; cx.shadowBlur = hot ? 18 : 7;
      cx.beginPath(); cx.arc(n.x, n.y, n.r * (hot ? 1.6 : 1), 0, 7); cx.fillStyle = n.color; cx.fill();
    }
    cx.shadowBlur = 0; cx.globalAlpha = 1;
    // memória compartilhada
    for (const s of shared) {
      const hot = hover === s || sel === s;
      cx.globalAlpha = (hot ? 1 : 0.5 + 0.3 * Math.sin(t * 1.2 + s.seed)) * recency(s.m.mtime);
      cx.shadowColor = s.color; cx.shadowBlur = hot ? 16 : 6;
      cx.beginPath(); cx.arc(s.x, s.y, s.r * (hot ? 1.5 : 1), 0, 7); cx.fillStyle = s.color; cx.fill();
    }
    cx.shadowBlur = 0; cx.globalAlpha = 1;
    // nós
    const label = (txt, x, y, size, col, bold) => { cx.font = `${bold ? 600 : 400} ${size}px Inter, Segoe UI, sans-serif`; cx.fillStyle = col; cx.textAlign = 'center'; cx.fillText(txt, x, y); };
    for (const n of [broker, ...nodes]) {
      const isB = n === broker;
      const hot = hover === n || (sel && sel.key === n.key);
      const al = isB ? 1 : dim(n);
      cx.globalAlpha = al;
      const g = cx.createRadialGradient(n.x - n.r / 3, n.y - n.r / 3, 2, n.x, n.y, n.r);
      g.addColorStop(0, '#ffffff55'); g.addColorStop(1, n.color + (isB ? 'ff' : 'cc'));
      cx.shadowColor = n.color; cx.shadowBlur = (n.active ? 26 + 8 * Math.sin(t * 3) : hot ? 24 : 12);
      cx.beginPath(); cx.arc(n.x, n.y, n.r * (hot ? 1.08 : 1), 0, 7); cx.fillStyle = g; cx.fill();
      cx.shadowBlur = 0;
      cx.lineWidth = 1.4; cx.strokeStyle = n.active ? '#2dd4bf' : 'rgba(255,255,255,.35)'; cx.stroke();
      label((n.name || '').trim().charAt(0).toUpperCase(), n.x, n.y + 6, isB ? 22 : 17, '#0b0a14', true);
      label(n.name, n.x, n.y + n.r + 18, 15, '#ece9ff', true);
      label(clipTxt(n.role || '', 34), n.x, n.y + n.r + 34, 12, 'rgba(200,196,230,.7)', false);
      if (n.hidden) label(`+${n.hidden} memórias`, n.x, n.y + n.r + 49, 11.5, 'rgba(45,212,191,.85)', false);
      cx.globalAlpha = 1;
    }
    if (shared.length) {
      label('Memória compartilhada', 0, broker.cloud.y - 92, 16, '#ece9ff', true);
      label(`${broker.cloud.n} arquivo${broker.cloud.n === 1 ? '' : 's'} · docs/knowledge, memória do Claude, CLAUDE.md`, 0, broker.cloud.y - 74, 12, 'rgba(200,196,230,.7)', false);
    }
    cx.restore();
  }
  const clipTxt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  function pick(px, py) {
    const w = toWorld(px, py), k = 1 / cam.k;
    let best = null, bd = 1e9;
    const test = (o, rad) => { const d = Math.hypot(o.x - w.x, o.y - w.y); if (d < rad * k + 0 && d < bd) { best = o; bd = d; } };
    for (const n of neurons) test(n, n.r + 6);
    for (const s of shared) test(s, s.r + 6);
    if (best) return best;
    for (const n of [broker, ...nodes]) { if (Math.hypot(n.x - w.x, n.y - w.y) < n.r + 4) return n; }
    return null;
  }

  function bind() {
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const k2 = Math.min(3, Math.max(0.15, cam.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      cam.x = px - (px - cam.x) * (k2 / cam.k); cam.y = py - (py - cam.y) * (k2 / cam.k); cam.k = k2;
    }, { passive: false });
    cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; cv.classList.add('grab'); });
    if (wbound) return;
    wbound = true;
    window.addEventListener('mouseup', (e) => {
      cv && cv.classList.remove('grab');
      if (drag && !drag.moved && cv) {
        const r = cv.getBoundingClientRect(); const o = pick(e.clientX - r.left, e.clientY - r.top);
        sel = o; if (handlers.onPick) handlers.onPick(o);
      }
      drag = null;
    });
    window.addEventListener('mousemove', (e) => {
      if (!cv) return;
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (drag) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
        if (drag.moved) { cam.x = drag.cx + e.clientX - drag.x; cam.y = drag.cy + e.clientY - drag.y; }
        return;
      }
      if (px < 0 || py < 0 || px > W || py > H) { hover = null; tip(null); return; }
      hover = pick(px, py);
      cv.style.cursor = hover ? 'pointer' : 'grab';
      tip(hover, e.clientX, e.clientY);
    });
  }
  function tip(o, mx, my) {
    const el = document.getElementById('btip');
    if (!el) return;
    if (!o) { el.style.display = 'none'; return; }
    let t1 = '', t2 = '';
    if (o.type === 'neuron') { t1 = o.m.title; t2 = `${o.own.name}${o.m.sec ? ' · ' + o.m.sec : ''}`; }
    else if (o.type === 'shared') { t1 = o.m.title; t2 = o.m.group; }
    else { t1 = o.name; t2 = o.role; }
    el.innerHTML = `<b></b><span></span>`;
    el.firstChild.textContent = t1; el.lastChild.textContent = t2;
    const r = el.parentElement.getBoundingClientRect();
    el.style.display = 'block';
    el.style.left = Math.min(mx - r.left + 14, r.width - 260) + 'px'; el.style.top = (my - r.top + 14) + 'px';
  }

  return {
    roleKey,
    start(canvas, model, h) {
      this.stop();
      cv = canvas; cx = cv.getContext('2d'); handlers = h || {}; fitted = false; hover = null; sel = null;
      layout(model); resize(); bind(); t0 = performance.now();
      ro = new ResizeObserver(() => resize()); ro.observe(cv.parentElement);
      raf = requestAnimationFrame(draw);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); ro = null; cv = null; cx = null; },
    fit() { fit(true); },
    focusAgent(key) {
      const n = nodes.find((q) => q.key === key); if (!n) return;
      sel = n; cam.k = Math.max(cam.k, 0.9); cam.x = W / 2 - n.x * cam.k; cam.y = H / 2 - n.y * cam.k;
    },
    // para teste: contagem dos objetos desenhados
    _stats() { return { agents: nodes.length, neurons: neurons.length, shared: shared.length, edges: edges.length }; },
    _toScreen(o) { return { x: o.x * cam.k + cam.x, y: o.y * cam.k + cam.y }; },
    _pickAt(wx, wy) { return pick(wx * cam.k + cam.x, wy * cam.k + cam.y); },
    _nodes: () => nodes, _neurons: () => neurons,
  };
})();
