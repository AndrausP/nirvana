// Onda animada do estado vazio (roxo -> ciano), como na referência.
const Wave = (() => {
  let raf = 0;
  let canvas = null;
  function stop() { cancelAnimationFrame(raf); raf = 0; canvas = null; }
  function start(c) {
    stop();
    canvas = c;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth;
    const H = c.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    const layers = [
      { amp: 34, freq: 1.3, speed: 0.9, phase: 0, w: 2.2, a: 1 },
      { amp: 24, freq: 1.8, speed: -1.2, phase: 1.3, w: 1.6, a: 0.75 },
      { amp: 16, freq: 2.6, speed: 1.6, phase: 2.4, w: 1.2, a: 0.5 },
    ];
    const t0 = performance.now();
    function frame(now) {
      if (!canvas) return;
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(139,92,246,0)');
      g.addColorStop(0.28, '#8b5cf6');
      g.addColorStop(0.62, '#2dd4bf');
      g.addColorStop(1, 'rgba(45,212,191,0)');
      for (const L of layers) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const u = x / W;
          const env = Math.pow(Math.sin(Math.PI * u), 2.2);
          const y = H / 2 + Math.sin(u * Math.PI * 2 * L.freq + t * L.speed + L.phase) * L.amp * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = g;
        ctx.globalAlpha = L.a;
        ctx.lineWidth = L.w;
        ctx.shadowColor = 'rgba(139,92,246,.7)';
        ctx.shadowBlur = 14;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }
  return { start, stop };
})();
