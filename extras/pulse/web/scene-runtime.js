/* Omarchy Pulse 1.5: the runtime of a community scene. (c) 2026 Marco Porro (x.com/MarcoPorro), MIT.
   A scene runs alone in a sandboxed frame: no network, no token, no access to Pulse or to your files. It gets a
   read-only copy of the state, draws on its own transparent canvas between the sky and the panels, and can answer
   a click with a line of text. See docs/SCENES.md. */
(function () {
  "use strict";
  var cv = document.getElementById("c"), g = cv.getContext("2d");
  var def = null, name = "", state = null, W = 0, H = 0, scale = 1, fps = 20, paused = false, last = 0;
  var t0 = performance.now(), inited = false, cost = 0, n = 0, worst = 0, rep = performance.now(), errs = 0;
  var parentWin = window.parent;
  function post(m) { try { parentWin.postMessage(m, "*"); } catch (e) {} }
  function fail(where, e) {
    errs++;
    if (errs <= 3) post({ pulseScene: "error", where: where, error: String(e && e.message || e) + (e && e.stack ? "\n" + String(e.stack).split("\n").slice(0, 3).join("\n") : "") });
  }
  function frozen(o) {   // the scene gets a copy it cannot change for the others
    if (o && typeof o === "object") { Object.keys(o).forEach(function (k) { frozen(o[k]); }); Object.freeze(o); }
    return o;
  }
  function resize() {
    var r = Math.min(2, window.devicePixelRatio || 1) * scale;
    W = Math.max(1, Math.round(innerWidth * r)); H = Math.max(1, Math.round(innerHeight * r));
    cv.width = W; cv.height = H;
    if (def && def.init) { try { def.init(g, { w: W, h: H, scale: r }); inited = true; } catch (e) { fail("init", e); } }
  }
  window.PulseScene = {
    register: function (nm, d) {
      if (def) return;   // one scene per frame
      name = String(nm || "scene"); def = d || {};
      resize(); inited = true;
      post({ pulseScene: "ready", name: name, city: !!def.city });
    },
    // 1.7: ask Pulse for one of its own effects (fireworks, banner, lightning, shooting, tip, launch, flare, chime):
    // Pulse plays it over the whole wallpaper. A few a minute at most; anything else is ignored.
    fx: function (kind, text) { post({ pulseScene: "fx", kind: String(kind || ""), text: String(text == null ? "" : text).slice(0, 60) }); },
    // 1.7: a line of text over the city, like a click's answer
    say: function (text) { post({ pulseScene: "show", text: String(text == null ? "" : text).slice(0, 120) }); },
    // little helpers every scene needs
    rgba: function (c, a) { c = c || [255, 255, 255]; return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a == null ? 1 : a) + ")"; },
    mix: function (a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; },
    rand: function (seed) { var s = (Math.abs(seed | 0) % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  };
  addEventListener("resize", resize);
  addEventListener("error", function (e) { fail("script", e.error || e.message); });
  addEventListener("message", function (ev) {
    var m = ev.data || {};
    if (ev.source !== parentWin || !m.pulse) return;
    if (m.pulse === "state") {
      state = frozen(m.state || {});
      fps = Math.max(1, Math.min(60, +m.fps || 20));
      if (m.scale && m.scale !== scale) { scale = m.scale; resize(); }
      if (def && def.update) { try { def.update(state); } catch (e) { fail("update", e); } }
    } else if (m.pulse === "pause") paused = !!m.on;
    else if (m.pulse === "click" && def && def.click) {
      var r = null;
      try { r = def.click(m.x * W, m.y * H, state); } catch (e) { fail("click", e); }
      if (r) post({ pulseScene: "show", text: String(typeof r === "object" ? (r.title || "") + (r.text ? " · " + r.text : "") : r).slice(0, 120) });
    } else if (m.pulse === "snap") {
      try { post({ pulseScene: "snap", url: cv.toDataURL("image/png") }); } catch (e) { fail("snap", e); }
    } else if (m.pulse === "record") record(+m.secs || 6);
  });
  function record(secs) {   // the scene lab: a short video of the scene alone (demo data)
    if (!cv.captureStream || !window.MediaRecorder) { post({ pulseScene: "video", error: "this browser cannot record" }); return; }
    var chunks = [], rec = new MediaRecorder(cv.captureStream(30), { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    rec.onstop = function () { var b = new Blob(chunks, { type: "video/webm" }), fr = new FileReader(); fr.onload = function () { post({ pulseScene: "video", url: fr.result }); }; fr.readAsDataURL(b); };
    rec.start(); setTimeout(function () { rec.stop(); }, secs * 1000);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!def || !state || paused) return;
    if (now - last < 1000 / fps - 2) return;
    last = now;
    var a = performance.now();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    try { if (def.draw) def.draw(g, (now - t0) / 1000, state, { w: W, h: H, horizon: H * (state.layout ? state.layout.horizon : 0.72) }); }
    catch (e) { fail("draw", e); }
    var c = performance.now() - a;
    cost += c; n++; if (c > worst) worst = c;
    if (now - rep > 2000) { post({ pulseScene: "perf", draw: +(cost / Math.max(1, n)).toFixed(2), worst: +worst.toFixed(1), fps: +(n / ((now - rep) / 1000)).toFixed(1), w: W, h: H }); cost = 0; n = 0; worst = 0; rep = now; }
  }
  requestAnimationFrame(frame);
})();
