# Omarchy Pulse: how to write a scene (for AI agents)

You are asked to make a scene for Omarchy Pulse, a live wallpaper. A scene is ONE JSON object, the "design". It is data,
not code: Pulse checks it and draws it. Reply with the JSON object only (no explanation, no code fence is needed).

## The canvas

- The screen is 16:9. Every position and size is a fraction of the screen: `x` 0 (left) to 1 (right), `y` 0 (top) to 1
  (bottom); `w` of the width, `h` of the height. `x`,`y` are the CENTRE of a shape.
- The horizon of Pulse is at `y = 0.745`: things that stand on the ground have their foot there (`y = 0.745 - h/2`).
- Keep the scene between `x = 0.27` and `x = 0.73` and below `y = 0.35`: panels cover the sides, the clock the top.
- Shapes are drawn in the order of the list: the first is the furthest back.
- Colours are names of the user's Omarchy theme, never hex: `bg`, `fg`, `accent`, `accent2`, `ok` (green), `warn`
  (amber), `crit` (red), `dim`. (A scene may set its own `palette`, see below; prefer the theme.)

## The design

```json
{
  "v": 2,
  "sky": "none",
  "city": false,
  "shapes": [ ... ],
  "assets": { "id": "data:image/svg+xml;base64,..." },
  "actions": [ ... ],
  "background": { "asset": "id", "fit": "cover", "alpha": 0.6, "dim": 0.2, "y": 0.5 },
  "palette": { "accent": "#7aa2f7" }
}
```

- `sky`: `"none"` keeps Pulse's real sky behind (the real Sun, Moon, stars, weather, planes): the best choice.
  Or a theme colour name for a plain sky.
- `city`: `true` keeps Pulse's far city behind the scene.
- `assets`, `actions`, `background`, `palette` are optional. At most 200 shapes, 40 actions, 40 pictures.

## A shape

```json
{ "id": "tower1", "type": "tower", "name": "api server", "x": 0.4, "y": 0.645, "w": 0.03, "h": 0.2,
  "color": "accent", "alpha": 1, "glow": 0.3,
  "anim": { "kind": "none", "speed": 1 },
  "bind": [ { "prop": "level", "src": "cpu", "from": 0.1, "to": 1 } ],
  "repeat": { "by": "none" },
  "click": "{cpu}% CPU" }
```

`id` is unique (letters, digits, -). `name` is for people. Types and their own keys:

| type | draws | own keys |
|---|---|---|
| `rect` | a rectangle | `round` 0..1 (rounded corners), `fill` false = outline only, `line` (outline width) |
| `ellipse` | an ellipse or circle | `fill`, `line` |
| `line` | a line from top-left to bottom-right of its box | `line` (width) |
| `star` | a star or flower | `points` (3+), `inner` 0..1 |
| `text` | a line of text | `text`, `size` (fraction of the height, 0.018 is small, 0.05 big), `bold` |
| `ring` | a gauge: an arc that fills with `level` | `thick` 0..1 |
| `bars` | a bar chart | `series`: `level`, `cores`, `agents` or `repos` |
| `tower` | a building whose windows light with `level` | |
| `wave` | a waving line | `freq`, `fill` |
| `particles` | dots: rain, bubbles, sparks, fireflies | `dir`: `down`, `up`, `left`, `right`, `fireflies`; `count`, `dot` (size) |
| `image` | a picture from `assets` | `asset` (its id), `tint` true = painted in `color`, `flip` |

Common keys: `color`, `color2` (the colour it turns into when `heat` rises), `alpha` 0..1, `glow` 0..2 (a halo),
`rot` (degrees), `hidden` true (not drawn until an action shows it), `click` (a text shown when the user clicks it).

`anim.kind`: `none`, `pulse` (breathes in size), `spin`, `bob` (up and down), `sway`, `blink`, `breathe` (fades in and
out), `drift` (crosses the screen). `speed` 1 is normal.

## Following data: `bind`

`{ "prop", "src", "from", "to" }`: when `src` goes from its low to its high, `prop` goes from `from` to `to`.

