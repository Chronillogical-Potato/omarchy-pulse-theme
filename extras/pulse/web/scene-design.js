/* Omarchy Pulse 1.7: the engine of the scenes made with the scene editor. (c) 2026 Marco Porro (x.com/MarcoPorro), MIT.
   A design is plain data (shapes, pictures, a background, their colours, their motion, which live data moves them, and
   the actions that fire when something happens); this draws it. The same code runs in the editor's preview and inside
   the saved scene, so what you see in the editor is what the wallpaper shows. See docs/SCENES.md and docs/EDITOR.md.
   1.7 ("Creator"): every value of the engine can move a shape (your own [[source]] panels too), pictures and backgrounds,
   keyframe animations, and actions: "when this happens, do that" (Pulse's own effects included). */
var PulseDesign = (function () {
  "use strict";
  var TAU = Math.PI * 2;
  function count(a, st) { return (a || []).filter(function (x) { return x.state === st; }).length; }
  function sp(s) { return s.space || {}; }
  // the live data a shape can follow: what it reads, and the range that becomes 0..1
  var SOURCES = {
    cpu: { label: "CPU %", min: 0, max: 100, get: function (s) { return (s.sys || {}).cpu; } },
    ram: { label: "RAM %", min: 0, max: 100, get: function (s) { return (s.sys || {}).ram; } },
    gpu: { label: "GPU %", min: 0, max: 100, get: function (s) { return (s.sys || {}).gpu; } },
    temp: { label: "CPU temperature °C", min: 30, max: 95, get: function (s) { return (s.sys || {}).temp; } },
    disk: { label: "disk used %", min: 0, max: 100, get: function (s) { return (s.sys || {}).disk; } },
    net: { label: "network MB/s", min: 0, max: 10, get: function (s) { var y = s.sys || {}; return ((y.rx || 0) + (y.tx || 0)) / 1e6; } },
    hour: { label: "hour of the day", min: 0, max: 24, get: function (s) { var t = s.time || {}; return (t.hour || 0) + (t.minute || 0) / 60; } },
    minute: { label: "minutes", min: 0, max: 60, get: function (s) { return (s.time || {}).minute; } },
    second: { label: "seconds", min: 0, max: 60, get: function (s) { return (s.time || {}).second; } },
    weekday: { label: "day of the week (0 Monday)", min: 0, max: 6, get: function (s) { return (s.time || {}).weekday; } },
    outside: { label: "outside temperature", min: -10, max: 35, get: function (s) { return (s.weather || {}).temp; } },
    rain: { label: "rain mm", min: 0, max: 5, get: function (s) { return (s.weather || {}).rain; } },
    wind: { label: "wind km/h", min: 0, max: 60, get: function (s) { return (s.weather || {}).wind; } },
    cloud: { label: "clouds %", min: 0, max: 100, get: function (s) { return (s.weather || {}).cloud; } },
    daylight: { label: "day (1) or night (0)", min: 0, max: 1, get: function (s) { return (s.weather || {}).day; } },
    sun: { label: "the Sun's height °", min: -30, max: 70, get: function (s) { return sp(s).sun; } },
    moon: { label: "the Moon lit %", min: 0, max: 100, get: function (s) { return sp(s).moon; } },
    planes: { label: "planes overhead", min: 0, max: 10, get: function (s) { return sp(s).planes; } },
    iss: { label: "the ISS's height ° (0 = not up)", min: 0, max: 90, get: function (s) { return sp(s).iss; } },
    starlink: { label: "Starlink satellites up", min: 0, max: 20, get: function (s) { return sp(s).starlink; } },
    kp: { label: "aurora Kp", min: 0, max: 9, get: function (s) { return sp(s).kp; } },
    launch: { label: "minutes to the next launch", min: 0, max: 60, get: function (s) { var n = sp(s).launchIn; return n == null ? 60 : n / 60; } },
    agents: { label: "AI agents", min: 0, max: 8, get: function (s) { return (s.agents || []).length; } },
    working: { label: "agents working", min: 0, max: 8, get: function (s) { return count(s.agents, "working"); } },
    waiting: { label: "agents waiting for you", min: 0, max: 4, get: function (s) { return count(s.agents, "waiting"); } },
    failed: { label: "agents failed", min: 0, max: 4, get: function (s) { return count(s.agents, "failed"); } },
    commits: { label: "commits this week", min: 0, max: 60, get: function (s) { return (s.git || []).reduce(function (a, r) { return a + (r.week || 0); }, 0); } },
    cifail: { label: "CI failing", min: 0, max: 3, get: function (s) { return (s.git || []).filter(function (r) { return r.ci === "fail"; }).length; } },
    music: { label: "music playing (1)", min: 0, max: 1, get: function (s) { return s.music ? 1 : 0; } },
    focus: { label: "focus session (1)", min: 0, max: 1, get: function (s) { return s.focus ? 1 : 0; } },
    meeting: { label: "in a meeting (1)", min: 0, max: 1, get: function (s) { return s.meeting ? 1 : 0; } },
    away: { label: "you are away (1)", min: 0, max: 1, get: function (s) { return s.away ? 1 : 0; } },
    item: { label: "each copy's own value", min: 0, max: 1, get: function (s, it) { return it ? it.v : 0; } }
  };
  // 1.7: your own panels ([[source]], push, Home Assistant...): "panel:ID" reads its number; its range is the binding's
  // own lo/hi when it has them, else the panel's min/max (a gauge), else 0..100
  function panel(st, id) { var p = (st.panels || {})[id]; return p && typeof p.value === "number" ? p : null; }
  function source(src) {
    if (SOURCES[src]) return SOURCES[src];
    if (/^panel:[A-Za-z0-9_.-]{1,40}$/.test(src || "")) {
      var id = src.slice(6);
      return { label: "panel " + id, min: 0, max: 100, panel: id, get: function (s) { var p = panel(s, id); return p ? p.value : null; } };
    }
    return null;
  }
  function range(S, st, b) {
    var lo = S.min, hi = S.max;
    if (S.panel) { var p = panel(st, S.panel); if (p && typeof p.min === "number" && typeof p.max === "number" && p.max > p.min) { lo = p.min; hi = p.max; } }
    if (b && typeof b.lo === "number" && typeof b.hi === "number" && b.hi !== b.lo) { lo = b.lo; hi = b.hi; }
    return [lo, hi];
  }
  // what a binding can move
  var PROPS = { x: "x position", y: "y position", w: "width", h: "height", alpha: "opacity", rot: "rotation (°)",
                glow: "glow", heat: "colour → second colour", speed: "motion speed", level: "level (bars, gauge, windows)",
                count: "how many (particles)", amp: "wave height" };
  // what an action can react to: a value crossing a line, or something that happens
  var EVENTS = {
    "agent-waiting": "an AI agent starts waiting for you", "agent-done": "an AI agent finishes", "agent-failed": "an AI agent fails",
    "agent-new": "a new AI agent starts", "ci-fail": "CI fails on a repo", "ci-ok": "CI passes again", "commit": "a new commit",
    "hour": "a new hour", "plane": "a plane comes overhead", "iss": "the ISS rises", "launch": "a rocket lifts off",
    "rain": "it starts raining", "focus": "a focus session starts", "back": "you come back", "music": "music starts",
    "row-crit": "a row of your panels turns red", "row-ok": "a row of your panels is green again",
    "click": "you click the shape", "start": "the scene starts", "every": "every N seconds"
  };
  // what an action can do; the effects are Pulse's own (fireworks, liftoff...), the rest happens in the scene
  var FX = { fireworks: "fireworks", banner: "a banner across the sky", lightning: "a lightning bolt", shooting: "a shooting star",
             tip: "a hot-air balloon with your text", launch: "a rocket lifts off", flare: "a solar flare", chime: "a chime",
             text: "a line of text over the city" };
  var DOS = { fx: "Pulse effect", play: "play a shape's animation", flash: "flash a shape in a colour", show: "show a shape",
              hide: "hide a shape", toggle: "show / hide a shape" };
  var THEME = { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7", accent2: "#bb9af7", ok: "#9ece6a", warn: "#e0af68", crit: "#f7768e", dim: "#565f89" };
  var STATE_COL = { working: "accent", waiting: "warn", done: "ok", failed: "crit", idle: "dim", ok: "ok", warn: "warn", crit: "crit", info: "accent2" };

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
  function raw(src, st, it) { var S = source(src); return S ? S.get(st, it) : null; }
  function norm(src, st, it, b) {
    var S = source(src); if (!S) return 0;
    var r = range(S, st, b), v = num(S.get(st, it), r[0]);
    return clamp01((v - r[0]) / (r[1] - r[0] || 1));
  }
  // the items a shape repeats over: one copy per agent, repo, core, or a fixed number
  function items(sh, st) {
    var r = sh.repeat || {}, n, out = [], priv = !!st.privacy;
    if (r.by === "agents") (st.agents || []).slice(0, 24).forEach(function (a) { out.push({ v: a.state === "working" ? 1 : a.state === "waiting" ? 0.6 : a.state === "done" ? 0.3 : 0, state: a.state, name: priv ? "" : a.name }); });
    else if (r.by === "repos") (st.git || []).slice(0, 16).forEach(function (g) { out.push({ v: clamp01((g.week || 0) / 30), state: g.ci === "fail" ? "failed" : g.ci === "run" ? "working" : g.ci === "ok" ? "done" : "idle", name: priv ? "" : g.name }); });
    else if (r.by === "cores") ((st.sys || {}).cores || []).slice(0, 32).forEach(function (c, i) { out.push({ v: clamp01((c || 0) / 100), state: c > 85 ? "failed" : "working", name: "core " + i }); });
    else if (r.by === "planes") (sp(st).list || []).slice(0, 12).forEach(function (p) { out.push({ v: clamp01((p.el || 0) / 90), state: "working", name: priv ? "" : (p.flight || "") }); });
    else if (r.by === "panel") {   // 1.7: one per row of your panel (a VM, a container, an access point...)
      var rows = (((st.panels || {})[String(r.panel || "")] || {}).rows || []).slice(0, 32), mx = 0;
      rows.forEach(function (w) { if (typeof w.value === "number" && w.value > mx) mx = w.value; });
      rows.forEach(function (w) {
        var lv = w.level || "", v = typeof w.value === "number" ? (mx > 0 ? clamp01(w.value / mx) : 0) : ({ ok: 1, info: 0.8, warn: 0.6, crit: 0.3 }[lv] || 0.5);
        out.push({ v: v, state: lv || "idle", name: priv ? "" : (w.name || "") });
      });
    }
    else if (r.by === "count") { n = Math.max(1, Math.min(64, num(r.n, 3) | 0)); for (var i = 0; i < n; i++) out.push({ v: n > 1 ? i / (n - 1) : 0, state: "", name: "" }); }
    else out.push(null);
    return out;
  }
  function text(tpl, st, it) {
    var y = st.sys || {}, w = st.weather || {}, t = st.time || {}, s = sp(st), p = function (n) { return (n < 10 ? "0" : "") + n; };
    var V = { cpu: Math.round(y.cpu || 0), ram: Math.round(y.ram || 0), gpu: Math.round(y.gpu || 0), temp: Math.round(y.temp || 0),
              net: (((y.rx || 0) + (y.tx || 0)) / 1e6).toFixed(1), time: p(t.hour || 0) + ":" + p(t.minute || 0), hour: t.hour || 0,
              date: p(t.day || 1) + "/" + p(t.month || 1), outside: w.temp == null ? "–" : Math.round(w.temp), agents: (st.agents || []).length,
              working: count(st.agents, "working"), waiting: count(st.agents, "waiting"), commits: SOURCES.commits.get(st),
              planes: s.planes || 0, kp: s.kp == null ? "–" : s.kp, moon: s.moon == null ? "–" : Math.round(s.moon),
              name: it ? it.name : "", state: it ? it.state : "", item: it ? Math.round(it.v * 100) : "" };
    return String(tpl || "").replace(/\{(panel:)?([\w.-]+)\}/g, function (m, pn, k) {
      if (pn) { var pv = panel(st, k); return pv ? (Math.round(pv.value * 10) / 10) + (pv.unit || "") : "–"; }
      return V[k] != null ? V[k] : m;
    });
  }
  // 1.7 keyframes: { dur, loop, start: "loop" | "action", ease: "linear" | "smooth", frames: [{t: 0..1, dx, dy, scale, alpha, rot}] }
  function keyed(sh, t, mem) {
    var k = sh.keys; if (!k || !(k.frames || []).length) return null;
    var dur = Math.max(0.1, num(k.dur, 2)), ph;
    if (k.start === "action") {
      var at = (mem.played || {})[sh.id]; if (at == null) return null;
      ph = (t - at) / dur;
      if (ph >= 1) { if (k.loop) ph = ph % 1; else { delete mem.played[sh.id]; return null; } }
    } else ph = k.loop === false ? Math.min(1, t / dur) : (t / dur) % 1;
    var fr = k.frames.slice().sort(function (a, b) { return num(a.t, 0) - num(b.t, 0); }), a = fr[0], b = fr[fr.length - 1];
    for (var i = 0; i < fr.length - 1; i++) if (ph >= num(fr[i].t, 0) && ph <= num(fr[i + 1].t, 1)) { a = fr[i]; b = fr[i + 1]; break; }
    var span = num(b.t, 1) - num(a.t, 0), u = span > 0 ? clamp01((ph - num(a.t, 0)) / span) : 0;
    if (k.ease === "smooth") u = u * u * (3 - 2 * u);
    var L = function (key, d) { return num(a[key], d) + (num(b[key], d) - num(a[key], d)) * u; };
    return { dx: L("dx", 0), dy: L("dy", 0), scale: L("scale", 1), alpha: L("alpha", 1), rot: L("rot", 0) };
  }
  // a shape's properties now: its own values, moved by its bindings, its motion and its keyframes
  function resolve(sh, st, it, t, still, mem) {
    var p = { x: num(sh.x, 0.5), y: num(sh.y, 0.5), w: num(sh.w, 0.1), h: num(sh.h, 0.1), alpha: num(sh.alpha, 1), rot: num(sh.rot, 0),
              glow: num(sh.glow, 0), heat: 0, speed: num((sh.anim || {}).speed, 1), level: num(sh.level, 0.6), count: num(sh.count, 40),
              amp: num(sh.amp, 0.3) };
    (sh.bind || []).forEach(function (b) {
      if (!PROPS[b.prop] || !source(b.src)) return;
      var k = norm(b.src, st, it, b); p[b.prop] = num(b.from, 0) + (num(b.to, 1) - num(b.from, 0)) * k;
    });
    var a = sh.anim || {}, spd = p.speed, ph = (it ? it.i * 0.7 : 0);
    if (!still && a.kind && a.kind !== "none") {
      if (a.kind === "pulse") { var s = 1 + 0.12 * Math.sin(t * TAU * 0.5 * spd + ph); p.w *= s; p.h *= s; }
      else if (a.kind === "spin") p.rot += t * 90 * spd;
      else if (a.kind === "bob") p.y += Math.sin(t * TAU * 0.4 * spd + ph) * 0.012;
      else if (a.kind === "sway") p.rot += Math.sin(t * TAU * 0.3 * spd + ph) * 8;
      else if (a.kind === "blink") p.alpha *= (t * spd + ph * 0.1) % 1 < 0.6 ? 1 : 0.15;
      else if (a.kind === "breathe") p.alpha *= 0.55 + 0.45 * Math.sin(t * TAU * 0.25 * spd + ph);
      else if (a.kind === "drift") { p.x = ((p.x + t * 0.02 * spd) % 1.2 + 1.2) % 1.2 - 0.1; }
    }
    if (!still && mem) {
      var kf = keyed(sh, t, mem);
      if (kf) { p.x += kf.dx; p.y += kf.dy; p.w *= kf.scale; p.h *= kf.scale; p.alpha *= kf.alpha; p.rot += kf.rot; }
    }
    return p;
  }
  function shapeColor(sh, st, it, p, th, mem, t) {
    var c = col(sh.color || "accent", th);
    if (it && it.state && (sh.repeat || {}).stateColors) c = col(STATE_COL[it.state] || "dim", th);
    if (p.heat > 0 && sh.color2) c = mix(c, col(sh.color2, th), clamp01(p.heat));
    var fl = mem && (mem.flash || {})[sh.id];
    if (fl && t < fl.until) c = mix(c, col(fl.color, th), 0.5 + 0.5 * Math.abs(Math.sin((fl.until - t) * 6)));
    return c;
  }
  // pictures (a design's assets: data: URLs, so a scene stays one file and needs no network)
  var imgs = {};
  function img(design, id) {
    var src = (design.assets || {})[id]; if (!src) return null;
    var k = id + ":" + src.length, im = imgs[k];
    if (!im && typeof Image !== "undefined") { im = imgs[k] = new Image(); im.src = src; }
    return im && im.complete && im.naturalWidth ? im : null;
  }
  // draws one shape (already placed: 0,0 is its centre, w and h in pixels)
  function paint(g, sh, p, c, W, H, t, still, st, it, mem, design) {
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
      case "image": {   // 1.7: a picture you imported (PNG, JPEG, WebP or SVG); "tint" paints it in the shape's colour
        var im = img(design, sh.asset);
        if (!im) { g.strokeStyle = rgba(c, p.alpha * 0.5); g.setLineDash([6, 6]); g.strokeRect(-w / 2, -h / 2, w, h); g.setLineDash([]); break; }
        g.globalAlpha = clamp01(p.alpha);
        if (sh.flip) g.scale(-1, 1);
        if (sh.tint) {   // the picture's shape, filled with the colour: logos and icons follow the theme
          var tc = mem.tintC || (mem.tintC = typeof document !== "undefined" ? document.createElement("canvas") : null);
          if (tc) {
            tc.width = Math.max(1, Math.round(w)); tc.height = Math.max(1, Math.round(h));
            var tg = tc.getContext("2d"); tg.clearRect(0, 0, tc.width, tc.height); tg.drawImage(im, 0, 0, tc.width, tc.height);
            tg.globalCompositeOperation = "source-in"; tg.fillStyle = rgba(c, 1); tg.fillRect(0, 0, tc.width, tc.height); tg.globalCompositeOperation = "source-over";
            g.drawImage(tc, -w / 2, -h / 2, w, h);
          }
        } else g.drawImage(im, -w / 2, -h / 2, w, h);
        g.globalAlpha = 1; break;
      }
    }
  }
  function background(g, W, H, st, design) {   // 1.7: a picture behind everything (a wallpaper of the scene's own)
    var b = design.background; if (!b || !b.asset) return;
    var im = img(design, b.asset); if (!im) return;
    var iw = im.naturalWidth, ih = im.naturalHeight, k = b.fit === "contain" ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
    var dw = iw * k, dh = ih * k;
    g.globalAlpha = clamp01(num(b.alpha, 1)); g.drawImage(im, (W - dw) / 2, (H - dh) * clamp01(num(b.y, 0.5)), dw, dh); g.globalAlpha = 1;
    var dim = clamp01(num(b.dim, 0));
    if (dim > 0) { g.fillStyle = rgba(col("bg", st.theme || {}), dim); g.fillRect(0, 0, W, H); }
  }
  function draw(g, t, st, box, design, mem) {
    var W = box.w, H = box.h, th = Object.assign({}, st.theme || {}, design.palette || {}), still = st.ui && st.ui.motion === "reduced";
    mem.hits = [];
    if (design.sky && design.sky !== "none") {   // a sky of its own (or none: Pulse's real sky shows through)
      var sk = g.createLinearGradient(0, 0, 0, H), c1 = col(design.sky, th), c0 = col("bg", th);
      sk.addColorStop(0, rgba(mix(c0, [0, 0, 0], 0.3), 1)); sk.addColorStop(0.75, rgba(mix(c0, c1, 0.35), 1)); sk.addColorStop(1, rgba(mix(c0, [0, 0, 0], 0.5), 1));
      g.fillStyle = sk; g.fillRect(0, 0, W, H);
    }
    background(g, W, H, { theme: th }, design);
    var vis = mem.vis || {};
    (design.shapes || []).forEach(function (sh) {
      if (vis[sh.id] === false || (sh.hidden && vis[sh.id] !== true)) return;
      var list = items(sh, st), r = sh.repeat || {};
      for (var i = 0; i < list.length; i++) {
        var it = list[i]; if (it) it.i = i;
        var p = resolve(sh, st, it, t, still, mem);
        if (it) {   // copies in a row (or a column), or spread evenly across the width
          if (r.spread) p.x = num(r.from, 0.3) + (num(r.to, 0.7) - num(r.from, 0.3)) * (list.length > 1 ? i / (list.length - 1) : 0.5);
          else { p.x += num(r.dx, 0.05) * i; p.y += num(r.dy, 0) * i; }
        }
        if (p.alpha <= 0.002) continue;
        var c = shapeColor(sh, st, it, p, th, mem, t);
        g.save(); g.translate(p.x * W, p.y * H); if (p.rot) g.rotate(p.rot * Math.PI / 180);
        if (p.glow > 0) { g.shadowColor = rgba(c, 0.9); g.shadowBlur = p.glow * H * 0.03; }
        try { paint(g, sh, p, c, W, H, t, still, st, it, mem, design); } finally { g.restore(); }
        mem.hits.push([p.x * W, p.y * H, Math.max(p.w * W, H * 0.02) / 2, Math.max(p.h * H, H * 0.02) / 2, sh.click ? text(sh.click, st, it) : "", sh.id]);
      }
    });
    if (mem.say && t < mem.say.until && mem.say.inScene) {   // a "text" action when the engine has no fx (the editor)
      g.save(); g.font = "600 " + Math.round(H * 0.03) + "px 'CaskaydiaMono Nerd Font', ui-monospace, monospace"; g.textAlign = "center";
      g.fillStyle = rgba(col("fg", th), Math.min(1, (mem.say.until - t))); g.fillText(mem.say.text, W / 2, H * 0.4); g.restore();
    }
  }
  // ------------------------------------------------------------------ actions: when something happens, do something
  // a value crossing a line counts once, on the way across; events come from comparing the state with the one before
  function happened(prev, st) {
    var out = {}, P = prev || {}, ag = function (s, k) { var m = {}; (s.agents || []).forEach(function (a) { m[a.name + "|" + (a.since || 0)] = a.state; }); return m; };
    if (!prev) return { start: 1 };
    var a0 = ag(P), a1 = ag(st);
    Object.keys(a1).forEach(function (k) {
      if (!(k in a0)) out["agent-new"] = 1;
      if (a1[k] !== a0[k]) { if (a1[k] === "waiting") out["agent-waiting"] = 1; if (a1[k] === "done") out["agent-done"] = 1; if (a1[k] === "failed") out["agent-failed"] = 1; }
    });
    var ci = function (s) { var m = {}; (s.git || []).forEach(function (r, i) { m[r.name || i] = r.ci; }); return m; }, c0 = ci(P), c1 = ci(st);
    Object.keys(c1).forEach(function (k) { if (c1[k] !== c0[k]) { if (c1[k] === "fail") out["ci-fail"] = 1; if (c1[k] === "ok" && c0[k] === "fail") out["ci-ok"] = 1; } });
    if (SOURCES.commits.get(st) > SOURCES.commits.get(P)) out.commit = 1;
    if ((st.time || {}).hour !== (P.time || {}).hour) out.hour = 1;
    if ((sp(st).planes || 0) > (sp(P).planes || 0)) out.plane = 1;
    if ((sp(st).iss || 0) > 10 && !((sp(P).iss || 0) > 10)) out.iss = 1;
    if (sp(st).launchIn != null && sp(st).launchIn <= 0 && !(sp(P).launchIn != null && sp(P).launchIn <= 0)) out.launch = 1;
    if ((st.weather || {}).rain > 0 && !((P.weather || {}).rain > 0)) out.rain = 1;
    if (st.focus && !P.focus) out.focus = 1;
    if (!st.away && P.away) out.back = 1;
    if (st.music && !P.music) out.music = 1;
    var rw = function (s) { var m = {}; Object.keys(s.panels || {}).forEach(function (id) { ((s.panels[id] || {}).rows || []).forEach(function (r, i) { m[id + "|" + (r.name || i)] = r.level || ""; }); }); return m; }, r0 = rw(P), r1 = rw(st);
    Object.keys(r1).forEach(function (k) { if (!(k in r0)) return; if (r1[k] === "crit" && r0[k] !== "crit") out["row-crit"] = 1; if (r1[k] === "ok" && (r0[k] === "crit" || r0[k] === "warn")) out["row-ok"] = 1; });
    return out;
  }
  function when(ac, ev, st, prev, t, mem) {
    var w = ac.when || {};
    if (w.type === "event") {
      if (w.event === "every") { var n = Math.max(5, num(w.secs, 60)), k = Math.floor(t / n); if (k > (mem.every[ac.id] || 0)) { mem.every[ac.id] = k; return true; } return false; }
      return !!ev[w.event];
    }
    if (!prev || !source(w.src)) return false;
    var v = num(raw(w.src, st), NaN), v0 = num(raw(w.src, prev), NaN), x = num(w.value, 0);
    if (!isFinite(v) || !isFinite(v0)) return false;
    return w.type === "below" ? v < x && v0 >= x : v > x && v0 <= x;   // "above" (default): rising across the line
  }
  function act(design, ac, mem, t, out, st) {
    (ac.do || []).slice(0, 8).forEach(function (d) {
      var sh = d.shape;
      if (d.type === "fx" && FX[d.fx]) out.push({ kind: d.fx === "text" ? "say" : d.fx, text: text(String(d.text || "").slice(0, 60), st || {}).slice(0, 60) });   // live values filled in
      else if (d.type === "play" && sh) mem.played[sh] = t;
      else if (d.type === "flash" && sh) mem.flash[sh] = { color: d.color || "warn", until: t + Math.max(0.3, Math.min(30, num(d.secs, 3))) };
      else if (d.type === "show" && sh) mem.vis[sh] = true;
      else if (d.type === "hide" && sh) mem.vis[sh] = false;
      else if (d.type === "toggle" && sh) { var s = (design.shapes || []).filter(function (x) { return x.id === sh; })[0]; var now = mem.vis[sh] != null ? mem.vis[sh] : !(s && s.hidden); mem.vis[sh] = !now; }
    });
  }
  // called with every new state (and with a click): returns the effects to ask Pulse for
  function react(design, st, mem, t, clicked) {
    mem.played = mem.played || {}; mem.flash = mem.flash || {}; mem.vis = mem.vis || {}; mem.every = mem.every || {}; mem.last = mem.last || {};
    var ev = clicked ? {} : happened(mem.prev, st), out = [];
    (design.actions || []).slice(0, 40).forEach(function (ac) {
      if (ac.off) return;
      var fire = clicked ? ((ac.when || {}).type === "event" && ac.when.event === "click" && (!ac.when.shape || ac.when.shape === clicked)) : when(ac, ev, st, mem.prev, t, mem);
      if (!fire) return;
      var cool = Math.max(1, num(ac.cooldown, 10));
      if (mem.last[ac.id] != null && t - mem.last[ac.id] < cool) return;
      mem.last[ac.id] = t;
      act(design, ac, mem, t, out, st);
    });
    if (!clicked) mem.prev = st;
    return out;
  }
  function click(mem, x, y) {   // the topmost shape under the pointer: its click text and id
    for (var i = (mem.hits || []).length - 1; i >= 0; i--) { var h = mem.hits[i]; if (Math.abs(x - h[0]) <= h[2] && Math.abs(y - h[1]) <= h[3]) return h[4] || null; }
    return null;
  }
  function clickedId(mem, x, y) {
    for (var i = (mem.hits || []).length - 1; i >= 0; i--) { var h = mem.hits[i]; if (Math.abs(x - h[0]) <= h[2] && Math.abs(y - h[1]) <= h[3]) return h[5]; }
    return null;
  }
  // the definition PulseScene.register() wants
  function scene(design) {
    var fxOut = function (list, mem, t) {
      list.forEach(function (f) {
        if (f.kind === "say") { if (typeof PulseScene !== "undefined" && PulseScene.say) PulseScene.say(f.text); else mem.say = { text: f.text, until: t + 4, inScene: true }; }
        else if (typeof PulseScene !== "undefined" && PulseScene.fx) PulseScene.fx(f.kind, f.text);
      });
    };
    return {
      city: !!design.city,
      init: function () { this.mem = this.mem || { hits: [] }; this.t0 = this.t0 || Date.now(); },
      update: function (st) { var m = this.mem || (this.mem = { hits: [] }), t = (Date.now() - (this.t0 || Date.now())) / 1000; fxOut(react(design, st, m, t), m, t); },
      draw: function (g, t, st, box) { this.t0 = Date.now() - t * 1000; draw(g, t, st, box, design, this.mem || (this.mem = { hits: [] })); },
      click: function (x, y, st) {
        var m = this.mem || {}, id = clickedId(m, x, y);
        var t = (Date.now() - (this.t0 || Date.now())) / 1000;
        if (id) fxOut(react(design, st || {}, m, t, id), m, t);
        return click(m, x, y);
      }
    };
  }
  return { draw: draw, click: click, clickedId: clickedId, react: react, happened: happened, scene: scene, source: source,
           SOURCES: SOURCES, PROPS: PROPS, EVENTS: EVENTS, FX: FX, DOS: DOS, THEME: THEME, text: text, hex: hex, keyed: keyed };
})();
if (typeof module !== "undefined" && module.exports) module.exports = PulseDesign;
