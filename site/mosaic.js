// Paper mosaic: each cell is one paper, cell area scales with citations.
// Hue comes from publication year, the inner pattern from topic group,
// and seeded randomness sets cell layout, color jitter and pattern angles.
// Runs in the browser (GitHub Pages) and in headless Chromium (GitHub Actions).
(function () {
  const GROUPS = {
    L: "Lung cancer treatment and mutations",
    D: "Diagnosis, pathology and guidelines",
    G: "Cancer genomics",
    I: "Immunotherapy and biomarkers",
    O: "Other topics",
  };

  // Sunrise palette: rose, coral, tangerine, amber, butter, peach, lilac, morning blue
  const SUNRISE = ["#ff6f91", "#ff8c6b", "#ffa552", "#ffc65c", "#ffe08a", "#ffb8a1", "#d9a7e0", "#9cc7f0"];
  const sunrise = d3.interpolateRgbBasisClosed(SUNRISE);

  function weekOfYear(dateStr) {
    const d = new Date(dateStr + "T00:00:00Z");
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.floor((d - start) / (7 * 864e5));
  }

  function render(canvas, data, opts = {}) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext("2d");
    const seed = opts.seed || `${data.snapshot_date}-${data.total_citations}`;
    const rng = new Math.seedrandom(seed);
    const rand = (a, b) => a + (b - a) * rng();
    const exponent = opts.exponent ?? 1.0;
    const week = weekOfYear(data.snapshot_date);
    const hueShift = (week * 0.02) % 1; // palette rotates a little each week

    // Flat hierarchy: every paper competes for space in one mosaic
    const works = data.works.map(([id, year, cites, group, fresh]) => ({ id, year, cites, group, fresh }));
    const tree = { children: works };
    const root = d3.hierarchy(tree).sum((d) => (d.cites ? Math.pow(d.cites, exponent) : 0));

    const m = Math.round(Math.min(W, H) * 0.035);
    const footer = opts.caption === false ? 0 : Math.round(H * 0.045);
    const clip = [[m, m], [W - m, m], [W - m, H - m - footer], [m, H - m - footer]];

    d3.voronoiTreemap()
      .clip(clip)
      .prng(rng)
      .convergenceRatio(0.002)
      .maxIterationCount(400)
      .minWeightRatio(0.01)(root);

    // Background
    ctx.fillStyle = "#24162f";
    ctx.fillRect(0, 0, W, H);

    const yearMin = 2004, yearMax = 2027;
    const leaves = root.leaves();

    leaves.forEach((leaf) => {
      const w = leaf.data;
      const poly = leaf.polygon;
      if (!poly) return;
      const t = (w.year - yearMin) / (yearMax - yearMin);
      const hue = (((t + hueShift + rand(-0.035, 0.035)) % 1) + 1) % 1;
      const baseC = d3.hsl(sunrise(hue));
      baseC.s = Math.min(1, baseC.s * rand(0.9, 1.05));
      baseC.l = Math.max(0.55, Math.min(0.85, baseC.l + rand(-0.05, 0.04)));
      const base = baseC.formatHex();
      const deep = d3.hsl(baseC.h - 12, baseC.s, baseC.l * 0.86).formatHex();
      const accent = d3.hsl(baseC.h + rand(-20, 20), baseC.s * 0.6, Math.min(0.96, baseC.l + 0.14)).formatHex();
      const [cx, cy] = d3.polygonCentroid(poly);
      const r = Math.sqrt(Math.abs(d3.polygonArea(poly)));

      ctx.save();
      tracePoly(ctx, poly);
      ctx.clip();

      // Base fill with a soft random-direction gradient
      const ang = rand(0, Math.PI * 2);
      const g = ctx.createLinearGradient(
        cx - Math.cos(ang) * r, cy - Math.sin(ang) * r,
        cx + Math.cos(ang) * r, cy + Math.sin(ang) * r
      );
      g.addColorStop(0, base);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);

      // Topic pattern
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      const step = Math.max(6, r * rand(0.08, 0.14));
      if (w.group === "D") stripes(ctx, cx, cy, r, step, rand(0, Math.PI), step * 0.2);
      else if (w.group === "G") dots(ctx, cx, cy, r, step, rand(0, Math.PI), step * 0.15);
      else if (w.group === "I") rings(ctx, cx, cy, r, step);
      else if (w.group === "O") {
        const a = rand(0, Math.PI);
        stripes(ctx, cx, cy, r, step, a, step * 0.1);
        stripes(ctx, cx, cy, r, step, a + Math.PI / 2, step * 0.1);
      }

      // Papers that gained citations this week get a burst with one ray per citation
      if (w.fresh > 0) burst(ctx, cx, cy, r, w.fresh, rng);
      ctx.restore();

      leaf._poly = poly;
    });

    // Paper borders
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#24162f";
    ctx.lineWidth = Math.max(2, W / 600);
    leaves.forEach((leaf) => { if (leaf.polygon) { tracePoly(ctx, leaf.polygon); ctx.stroke(); } });
    // Outer frame
    ctx.lineWidth = Math.max(5, W / 220);
    tracePoly(ctx, clip); ctx.stroke();

    if (opts.caption !== false) {
      ctx.fillStyle = "#f4f1ff";
      ctx.font = `${Math.round(footer * 0.42)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textBaseline = "middle";
      const y = H - m * 0.7 - footer / 2;
      ctx.textAlign = "right";
      ctx.fillText(`week of ${data.snapshot_date}`, W - m, y);
    }

    return { root, leaves, clip };
  }

  function tracePoly(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }

  function stripes(ctx, cx, cy, r, step, angle, width) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.4;
    for (let x = -r * 2; x <= r * 2; x += step) {
      ctx.beginPath(); ctx.moveTo(x, -r * 2); ctx.lineTo(x, r * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function dots(ctx, cx, cy, r, step, angle, radius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.45;
    for (let x = -r * 2; x <= r * 2; x += step)
      for (let y = -r * 2; y <= r * 2; y += step) {
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
    ctx.restore();
  }

  function rings(ctx, cx, cy, r, step) {
    ctx.save();
    ctx.lineWidth = step * 0.16;
    ctx.globalAlpha = 0.4;
    for (let rr = step; rr < r * 2; rr += step) {
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function burst(ctx, cx, cy, r, n, rng) {
    ctx.save();
    ctx.strokeStyle = "#fffbe6";
    ctx.shadowColor = "#fff36b";
    ctx.shadowBlur = r * 0.15;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, r * 0.03);
    const len = r * 0.45;
    const off = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      const l = len * (0.6 + 0.4 * rng());
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * len * 0.15, cy + Math.sin(a) * len * 0.15);
      ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.fillStyle = "#fffbe6";
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, r * 0.05), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  window.Mosaic = { render, GROUPS };
})();
