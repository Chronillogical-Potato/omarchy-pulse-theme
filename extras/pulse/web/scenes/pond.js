// pond: the example scene of Omarchy Pulse 1.5 (docs/SCENES.md). (c) 2026 Marco Porro (x.com/MarcoPorro), MIT.
// A night pond on the floor of the sky: each AI agent is a fish, each Git repo a water lily, your CPU stirs the water.
// Copy it to start your own: omarchy-pulse scene new myscene, or read this one top to bottom.
PulseScene.register("pond", {
  init: function (g, size) {
    this.fish = {};      // where each agent's fish is, by name (or by index when names are hidden)
    this.ripples = [];   // [x, y, born, strength]
    this.seen = 0;       // the last event we reacted to
    this.hit = [];       // what a click can find: [x, y, r, text]
  },

  draw: function (g, t, st, box) {
    var C = PulseScene.rgba, M = PulseScene.mix, W = box.w, H = box.h, hz = box.horizon;
    var hex = function (h, d) { h = (h || d).slice(1); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    var th = st.theme || {}, bg = hex(th.bg, "#1a1b26"), ac = hex(th.accent, "#7aa2f7"), a2 = hex(th.accent2, "#bb9af7");
    var ok = hex(th.ok, "#9ece6a"), warn = hex(th.warn, "#e0af68"), crit = hex(th.crit, "#f7768e"), fg = hex(th.fg, "#c0caf5");
    var still = st.ui && st.ui.motion === "reduced", now = st.t || Date.now() / 1000, self = this;
    this.hit = [];

    // the pond: an ellipse on the floor, in perspective
    var cx = W / 2, cy = hz + (H - hz) * 0.52, rx = W * 0.36, ry = (H - hz) * 0.36;
    var water = g.createRadialGradient(cx, cy - ry * 0.4, ry * 0.1, cx, cy, rx);
    water.addColorStop(0, C(M(bg, ac, 0.32), 0.92)); water.addColorStop(1, C(M(bg, [0, 0, 0], 0.4), 0.95));
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = water; g.fill();
    g.lineWidth = Math.max(2, H / 300); g.strokeStyle = C(M(bg, a2, 0.5), 0.9); g.stroke();
    var inPond = function (u, v) { return [cx + u * rx * 0.86, cy + v * ry * 0.8]; };   // u, v in -1..1

    // the CPU stirs the water: ripples now and then, more with more load (none with reduced motion)
    var cpu = (st.sys && st.sys.cpu) || 0, rain = st.weather && st.weather.rain > 0;
    if (!still && Math.random() < 0.02 + cpu / 1500 + (rain ? 0.4 : 0)) {
      var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
      this.ripples.push([cx + Math.cos(a) * d * rx * 0.9, cy + Math.sin(a) * d * ry * 0.9, t, rain ? 0.4 : 0.6 + cpu / 200]);
    }
    // a commit or a push drops a stone on its lily
    var lilies = (st.git || []).slice(0, 8);
    (st.events || []).forEach(function (e) {
      if (e.t <= self.seen) return;
      self.seen = e.t;
      if (e.kind === "commit" || e.kind === "push") {
        var i = Math.max(0, lilies.findIndex(function (r) { return r.name && e.text.indexOf(r.name) === 0; }));
        var p = inPond(Math.cos(i * 2.4) * 0.8, Math.sin(i * 2.4) * 0.8);
        self.ripples.push([p[0], p[1], t, e.kind === "push" ? 1.6 : 1]);
      }
    });
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
    this.ripples = this.ripples.filter(function (r) {
      var age = t - r[2]; if (age > 3) return false;
      g.beginPath(); g.ellipse(r[0], r[1], age * W * 0.03 * r[3], age * W * 0.03 * r[3] * ry / rx, 0, 0, Math.PI * 2);
      g.strokeStyle = C(fg, 0.25 * (1 - age / 3) * Math.min(1, r[3])); g.lineWidth = Math.max(1, H / 900); g.stroke();
      return true;
    });

    // the agents: one fish each, faster while working, golden when done, still and red when failed
    var agents = st.agents || [];
    agents.forEach(function (ag, i) {
      var key = ag.name || "#" + i, f = self.fish[key] || (self.fish[key] = { a: i * 1.7, r: 0.3 + (i % 4) * 0.14 });
      var speed = { working: 0.9, waiting: 0.05, done: 0.35, failed: 0, idle: 0.15 }[ag.state] || 0.2;
      if (!still) f.a += speed * 0.02;
      var p = inPond(Math.cos(f.a) * f.r * 1.6, Math.sin(f.a) * f.r * 1.4), dir = f.a + Math.PI / 2;
      var col = { working: ac, waiting: warn, done: [240, 190, 90], failed: crit }[ag.state] || M(fg, bg, 0.4);
      var L = H * 0.038, wag = still || speed < 0.1 ? 0 : Math.sin(t * 9 + i) * 0.35;
      g.save(); g.translate(p[0], p[1]); g.scale(1, ry / rx * 1.4); g.rotate(dir);
      g.fillStyle = C(col, ag.state === "failed" ? 0.55 : 0.9);
      g.beginPath(); g.ellipse(0, 0, L, L * 0.36, 0, 0, Math.PI * 2); g.fill();                 // body
      g.beginPath(); g.moveTo(-L * 0.85, 0); g.lineTo(-L * 1.45, -L * 0.42 + wag * L); g.lineTo(-L * 1.45, L * 0.42 + wag * L); g.closePath(); g.fill();   // tail
      g.fillStyle = C(bg, 0.9); g.beginPath(); g.arc(L * 0.55, -L * 0.12, L * 0.07, 0, Math.PI * 2); g.fill();   // eye
      g.restore();
      if (ag.state === "waiting") {   // waiting for you: a soft amber light, blinking
        var bl = still ? 0.5 : 0.35 + 0.35 * Math.sin(t * 3);
        var glow = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], L * 3); glow.addColorStop(0, C(warn, bl)); glow.addColorStop(1, C(warn, 0));
        g.fillStyle = glow; g.fillRect(p[0] - L * 3, p[1] - L * 3, L * 6, L * 6);
      }
      var mins = Math.max(0, Math.round((now - (ag.since || now)) / 60));
      self.hit.push([p[0], p[1], L * 1.6, (ag.name || "an agent") + " · " + ag.state + (mins ? " · " + mins + " min" : "")]);
    });
    g.restore();

    // the repos: water lilies around the edge, bigger with more commits this week, the flower is the CI
    lilies.forEach(function (r, i) {
      var p = inPond(Math.cos(i * 2.4) * 0.8, Math.sin(i * 2.4) * 0.8), s = H * (0.018 + Math.min(1, r.week / 30) * 0.02);
      g.fillStyle = C(M(ok, bg, 0.45), 0.95);
      g.beginPath(); g.ellipse(p[0], p[1], s, s * 0.45, 0, 0.25, Math.PI * 2 - 0.25); g.lineTo(p[0], p[1]); g.closePath(); g.fill();
      var fc = r.ci === "fail" ? crit : r.ci === "run" ? warn : r.ci === "ok" ? [245, 230, 240] : null;
      if (fc) {
        var open = r.ci === "run" && !still ? 0.5 + 0.3 * Math.sin(t * 2) : 1;
        for (var k = 0; k < 6; k++) {
          var a = k / 6 * Math.PI * 2 + 0.3;
          g.fillStyle = C(fc, 0.9); g.beginPath();
          g.ellipse(p[0] + Math.cos(a) * s * 0.28 * open, p[1] - s * 0.2 + Math.sin(a) * s * 0.12 * open, s * 0.22, s * 0.1, a, 0, Math.PI * 2); g.fill();
        }
      }
      self.hit.push([p[0], p[1], s, (r.name || "a repo") + " · " + r.week + " commits this week" + (r.ci ? " · CI " + (r.ci === "ok" ? "green" : r.ci) : "")]);
    });

    // away: the pond sleeps under a light mist
    if (st.away) { g.fillStyle = C(fg, 0.06); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  },

  click: function (x, y) {   // the nearest fish or lily under the pointer
    var best = null, bd = 1e9;
    (this.hit || []).forEach(function (h) { var d = Math.hypot(h[0] - x, h[1] - y); if (d < h[2] * 2 && d < bd) { bd = d; best = h[3]; } });
    return best;
  }
});
