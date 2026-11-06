/* Omarchy Pulse: the wallpaper page. Reads /api/state from the local hub once a second and draws:
   a scene that is the data (the skyline is your CPU cores, the horizon beats with your load, the aurora is your
   network, the weather falls from the sky) and Omarchy-style panels for every source.
   (c) 2026 Marco Porro (x.com/MarcoPorro), MIT. */
(function () {
  "use strict";
  var Q = new URLSearchParams(location.search);
  var TOKEN = Q.get("token") || "";
  var MONKEY = (Q.get("mx") || "0") + "," + (Q.get("my") || "0");
  var MX = +Q.get("mx") || 0, MY = +Q.get("my") || 0;
  var PRIMARY = Q.get("primary") !== "0";
  var S = null;               // last state
  var covered = false;        // this monitor is almost entirely covered by windows
  var seenAlert = -1;         // alerts already shown
  var themeKey = "";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ------------------------------------------------------------------ colours from the Omarchy theme
  var COL = {};
  function hexRgb(h) {
    h = String(h || "").replace("#", "");
    if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
    var n = parseInt(h.slice(0, 6), 16);
    return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function applyTheme(t) {
    var c = (t && t.colors) || {};
    var key = JSON.stringify(c);
    if (key === themeKey) return;
    themeKey = key;
    var map = { bg: c.background, fg: c.foreground, accent: c.accent || c.color6, accent2: c.color5 || c.color13,
      ok: c.color2, warn: c.color3, crit: c.color1, dim: c.color8 };
    var root = document.documentElement.style;
    Object.keys(map).forEach(function (k) {
      var rgb = hexRgb(map[k]);
      if (!rgb) { root.removeProperty("--" + k); root.removeProperty("--" + k + "-rgb"); return; }
      root.setProperty("--" + k, map[k]);
      root.setProperty("--" + k + "-rgb", rgb.join(","));
    });
    var cs = getComputedStyle(document.documentElement);
    ["bg", "fg", "accent", "accent2", "ok", "warn", "crit", "dim"].forEach(function (k) {
      COL[k] = (cs.getPropertyValue("--" + k + "-rgb") || "0,0,0").trim().split(",").map(Number);
    });
    COL.light = lum(COL.bg) > 0.5;
    Scene.reset();
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t | 0, a[1] + (b[1] - a[1]) * t | 0, a[2] + (b[2] - a[2]) * t | 0]; }

  // ------------------------------------------------------------------ formatting
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function bytes(n, rate) {
    var u = rate ? ["B/s", "KB/s", "MB/s", "GB/s"] : ["B", "KB", "MB", "GB", "TB"], i = 0;
    n = +n || 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
  }
  function ago(t) {
    if (!t) return "";
    var s = Math.max(0, Date.now() / 1000 - t);
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }
  function upt(s) {
    s = +s || 0;
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (d ? d + "d " : "") + (d || h ? h + "h " : "") + m + "m";
  }
  function num(v) {
    if (typeof v !== "number") return esc(v);
    var a = Math.abs(v);
    return a >= 10000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, "") || "0";
  }

  // ------------------------------------------------------------------ sparklines
  function spark(cv, series, opts) {
    opts = opts || {};
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== (w * dpr | 0)) { cv.width = w * dpr | 0; cv.height = h * dpr | 0; }
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var max = opts.max || 0;
    series.forEach(function (s) { (s.v || []).forEach(function (x) { if (x > max) max = x; }); });
    if (!max) max = 1;
    g.strokeStyle = rgba(COL.dim, 0.35); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, h - 0.5); g.lineTo(w, h - 0.5); g.stroke();
    series.forEach(function (s) {
      var v = s.v || [];
      if (v.length < 2) return;
      var n = Math.max(v.length, opts.n || 60);
      var step = w / (n - 1), x0 = w - (v.length - 1) * step;
      g.beginPath();
      v.forEach(function (x, i) { var y = h - 2 - (x / max) * (h - 5); if (i) g.lineTo(x0 + i * step, y); else g.moveTo(x0, y); });
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, rgba(s.c, 0.35)); grad.addColorStop(1, rgba(s.c, 0));
      g.lineWidth = 1.6; g.strokeStyle = rgba(s.c, 0.95); g.stroke();
      g.lineTo(w, h); g.lineTo(x0, h); g.closePath(); g.fillStyle = grad; g.fill();
    });
  }

  // ------------------------------------------------------------------ weather icons (drawn, so every font works)
  var WX = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "drizzle", 53: "drizzle", 55: "drizzle",
    56: "freezing drizzle", 57: "freezing drizzle", 61: "rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
    71: "snow", 73: "snow", 75: "heavy snow", 77: "snow grains", 80: "showers", 81: "showers", 82: "violent showers",
    85: "snow showers", 86: "snow showers", 95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm" };
  function wxKind(c) {
    c = +c;
    if (c >= 95) return "storm";
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
    if (c >= 51) return "rain";
    if (c === 45 || c === 48) return "fog";
    if (c === 3) return "cloud";
    if (c === 1 || c === 2) return "part";
    return "clear";
  }
  function wxSvg(code, day) {
    var k = wxKind(code), a = "var(--accent)", b = "var(--accent2)", f = "var(--fg)";
    var sun = day ? '<circle cx="34" cy="30" r="11" fill="none" stroke="' + b + '" stroke-width="2.5"/>' +
      [0, 45, 90, 135, 180, 225, 270, 315].map(function (d) { var r = d * Math.PI / 180; return '<line x1="' + (34 + Math.cos(r) * 15) + '" y1="' + (30 + Math.sin(r) * 15) + '" x2="' + (34 + Math.cos(r) * 19) + '" y2="' + (30 + Math.sin(r) * 19) + '" stroke="' + b + '" stroke-width="2.5" stroke-linecap="round"/>'; }).join("")
      : '<path d="M42 18a13 13 0 1 0 8 22a11 11 0 1 1 -8 -22z" fill="none" stroke="' + b + '" stroke-width="2.5"/>';
    var cloud = '<path d="M22 58h34a11 11 0 0 0 0-22a15 15 0 0 0-28-4a10 10 0 0 0-6 26z" fill="rgba(var(--bg-rgb),.9)" stroke="' + a + '" stroke-width="2.5" stroke-linejoin="round"/>';
    var drops = function (n, sym) {
      var o = "";
      for (var i = 0; i < n; i++) {
        var x = 28 + i * 9;
        o += sym === "snow" ? '<text x="' + (x - 3) + '" y="76" font-size="11" fill="' + f + '">*</text>'
          : '<line x1="' + x + '" y1="64" x2="' + (x - 4) + '" y2="74" stroke="' + a + '" stroke-width="2.5" stroke-linecap="round"/>';
      }
      return o;
    };
    var body = { clear: sun, part: sun + cloud, cloud: cloud, fog: cloud + '<line x1="18" y1="66" x2="66" y2="66" stroke="' + f + '" stroke-width="2" opacity=".6"/><line x1="24" y1="73" x2="60" y2="73" stroke="' + f + '" stroke-width="2" opacity=".4"/>',
      rain: cloud + drops(4), snow: cloud + drops(4, "snow"),
      storm: cloud + '<path d="M44 60l-7 10h7l-5 9" fill="none" stroke="var(--warn)" stroke-width="2.8" stroke-linejoin="round"/>' + drops(2) }[k];
    return '<svg viewBox="0 0 84 84">' + body + "</svg>";
  }

  // ------------------------------------------------------------------ panels
  var panels = {};   // id -> element
  function panel(id, title, icon) {
    var el = panels[id];
    if (!el) {
      el = document.createElement("div");
      el.className = "panel";
      el.innerHTML = '<div class="legend"></div><div class="corner"></div><div class="body"></div><div class="err"></div><div class="cover">PRIVATE</div>';
      panels[id] = el;
    }
    var lg = (icon ? '<span class="ic">' + esc(icon) + "</span>" : "") + esc(title);
    if (el._lg !== lg) { el.querySelector(".legend").innerHTML = lg; el._lg = lg; }
    return el;
  }
  function setHTML(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }
  function bodyOf(el) { return el.querySelector(".body"); }

  function sysPanel(s, h) {
    var el = panel("sys", "system", "󰍛");
    var b = bodyOf(el);
    if (!b._built) {
      b.innerHTML = '<div class="cpuhead"><div class="big"><span class="cpu">0</span><small>% cpu</small></div><div class="side"></div></div>' +
        '<canvas class="spark"></canvas><div class="cores"></div><div class="meters"></div>';
      b._built = true;
    }
    $(".cpu", b).textContent = Math.round(s.cpu || 0);
    setHTML($(".side", b), "load " + esc((s.load || []).join(" ")) + "<br>up " + upt(s.uptime));
    var cores = s.cores || [];
    var cb = $(".cores", b);
    if (cb.children.length !== Math.min(cores.length, 32)) { cb.innerHTML = cores.slice(0, 32).map(function () { return "<i></i>"; }).join(""); }
    cores.slice(0, 32).forEach(function (v, i) { cb.children[i].style.height = Math.max(4, v) + "%"; });
    spark($(".spark", b), [{ v: h.cpu, c: COL.accent }], { max: 100, n: 90 });
    var gb = function (n) { return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1); };
    var m = [["ram", s.ram, gb(s.ramUsed) + "/" + gb(s.ramTotal) + "G"]];
    if (s.gpu != null) m.push(["gpu", s.gpu, Math.round(s.gpu) + "%"]);
    if (s.temp != null) m.push(["temp", Math.min(100, s.temp), Math.round(s.temp) + "°C", s.temp >= 85 ? "var(--crit)" : s.temp >= 75 ? "var(--warn)" : null]);
    m.push(["disk", s.disk, Math.round(s.disk) + "%", s.disk >= 90 ? "var(--warn)" : null]);
    if (s.bat) m.push(["bat", s.bat.pct, s.bat.pct + "%" + (s.bat.status === "Charging" ? " ⚡" : ""), s.bat.pct < 15 ? "var(--crit)" : null]);
    setHTML($(".meters", b), m.map(function (r) {
      return '<div class="meter"><span class="k">' + r[0] + '</span><div class="seg"><i style="width:' + Math.max(0, Math.min(100, r[1] || 0)).toFixed(1) + "%" + (r[3] ? ";--c:" + r[3] : "") + '"></i></div><span class="v">' + esc(r[2]) + "</span></div>";
    }).join(""));
    return el;
  }

  function netPanel(s, h) {
    var el = panel("net", "network", "󰛳");
    var b = bodyOf(el);
    if (!b._built) {
      b.innerHTML = '<div class="row"><span class="k">↓ down</span><span class="v rx"></span></div><div class="row"><span class="k">↑ up</span><span class="v tx"></span></div>' +
        '<canvas class="spark"></canvas><div class="row"><span class="k">' + esc(s.user || "") + "@" + esc(s.host || "") + '</span><span class="v ip"></span></div>';
      b._built = true;
    }
    $(".rx", b).textContent = bytes(s.rx, true);
    $(".tx", b).textContent = bytes(s.tx, true);
    $(".ip", b).textContent = s.ip || "offline";
    spark($(".spark", b), [{ v: h.rx, c: COL.accent }, { v: h.tx, c: COL.accent2 }], { n: 90 });
    return el;
  }

  function weatherPanel(w) {
    var el = panel("weather", "weather" + (w && w.city ? " · " + w.city : ""), "󰖐");
    var b = bodyOf(el);
    if (!w || w.error) { setHTML(b, '<div class="note">' + esc(w ? w.error : "") + "</div>"); return el; }
    var hrs = (w.hours || []).slice(0, 12);
    var tmin = Math.min.apply(null, hrs.map(function (x) { return x.t; }).concat([w.lo])), tmax = Math.max.apply(null, hrs.map(function (x) { return x.t; }).concat([w.hi]));
    setHTML(b, '<div class="wx">' + wxSvg(w.code, w.day) + '<div><div class="big">' + Math.round(w.temp) + "<small>" + esc(w.unit) + '</small></div><div class="cond">' + esc(WX[w.code] || "") + "</div></div></div>" +
      '<div class="wxrow"><span>feels ' + Math.round(w.feels) + "°</span><span>↑" + Math.round(w.hi) + "° ↓" + Math.round(w.lo) + "°</span><span>" + Math.round(w.wind) + " " + esc(w.windUnit) + "</span><span>" + w.hum + "%</span></div>" +
      '<div class="hours">' + hrs.map(function (x) {
        var hh = 12 + 78 * (x.t - tmin) / Math.max(1, tmax - tmin);
        return '<div title="' + x.t + '"><b style="height:' + hh.toFixed(0) + "%;" + (x.p >= 40 ? "background:rgba(var(--accent2-rgb)," + (0.35 + x.p / 160).toFixed(2) + ")" : "") + '"></b><span>' + x.h + "</span></div>";
      }).join("") + '</div><div class="wxrow"><span>☀ ' + esc(w.sunrise) + "</span><span>" + (w.stale ? "offline" : "rain " + Math.max.apply(null, hrs.map(function (x) { return x.p; }).concat([0])) + "% next 12h") + "</span><span>☾ " + esc(w.sunset) + "</span></div>");
    return el;
  }

  var typed = {};   // id -> {full, shown}
  function generic(w) {
    var el = panel(w.id, w.title || w.id, w.icon);
    var d = w.data || {}, b = bodyOf(el), t = w.type, html = "";
    var unit = d.unit || w.unit_override || "";
    if (t === "stat") {
      html = '<div class="big">' + num(d.value) + (unit ? "<small>" + esc(unit) + "</small>" : "") + "</div>" +
        (d.note ? '<div class="note">' + esc(d.note) + "</div>" : "") + ((d.history || []).length > 2 ? '<canvas class="spark"></canvas>' : "");
    } else if (t === "gauge") {
      var max = d.max || 100, min = d.min || 0, pct = Math.max(0, Math.min(100, 100 * ((+d.value || 0) - min) / (max - min || 1)));
      html = '<div class="row"><span class="big" style="font-size:2.2rem">' + num(d.value) + "<small>" + esc(unit) + '</small></span></div><div class="seg" style="height:.8rem"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        (d.note ? '<div class="note">' + esc(d.note) + "</div>" : "");
    } else if (t === "list") {
      html = '<ul class="items">' + (d.items || []).slice(0, w.slot === "center" ? 4 : 6).map(function (it) {
        return '<li><span class="dot ' + (it.level ? "lv-" + it.level : "") + '"></span><div style="min-width:0"><div class="t">' + esc(it.title) + "</div>" +
          (it.text ? '<div class="s">' + esc(it.text) + "</div>" : "") + '</div><span class="r">' + esc(it.right || ago(it.t) || (it.value != null ? it.value + (it.unit || "") : "")) + "</span></li>";
      }).join("") + "</ul>" + (d.note ? '<div class="note">' + esc(d.note) + "</div>" : "");
    } else if (t === "status") {
      // long names (problems, alerts) get one tile per line instead of being cut in two columns
      var wide = (d.items || []).some(function (it) { return String(it.title || "").length > 15; });
      html = '<div class="tiles' + (wide ? " one" : "") + '">' + (d.items || []).slice(0, wide ? 6 : 12).map(function (it) {
        return '<div class="tile ' + (it.level || "") + '"><span class="dot ' + (it.level ? "lv-" + it.level : "") + '"></span><span class="n">' + esc(it.title) + '</span><span class="m">' + esc(it.note || "") + "</span></div>";
      }).join("") + "</div>";
    } else if (t === "kv") {
      html = '<table class="kv">' + (d.rows || []).slice(0, 8).map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>";
    } else if (t === "image") {
      if (!b._cam) {
        b.innerHTML = '<div class="cam"><span class="rec"></span><img alt=""><span class="ts"></span></div>';
        b._cam = true;
      }
      $(".rec", b).textContent = (d.live ? "LIVE · " : "") + (w.title || w.id);
      $(".ts", b).textContent = d.frame ? new Date(d.frame * 1000).toLocaleTimeString([], { hour12: false }) : "";
      if (d.frame && d.frame !== b._frame && !document.body.classList.contains("private")) {
        b._frame = d.frame;
        var img = new Image();
        img.onload = function () { var cur = $("img", b); if (cur) cur.src = img.src; };
        img.src = d.src + "?token=" + encodeURIComponent(TOKEN) + "&f=" + d.frame;
      }
      return finish(el, w);
    } else if (t === "media") {
      el.classList.toggle("media", true); el.classList.toggle("paused", d.status !== "Playing");
      html = '<div class="eq"><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="ti">' + esc(d.title) + '</div><div class="ar">' + esc(d.artist || d.player) + '</div><div class="bar"><i style="width:' + (d.len ? (100 * d.pos / d.len).toFixed(1) : 0) + '%"></i></div>';
    } else if (t === "chart") {
      html = '<canvas class="spark" style="height:5rem"></canvas>';
    } else {   // text, typed out when it changes
      var full = String(d.text || "");
      var ty = typed[w.id] || (typed[w.id] = { full: "", shown: 0 });
      if (ty.full !== full) { ty.full = full; ty.shown = 0; }
      if (!b._text) { b.innerHTML = '<div class="text"></div>'; b._text = true; }
      return finish(el, w);
    }
    setHTML(b, html);
    var cv = $("canvas.spark", b);
    if (cv && t === "stat") spark(cv, [{ v: d.history, c: COL.accent }], { n: 90 });
    if (cv && t === "chart") spark(cv, (d.series || []).map(function (s, i) { return { v: s.values || s.v || s, c: [COL.accent, COL.accent2, COL.ok, COL.warn][i % 4] }; }), {});
    return finish(el, w);
  }
  function finish(el, w) {
    if (w.click && !el._click) {   // a panel with click = "..." in pulse.toml runs that command
      el._click = true; el.classList.add("clickable");
      el.addEventListener("click", function () {
        fetch("/api/click/" + encodeURIComponent(w.id) + "?token=" + encodeURIComponent(TOKEN), { method: "POST" });
        el.classList.add("pressed"); setTimeout(function () { el.classList.remove("pressed"); }, 300);
      });
    }
    el.classList.toggle("warn", w.level === "warn");
    el.classList.toggle("crit", w.level === "crit");
    el.classList.toggle("private", !!w.private);
    setHTML(el.querySelector(".corner"), w.updated && w.type !== "image" ? ago(w.updated) === "now" ? "" : ago(w.updated) : "");
    setHTML(el.querySelector(".err"), w.error ? "⚠ " + esc(w.error) : "");
    return el;
  }
  // typing animation for text panels
  setInterval(function () {
    if (covered) return;
    Object.keys(typed).forEach(function (id) {
      var ty = typed[id], el = panels[id];
      if (!el) return;
      var box = el.querySelector(".text");
      if (!box) return;
      if (ty.shown >= ty.full.length && box._h) return;
      if (ty.shown < ty.full.length) { ty.shown = Math.min(ty.full.length, ty.shown + 3); }
      var html = esc(ty.full.slice(0, ty.shown)) + '<span class="cur"></span>';
      if (box._h !== html) { box.innerHTML = html; box._h = html; }
    });
  }, 40);

  function place(col, list) {
    var want = list.filter(Boolean);
    var cur = Array.prototype.slice.call(col.children);
    var same = cur.length === want.length && cur.every(function (e, i) { return e === want[i]; });
    if (!same) want.forEach(function (e) { col.appendChild(e); });
    cur.forEach(function (e) { if (want.indexOf(e) < 0) col.removeChild(e); });
  }

  // a panel that does not fit in its column is hidden, never cut in half
  function fit(col) {
    var bottom = col.getBoundingClientRect().bottom, hid = false;
    Array.prototype.forEach.call(col.children, function (e) {
      e.style.visibility = "";
      if (hid || e.getBoundingClientRect().bottom > bottom + 1) { e.style.visibility = "hidden"; hid = true; }
    });
  }
  var lastNote = null;
  function render() {
    if (!S) return;
    var s = S.sys || {}, h = S.hist || {};
    applyTheme(S.theme);
    var fnt = (S.ui && S.ui.font) || "";
    if (fnt !== document.body._font) { document.body._font = fnt; if (fnt) document.documentElement.style.setProperty("--font", "'" + fnt.replace(/'/g, "") + "', var(--font-base)"); else document.documentElement.style.removeProperty("--font"); }
    document.body.classList.toggle("private", !!S.privacy);
    $("#badge").textContent = "◉ PRIVACY" + (S.screencast ? " · screen shared" : "");
    var left = [], right = [], center = [], ticker = [];
    var ui = S.ui || {};
    if (s.cpu != null && ui.system !== false) left.push(sysPanel(s, h));
    if (s.cpu != null && ui.network !== false) left.push(netPanel(s, h));
    if (S.weather) right.push(weatherPanel(S.weather));
    var ws = (S.widgets || []).slice().sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
    var nl = 2, nr = 1;
    ws.forEach(function (w) {
      if (w.slot === "ticker") { ticker.push(w); return; }
      var slot = w.slot;
      if (!slot || slot === "auto") {
        slot = w.type === "image" || w.type === "status" ? "right" : w.type === "text" ? "center" : nl <= nr ? "left" : "right";
      }
      var el = generic(w);
      if (slot === "left") { left.push(el); nl++; } else if (slot === "center") center.push(el); else { right.push(el); nr++; }
    });
    place($("#left"), left); place($("#right"), right); place($("#center-w"), center);
    fit($("#left")); fit($("#right")); fit($("#center-w"));
    clock();
    document.body.classList.toggle("blink");
    Array.prototype.forEach.call(document.querySelectorAll(".media .eq i"), function (i) { i.style.height = (15 + Math.random() * 85).toFixed(0) + "%"; });
    tickerUpdate(ticker);
    alerts();
    digest();
    var m = (S.mons || {})[MONKEY] || null;
    Scene.mode(m, S);
    document.body.classList.toggle("focus", !!S.focus);
    // a new notification or news item: a shooting star
    var nt = (S.widgets || []).filter(function (x) { return x.id === "notifications" || x.id === "news"; })
      .map(function (x) { return ((x.data || {}).items || [])[0] ? x.data.items[0].title : ""; }).join("|");
    if (lastNote !== null && nt !== lastNote) Scene.shoot();
    lastNote = nt;
  }

  // ------------------------------------------------------------------ clock
  var DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  function week(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  function clock() {
    var d = new Date(), h = d.getHours(), ui = (S && S.ui) || {};
    if (ui.clock === "12h") h = h % 12 || 12;
    var hm = (h < 10 ? "0" : "") + h + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
    var hme = $("#clock .hm"); if (hme.textContent !== hm) hme.textContent = hm;
    $("#clock .ss").textContent = (d.getSeconds() < 10 ? "0" : "") + d.getSeconds();
    $("#clock .secbar i").style.width = (d.getSeconds() / 59 * 100).toFixed(1) + "%";
    setHTML($("#clock .date"), DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " · W" + week(d));
    if (S && S.focus) {
      var left = Math.max(0, S.focus.until - Date.now() / 1000), mm = Math.floor(left / 60), ss2 = Math.floor(left % 60);
      setHTML($("#clock .who"), "<b>FOCUS</b> · " + esc(S.focus.label || "") + " · " + mm + ":" + (ss2 < 10 ? "0" : "") + ss2 + " left");
      $("#clock .secbar i").style.width = (100 * (1 - left / Math.max(1, S.focus.until - S.focus.start))).toFixed(1) + "%";
    } else if (S && S.sys) {
      var t = S.theme && S.theme.name ? S.theme.name : "omarchy";
      setHTML($("#clock .who"), esc(S.sys.user || "") + "@" + esc(S.sys.host || "") + " · <b>" + esc(t) + "</b> · up " + upt(S.sys.uptime) +
        (ui.title ? '<span class="title">' + esc(ui.title) + "</span>" : ""));
    }
  }
  setInterval(function () { if (fails && !covered) clock(); }, 1000);   // render() ticks the clock while the hub answers

  // ------------------------------------------------------------------ ticker
  function tickerUpdate(ws) {
    var items = [];
    ws.forEach(function (w) {
      var d = w.data || {};
      if (d.items) d.items.forEach(function (it) { items.push({ t: (w.title && w.title !== w.id && w.id !== "ticker" ? w.title + " · " : "") + it.title + (it.text ? " · " + it.text : ""), l: it.level }); });
      else if (d.text) items.push({ t: (w.title || w.id) + " · " + String(d.text).split("\n")[0], l: w.level });
      else if (d.value != null) items.push({ t: (w.title || w.id) + " " + num(d.value) + " " + (d.unit || ""), l: w.level });
    });
    (S.alerts || []).slice(-3).forEach(function (a) { if (Date.now() / 1000 - a.t < 3600) items.push({ t: a.title + " · " + a.text + " · " + ago(a.t), l: a.level }); });
    var w = S.weather;
    if (w && !w.error) items.push({ t: (w.city || "") + " " + Math.round(w.temp) + w.unit + " " + (WX[w.code] || "") + " · sunset " + w.sunset });
    if (S.sys && S.sys.host) items.push({ t: "omarchy pulse · " + (S.widgets || []).length + " live sources" });
    tickItems = items;
  }
  // one headline at a time, every 6 seconds (a scrolling marquee would repaint the screen 60 times a second)
  var tickItems = [], tickIdx = -1;
  setInterval(function () {
    if (covered) return;
    if (!tickItems.length) return;
    var tr = $("#ticker .track");
    tickIdx = (tickIdx + 1) % tickItems.length;
    var it = tickItems[tickIdx];
    tr.innerHTML = '<span class="it ' + (it.l || "") + '">' + esc(it.t) + '</span><span class="count">' + (tickIdx + 1) + "/" + tickItems.length + "</span>";
  }, 6000);

  // ------------------------------------------------------------------ INCOMING
  var incT = null;
  function alerts() {
    var list = S.alerts || [];
    if (seenAlert < 0) { seenAlert = list.length ? list[list.length - 1].seq : 0; return; }   // not the old ones at start
    var fresh = list.filter(function (a) { return a.seq > seenAlert; });
    if (!fresh.length) return;
    var a = fresh[fresh.length - 1];
    seenAlert = a.seq;
    Scene.alert(a.level);
    if (!PRIMARY) return;
    var box = $("#incoming");
    box.className = a.level;
    box.hidden = false;
    $(".frame", box).style.animation = "none"; void box.offsetWidth; $(".frame", box).style.animation = "";
    decrypt($(".title", box), a.title || "");
    $(".text", box).textContent = S.privacy ? "" : (a.text || "");
    clearTimeout(incT);
    incT = setTimeout(function () { box.hidden = true; }, 7000);
  }
  // ------------------------------------------------------------------ while you were away
  var seenDigest = 0;
  function digest() {
    var d = S.digest;
    if (!d || d.seq <= seenDigest) return;
    seenDigest = d.seq;
    if (Date.now() / 1000 - d.until > 120 || covered) return;
    var box = $("#digest");
    if (!box) {
      box = document.createElement("div"); box.id = "digest"; box.hidden = true; document.body.appendChild(box);
      box.addEventListener("click", function () { box.hidden = true; });
    }
    var h = Math.floor(d.mins / 60), mm = d.mins % 60;
    var icon = { alert: "▲", agent: "✓", news: "✦", notifications: "●" };
    var lines = (d.lines || []).map(function (l) {
      return '<li class="' + esc(l.level || "info") + '"><i>' + (icon[l.kind] || "·") + "</i>" + esc(l.text) + "</li>";
    }).join("") || '<li class="ok"><i>✓</i>all quiet</li>';
    if (d.more) lines += '<li class="dim"><i>+</i>' + d.more + " more</li>";
    setTimeout(function () {
      box.innerHTML = '<div class="frame"><div class="tag">◂ WHILE YOU WERE AWAY · ' + (h ? h + "h " : "") + mm + ' min</div><ul>' + lines + "</ul></div>";
      box.hidden = false;
      clearTimeout(box._t); box._t = setTimeout(function () { box.hidden = true; }, 40000);
    }, 2200);   // first the face wakes up
  }
  function decrypt(el, txt) {
    var glyph = "█▓▒░<>/\\|#$%&*+=?01", n = 0;
    var iv = setInterval(function () {
      n += 1;
      var out = "";
      for (var i = 0; i < txt.length; i++) out += i < n / 1.6 || txt[i] === " " ? txt[i] : glyph[Math.random() * glyph.length | 0];
      el.textContent = out;
      if (n / 1.6 >= txt.length) clearInterval(iv);
    }, 28);
  }

  // ------------------------------------------------------------------ the scene
  function sunPhase(w) {
    if (!w || !w.sunrise || !w.sunset) return "night";
    var d = new Date(), now = d.getHours() * 60 + d.getMinutes();
    var mins = function (s) { var p = String(s).split(":"); return +p[0] * 60 + +p[1]; };
    var rise = mins(w.sunrise), set = mins(w.sunset);
    if (Math.abs(now - rise) <= 40) return "dawn";
    if (Math.abs(now - set) <= 40) return "dusk";
    return now > rise && now < set ? "day" : "night";
  }
  function fxText(txt) {
    var el = $("#fxtext");
    if (!el) { el = document.createElement("div"); el.id = "fxtext"; document.body.appendChild(el); }
    el.textContent = txt; el.className = "on";
    clearTimeout(el._t); el._t = setTimeout(function () { el.className = ""; }, 3800);
  }
  var Scene = (function () {
    var cv = $("#scene"), g = cv.getContext("2d");
    var W = 0, H = 0, SC = +Q.get("q") || 0.5, last = 0, t0 = performance.now();
    var stars = [], drops = [], spikes = [], far = [], heights = [], rings = [], ridge = [];
    var beatAt = 0, beatEnv = 0, flash = 0, alertEnv = 0, alertCol = null;
    var fps = 30, paused = false, kind = "skyline", wx = "clear", day = 0;
    var cpu = 10, cores = [], ram = 40, net = 0, band = [0, 0];
    var audio = [], audioT = 0, bass = 0, mid = 0, music = false;          // cava bars, when something plays
    var agents = [], drones = {}, face = "agents", typing = false;        // AI agents: drones and the face
    var parts = [], rockets = [], fxOn = true, flashFx = 0;                            // fireworks
    var focus = null, sunOn = true, phase = "night", phaseKey = "";       // focus mode, the sun
    var shooting = [], camImg = null, newsText = "", weatherNow = null, clockStr = "", ledStyle = false;
    var gaze = { x: 0, y: 0 }, cursorXY = null, cursorAt = -1e9, eyesOn = true, deskEmpty = true;   // the eyes follow you
    var away = false, wakeAt = -1e9, lan = [], carsOn = true, privacyOn = false, newAt = {};             // sleep; cars = your network
    var tex = document.createElement("canvas"), tg = tex.getContext("2d", { willReadFrequently: true }), TW = 192, TH = 96, texData = null;
    var TX = 2;   // the texture is painted in 192x96 units on a 384x192 canvas: sharper letters on the sphere
    tex.width = TW * TX; tex.height = TH * TX;
    if (window.PULSE_DEBUG) window.__pulseTex = tex;
    var rnd = function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

    function resize() {
      var r = (Q.get("q") ? (window.devicePixelRatio || 1) : Math.min(1, window.devicePixelRatio || 1)) * SC;
      W = Math.max(320, innerWidth * r | 0); H = Math.max(200, innerHeight * r | 0);
      cv.width = W; cv.height = H;
      var R = rnd(42);
      stars = []; for (var i = 0; i < 130; i++) stars.push([R() * W, R() * H * 0.62, R(), 0.3 + R() * 1.1]);
      far = []; var x = 0; while (x < W) { var bw = W * (0.012 + R() * 0.03); far.push([x, bw, H * (0.03 + R() * 0.12)]); x += bw + W * 0.002; }
      drops = []; for (i = 0; i < 180; i++) drops.push([R() * W, R() * H, 0.6 + R() * 0.8]);
      ridge = []; var a1 = R() * 6, a2r = R() * 6;
      for (i = 0; i <= 64; i++) { var u = i / 64; ridge.push(0.5 + 0.28 * Math.sin(u * 7.1 + a1) + 0.16 * Math.sin(u * 17.3 + a2r) + 0.08 * Math.sin(u * 41 + a1 * 2)); }
      // the free band between the side columns, where the skyline stands
      var l = $("#left").getBoundingClientRect(), rr = $("#right").getBoundingClientRect();
      band = [(l.right + 30) * r, (rr.left - 30) * r];
      if (!(band[1] - band[0] > W * 0.25)) band = [W * 0.08, W * 0.92];
      paintStatic();
    }
    // what never moves is painted once: sky, floor, the far ridge and the far city
    var bgc = document.createElement("canvas");
    function paintStatic() {
      if (!COL.bg) return;
      bgc.width = W; bgc.height = H;
      var b = bgc.getContext("2d"), hz = H * 0.745, cx = W / 2, bg = COL.bg, a2 = COL.accent2, i;
      var sky = b.createLinearGradient(0, 0, 0, hz);
      // the sky follows the real sun: night, a warm dawn and dusk, a (still dark enough to read) day
      var top = mix(bg, [0, 0, 0], 0.35), midc = mix(bg, a2, 0.10), low = mix(bg, a2, 0.28);
      if (phase === "day") { top = mix(bg, COL.accent, 0.16); midc = mix(bg, COL.accent, 0.24); low = mix(mix(bg, COL.fg, 0.22), a2, 0.2); }
      else if (phase === "dawn" || phase === "dusk") { top = mix(bg, [20, 10, 40], 0.4); midc = mix(bg, a2, 0.22); low = mix(mix(bg, COL.warn, 0.45), a2, 0.35); }
      sky.addColorStop(0, rgba(top, 1));
      sky.addColorStop(0.7, rgba(midc, 1));
      sky.addColorStop(1, rgba(low, 1));
      b.fillStyle = sky; b.fillRect(0, 0, W, hz + 1);
      var fl = b.createLinearGradient(0, hz, 0, H);
      fl.addColorStop(0, rgba(mix(bg, a2, 0.2), 1)); fl.addColorStop(1, rgba(mix(bg, [0, 0, 0], 0.5), 1));
      b.fillStyle = fl; b.fillRect(0, hz, W, H - hz);
      b.beginPath(); b.moveTo(0, hz);
      for (i = 0; i < ridge.length; i++) b.lineTo(i / (ridge.length - 1) * W, hz - H * (0.025 + 0.085 * ridge[i]) * (0.55 + 0.45 * Math.abs(i / (ridge.length - 1) - 0.5) * 2));
      b.lineTo(W, hz); b.closePath();
      b.fillStyle = rgba(mix(bg, a2, 0.13), 1); b.fill();
      b.strokeStyle = rgba(a2, 0.35); b.lineWidth = Math.max(1, H / 900); b.stroke();
      var R = H * (kind === "sphere" ? 0.18 : 0.15);
      b.fillStyle = rgba(mix(bg, a2, 0.18), 1);
      for (i = 0; i < far.length; i++) { var f = far[i]; if (kind !== "sphere" && f[0] + f[1] > cx - R * 1.1 && f[0] < cx + R * 1.1) continue; b.fillRect(f[0], hz - f[2], f[1], f[2]); }
    }
    function reset() { resize(); }

    function beat(now) {
      var bpm = 46 + cpu * 0.95;
      if ((now - beatAt) / 1000 > 60 / bpm) {
        beatAt = now;
        spikes.push({ born: now, col: null, amp: 0.6 + cpu / 140 });
      }
      beatEnv = Math.exp(-(now - beatAt) / 160);
    }
    function gauss(u, s) { return Math.exp(-(u * u) / (2 * s * s)); }
    function ecg(u) {   // one heartbeat, u in "beat widths" from the spike centre
      return -0.12 * gauss(u + 0.075, 0.018) + 1.0 * gauss(u, 0.011) - 0.32 * gauss(u - 0.024, 0.012) + 0.18 * gauss(u - 0.12, 0.035);
    }

    function avg(a, i, j) { var s = 0, n = 0; for (var k = i; k < j && k < a.length; k++) { s += a[k]; n++; } return n ? s / n / 100 : 0; }
    function pick(list) { return list[(Math.random() * list.length) | 0]; }

    // ---------------- fireworks: rockets from the floor, sparks with gravity, added light
    function launch(x, y, big) {
      var cols = [COL.accent, COL.accent2, COL.ok, COL.warn, COL.fg];
      rockets.push({ x: x, y: H * 0.95, vx: (Math.random() - 0.5) * W * 0.0008, vy: -H * (0.024 + Math.random() * 0.006), ty: y,
        col: pick(cols), col2: pick(cols), big: big });
    }
    function burst(x, y, col, col2, n, spd) {
      flashFx = Math.max(flashFx, 0.5);
      for (var i = 0; i < n; i++) {   // a sphere of sparks: even speeds on a ring, a few faster ones
        var a = Math.random() * Math.PI * 2, v = spd * (Math.random() < 0.8 ? 0.85 + Math.random() * 0.15 : 0.3 + Math.random() * 0.5);
        parts.push({ x: x, y: y, px: x, py: y, ppx: x, ppy: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1,
          col: i % 3 ? col : col2, dec: 0.008 + Math.random() * 0.008, tw: Math.random() < 0.3 });
      }
    }
    function fireworks(small, kind2) {
      var hz = H * 0.745, n = kind2 === "burst" ? 0 : small ? 4 : 11;
      if (kind2 === "burst") { burst(W / 2, hz - H * 0.18, COL.ok, COL.fg, 70, H * 0.006); return; }
      for (var i = 0; i < n; i++) (function (i) {
        setTimeout(function () { launch(band[0] + Math.random() * (band[1] - band[0]), H * (0.08 + Math.random() * 0.2), !small || i % 2 === 0); }, i * (small ? 300 : 280));
      })(i);
    }
    function drawFireworks() {
      if (!rockets.length && !parts.length) return;
      g.globalCompositeOperation = "lighter";
      var grav = H * 0.00018, keep = [];
      for (var i = 0; i < rockets.length; i++) {
        var r = rockets[i];
        r.x += r.vx; r.y += r.vy; r.vy += grav * 0.6;
        var rg = g.createLinearGradient(r.x, r.y, r.x - r.vx * 8, r.y - r.vy * 8);   // the rocket and its trail
        rg.addColorStop(0, rgba(COL.fg, 1)); rg.addColorStop(1, rgba(r.col, 0));
        g.strokeStyle = rg; g.lineWidth = Math.max(1.5, H / 350); g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - r.vx * 8, r.y - r.vy * 8); g.stroke();
        if (r.y <= r.ty || r.vy >= 0) burst(r.x, r.y, r.col, r.col2, r.big ? 140 : 80, H * (r.big ? 0.0105 : 0.0075));
        else keep.push(r);
      }
      rockets = keep; keep = [];
      g.lineWidth = Math.max(1.2, H / 420);
      for (i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.ppx = p.px; p.ppy = p.py; p.px = p.x; p.py = p.y;
        p.x += p.vx; p.y += p.vy; p.vx *= 0.975; p.vy = p.vy * 0.975 + grav; p.life -= p.dec;
        if (p.life <= 0) continue;
        var al = Math.min(1, p.life * 1.4) * (p.tw && p.life < 0.5 ? (Math.random() < 0.5 ? 1 : 0.2) : 1);   // some sparks glitter
        g.strokeStyle = rgba(mix(p.col, COL.fg, p.life > 0.8 ? 0.6 : 0), al);
        g.beginPath(); g.moveTo(p.ppx, p.ppy); g.lineTo(p.x, p.y); g.stroke();
        keep.push(p);
      }
      if (flashFx > 0.02) { g.fillStyle = rgba(COL.fg, flashFx * 0.06); g.fillRect(0, 0, W, H); flashFx *= 0.85; }   // the sky lights up
      parts = keep;
      g.globalCompositeOperation = "source-over";
    }

    // ---------------- the agent's face: an orb with eyes, original and simple
    function mainAgent() {
      var order = { waiting: 5, failed: 4, working: 3, done: 2, idle: 1 }, best = null;
      agents.forEach(function (a) { if (!best || (order[a.state] || 0) > (order[best.state] || 0)) best = a; });
      return best;
    }
    function watching() {   // you move the pointer on an empty desktop: the face looks at you
      return eyesOn && face !== "off" && deskEmpty && cursorXY && performance.now() - cursorAt < 6000 &&
        cursorXY[0] >= 0 && cursorXY[1] >= 0 && cursorXY[0] <= innerWidth && cursorXY[1] <= innerHeight;
    }
    function faceMood(t) {
      var a = mainAgent();
      if (away && face !== "off") return "sleep";
      if (face !== "off" && performance.now() - wakeAt < 2600) return "wake";
      if (typing) return "talk";
      if (!a) return face === "always" || watching() ? "idle" : null;
      return { working: "think", waiting: "alert", done: "happy", failed: "sad", idle: "idle" }[a.state] || "idle";
    }
    function drawFace(c, x, y, s, mood, t, col, fixed) {
      var ec = col, eyeW = s * 0.17, eyeH = s * 0.3, gap = s * 0.26, lookX = 0, lookY = 0;
      if (mood === "think") { lookX = Math.sin(t * 1.3) * s * 0.05; lookY = -s * 0.05; }
      if (mood !== "sleep" && mood !== "sad") { lookX += gaze.x * s * 0.15; lookY += gaze.y * s * 0.1; }   // at your pointer
      var blink = mood === "idle" || mood === "think" ? ((t % 4.2) < 0.13 ? 0.12 : 1) : 1;
      if (mood === "wake") blink = Math.min(1, Math.max(0.1, (performance.now() - wakeAt) / 1100));
      if (mood === "alert") { eyeW *= 1.15; eyeH *= 1.2; if (!fixed) ec = COL.warn; }
      if (mood === "sad" && !fixed) ec = COL.crit;
      c.fillStyle = rgba(ec, 0.95); c.strokeStyle = rgba(ec, 0.95); c.lineWidth = Math.max(1.5, s * 0.07); c.lineCap = "round";
      [-1, 1].forEach(function (side) {
        var ex = x + side * gap + lookX, ey = y - s * 0.08 + lookY;
        if (mood === "happy") { c.beginPath(); c.arc(ex, ey + s * 0.06, eyeW * 0.9, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        else if (mood === "sleep") { c.beginPath(); c.arc(ex, ey - s * 0.03, eyeW * 0.75, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
        else if (mood === "sad") { c.beginPath(); c.moveTo(ex - eyeW * 0.7, ey - eyeW * 0.7); c.lineTo(ex + eyeW * 0.7, ey + eyeW * 0.7); c.moveTo(ex + eyeW * 0.7, ey - eyeW * 0.7); c.lineTo(ex - eyeW * 0.7, ey + eyeW * 0.7); c.stroke(); }
        else {
          var h = eyeH * blink, r = Math.min(eyeW, h) / 2;
          c.beginPath();
          if (c.roundRect) c.roundRect(ex - eyeW / 2, ey - h / 2, eyeW, h, r); else c.rect(ex - eyeW / 2, ey - h / 2, eyeW, h);
          c.fill();
        }
        if (mood === "alert") { c.beginPath(); c.moveTo(ex - eyeW * 0.8, ey - eyeH * 0.85); c.lineTo(ex + eyeW * 0.6, ey - eyeH * 1.0); c.stroke(); }
      });
      var my = y + s * 0.26;
      if (mood === "sleep") {   // asleep: a small mouth, and z z z drifting up
        c.beginPath(); c.arc(x, my, s * 0.04, 0, Math.PI * 2); c.stroke();
        for (var zi = 0; zi < 3; zi++) {
          var zp = ((t * 0.35 + zi / 3) % 1), zs = s * (0.07 + zp * 0.09), zx = x + s * (0.42 + zp * 0.3), zy = y - s * (0.25 + zp * 0.55);
          c.globalAlpha = Math.sin(zp * Math.PI); c.beginPath();
          c.moveTo(zx, zy); c.lineTo(zx + zs, zy); c.lineTo(zx, zy + zs); c.lineTo(zx + zs, zy + zs); c.stroke();
        }
        c.globalAlpha = 1;
        return;
      }
      c.beginPath();
      if (mood === "happy" || mood === "wake") c.arc(x, my - s * 0.08, s * 0.16, Math.PI * 0.15, Math.PI * 0.85);
      else if (mood === "sad") c.arc(x, my + s * 0.08, s * 0.13, Math.PI * 1.2, Math.PI * 1.8);
      else if (mood === "alert") { c.arc(x, my, s * 0.06, 0, Math.PI * 2); }
      else if (mood === "talk") { var o = (0.3 + 0.7 * Math.abs(Math.sin(t * 9))) * s * 0.09; c.ellipse(x, my, s * 0.1, o, 0, 0, Math.PI * 2); c.fill(); return; }
      else { c.moveTo(x - s * 0.08, my); c.lineTo(x + s * 0.08, my); }
      c.stroke();
      if (mood === "think") {   // thinking dots
        for (var i = 0; i < 3; i++) { var on = ((t * 2.2 - i * 0.33) % 1 + 1) % 1 < 0.5; c.globalAlpha = on ? 1 : 0.3; c.beginPath(); c.arc(x + s * (0.55 + i * 0.13), y - s * 0.45 - i * s * 0.08, s * 0.035, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1;
      }
    }

    // ---------------- the LED sphere: a texture painted every frame, sampled by thousands of LEDs
    var progList = ["clock", "weather", "cpu", "news"], progI = 0, progAt = 0;
    function sphereProgram(t) {
      if (Q.get("prog")) return Q.get("prog");
      if (alertEnv > 0.25) return "alert";
      if (away && face !== "off") return "face";
      if (focus) return "focus";
      if (faceMood(t)) return "face";
      if (music) return "music";
      var list = camImg ? progList.concat(["camera"]) : progList;
      if (t - progAt > 11) { progAt = t; progI = (progI + 1) % list.length; }
      return list[progI % list.length];
    }
    function paintTex(prog, t, front) {
      var c = tg, ac = COL.accent, a2 = COL.accent2, fg = COL.fg, i;
      c.setTransform(TX, 0, 0, TX, 0, 0);
      // the sphere is a screen: a glowing base that turns with it, content on top
      var base = c.createLinearGradient(0, 0, 0, TH);
      var hot = prog === "alert" ? COL.crit : prog === "face" && faceMood(t) === "alert" ? COL.warn : null;
      base.addColorStop(0, rgba(hot || a2, 0.95)); base.addColorStop(0.5, rgba(hot || mix(a2, ac, 0.5), 0.8)); base.addColorStop(1, rgba(hot || ac, 0.95));
      c.fillStyle = "#000"; c.fillRect(0, 0, TW, TH);
      if (ledStyle) {   // the LED look: a dark screen, only what is drawn lights up
        if (hot) { c.fillStyle = rgba(hot, prog === "alert" ? 0.75 : 0.18); c.fillRect(0, 0, TW, TH); }
        c.fillStyle = rgba(ac, 0.22); c.fillRect(0, TH * 0.06, TW, 1); c.fillRect(0, TH * 0.93, TW, 1);
      } else {
      c.fillStyle = base; c.fillRect(0, 0, TW, TH);
      c.fillStyle = prog === "face" || prog === "alert" ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.16)";
      for (i = 0; i < TW; i += 24) c.fillRect(i, 0, 3, TH);          // faint stripes fixed to the sphere: you see it turn
      c.fillStyle = rgba(COL.fg, 0.5); c.fillRect(0, TH * 0.06, TW, 1); c.fillRect(0, TH * 0.93, TW, 1);
      if (prog === "music" || prog === "camera") { c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(0, 0, TW, TH); }
      }
      var fx = front + Math.sin(t * 0.25) * TW * 0.04;   // content gently sways around the front
      function at(fn) { fn(fx); fn(fx - TW); fn(fx + TW); }
      c.textAlign = "center"; c.textBaseline = "middle";
      var font = function (px, w) { return (w || 800) + " " + px + "px 'CaskaydiaMono Nerd Font', 'Cascadia Mono', monospace"; };
      c.lineJoin = "round"; c.strokeStyle = "rgba(0,0,0,0.85)";
      var txt2 = function (str, x, y, px, col, w) { c.font = font(px, w); c.lineWidth = Math.max(2, px / 8); c.strokeText(str, x, y); c.fillStyle = rgba(col, 1); c.fillText(str, x, y); };
      if (prog === "clock") {
        at(function (x) { txt2(clockStr, x, TH * 0.47, 21, fg); txt2(new Date().toDateString().toUpperCase().slice(0, 10), x, TH * 0.74, 9, fg, 700); });
      } else if (prog === "weather") {
        var w = weatherNow;
        at(function (x) {
          c.fillStyle = rgba(COL.warn, 1); c.beginPath(); c.arc(x - 24, TH * 0.45, 11, 0, Math.PI * 2); c.fill();
          txt2(w ? Math.round(w.temp) + "°" : "--", x + 16, TH * 0.46, 30, fg); txt2(w ? String(w.city || "").toUpperCase() : "", x, TH * 0.78, 11, fg, 700); });
      } else if (prog === "cpu") {
        var hcpu = (S && S.hist && S.hist.cpu) || [];
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(0, TH * 0.4, TW, TH * 0.5);
        c.fillStyle = rgba(fg, 0.95);
        for (i = 0; i < TW; i++) { var v = hcpu.length ? hcpu[Math.floor(i / TW * hcpu.length)] || 0 : 0; var hh = Math.max(1, v / 100 * TH * 0.45); c.fillRect(i, TH * 0.88 - hh, 1, hh); }
        at(function (x) { txt2("CPU " + Math.round(cpu) + "%", x, TH * 0.3, 22, fg); });
      } else if (prog === "news") {
        c.textAlign = "left"; c.font = font(24);
        var txt = (newsText || "omarchy pulse") + "   ◆   ", w2 = c.measureText(txt).width || 1, off = (t * 26) % w2;
        for (var x2 = -off; x2 < TW + w2; x2 += w2) txt2(txt, x2, TH * 0.5, 24, fg);
        c.textAlign = "center";
      } else if (prog === "music") {
        var nb = audio.length || 1;
        for (i = 0; i < TW; i += 4) {
          var k = Math.floor(Math.abs(((i / TW) * 2 - 1)) * (nb - 1)), v2 = (audio[k] || 0) / 100;
          var hh2 = v2 * TH * 0.42;
          c.fillStyle = rgba(mix(ac, a2, i / TW), 1); c.fillRect(i, TH / 2 - hh2, 3, hh2 * 2);
        }
      } else if (prog === "alert") {
        var pulse = 0.55 + 0.45 * Math.sin(t * 8);
        c.fillStyle = rgba(COL.crit, 0.55 * pulse + 0.2); c.fillRect(0, 0, TW, TH);
        at(function (x) { txt2("!", x, TH * 0.52, 56, fg); });
      } else if (prog === "focus") {
        var left = Math.max(0, focus.until - Date.now() / 1000), tot = Math.max(1, focus.until - focus.start);
        var mm = Math.floor(left / 60), ss = Math.floor(left % 60);
        c.fillStyle = rgba(ac, 0.85); c.fillRect(0, TH * 0.86, TW * (1 - left / tot), TH * 0.06);
        at(function (x) { txt2((mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss, x, TH * 0.44, 32, fg);
          txt2("FOCUS · " + String(focus.label || "").toUpperCase().slice(0, 14), x, TH * 0.72, 11, fg, 700); });
      } else if (prog === "face") {
        at(function (x) { if (ledStyle) drawFace(c, x, TH * 0.5, TH * 0.6, faceMood(t), t, COL.warn); else drawFace(c, x, TH * 0.5, TH * 0.6, faceMood(t), t, [8, 8, 14], true); });
      } else if (prog === "camera" && camImg) {
        c.globalCompositeOperation = "lighter";   // night cameras are dark: twice as bright on the sphere
        at(function (x) { try { c.drawImage(camImg, x - TH * 0.9, TH * 0.12, TH * 1.8, TH * 0.76); c.drawImage(camImg, x - TH * 0.9, TH * 0.12, TH * 1.8, TH * 0.76); } catch (e) {} });
        c.globalCompositeOperation = "source-over";
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      try { texData = c.getImageData(0, 0, TW * TX, TH * TX).data; } catch (e) { texData = null; }
    }
    // Every pixel of the sphere looks up its spot on the texture: a continuous image, as from across the street,
    // with the fine LED grid, darker edges (the curve), a halo in the colours on screen, its reflection on the
    // wet plaza and its light on the city. The map is computed once per size; each frame only reads colours.
    var sph = document.createElement("canvas"), sg = sph.getContext("2d"), sImg = null, sMap = null, sD = 0;
    var avgCol = [0, 0, 0];
    function sphereMap(D) {
      sD = D; sph.width = sph.height = D; sImg = sg.createImageData(D, D);
      var R = D / 2, n = D * D, ROWS = Math.max(40, Math.round(D / 2.6));
      sMap = { v: new Int32Array(n), lam: new Float32Array(n), k: new Float32Array(n), cos: new Float32Array(n), a: new Uint8Array(n) };
      for (var y = 0; y < D; y++) for (var x = 0; x < D; x++) {
        var i = y * D + x, nx = (x + 0.5 - R) / R, ny = (y + 0.5 - R) / R, r2 = nx * nx + ny * ny;
        if (r2 >= 1) { sMap.v[i] = -1; continue; }
        var nz = Math.sqrt(1 - r2), phi = Math.asin(-ny);
        var vRow = (0.5 - phi / Math.PI) * TH * TX;
        sMap.v[i] = Math.min(TH * TX - 1, Math.max(0, vRow | 0));
        sMap.lam[i] = Math.atan2(nx, nz);
        sMap.cos[i] = Math.cos(phi);
        var rowF = ((0.5 - phi / Math.PI) * ROWS) % 1;                    // between two rows of LEDs: darker
        var grid = 0.62 + 0.38 * Math.pow(Math.sin(rowF * Math.PI), 0.6);
        var limb = 0.5 + 0.5 * Math.pow(nz, 0.45);                         // the curve: a little dimmer toward the edge
        var rim = 1 + 0.25 * Math.pow(1 - nz, 3);                           // light gathers at the rim, like on glass
        sMap.k[i] = grid * limb * rim;
        var rr = Math.sqrt(r2);                                             // the edge fades into the sky: no outline
        sMap.a[i] = rr > 0.93 ? Math.max(0, Math.min(255, (1 - rr) / 0.07 * 255)) : 255;
      }
    }
    var LED = null;
    function ledGrid() {
      LED = [];
      for (var i = 0, nLat = 46; i < nLat; i++) {
        var phi = -Math.PI / 2 + (i + 0.5) / nLat * Math.PI, n = Math.max(6, Math.round(Math.cos(phi) * 116));
        for (var j = 0; j < n; j++) LED.push([phi, j / n * Math.PI * 2]);
      }
    }
    function drawSphereLeds(cx, cy, R, t, rot) {
      if (!LED) ledGrid();
      var halo = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.9);
      halo.addColorStop(0, rgba(alertEnv > 0.25 ? COL.crit : COL.accent2, 0.28 + 0.2 * beatEnv + 0.25 * bass)); halo.addColorStop(1, rgba(COL.accent2, 0));
      g.fillStyle = halo; g.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = rgba(mix(COL.bg, [0, 0, 0], 0.4), 1); g.fill();
      var dot = Math.max(1, R * 0.03), lift = 1 + 0.5 * bass, TWp = TW * TX, td = texData;
      for (var i = 0; i < LED.length; i++) {
        var phi = LED[i][0], lam = LED[i][1], cp = Math.cos(phi);
        var z = cp * Math.cos(lam);
        if (z < 0.02) continue;
        var uu = (lam + rot) / (Math.PI * 2); uu -= Math.floor(uu);
        var sx = cx + cp * Math.sin(lam) * R, sy = cy - Math.sin(phi) * R;
        var o = ((Math.min(TH * TX - 1, ((0.5 - phi / Math.PI) * TH * TX) | 0)) * TWp + ((uu * TWp) | 0)) * 4;
        var r = td ? td[o] : 0, gg = td ? td[o + 1] : 0, b = td ? td[o + 2] : 0;
        var lum2 = (r + gg + b) / 765, shade = 0.35 + 0.65 * z, sz = dot * (0.55 + 0.45 * z);
        g.fillStyle = lum2 < 0.05 ? rgba(COL.dim, 0.22 * shade)
          : "rgba(" + (r * shade * lift | 0) + "," + (gg * shade * lift | 0) + "," + (b * shade * lift | 0) + "," + Math.min(1, 0.4 + lum2) + ")";
        g.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      }
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.strokeStyle = rgba(COL.accent, 0.3); g.lineWidth = Math.max(1, H / 700); g.stroke();
    }
    function drawSphere(cx, cy, R, t) {
      var D = Math.max(16, Math.round(R * 2));
      if (D !== sD) sphereMap(D);
      var rot = t * 0.2 + (music ? bass * 0.35 : 0);
      var front = (((rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * TW;   // what faces you
      var prog = sphereProgram(t);
      paintTex(prog, t, front);
      if (ledStyle) { drawSphereLeds(cx, cy, R, t, rot); return; }
      var d = sImg.data, td = texData, TWp = TW * TX, lift = 1 + 0.45 * bass, sr = 0, sgc = 0, sb = 0, cnt = 0;
      var cols = TWp / 2;   // LED columns around the sphere
      var bgR = COL.bg[0] * 0.6, bgG = COL.bg[1] * 0.6, bgB = COL.bg[2] * 0.6;   // dark LEDs take the night's colour
      for (var i = 0, n = D * D; i < n; i++) {
        var o = i * 4, v = sMap.v[i];
        if (v < 0) { d[o + 3] = 0; continue; }
        var uu = (sMap.lam[i] + rot) / (Math.PI * 2);
        uu = uu - Math.floor(uu);
        var u = (uu * TWp) | 0, ti = (v * TWp + u) * 4;
        var colF = (uu * cols * sMap.cos[i]) % 1;                           // between two columns: darker
        var k = sMap.k[i] * (0.7 + 0.3 * Math.pow(Math.sin(colF * Math.PI), 0.5)) * lift;
        var r = td ? td[ti] : 0, gg = td ? td[ti + 1] : 0, b = td ? td[ti + 2] : 0;
        d[o] = Math.min(255, r * k + bgR); d[o + 1] = Math.min(255, gg * k + bgG); d[o + 2] = Math.min(255, b * k + bgB); d[o + 3] = sMap.a[i];
        if ((i & 15) === 0) { sr += r; sgc += gg; sb += b; cnt++; }
      }
      sg.putImageData(sImg, 0, 0);
      if (cnt) avgCol = [sr / cnt | 0, sgc / cnt | 0, sb / cnt | 0];
      // light on the plaza and the city, in the colour on screen
      var hz = H * 0.745;
      var spill = g.createRadialGradient(cx, hz, R * 0.3, cx, hz, R * 3.2);
      spill.addColorStop(0, rgba(avgCol, 0.38)); spill.addColorStop(1, rgba(avgCol, 0));
      g.globalCompositeOperation = "lighter";
      g.fillStyle = spill; g.fillRect(cx - R * 3.2, hz - R * 3.2, R * 6.4, R * 6.4);
      // the glow it throws into the wet night air, wide and soft: it belongs to the sky, not stuck on it
      var hk = 0.34 + 0.2 * beatEnv + 0.18 * bass;
      var halo = g.createRadialGradient(cx, cy, R * 0.75, cx, cy, R * 2.3);
      halo.addColorStop(0, rgba(avgCol, hk)); halo.addColorStop(0.35, rgba(avgCol, hk * 0.45));
      halo.addColorStop(0.7, rgba(avgCol, hk * 0.12)); halo.addColorStop(1, rgba(avgCol, 0));
      g.fillStyle = halo; g.fillRect(cx - R * 2.3, cy - R * 2.3, R * 4.6, R * 4.6);
      // where it touches the plaza: a pool of its own light
      var pool = g.createRadialGradient(cx, hz, 0, cx, hz, R * 1.1);
      pool.addColorStop(0, rgba(avgCol, 0.5)); pool.addColorStop(1, rgba(avgCol, 0));
      g.save(); g.translate(cx, hz); g.scale(1, 0.16); g.translate(-cx, -hz);
      g.fillStyle = pool; g.fillRect(cx - R * 1.1, hz - R * 1.1, R * 2.2, R * 2.2); g.restore();
      g.globalCompositeOperation = "source-over";
      g.drawImage(sph, cx - R, cy - R, R * 2, R * 2);
      // a thin rim of light on the outline, blending the curve into the halo
      g.globalCompositeOperation = "lighter";
      var rimG = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.06);
      rimG.addColorStop(0, rgba(avgCol, 0)); rimG.addColorStop(0.7, rgba(mix(avgCol, COL.fg, 0.3), 0.22)); rimG.addColorStop(1, rgba(avgCol, 0));
      g.fillStyle = rimG; g.fillRect(cx - R * 1.06, cy - R * 1.06, R * 2.12, R * 2.12);
      g.globalCompositeOperation = "source-over";
      // its reflection on the wet floor
      g.save(); g.beginPath(); g.rect(cx - R * 1.2, hz, R * 2.4, R * 1.3); g.clip();
      g.globalAlpha = 0.2; g.translate(0, hz * 2 + R * 0.08); g.scale(1, -1);
      g.drawImage(sph, cx - R, cy - R, R * 2, R * 2); g.restore(); g.globalAlpha = 1;
    }

    // ---------------- drones: one per agent, flying over the city, landing when done
    var dronesEl = null;
    function drawDrones(t, hz) {
      if (!dronesEl) { dronesEl = document.createElement("div"); dronesEl.id = "drones"; document.body.appendChild(dronesEl); }
      var seen = {}, sx = innerWidth / W, half = (band[1] - band[0]) / 2, mx = (band[0] + band[1]) / 2;
      agents.forEach(function (a, idx) {
        var d = drones[a.name];
        if (!d) {
          d = drones[a.name] = { ph: Object.keys(drones).length * 2.4 + Math.random() * 0.6, sp: 0.7 + Math.random() * 0.5, land: 0, el: document.createElement("div") };   // spread out
          d.el.className = "drone"; dronesEl.appendChild(d.el);
        }
        seen[a.name] = 1;
        var down = a.state === "done" || a.state === "failed";
        d.land = Math.min(1, Math.max(0, d.land + (down ? 0.012 : -0.03)));
        var x = mx + half * 0.82 * Math.sin(t * 0.11 * d.sp + d.ph);
        var y0 = H * (0.5 + 0.035 * Math.sin(t * 0.23 * d.sp + d.ph * 1.7)) + (idx % 3) * H * 0.045;
        var y = y0 + (hz - H * 0.04 - y0) * (d.land * d.land);
        var tilt = Math.cos(t * 0.11 * d.sp + d.ph) * 0.18, s = H * 0.042;
        var col = { working: COL.accent, waiting: COL.warn, done: COL.ok, failed: COL.crit, idle: COL.dim }[a.state] || COL.accent;
        var blinkOn = a.state !== "waiting" || (t * 2.5 % 1) < 0.55;
        // beam: a working drone scans the city
        if (a.state === "working" || a.state === "waiting") {
          var sw = Math.sin(t * 1.6 + d.ph) * s * 1.4;
          var bmg = g.createLinearGradient(0, y, 0, hz);
          bmg.addColorStop(0, rgba(col, a.state === "waiting" && !blinkOn ? 0.08 : 0.32)); bmg.addColorStop(1, rgba(col, 0));
          g.fillStyle = bmg; g.beginPath(); g.moveTo(x - s * 0.25, y + s * 0.25); g.lineTo(x + s * 0.25, y + s * 0.25);
          g.lineTo(x + s * 1.9 + sw, hz); g.lineTo(x - s * 1.9 + sw, hz); g.closePath(); g.fill();
        }
        g.save(); g.translate(x, y); g.rotate(tilt);
        // glow around it, in the colour of its state
        g.globalCompositeOperation = "lighter";
        var gl = g.createRadialGradient(0, 0, 0, 0, 0, s * 2.2);
        gl.addColorStop(0, rgba(col, blinkOn ? 0.45 : 0.15)); gl.addColorStop(1, rgba(col, 0));
        g.fillStyle = gl; g.fillRect(-s * 2.2, -s * 2.2, s * 4.4, s * 4.4);
        g.globalCompositeOperation = "source-over";
        // a quadcopter seen slightly from below: four arms, four spinning rotors
        var arms = [[-1.25, -0.42, 0.9], [1.25, -0.42, 0.9], [-1.05, 0.22, 1], [1.05, 0.22, 1]];
        g.lineCap = "round";
        arms.forEach(function (ar) {
          g.strokeStyle = rgba(mix(COL.bg, COL.fg, 0.55), 1); g.lineWidth = Math.max(1.5, s * 0.12);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(ar[0] * s, ar[1] * s); g.stroke();
          var spin = (0.55 + 0.45 * Math.abs(Math.sin(t * 37 + ar[0] * 3))) * s * 0.62 * ar[2];
          g.beginPath(); g.ellipse(ar[0] * s, ar[1] * s - s * 0.08, spin, spin * 0.22, 0, 0, Math.PI * 2);
          g.fillStyle = rgba(COL.fg, 0.12); g.fill(); g.strokeStyle = rgba(COL.fg, 0.6); g.lineWidth = Math.max(1, s * 0.05); g.stroke();
        });
        g.fillStyle = rgba(mix(COL.bg, COL.fg, 0.35), 1);
        g.beginPath(); g.ellipse(0, 0, s * 0.62, s * 0.3, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = rgba(col, 0.95); g.lineWidth = Math.max(1, s * 0.07); g.stroke();
        g.fillStyle = rgba(col, blinkOn ? 1 : 0.3); g.beginPath(); g.arc(0, s * 0.12, s * 0.16, 0, Math.PI * 2); g.fill();   // its eye
        if ((t * 1.3 + d.ph) % 1 < 0.15) {   // navigation lights
          g.fillStyle = rgba(COL.crit, 1); g.fillRect(-s * 1.32, -s * 0.5, s * 0.14, s * 0.14);
          g.fillStyle = rgba(COL.ok, 1); g.fillRect(s * 1.18, -s * 0.5, s * 0.14, s * 0.14);
        }
        g.restore();
        if (d.land > 0.95 && !d.boom) { d.boom = 1; burst(x, y, col, COL.fg, 40, H * 0.004); }
        if (!down) d.boom = 0;
        var mins = Math.max(0, Math.floor((Date.now() / 1000 - (a.since || a.t)) / 60));
        var html = '<i style="background:' + rgba(col, 1) + '"></i>' + esc(a.name) + (a.text ? ' <span>' + esc(a.text) + "</span>" : "") +
          (a.state === "working" && mins ? ' <b>' + mins + "m</b>" : "") + (a.state === "waiting" ? " <b>!</b>" : "");
        if (d.el._h !== html) { d.el.innerHTML = html; d.el._h = html; }
        d.el.style.transform = "translate(" + (x * sx | 0) + "px," + ((y + s * 0.9) * sx | 0) + "px) translateX(-50%)";
        d.el.className = "drone " + a.state;
      });
      Object.keys(drones).forEach(function (n) { if (!seen[n]) { drones[n].el.remove(); delete drones[n]; } });
    }
    // ---------------- your network: every device is a car on the grid (light trails), a new one blinks
    function drawCars(t, hz) {
      if (!carsOn || !lan.length || kind === "calm") return;
      var cx = W / 2, n = Math.min(lan.length, 14);
      g.globalCompositeOperation = "lighter";
      for (var i = 0; i < n; i++) {
        var d = lan[i], h = ((d.id || i) * 2654435761 % 4294967296) / 4294967296;
        var sign = i % 2 ? 1 : -1, lane = sign * (1.5 + ((i >> 1) % 8) * 1.0 + (h > 0.5 ? 1 : 0));
        var toward = d["new"] || ((d.id || i) % 3) !== 0;
        var sp = 0.03 + h * 0.035 + bass * 0.05;
        var p = (t * sp + h * 7) % 1; if (!toward) p = 1 - p;
        if (d["new"]) {   // a new device drives in from the horizon, toward you, again and again
          if (newAt[d.id] == null) newAt[d.id] = t;
          p = ((t - newAt[d.id]) * 0.11) % 1;
        }
        var pos = function (pp) { var f = Math.pow(pp, 2.2); return [cx + lane * W * (0.012 + 0.098 * f), hz + (H - hz) * f, f]; };
        var a = pos(p), b = pos(toward ? Math.max(0, p - 0.06) : Math.min(1, p + 0.06)), f = a[2];
        var lw = W * (0.012 + 0.098 * f), sz = H * (0.0018 + 0.009 * f);
        var col = d["new"] ? COL.warn : toward ? mix(COL.fg, COL.accent, 0.25) : COL.accent2;
        var on = !d["new"] || (t * 3 % 1) < 0.6, al = Math.min(1, f * 10) * (on ? 1 : 0.35);
        [-0.22, 0.22].forEach(function (o) {
          var x = a[0] + o * lw, x2 = b[0] + o * W * (0.012 + 0.098 * b[2]);
          var tr = g.createLinearGradient(x, a[1], x2, b[1]);
          tr.addColorStop(0, rgba(col, 0.55 * al)); tr.addColorStop(1, rgba(col, 0));
          g.strokeStyle = tr; g.lineWidth = sz * 0.9; g.beginPath(); g.moveTo(x, a[1]); g.lineTo(x2, b[1]); g.stroke();
          var gl = g.createRadialGradient(x, a[1], 0, x, a[1], sz * 3.2);
          gl.addColorStop(0, rgba(mix(col, COL.fg, 0.5), al)); gl.addColorStop(0.3, rgba(col, 0.5 * al)); gl.addColorStop(1, rgba(col, 0));
          g.fillStyle = gl; g.fillRect(x - sz * 3.2, a[1] - sz * 3.2, sz * 6.4, sz * 6.4);
        });
        if (!privacyOn && f > 0.12 && f < 0.92 && (d["new"] || d.name)) {
          g.globalCompositeOperation = "source-over";
          g.font = "600 " + Math.round(H * (0.009 + f * 0.007)) + "px 'CaskaydiaMono Nerd Font', 'Cascadia Mono', monospace";
          g.textAlign = "center"; g.fillStyle = rgba(d["new"] ? COL.warn : COL.fg, (d["new"] ? 0.95 : 0.5) * Math.min(1, (0.92 - f) * 6));
          g.fillText(d["new"] ? "new · " + d.ip : d.name, a[0], a[1] - sz * 3.4);
          g.globalCompositeOperation = "lighter";
        }
      }
      g.globalCompositeOperation = "source-over";
    }
    function drawShooting() {
      var keep = [];
      for (var i = 0; i < shooting.length; i++) {
        var sh = shooting[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.02;
        if (sh.life <= 0) continue;
        var gr = g.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 12, sh.y - sh.vy * 12);
        gr.addColorStop(0, rgba(COL.fg, sh.life)); gr.addColorStop(1, rgba(COL.fg, 0));
        g.strokeStyle = gr; g.lineWidth = Math.max(1, H / 600); g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(sh.x - sh.vx * 12, sh.y - sh.vy * 12); g.stroke();
        keep.push(sh);
      }
      shooting = keep;
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      var hz = H * 0.745, cx = W / 2;
      var bg = COL.bg, ac = COL.accent, a2 = COL.accent2;
      music = audio.length > 0 && now - audioT < 800;
      bass = music ? bass * 0.6 + avg(audio, 0, 4) * 0.4 : bass * 0.9;
      mid = music ? avg(audio, 6, 16) : 0;
      if (music && bass > 0.55) beatEnv = Math.max(beatEnv, bass);
      g.drawImage(bgc, 0, 0);
      // the eyes: towards the pointer while it moves, then slowly back to the middle
      var gx = 0, gy = 0;
      if (eyesOn && cursorXY && now - cursorAt < 15000) {
        var fyy = kind === "skyline" || kind === "calm" ? hz - H * 0.09 : hz - H * 0.16;
        gx = (cursorXY[0] * W / innerWidth - cx) / (H * 0.45); gy = (cursorXY[1] * H / innerHeight - fyy) / (H * 0.45);
        var gl2 = Math.sqrt(gx * gx + gy * gy); if (gl2 > 1) { gx /= gl2; gy /= gl2; }
      }
      gaze.x += (gx - gaze.x) * 0.18; gaze.y += (gy - gaze.y) * 0.18;
      // stars (fewer when it is cloudy, none by day)
      var starA = phase === "day" ? 0.1 : phase !== "night" ? 0.45 : wx === "clear" || wx === "part" ? 1 : 0.35;
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i], tw = 0.5 + 0.5 * Math.sin(t * st[3] * 2 + st[2] * 40);
        g.fillStyle = rgba(COL.fg, (0.15 + 0.6 * tw * st[2]) * starA);
        var ss = Math.max(1, H / 1080 * (st[2] > 0.9 ? 2.4 : 1.3));
        g.fillRect(st[0], st[1], ss, ss);
      }
      // aurora = network traffic
      var na = Math.max(Math.min(1, Math.log10(1 + net) / 7.5), mid * 0.9);
      g.globalCompositeOperation = "lighter";
      for (var k = 0; k < 2; k++) {
        var col = k ? a2 : ac, base = H * (0.16 + k * 0.09);
        g.beginPath();
        for (var x = 0; x <= W; x += 14) {
          var y = base + Math.sin(x * 0.004 + t * (0.25 + k * 0.1) + k * 2) * H * 0.04 + Math.sin(x * 0.011 - t * 0.4) * H * 0.015;
          if (x) g.lineTo(x, y); else g.moveTo(x, y);
        }
        for (x = W; x >= 0; x -= 14) {
          var y2 = base + H * (0.07 + 0.05 * na) + Math.sin(x * 0.003 + t * 0.2 + k) * H * 0.03;
          g.lineTo(x, y2);
        }
        g.closePath();
        var ag = g.createLinearGradient(0, base - H * 0.05, 0, base + H * 0.14);
        ag.addColorStop(0, rgba(col, 0)); ag.addColorStop(0.45, rgba(col, 0.05 + 0.13 * na)); ag.addColorStop(1, rgba(col, 0));
        g.fillStyle = ag; g.fill();
      }
      g.globalCompositeOperation = "source-over";

      drawShooting();
      // the core: a wireframe sphere rising on the horizon, beating with the load (or the LED sphere)
      var R = H * (kind === "orbit" ? 0.15 : kind === "sphere" ? 0.165 : 0.135) * (1 + (kind === "sphere" ? 0.012 : 0.035) * beatEnv);
      var cy = kind === "orbit" ? hz - R * 1.02 : kind === "sphere" ? hz - R * 0.97 : hz;
      if (kind !== "sphere") {
      var glow = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
      glow.addColorStop(0, rgba(alertEnv > 0.05 && alertCol ? alertCol : a2, 0.30 + 0.25 * beatEnv));
      glow.addColorStop(1, rgba(a2, 0));
      g.fillStyle = glow; g.fillRect(cx - R * 2.5, cy - R * 2.5, R * 5, R * 2.5 + (kind === "orbit" ? R * 2.5 : 1));
      g.save();
      g.beginPath(); g.rect(0, 0, W, kind === "orbit" ? H : hz); g.clip();
      var body = g.createLinearGradient(0, cy - R, 0, cy + R);
      body.addColorStop(0, rgba(mix(bg, a2, 0.55), 1)); body.addColorStop(1, rgba(mix(bg, ac, 0.25), 1));
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = body; g.fill();
      g.lineWidth = Math.max(1, H / 700);
      g.strokeStyle = rgba(ac, 0.55);
      for (var la = -3; la <= 3; la++) {   // latitudes
        var yy = cy + (la / 4) * R, rx = Math.sqrt(Math.max(0, R * R - (yy - cy) * (yy - cy)));
        g.beginPath(); g.ellipse(cx, yy, rx, rx * 0.08, 0, 0, Math.PI * 2); g.stroke();
      }
      for (var mer = 0; mer < 6; mer++) {   // turning meridians
        var ph = (mer / 6) * Math.PI + t * (0.12 + cpu / 600);
        var ex = Math.abs(Math.cos(ph)) * R;
        g.beginPath(); g.ellipse(cx, cy, ex, R, 0, 0, Math.PI * 2); g.strokeStyle = rgba(ac, 0.18 + 0.4 * Math.abs(Math.sin(ph))); g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.strokeStyle = rgba(ac, 0.9); g.lineWidth = Math.max(1.5, H / 420); g.stroke();
      var mood = faceMood(t);   // the agent lives in the core
      if (mood) drawFace(g, cx, kind === "orbit" ? cy : cy - R * 0.45, R * (kind === "orbit" ? 0.9 : 0.55), mood, t, COL.fg);
      g.restore();
      }

      if (kind !== "sphere" && focus) {   // focus: the time left as a ring around the core
        var leftF = Math.max(0, focus.until - Date.now() / 1000) / Math.max(1, focus.until - focus.start);
        g.beginPath(); g.arc(cx, cy, R * 1.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftF); g.strokeStyle = rgba(a2, 0.9); g.lineWidth = Math.max(2, H / 250); g.stroke();
      }
      if (kind === "orbit") {
        // every core is a moon on its ring
        var n = Math.min(cores.length, 16);
        for (i = 0; i < n; i++) {
          var rr = R * (1.25 + i * 0.09), sp = 0.1 + (cores[i] || 0) / 160;
          rings[i] = (rings[i] || i * 1.7) + sp / Math.max(1, fps);
          g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.28, -0.25, 0, Math.PI * 2); g.strokeStyle = rgba(ac, 0.12 + (cores[i] || 0) / 400); g.lineWidth = Math.max(1, H / 1080); g.stroke();
          var ang = rings[i], px = cx + Math.cos(ang) * rr * Math.cos(-0.25) - Math.sin(ang) * rr * 0.28 * Math.sin(-0.25),
            py = cy + Math.cos(ang) * rr * Math.sin(-0.25) + Math.sin(ang) * rr * 0.28 * Math.cos(-0.25);
          var front = Math.sin(ang) > 0;
          g.fillStyle = rgba((cores[i] || 0) > 85 ? COL.crit : front ? ac : a2, front ? 0.95 : 0.4);
          g.beginPath(); g.arc(px, py, Math.max(1.5, H / 300) * (front ? 1.4 : 0.9), 0, Math.PI * 2); g.fill();
        }
      } else {
        // far city (still), then the skyline: one tower per CPU core, its lit windows follow the RAM
        var nc = Math.min(Math.max(cores.length, 8), 32), side = Math.ceil(nc / 2);
        var inner = R * (kind === "sphere" ? 1.08 : 1.18), outer = Math.min(cx - band[0], band[1] - cx);
        var slot = Math.max(4, (outer - inner) / side), bw = slot * 0.74;
        for (i = 0; i < nc; i++) {
          var load = cores.length ? cores[i % cores.length] || 0 : cpu;
          if (music) load = Math.min(100, load * 0.4 + (audio[Math.min(audio.length - 1, (i / 2) | 0)] || 0) * 0.9);   // the city dances
          heights[i] = (heights[i] == null ? load : heights[i] + (load - heights[i]) * (music ? 0.35 : 0.06));
          var hh = H * 0.035 + (heights[i] / 100) * H * 0.2 + ((i * 37) % 11) / 11 * H * 0.03;
          var s2 = i % 2 ? 1 : -1, idx = (i / 2) | 0;
          var bx = s2 > 0 ? cx + inner + idx * slot : cx - inner - idx * slot - bw;
          var tg = g.createLinearGradient(0, hz - hh, 0, hz);
          tg.addColorStop(0, rgba(mix(bg, ac, 0.16), 1)); tg.addColorStop(1, rgba(mix(bg, [0, 0, 0], 0.3), 1));
          g.fillStyle = tg; g.fillRect(bx, hz - hh, bw, hh);
          g.fillStyle = rgba(heights[i] > 90 ? COL.crit : ac, 0.85); g.fillRect(bx, hz - hh, bw, Math.max(1, H / 600));
          // windows
          var cw = Math.max(2, bw / 5), chh = Math.max(2, H / 140), cols = Math.max(1, Math.floor((bw - cw) / (cw * 1.7))), rows = Math.floor((hh - chh * 2) / (chh * 2.2));
          for (var ry = 0; ry < rows; ry++) for (var cxi = 0; cxi < cols; cxi++) {
            var hsh = ((i * 7919 + ry * 104729 + cxi * 1299709) % 1000) / 1000;
            if (hsh < ram / 100 * 0.75) {
              var flick = ((t * 0.07 + hsh * 13) % 1) > 0.985 ? 0.2 : 1;
              g.fillStyle = rgba(hsh < 0.12 ? a2 : hsh < 0.5 ? ac : COL.warn, (0.35 + hsh * 0.5) * flick);
              g.fillRect(bx + cw * 0.7 + cxi * cw * 1.7, hz - hh + chh * 2 + ry * chh * 2.2, cw, chh);
            }
          }
          if (heights[i] > 90 && (t * 2 % 1) < 0.5) { g.fillStyle = rgba(COL.crit, 1); g.fillRect(bx + bw / 2 - 1, hz - hh - H / 90, 2, 2); }
        }
      }

      if (kind === "sphere") drawSphere(cx, cy, R, t);
      drawDrones(t, hz);
      // floor: the grid runs toward you as fast as the CPU works (and with the bass)
      var speed = paused || kind === "calm" ? 0 : 0.08 + cpu / 160 + bass * 0.9;
      var off = (t * speed) % 1;
      g.lineWidth = Math.max(1, H / 1080);
      for (k = 0; k < 18; k++) {
        var p = (k + off) / 18, yh = hz + (H - hz) * Math.pow(p, 2.2);
        g.strokeStyle = rgba(ac, 0.05 + 0.45 * p); g.beginPath(); g.moveTo(0, yh); g.lineTo(W, yh); g.stroke();
      }
      for (k = -24; k <= 24; k++) {
        g.strokeStyle = rgba(ac, 0.18 - Math.abs(k) * 0.005);
        g.beginPath(); g.moveTo(cx + k * W * 0.012, hz); g.lineTo(cx + k * W * 0.11, H); g.stroke();
      }
      drawCars(t, hz);
      // reflection of the core on the floor
      var rf = g.createRadialGradient(cx, hz, 0, cx, hz, R * 1.6);
      rf.addColorStop(0, rgba(a2, 0.22 + 0.2 * beatEnv)); rf.addColorStop(1, rgba(a2, 0));
      g.fillStyle = rf; g.fillRect(cx - R * 1.6, hz, R * 3.2, R * 1.2);

      // the horizon is your pulse: every beat leaves the core and runs to both edges
      var alive = [];
      var path = [];
      for (x = 0; x <= W; x += 3) {
        var dx = Math.abs(x - cx) / W, yv = 0;
        for (var si = 0; si < spikes.length; si++) {
          var sp2 = spikes[si], age = (now - sp2.born) / 1000, d = age * 0.32;
          var fade = Math.max(0, 1 - age / 1.8);
          if (fade <= 0) continue;
          yv += ecg(dx - d) * sp2.amp * fade;
        }
        if (music) { var bi = Math.min(audio.length - 1, (dx * 2 * audio.length) | 0); yv += (audio[bi] || 0) / 100 * 0.5 * (1 - dx); }
        path.push(hz - 1 - yv * H * 0.06);
      }
      for (i = 0; i < spikes.length; i++) if ((now - spikes[i].born) / 1000 < 1.8) alive.push(spikes[i]);
      spikes = alive;
      var lc = alertEnv > 0.05 && alertCol ? mix(ac, alertCol, Math.min(1, alertEnv * 1.5)) : ac;
      [[7, 0.06], [3.5, 0.16], [1.6, 0.95]].forEach(function (pass) {
        g.beginPath();
        for (var j = 0; j < path.length; j++) { if (j) g.lineTo(j * 3, path[j]); else g.moveTo(0, path[j]); }
        g.lineWidth = pass[0] * H / 1080 * 1.6; g.strokeStyle = rgba(lc, pass[1]); g.stroke();
      });

      // weather from the real sky
      if (wx === "rain" || wx === "storm") {
        g.strokeStyle = rgba(COL.fg, 0.22); g.lineWidth = 1; g.beginPath();
        for (i = 0; i < drops.length; i++) {
          var dr = drops[i]; dr[1] += H * 0.022 * dr[2]; dr[0] -= H * 0.004 * dr[2];
          if (dr[1] > H) { dr[1] = -10; dr[0] = Math.random() * W * 1.1; }
          g.moveTo(dr[0], dr[1]); g.lineTo(dr[0] + H * 0.004, dr[1] - H * 0.018 * dr[2]);
        }
        g.stroke();
      } else if (wx === "snow") {
        g.fillStyle = rgba(COL.fg, 0.6);
        for (i = 0; i < drops.length; i++) {
          var sn = drops[i]; sn[1] += H * 0.0018 * sn[2]; sn[0] += Math.sin(t + i) * 0.3;
          if (sn[1] > H) { sn[1] = -5; sn[0] = Math.random() * W; }
          g.fillRect(sn[0], sn[1], 2, 2);
        }
      } else if (wx === "fog") {
        var fgz = g.createLinearGradient(0, hz - H * 0.15, 0, hz + H * 0.1);
        fgz.addColorStop(0, rgba(COL.fg, 0)); fgz.addColorStop(0.6, rgba(COL.fg, 0.08)); fgz.addColorStop(1, rgba(COL.fg, 0));
        g.fillStyle = fgz; g.fillRect(0, hz - H * 0.15, W, H * 0.25);
      }
      if (wx === "storm" && Math.random() < 0.004) flash = 1;
      if (flash > 0.02) { g.fillStyle = rgba(COL.fg, flash * 0.16); g.fillRect(0, 0, W, H); flash *= 0.8; }
      drawFireworks();
      // an alert: a shockwave from the core
      if (alertEnv > 0.02 && alertCol) {
        var ar = R * (1 + (1 - alertEnv) * 6);
        g.beginPath(); g.ellipse(cx, hz, ar, ar * 0.3, 0, 0, Math.PI * 2); g.strokeStyle = rgba(alertCol, alertEnv * 0.8); g.lineWidth = 2; g.stroke();
        alertEnv *= 0.975;
      }
    }

    // a PC that cannot keep up (no GPU, software rendering) gets fewer frames instead of a busy CPU
    var cap = 60, slow = 0, gap = 0, frameId = null;
    // frame pacing: how long a frame takes to reach the screen vs how long it takes to draw (omarchy-pulse perf)
    var pf = { n: 0, cost: 0, gap: 0, max: 0, t: 0, prev: 0 }, pbound = false, pbAt = 0;
    function perfReport(now) {
      var n = Math.max(1, pf.n), avgCost = pf.cost / n, avgGap = pf.n > 1 ? pf.gap / (pf.n - 1) : 0;
      var want = Math.min(Math.max(fps, 1), cap);
      // most of the time is spent after draw(): copying and presenting the frame, not drawing it
      pbound = pf.n > 3 && avgGap > 80 && avgGap > 1.4 * 1000 / want && avgCost < avgGap / 8;
      if (pbound) { cap = Math.max(2, Math.min(cap, Math.round(450 / avgGap))); pbAt = now; }   // fewer frames: the CPU calms down
      else if (pbAt && now - pbAt > 60000) { cap = 60; pbAt = 0; }   // try full speed again now and then
      var body = { mon: MONKEY, scene: kind, fps: +(pf.n / ((now - pf.t) / 1000)).toFixed(1), want: want, cap: cap,
        draw: +avgCost.toFixed(1), gap: +avgGap.toFixed(0), maxGap: +pf.max.toFixed(0), bound: pbound,
        w: Math.round(innerWidth * (window.devicePixelRatio || 1)), h: Math.round(innerHeight * (window.devicePixelRatio || 1)),
        canvas: W + "x" + H };
      pf = { n: 0, cost: 0, gap: 0, max: 0, t: now, prev: 0 };
      try { fetch("/api/perf?token=" + encodeURIComponent(TOKEN), { method: "POST", body: JSON.stringify(body) }).catch(function () {}); } catch (e) {}
    }
    function frame(now) {
      frameId = null;
      if (covered) return;
      frameId = requestAnimationFrame(frame);
      if (paused && last) return;
      var want = Math.min(Math.max(fps, (parts.length || rockets.length || music) && !paused ? 24 : 0), cap);
      if (now - last < 1000 / want - 2) return;
      if (last) gap = gap * 0.9 + (now - last) * 0.1;
      last = now;
      beat(now);
      var a = performance.now();
      try { draw(now); } catch (e) { if (window.PULSE_DEBUG && !frame._err) { frame._err = 1; console.error("draw: " + e + " " + (e.stack || "")); } }   // never stop the wallpaper for one bad frame
      var cost = performance.now() - a;
      if ((cost > 22 || gap > 1.7 * 1000 / want) && want > 6) { if (++slow > 60) { cap = Math.max(6, Math.round(want * 0.7)); slow = 0; gap = 0; } }
      else slow = Math.max(0, slow - 1);
      if (!pf.t) pf.t = now;
      pf.n++; pf.cost += cost;
      if (pf.prev) { var fg = now - pf.prev; pf.gap += fg; if (fg > pf.max) pf.max = fg; }
      pf.prev = now;
      if (now - pf.t > 5000) perfReport(now);
    }

    return {
      start: function () { if (!COL.bg) applyTheme(null); resize(); addEventListener("resize", resize); frameId = requestAnimationFrame(frame); },
      reset: reset,
      audio: function (a) { audio = a || []; audioT = performance.now(); },
      cursor: function (x, y) {
        if (cursorXY && Math.abs(cursorXY[0] - x) < 1 && Math.abs(cursorXY[1] - y) < 1) return;
        cursorXY = [x, y]; cursorAt = performance.now();
      },
      fx: function (f) {
        if (f.kind === "shooting") { shooting.push({ x: Math.random() * W * 0.6, y: H * 0.05, vx: W * 0.012, vy: H * 0.006, life: 1 }); return; }
        if (fxOn || f.kind !== "burst") fireworks(!!f.small, f.kind);
        if (f.text) fxText(f.text);
      },
      shoot: function () { shooting.push({ x: W * (0.1 + Math.random() * 0.5), y: H * (0.04 + Math.random() * 0.12), vx: W * (0.008 + Math.random() * 0.006), vy: H * 0.005, life: 1 }); },
      setCovered: function (value) {
        if (covered === value) return;
        covered = value;
        document.body.classList.toggle("suspended", covered);
        if (covered && frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
        else if (!covered && frameId === null) { last = 0; gap = 0; frameId = requestAnimationFrame(frame); }
      },
      mode: function (m, st) {
        var ui = st.ui || {};
        kind = window.PULSE_SCENE || Q.get("scene") || ui.scene || "skyline";
        var sys = st.sys || {};
        cpu = sys.cpu || 0; cores = sys.cores || []; ram = sys.ram || 0; net = (sys.rx || 0) + (sys.tx || 0);
        var w = st.weather;
        wx = Q.get("wx") || (w && !w.error ? wxKind(w.code) : "clear"); day = w ? w.day : 0;
        typing = Object.keys(typed).some(function (id) { return typed[id].shown < typed[id].full.length; });
        ledStyle = (window.PULSE_SPHERE || Q.get("sphere") || ui.sphere) === "led";
        agents = st.agents || []; face = ui.face || "agents"; fxOn = ui.fireworks !== false; focus = st.focus || null;
        if (away && !st.away) wakeAt = performance.now();
        away = !!st.away; lan = st.lan || []; carsOn = ui.cars !== false; eyesOn = ui.eyes !== false; privacyOn = !!st.privacy;
        deskEmpty = !(m && m.windows > 0);
        weatherNow = w && !w.error ? w : null; sunOn = ui.sun !== false;
        var ph = sunOn ? sunPhase(w) : "night";
        if (ph + kind !== phaseKey) { phaseKey = ph + kind; phase = ph; paintStatic(); }
        var nw = (st.widgets || []).filter(function (x) { return x.id === "news" || x.id === "ai"; })[0];
        newsText = nw && nw.data ? (nw.data.items && nw.data.items[0] ? nw.data.items[0].title : String(nw.data.text || "").split("\n")[0]) : "";
        var cam = (st.widgets || []).filter(function (x) { return x.type === "image" && x.data && x.data.frame; })[0];
        if (cam && !st.privacy && cam.data.frame !== (camImg && camImg._f)) { var im = new Image(); im._f = cam.data.frame; im.onload = function () { camImg = im; }; im.src = cam.data.src + "?token=" + encodeURIComponent(TOKEN) + "&f=" + cam.data.frame; }
        if (st.privacy) camImg = null;
        var dd = new Date(); clockStr = (dd.getHours() < 10 ? "0" : "") + dd.getHours() + ":" + (dd.getMinutes() < 10 ? "0" : "") + dd.getMinutes();
        var full = !!(m && m.fullscreen), busy = !!(m && m.windows > 0 && ui.dim_with_windows !== false);
        var bat = sys.bat && sys.bat.status === "Discharging";
        fps = full ? 1 : busy ? 8 : Math.min(+Q.get("fps") || +ui.fps || 20, bat ? 12 : 60);
        if (kind === "calm") fps = Math.min(fps, 10);
        if (away) fps = Math.min(fps, 8);   // nobody is looking: save power
        paused = full;
        document.body.classList.toggle("busy", busy);
        document.body.classList.toggle("calm", kind === "calm");
      },
      alert: function (level) { alertEnv = 1; alertCol = level === "crit" ? COL.crit : COL.warn; spikes.push({ born: performance.now(), amp: 1.6, col: alertCol }); }
    };
  })();

  // ------------------------------------------------------------------ data loop
  var fails = 0;
  function getJSON(path) {
    return fetch(path + "?token=" + encodeURIComponent(TOKEN), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Pulse hub unavailable");
      return r.json();
    });
  }
  function isCovered(data, enabled) {
    var m = (data.mons || {})[MONKEY];
    return enabled !== false && !!(m && m.covered);
  }
  function poll() {
    var request = covered ? getJSON("/api/visibility").then(function (v) {
      if (isCovered(v, v.pause_when_covered)) return null;
      return getJSON("/api/state");
    }) : getJSON("/api/state");
    request.then(function (j) {
      fails = 0;
      if (!j) return;
      if (isCovered(j, (j.ui || {}).pause_when_covered)) { Scene.setCovered(true); return; }
      S = j;
      try { render(); Scene.setCovered(false); } catch (e) { console.error(e); }
    }).catch(function () { fails++; }).then(function () { setTimeout(poll, fails ? Math.min(10000, 1000 * fails) : 1000); });
  }
  // music bars and effects as they happen
  function live() {
    if (!window.EventSource) return;
    var es = new EventSource("/api/live?fx=-1&token=" + encodeURIComponent(TOKEN));
    es.onmessage = function (e) {
      try {
        var d = JSON.parse(e.data);
        if (d.a) Scene.audio(d.a);
        if (d.c) Scene.cursor(d.c[0] - MX, d.c[1] - MY);   // the pointer, in this monitor's pixels
        (d.fx || []).forEach(function (f) { if (!covered) Scene.fx(f); });
      } catch (err) { /* ignore one bad message */ }
    };
  }
  addEventListener("mousemove", function (e) { Scene.cursor(e.clientX, e.clientY); }, { passive: true });
  if (Q.get("only") === "scene") document.body.classList.add("sceneonly");
  if (Q.get("dbg")) document.body.classList.add("dbg-" + Q.get("dbg"));
  applyTheme(null);
  Scene.start();
  clock();
  poll();
  live();
})();