- `prop`: `x`, `y`, `w`, `h`, `alpha`, `rot`, `glow`, `heat` (0..1: colour → `color2`), `speed`, `level` (0..1: gauge,
  bars, windows), `count` (particles), `amp` (wave height 0..1).
- `src` (low → high): `cpu`, `ram`, `disk`, `gpu` (0→100), `temp` (30→95), `net` (network, 0→1), `hour`
  (0→24), `minute` (0→60), `weekday` (0→6), `second`, `outside` (°C outside), `rain` (mm/h 0→5), `wind`, `cloud`
  (0→100), `daylight` (0 or 1),
  `sun` (the Sun's height in degrees, −30→70), `moon` (lit %, 0→100), `planes` (0→10), `iss` (0→90), `starlink`,
  `kp` (aurora, 0→9), `launch` (minutes to the next rocket launch, 0→60), `agents`, `working`, `waiting`, `failed`
  (AI agents, 0→8), `commits` (this week, 0→60), `cifail` (repos with CI failing, 0→3), `music`, `focus`, `meeting`,
  `away` (0 or 1), `item` (a repeated copy's own value, 0→1).
- The user's own panels: `"src": "panel:ID"` with `"lo"` and `"hi"` for its range, e.g.
  `{ "prop": "h", "src": "panel:power", "from": 0.1, "to": 0.4, "lo": 0, "hi": 5 }`. Use only panel IDs you were
  given.
- To make something grow from the ground, bind `h` AND `y` together (the foot stays at 0.745):
  `h` from 0.1 to 0.4 and `y` from 0.695 to 0.545.

## One copy per thing: `repeat`

`"repeat": { "by": "agents", "spread": true, "from": 0.32, "to": 0.68, "stateColors": true }`

- `by`: `none`, `agents` (one per AI agent), `repos` (one per Git repo), `cores` (one per CPU core), `planes` (one per
  plane overhead), `panel` with `"panel": "ID"` (one per row of that panel: a VM, a container), `count` with `"n"`.
- `spread` true places the copies evenly between `from` and `to` (x); or `dx`, `dy` step each copy.
- `stateColors` true colours each copy by its state: working accent, waiting amber, done green, failed red; a row ok
  green, warn amber, crit red.
- In a repeated shape, `item` (in `bind`) is that copy's own value, and texts can use `{name}`, `{state}`, `{item}`.

## Texts

`text` and `click` can contain live values: `{cpu}`, `{ram}`, `{gpu}`, `{temp}`, `{net}`, `{time}`, `{date}`, `{outside}`, `{agents}`, `{working}`,
`{waiting}`, `{commits}`, `{planes}`, `{kp}`, `{moon}`, `{panel:ID}` (the panel's number with its unit), and in a
repeated shape `{name}`, `{state}`, `{item}`. Keep texts short. Never write links, commands or fake system messages.

## Animations: `keys`

```json
"keys": { "start": "action", "loop": false, "dur": 1.2, "ease": "smooth",
          "frames": [ { "t": 0 }, { "t": 0.3, "dy": -0.06, "scale": 1.1 }, { "t": 1 } ] }
```

`start`: `loop` (always) or `action` (played by an action). `t` goes 0→1; `dx`,`dy` move by a fraction of the screen,
`scale` (1 = as drawn), `alpha` (0..1), `rot` (degrees). `ease`: `smooth` or `linear`.

## Actions: when something happens, do something

```json
{ "id": "a1", "when": { "type": "event", "event": "ci-ok" },
  "do": [ { "type": "fx", "fx": "launch", "text": "deploy ok" }, { "type": "play", "shape": "rocket" } ],
  "cooldown": 30 }
```

- `when`: `{ "type": "event", "event": E }` with E one of `agent-waiting`, `agent-done`, `agent-failed`, `agent-new`,
  `ci-fail`, `ci-ok`, `commit`, `hour`, `plane`, `iss`, `launch`, `rain`, `focus`, `back`, `music`, `row-crit` (a row
  of a panel turns red), `row-ok`, `start`, `click` (with optional `"shape": id`), `every` (with `"secs"` ≥ 5);
  or `{ "type": "above" | "below", "src": S, "value": N }` (fires once, when the value crosses N).
- `do`: `{ "type": "fx", "fx": F, "text": "..." }` with F one of `fireworks`, `banner`, `lightning`, `shooting`, `tip`
  (a hot-air balloon with the text), `launch`, `flare`, `chime`, `text`; `{ "type": "play", "shape": id }` (its `keys`
  must have `"start": "action"`); `{ "type": "flash", "shape": id, "color": "crit", "secs": 4 }`;
  `{ "type": "show" | "hide" | "toggle", "shape": id }`.
- `cooldown` in seconds (10 or more). Use Pulse's effects sparingly: they are a treat, not a loop.

## Pictures

You can draw your own pictures as SVG and put them in `assets` as `data:image/svg+xml;base64,...` (plain SVG: no
scripts, no events, no links, no external images, no text that needs a font; under 100 KB each). Draw simple, flat,
original shapes: never logos, brands or characters of others. An `image` shape with `"tint": true` is painted in a
theme colour, so draw it in white. Most scenes need no pictures: the shapes above are enough.

## What makes a good scene

- It MEANS something: every shape shows a piece of the user's real data. Say what in each `name` and `click`.
- 6 to 25 shapes. Leave air. A foot on the horizon, a sky above, a label below (y ≈ 0.78).
- It still makes sense with no data: 0 agents, no rain, panel missing.
- Use the theme's colours, so it fits every Omarchy theme.

## An example: "a lighthouse whose beam turns faster with the CPU, a boat for each AI agent"

```json
{"v":2,"sky":"none","city":false,"shapes":[
 {"id":"sea","type":"wave","name":"sea: the network","x":0.5,"y":0.75,"w":0.46,"h":0.02,"fill":false,"line":2,"freq":6,"color":"accent","alpha":0.8,"glow":0.4,"anim":{"kind":"none","speed":1},"bind":[{"prop":"amp","src":"net","from":0.2,"to":1}],"repeat":{"by":"none"}},
 {"id":"house","type":"rect","name":"lighthouse","x":0.5,"y":0.645,"w":0.014,"h":0.2,"color":"fg","alpha":0.9,"glow":0.2,"anim":{"kind":"none","speed":1},"bind":[],"repeat":{"by":"none"},"click":"CPU {cpu}% · {temp}°"},
 {"id":"lamp","type":"ellipse","name":"lamp: hot when the CPU is","x":0.5,"y":0.535,"w":0.016,"h":0.028,"color":"warn","color2":"crit","alpha":1,"glow":1.6,"anim":{"kind":"pulse","speed":1},"bind":[{"prop":"heat","src":"temp","from":0,"to":1}],"repeat":{"by":"none"}},
 {"id":"beam","type":"line","name":"beam: turns with the CPU","x":0.5,"y":0.535,"w":0.2,"h":0.004,"line":3,"color":"warn","alpha":0.5,"glow":1,"anim":{"kind":"spin","speed":0.3},"bind":[{"prop":"speed","src":"cpu","from":0.2,"to":2}],"repeat":{"by":"none"}},
 {"id":"boat","type":"rect","name":"a boat per AI agent","x":0.34,"y":0.735,"w":0.022,"h":0.012,"round":0.5,"color":"accent","alpha":1,"glow":0.5,"anim":{"kind":"bob","speed":1},"bind":[],"repeat":{"by":"agents","spread":true,"from":0.33,"to":0.67,"stateColors":true},"click":"{name} · {state}"},
 {"id":"label","type":"text","name":"label","x":0.5,"y":0.785,"w":0.3,"h":0.03,"text":"{working} at sea · {waiting} waiting","size":0.017,"color":"fg","alpha":0.6,"anim":{"kind":"none","speed":1},"bind":[],"repeat":{"by":"none"}}
],"actions":[
 {"id":"a1","when":{"type":"event","event":"agent-waiting"},"do":[{"type":"flash","shape":"lamp","color":"warn","secs":5},{"type":"fx","fx":"chime","text":"a boat is waiting"}],"cooldown":30},
 {"id":"a2","when":{"type":"event","event":"agent-failed"},"do":[{"type":"fx","fx":"lightning","text":"a boat is in trouble"}],"cooldown":60}
]}
```
