/* Omarchy Pulse 1.6: the engine of the scenes made with the scene editor. (c) 2026 Marco Porro (x.com/MarcoPorro), MIT.
   A design is plain data (shapes, their colours, their motion, which live data moves them); this draws it. The same
   code runs in the editor's preview and inside the saved scene, so what you see in the editor is what the wallpaper
   shows. See docs/SCENES.md, section 12. */
var PulseDesign = (function () {
  "use strict";
  var TAU = Math.PI * 2;
  // the live data a shape can follow: what it reads, and the range that becomes 0..1
  var SOURCES = {
    cpu: { label: "CPU %", min: 0, max: 100, get: function (s) { return (s.sys || {}).cpu; } },
    ram: { label: "RAM %", min: 0, max: 100, get: function (s) { return (s.sys || {}).ram; } },
    gpu: { label: "GPU %", min: 0, max: 100, get: function (s) { return (s.sys || {}).gpu; } },
    temp: { label: "CPU temperature °C", min: 30, max: 95, get: function (s) { return (s.sys || {}).temp; } },
    disk: { label: "disk used %", min: 0, max: 100, get: function (s) { return (s.sys || {}).disk; } },
    net: { label: "network MB/s", min: 0, max: 10, get: function (s) { var y = s.sys || {}; return ((y.rx || 0) + (y.tx || 0)) / 1e6; } },
    hour: { label: "hour of the day", min: 0, max: 24, get: function (s) { var t = s.time || {}; return (t.hour || 0) + (t.minute || 0) / 60; } },
    second: { label: "seconds", min: 0, max: 60, get: function (s) { return (s.time || {}).second; } },
    outside: { label: "outside temperature", min: -10, max: 35, get: function (s) { return (s.weather || {}).temp; } },
    rain: { label: "rain mm", min: 0, max: 5, get: function (s) { return (s.weather || {}).rain; } },
    wind: { label: "wind km/h", min: 0, max: 60, get: function (s) { return (s.weather || {}).wind; } },
    cloud: { label: "clouds %", min: 0, max: 100, get: function (s) { return (s.weather || {}).cloud; } },
    daylight: { label: "day (1) or night (0)", min: 0, max: 1, get: function (s) { return (s.weather || {}).day; } },
    agents: { label: "AI agents", min: 0, max: 8, get: function (s) { return (s.agents || []).length; } },
    working: { label: "agents working", min: 0, max: 8, get: function (s) { return count(s.agents, "working"); } },
    waiting: { label: "agents waiting for you", min: 0, max: 4, get: function (s) { return count(s.agents, "waiting"); } },
    failed: { label: "agents failed", min: 0, max: 4, get: function (s) { return count(s.agents, "failed"); } },
    commits: { label: "commits this week", min: 0, max: 60, get: function (s) { return (s.git || []).reduce(function (a, r) { return a + (r.week || 0); }, 0); } },
    cifail: { label: "CI failing", min: 0, max: 3, get: function (s) { return (s.git || []).filter(function (r) { return r.ci === "fail"; }).length; } },
    focus: { label: "focus session (1)", min: 0, max: 1, get: function (s) { return s.focus ? 1 : 0; } },
    away: { label: "you are away (1)", min: 0, max: 1, get: function (s) { return s.away ? 1 : 0; } },
    item: { label: "each copy's own value", min: 0, max: 1, get: function (s, it) { return it ? it.v : 0; } }
  };
  function count(a, st) { return (a || []).filter(function (x) { return x.state === st; }).length; }
  // what a binding can move
  var PROPS = { x: "x position", y: "y position", w: "width", h: "height", alpha: "opacity", rot: "rotation (°)",
                glow: "glow", heat: "colour → second colour", speed: "motion speed", level: "level (bars, gauge, windows)",
                count: "how many (particles)", amp: "wave height" };
  var THEME = { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7", accent2: "#bb9af7", ok: "#9ece6a", warn: "#e0af68", crit: "#f7768e", dim: "#565f89" };
  var STATE_COL = { working: "accent", waiting: "warn", done: "ok", failed: "crit", idle: "dim" };

  function hex(h) {
    h = String(h || "#888888").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16); if (isNaN(n)) n = 0x888888;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function col(c, th) { return hex(c && c.charAt(0) === "#" ? c : (th[c] || THEME[c] || "#888888")); }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + Math.max(0, Math.min(1, a)) + ")"; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function norm(src, st, it) {
    var S = SOURCES[src]; if (!S) return 0;
    var v = num(S.get(st, it), S.min);
    return clamp01((v - S.min) / (S.max - S.min || 1));
  }
  // the items a shape repeats over: one copy per agent, repo, core, or a fixed number
  function items(sh, st) {
    var r = sh.repeat || {}, n, out = [], priv = !!st.privacy;
    if (r.by === "agents") (st.agents || []).slice(0, 24).forEach(function (a) { out.push({ v: a.state === "working" ? 1 : a.state === "waiting" ? 0.6 : a.state === "done" ? 0.3 : 0, state: a.state, name: priv ? "" : a.name }); });
    else if (r.by === "repos") (st.git || []).slice(0, 16).forEach(function (g) { out.push({ v: clamp01((g.week || 0) / 30), state: g.ci === "fail" ? "failed" : g.ci === "run" ? "working" : g.ci === "ok" ? "done" : "idle", name: priv ? "" : g.name }); });
    else if (r.by === "cores") ((st.sys || {}).cores || []).slice(0, 32).forEach(function (c, i) { out.push({ v: clamp01((c || 0) / 100), state: c > 85 ? "failed" : "working", name: "core " + i }); });
    else if (r.by === "count") { n = Math.max(1, Math.min(64, num(r.n, 3) | 0)); for (var i = 0; i < n; i++) out.push({ v: n > 1 ? i / (n - 1) : 0, state: "", name: "" }); }
    else out.push(null);
    return out;
  }
  function text(tpl, st, it) {
    var y = st.sys || {}, w = st.weather || {}, t = st.time || {}, p = function (n) { return (n < 10 ? "0" : "") + n; };
    var V = { cpu: Math.round(y.cpu || 0), ram: Math.round(y.ram || 0), gpu: Math.round(y.gpu || 0), temp: Math.round(y.temp || 0),
              net: (((y.rx || 0) + (y.tx || 0)) / 1e6).toFixed(1), time: p(t.hour || 0) + ":" + p(t.minute || 0), hour: t.hour || 0,
              date: p(t.day || 1) + "/" + p(t.month || 1), outside: w.temp == null ? "–" : Math.round(w.temp), agents: (st.agents || []).length,
              working: count(st.agents, "working"), waiting: count(st.agents, "waiting"), commits: SOURCES.commits.get(st),
              name: it ? it.name : "", state: it ? it.state : "", item: it ? Math.round(it.v * 100) : "" };
    return String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) { return V[k] != null ? V[k] : m; });
  }
  // a shape's properties now: its own values, moved by its bindings and its motion
  function resolve(sh, st, it, t, still) {
    var p = { x: num(sh.x, 0.5), y: num(sh.y, 0.5), w: num(sh.w, 0.1), h: num(sh.h, 0.1), alpha: num(sh.alpha, 1), rot: num(sh.rot, 0),
              glow: num(sh.glow, 0), heat: 0, speed: num((sh.anim || {}).speed, 1), level: num(sh.level, 0.6), count: num(sh.count, 40),
              amp: num(sh.amp, 0.3) };
    (sh.bind || []).forEach(function (b) {
      if (!PROPS[b.prop] || !SOURCES[b.src]) return;
      var k = norm(b.src, st, it); p[b.prop] = num(b.from, 0) + (num(b.to, 1) - num(b.from, 0)) * k;
    });
    var a = sh.anim || {}, sp = p.speed, ph = (it ? it.i * 0.7 : 0);
    if (!still && a.kind && a.kind !== "none") {
      if (a.kind === "pulse") { var s = 1 + 0.12 * Math.sin(t * TAU * 0.5 * sp + ph); p.w *= s; p.h *= s; }
      else if (a.kind === "spin") p.rot += t * 90 * sp;
      else if (a.kind === "bob") p.y += Math.sin(t * TAU * 0.4 * sp + ph) * 0.012;
      else if (a.kind === "sway") p.rot += Math.sin(t * TAU * 0.3 * sp + ph) * 8;
      else if (a.kind === "blink") p.alpha *= (t * sp + ph * 0.1) % 1 < 0.6 ? 1 : 0.15;
      else if (a.kind === "breathe") p.alpha *= 0.55 + 0.45 * Math.sin(t * TAU * 0.25 * sp + ph);
      else if (a.kind === "drift") { p.x = ((p.x + t * 0.02 * sp) % 1.2 + 1.2) % 1.2 - 0.1; }
    }
    return p;
  }
  function shapeColor(sh, st, it, p, th) {
    var c = col(sh.color || "accent", th);
    if (it && it.state && (sh.repeat || {}).stateColors) c = col(STATE_COL[it.state] || "dim", th);
    if (p.heat > 0 && sh.color2) c = mix(c, col(sh.color2, th), clamp01(p.heat));
    return c;
  }
  // draws one shape (already placed: 0,0 is its centre, w and h in pixels)
  function paint(g, sh, p, c, W, H, t, still, st, it, mem) {
    var w = p.w * W, h = p.h * H, fill = sh.fill !== false, lw = Math.max(1, num(sh.line, 2) * H / 1080);
    g.fillStyle = rgba(c, p.alpha); g.strokeStyle = rgba(c, p.alpha); g.lineWidth = lw;
    var stroke = function () { if (fill) g.fill(); else g.stroke(); };
    switch (sh.type) {
      case "rect": {
        var r = Math.min(w, h) / 2 * clamp01(num(sh.round, 0));
        g.beginPath(); if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, r); else g.rect(-w / 2, -h / 2, w, h); stroke(); break;
      }
      case "ellipse": g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); stroke(); break;
      case "line": g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, h / 2); g.stroke(); break;
      case "star": {
        var n = Math.max(3, num(sh.points, 5) | 0), ir = clamp01(num(sh.inner, 0.45));
        g.beginPath();
        for (var i = 0; i < n * 2; i++) { var a = i / (n * 2) * TAU - Math.PI / 2, rr = i % 2 ? ir : 1; if (i) g.lineTo(Math.cos(a) * w / 2 * rr, Math.sin(a) * h / 2 * rr); else g.moveTo(Math.cos(a) * w / 2 * rr, Math.sin(a) * h / 2 * rr); }
        g.closePath(); stroke(); break;
      }
      case "text": {
        var fs = Math.max(6, num(sh.size, 0.04) * H);
        g.font = (sh.bold ? "800 " : "500 ") + Math.round(fs) + "px 'CaskaydiaMono Nerd Font', 'Cascadia Mono', ui-monospace, monospace";
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text(sh.text, st, it), 0, 0); g.textBaseline = "alphabetic"; break;
      }
      case "ring": {   // a gauge: the level as an arc
        var R = Math.min(w, h) / 2, thick = Math.max(2, R * clamp01(num(sh.thick, 0.18)));
        g.lineWidth = thick; g.strokeStyle = rgba(c, p.alpha * 0.18); g.beginPath(); g.arc(0, 0, R - thick / 2, 0, TAU); g.stroke();
        g.strokeStyle = rgba(c, p.alpha); g.beginPath(); g.arc(0, 0, R - thick / 2, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(p.level)); g.stroke(); break;
      }
      case "bars": {   // a little chart: one bar per core, agent or repo (or the level, repeated)
        var vals = (sh.series && sh.series !== "level") ? items({ repeat: { by: sh.series } }, st).map(function (x) { return x ? x.v : 0; }) : [p.level];
        if (!vals.length) vals = [0];
        var bw = w / vals.length;
        for (var k = 0; k < vals.length; k++) { var bh = h * clamp01(vals[k]); g.fillRect(-w / 2 + k * bw + bw * 0.12, h / 2 - bh, bw * 0.76, bh); }
        break;
      }
      case "tower": {   // a building whose windows light up with the level
        g.fillStyle = rgba(mix(col("bg", st.theme || {}), c, 0.18), p.alpha); g.fillRect(-w / 2, -h / 2, w, h);
        g.strokeStyle = rgba(c, p.alpha * 0.8); g.strokeRect(-w / 2, -h / 2, w, h);
        var cols = Math.max(1, Math.round(w / (H * 0.012))), rows = Math.max(1, Math.round(h / (H * 0.018))), cw = w / cols, ch = h / rows;
        for (var ry = 0; ry < rows; ry++) for (var cx = 0; cx < cols; cx++) {
          var hs = ((ry * 7919 + cx * 104729 + (it ? it.i * 31 : 0)) % 997) / 997;
          if (hs < clamp01(p.level)) { g.fillStyle = rgba(c, p.alpha * (0.5 + hs * 0.5)); g.fillRect(-w / 2 + cx * cw + cw * 0.25, -h / 2 + ry * ch + ch * 0.25, cw * 0.5, ch * 0.45); }
        }
        break;
      }
      case "wave": {   // a line that waves: its height can follow the data
        var A = h / 2 * clamp01(p.amp), f = Math.max(0.5, num(sh.freq, 3)), ph2 = still ? 0 : t * TAU * 0.3 * p.speed;
        g.beginPath();
        for (var x = 0; x <= 48; x++) { var u = x / 48, yy = Math.sin(u * f * TAU + ph2) * A; if (x) g.lineTo(-w / 2 + u * w, yy); else g.moveTo(-w / 2, yy); }
        g.stroke(); break;
      }
      case "particles": {   // dots that fall, rise or fly across the box: rain, packets, fireflies
        var N = Math.max(0, Math.min(400, Math.round(p.count))), dir = sh.dir || "down", seed = (sh.id || "p").length * 977, sz = Math.max(1, num(sh.dot, 2.5) * H / 1080);
        for (var q = 0; q < N; q++) {
          var r1 = ((q * 16807 + seed) % 2147) / 2147, r2 = ((q * 48271 + seed * 3) % 3001) / 3001, r3 = ((q * 69621 + seed) % 1009) / 1009;
          var tt = still ? r2 : (t * 0.15 * p.speed * (0.5 + r3) + r2) % 1;
          var px = dir === "right" ? tt : dir === "left" ? 1 - tt : r1, py = dir === "down" ? tt : dir === "up" ? 1 - tt : r1;
          if (dir === "fireflies") { px = r1 + (still ? 0 : Math.sin(t * (0.3 + r3) + q) * 0.03); py = r2 + (still ? 0 : Math.cos(t * (0.25 + r1) + q) * 0.04); }
          g.globalAlpha = dir === "fireflies" && !still ? 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + r3) + q)) : 1;
          g.fillRect(-w / 2 + px * w - sz / 2, -h / 2 + py * h - sz / 2, sz, sz * (dir === "down" || dir === "up" ? 2.2 : 1));
        }
        g.globalAlpha = 1; break;
      }
    }
  }
  function draw(g, t, st, box, design, mem) {
    var W = box.w, H = box.h, th = st.theme || {}, still = st.ui && st.ui.motion === "reduced";
    mem.hits = [];
    if (design.sky && design.sky !== "none") {   // a sky of its own (or none: Pulse's real sky shows through)
      var sk = g.createLinearGradient(0, 0, 0, H), c1 = col(design.sky, th), c0 = col("bg", th);
      sk.addColorStop(0, rgba(mix(c0, [0, 0, 0], 0.3), 1)); sk.addColorStop(0.75, rgba(mix(c0, c1, 0.35), 1)); sk.addColorStop(1, rgba(mix(c0, [0, 0, 0], 0.5), 1));
      g.fillStyle = sk; g.fillRect(0, 0, W, H);
    }
    (design.shapes || []).forEach(function (sh) {
      if (sh.hidden) return;
      var list = items(sh, st), r = sh.repeat || {};
      for (var i = 0; i < list.length; i++) {
        var it = list[i]; if (it) it.i = i;
        var p = resolve(sh, st, it, t, still);
        if (it) {   // copies in a row (or a column), or spread evenly across the width
          if (r.spread) p.x = num(r.from, 0.3) + (num(r.to, 0.7) - num(r.from, 0.3)) * (list.length > 1 ? i / (list.length - 1) : 0.5);
          else { p.x += num(r.dx, 0.05) * i; p.y += num(r.dy, 0) * i; }
        }
        if (p.alpha <= 0.002) continue;
        var c = shapeColor(sh, st, it, p, th);
        g.save(); g.translate(p.x * W, p.y * H); if (p.rot) g.rotate(p.rot * Math.PI / 180);
        if (p.glow > 0) { g.shadowColor = rgba(c, 0.9); g.shadowBlur = p.glow * H * 0.03; }
        try { paint(g, sh, p, c, W, H, t, still, st, it, mem); } finally { g.restore(); }
        if (sh.click) mem.hits.push([p.x * W, p.y * H, Math.max(p.w * W, H * 0.02) / 2, Math.max(p.h * H, H * 0.02) / 2, text(sh.click, st, it)]);
      }
    });
  }
  function click(mem, x, y) {   // the topmost shape with a click text under the pointer
    for (var i = (mem.hits || []).length - 1; i >= 0; i--) { var h = mem.hits[i]; if (Math.abs(x - h[0]) <= h[2] && Math.abs(y - h[1]) <= h[3]) return h[4]; }
    return null;
  }
  // the definition PulseScene.register() wants
  function scene(design) {
    return {
      city: !!design.city,
      init: function () { this.mem = { hits: [] }; },
      draw: function (g, t, st, box) { draw(g, t, st, box, design, this.mem || (this.mem = { hits: [] })); },
      click: function (x, y) { return click(this.mem || {}, x, y); }
    };
  }
  return { draw: draw, click: click, scene: scene, SOURCES: SOURCES, PROPS: PROPS, THEME: THEME, text: text, hex: hex };
})();
