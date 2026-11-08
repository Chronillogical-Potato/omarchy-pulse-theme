# Creating scenes for Omarchy Pulse

A **scene** is a whole world on the wallpaper, drawn from your real data: a pond where every AI agent is a fish, a
garage where your agents are mechanics, a forest that grows with your commits, your own room. You write it in one
JavaScript file. You do not touch Pulse's engine: Pulse keeps the sky, the real weather, the planes, the effects and
all the panels, and gives your scene a read-only copy of the data. This guide is everything you need to make one,
try it and share it.

- [1. Your first scene in five minutes](#1-your-first-scene-in-five-minutes)
- [2. How a scene works](#2-how-a-scene-works)
- [3. What your scene gets: the state](#3-what-your-scene-gets-the-state)
- [4. Drawing: the canvas, the box, the horizon](#4-drawing-the-canvas-the-box-the-horizon)
- [5. Clicks](#5-clicks)
- [6. The scene lab](#6-the-scene-lab)
- [7. Rules for a scene in the repo](#7-rules-for-a-scene-in-the-repo)
- [8. Performance](#8-performance)
- [9. Safety: what a scene cannot do](#9-safety-what-a-scene-cannot-do)
- [10. Sharing your scene](#10-sharing-your-scene)
- [11. Recipes](#11-recipes)

---

## 1. Your first scene in five minutes

```bash
omarchy-pulse scene new lanterns         # creates ~/.config/omarchy-pulse/scenes/lanterns.js from a template
omarchy-pulse scene lab lanterns         # opens the scene lab in your browser
```

Open `~/.config/omarchy-pulse/scenes/lanterns.js` in your editor. Every time you save, the lab reloads it. The
template already draws one lantern per AI agent, coloured by its state. Change something, save, look.

When you like it, put it on your wallpaper:

```toml
# ~/.config/omarchy-pulse/pulse.toml
[pulse]
scene = "lanterns"
```

Pulse switches within a few seconds. Want to read a complete scene first? `extras/pulse/web/scenes/pond.js` (about
120 lines, commented) is the example that comes with Pulse.

## 2. How a scene works

```js
PulseScene.register("lanterns", {
  init: function (g, size) { },                 // once, and when the screen changes size
  update: function (state) { },                  // optional: every time new data arrives (about once a second)
  draw: function (g, t, state, box) { },         // every frame
  click: function (x, y, state) { return "a line of text"; }   // optional
});
```

- `g` is a 2D canvas context ([CanvasRenderingContext2D](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D)),
  already cleared and transparent at every frame.
- `t` is the time in seconds since the scene started: use it for anything that moves.
- `state` is the data (section 3). It is frozen: read it, do not change it.
- `box` is `{ w, h, horizon }` in pixels: the size of your canvas and the height of Pulse's horizon line.
- `this` inside every function is your scene object: keep your own memory there (`this.fish = {}` in `init`).

**Layers.** From back to front: Pulse's sky (gradient, sun, moon, stars, clouds, aurora, rain) → **your scene** →
the panels, the clock and the HTML on top. Leave the sky transparent if you want the real sky to show; paint it if
your world has its own. The weather rain and the planes are drawn by Pulse behind your scene: where you paint, they
are hidden.

With a community scene, Pulse does not draw its own world (towers, sphere, grid, drones, robots, cars): your scene is
the world. If you want Pulse's distant city silhouettes behind yours, register with `city: true` in the definition.

A scene that throws an error is not stopped: the error is shown in the lab and written once a minute in Pulse's log
(`scene lanterns: draw: ...`), and the next frame is tried again.

## 3. What your scene gets: the state

Everything is optional: always check before you use it (`(state.agents || [])`). Names are empty strings while the
user shares the screen or is in privacy mode: always draw something that works without the name.

| Field | What it is |
|---|---|
| `state.t` | now, in seconds (Unix time) |
| `state.demo` | true in the demo and in the lab |
| `state.privacy` | true while sharing the screen or in privacy mode (names are already empty) |
| `state.time` | `{ hour, minute, second, weekday, day, month, year }`, on the user's clock |
| `state.sys` | `{ cpu, cores: [..], ram, swap, gpu, temp, disk, rx, tx, load }`: percentages, °C, bytes a second |
| `state.agents` | `[{ name, state, since, text }]`: the AI agents. `state` is `idle`, `working`, `waiting` (needs the user), `done`, `failed`; `since` is when it started (Unix time) |
| `state.git` | `[{ name, branch, week, last, dirty, ci }]`: the repos. `week` = commits in 7 days, `last` = last commit time, `dirty` = changed files not committed, `ci` = `ok`, `run`, `fail` or `""` |
| `state.weather` | `{ code, temp, day, wind, windDir, cloud, rain }`: [WMO code](https://open-meteo.com/en/docs), °C (or °F), 1 by day, km/h, degrees, %, mm |
| `state.focus` | `{ start, until }` during a focus session, else null |
| `state.away` | the user is away from the PC |
| `state.meeting` | the user is in a meeting |
| `state.theme` | the Omarchy theme's colours as `#rrggbb`: `bg`, `fg`, `accent`, `accent2`, `ok`, `warn`, `crit`, `dim` |
| `state.ui` | `{ quality: "full" \| "half" \| "auto", motion: "full" \| "reduced", fps }` |
| `state.events` | the last effects: `[{ kind, text, t }]`, kinds such as `commit`, `push`, `fireworks`, `burst` (a CI back to green), `launch`, `quake`, `banner` |
| `state.season` | `xmas: { day, snow }` (8 Dec to 6 Jan), `newYear: { left, year, party }` (the last hour, and midnight), `eclipse: {...}` during an eclipse |
| `state.layout` | `{ horizon: 0.745 }`: Pulse's horizon as a fraction of the height |

What a scene never gets: the user's location or city, their network devices or addresses, the calendar, the
notifications, the cameras, the car, the token. That is on purpose: a scene can be installed from anyone.

React to an event only once: remember the last `t` you saw (see `pond.js`, `this.seen`).

## 4. Drawing: the canvas, the box, the horizon

- Your canvas is the whole screen, at the resolution Pulse chose (`quality`). Use `box.w` and `box.h`, never fixed
  pixels: the same scene runs on a laptop and on a 4K monitor. Sizes as fractions: `box.h * 0.02`.
- `box.horizon` is where Pulse's floor starts. The floor (below it) is yours; above it is the sky.
- The panels cover the left and right quarters of the screen and the clock the top middle: the part of your world
  people will see is the middle, from a bit above the horizon to the bottom.
- Colours: use the theme (`state.theme`), so your scene fits every Omarchy theme. A helper turns `#rrggbb` into
  `[r, g, b]` (see the template).

Helpers on `PulseScene`:

```js
PulseScene.rgba([255, 120, 0], 0.5)          // "rgba(255,120,0,0.5)"
PulseScene.mix([0, 0, 0], [255, 255, 255], 0.25)   // a colour between two
var r = PulseScene.rand(42); r(); r();       // a random generator with a seed: the same world every time
```

## 5. Clicks

When the user clicks the desktop where your scene is, `click(x, y, state)` gets the position in your canvas'
pixels. Return a string (or `{ title, text }`) and Pulse shows it as a line over the city for a few seconds; return
nothing to stay silent. Keep the positions of what you drew in `this` during `draw`, then look them up in `click`.

## 6. The scene lab

`omarchy-pulse scene lab NAME` opens a page in your browser (Pulse must be running; `omarchy-pulse serve --demo`
works too):

- **the scene, live**, over a sky like Pulse's, reloaded every time you save the file;
- **demo data you control**: add agents and change their state, move CPU, RAM, GPU and network, set the CI of a repo
  to green, running or failed, fire a commit or a push, change the hour and the weather, try reduced motion, half
  quality and privacy, start a focus, go away, jump to Christmas Eve or to the last minute of the year;
- **checks**: is it ready to share (section 7), how long a frame takes to draw and whether that is light enough;
- **errors**, with the line;
- **export**: a PNG and a 6-second video of the scene alone, with demo data only, safe to post.

From a terminal, without the browser: `omarchy-pulse scene check NAME`.

## 7. Rules for a scene in the repo

To be merged into `community/scenes/` (or shipped with Pulse), a scene must:

1. **Be yours.** Your own code and your own art, MIT like the rest of the repo. No logos, characters, brands or
   assets from anyone else (no real car brands, no game or film characters, no fonts you cannot redistribute). An
   idea or a mood can be shared; a recognisable work cannot.
2. **Respect `state.ui.motion === "reduced"`**: nothing runs, swings or flashes; the scene still shows the data.
3. **Be light** (section 8), and work with `quality = "half"`.
4. **Work without names** (`state.privacy`) and with no agents, no repos, no weather.
5. **Be one file**, no network, no storage, no `eval` (they are blocked anyway, see section 9).
6. **Have a short section** in its README: what each thing in the scene means.
7. **Use demo data only** in screenshots and videos (the lab, or `omarchy-pulse serve --demo`).

`omarchy-pulse scene check NAME` checks what it can of this list.

## 8. Performance

A wallpaper runs all day next to your work. Budget: **under 8 ms a frame** at full quality on a normal laptop
(the lab shows yours; under 5 ms at half). Tips:

- Draw what does not change (a building, a background) once into an offscreen canvas in `init`, then
  `g.drawImage` it every frame.
- Avoid creating gradients and paths for hundreds of objects every frame; batch with one `beginPath()` and many
  `moveTo/lineTo`, then one `stroke()`.
- Use `t` for animation, not your own counters that depend on the frame rate: Pulse changes the frame rate (fewer
  frames under windows, none when covered).
- Text is expensive: draw only a few labels.
- Do not grow arrays forever: cap them.

## 9. Safety: what a scene cannot do

A scene runs in a sandboxed frame of its own, served with a strict Content Security Policy:

- **no network**: `fetch`, XHR, WebSocket, images or fonts from the internet are blocked;
- **no token** and no way to call Pulse's API (the frame is loaded with a ticket that only opens scenes);
- **no access** to the page, the panels, the user's files, cookies or storage; no popups, forms or navigation;
- **only a copy** of the state in section 3, nothing more.

That is why users can install scenes from anyone, and why your scene must bring everything it needs in its file.

## 10. Sharing your scene

1. Put it in a fork of [piermark/omarchy-pulse-theme](https://github.com/piermark/omarchy-pulse-theme):
   `community/scenes/NAME/NAME.js`, a `README.md` (what each thing means, a screenshot with demo data) and
   nothing else.
2. `omarchy-pulse scene check NAME` must say ✓ ready to share.
3. Open a pull request with one scene. The maintainer reviews it, tries it in the lab and merges it if it follows
   section 7.

Users install it with:

```bash
mkdir -p ~/.config/omarchy-pulse/scenes
cp community/scenes/NAME/NAME.js ~/.config/omarchy-pulse/scenes/
```

and `scene = "NAME"` in `[pulse]`.

## 11. Recipes

**Something per agent, coloured by its state**

```js
var col = { working: th.accent, waiting: th.warn, done: th.ok, failed: th.crit }[a.state] || th.dim;
```

**Busy CPU, busier world**: speed = `0.2 + state.sys.cpu / 100`; size = `state.sys.ram / 100`.

**A commit just happened**

```js
(state.events || []).forEach(function (e) {
  if (e.t <= this.seen) return;
  this.seen = e.t;
  if (e.kind === "commit") this.drops.push({ t: t, repo: e.text });
}, this);
```

**Day and night**: `state.time.hour`, or `state.weather.day` (1 by day).

**It rains for real**: `state.weather && state.weather.rain > 0`; snow: codes 71 to 77 and 85 to 86.

**Keep still with reduced motion**

```js
var still = state.ui && state.ui.motion === "reduced";
var bob = still ? 0 : Math.sin(t * 2) * box.h * 0.005;
```

**The holidays**: `state.season.xmas` (lights, a tree), `state.season.newYear.left` (seconds to midnight).
