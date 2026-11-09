# The scene editor — make your own world for Omarchy Pulse

The scene editor (new in 1.6) lets you build a **scene**, a whole world on your wallpaper, with the mouse and no
code. You place shapes on a stage, give them the theme's colours and a little motion, and tell each one which of your
data moves it: a building as tall as your RAM, rain as heavy as your network, a lantern for every AI agent. Save, and it
is on your wallpaper.

What the editor makes is a normal community scene: it runs in the same sandbox as every scene (no network, no token),
you can share it like any other, and you can always open it again in the editor to change it. If you would rather
write code, see [SCENES.md](SCENES.md); this page is about the editor.

- [1. Open it](#1-open-it)
- [2. Your first scene in two minutes](#2-your-first-scene-in-two-minutes)
- [3. The editor, part by part](#3-the-editor-part-by-part)
- [4. The shapes](#4-the-shapes)
- [5. Look and motion](#5-look-and-motion)
- [6. Follow your data](#6-follow-your-data)
- [7. Repeat: one per agent, repo or core](#7-repeat-one-per-agent-repo-or-core)
- [8. Clicks](#8-clicks)
- [9. Save, try, export](#9-save-try-export)
- [10. Recipes](#10-recipes)
- [11. Good scenes: tips](#11-good-scenes-tips)
- [12. Share your scene](#12-share-your-scene)
- [13. Questions and problems](#13-questions-and-problems)

---

## 1. Open it

```bash
omarchy-pulse scene editor            # a new scene
omarchy-pulse scene editor my-world   # open a scene you made with the editor
```

Pulse must be running (it always is, as your wallpaper). To try the editor without your data, run
`omarchy-pulse serve --demo` in a terminal and open the address `omarchy-pulse scene editor` prints. The editor opens
in your browser; it needs a mouse, and is made for a screen at least 1280 pixels wide.

## 2. Your first scene in two minutes

1. `omarchy-pulse scene editor`. A window asks where to start: pick **Core skyline**. You get a row of buildings, one
   per CPU core, whose windows light up with the load, and a wave that follows your network.
2. Move the **CPU** slider under the stage: the buildings fill with light and turn red when the cores are busy.
3. Click **star** in *Add*: a star appears in the middle. Drag it into the sky. In the inspector on the right, set
   *colour* to *amber (warn)* and *move* to *spin*.
4. With the star still selected, click **+ follow data**, choose *height* and *with: CPU %*. Move the CPU slider
   again: the star grows with the CPU.
5. Type a **name** at the top (`my-city`) and press **Save** (or Ctrl+S). The status says where the file is and
   "✓ ready to share".
6. Press **Try on wallpaper**: look at your desktop. Your scene is there, live with your real data.
7. To keep it: in `~/.config/omarchy-pulse/pulse.toml`, `[pulse]` → `scene = "my-city"`.

## 3. The editor, part by part

```
┌ name · New… · ↶ ↷ ─────────────────────────────── status · Lab · Export .js · Try on wallpaper · Save ┐
│ ADD          │                                                         │ INSPECTOR                   │
│ box circle   │                  the stage                              │ the selected shape:         │
│ line star    │   (Pulse's sky, the horizon line, the dashed zones      │ place · look · motion ·     │
│ text gauge   │    the panels and the clock cover)                      │ follows your data · repeat  │
│ bars building│                                                         │ · click                     │
│ wave particles                                                         │                             │
│ LAYERS       │ demo data: my live data · CPU · RAM · network · hour ·  │                             │
│ SCENE        │ agents · rain · motion · privacy                        │                             │
└──────────────┴─────────────────────────────────────────────────────────┴─────────────────────────────┘
```

- **Add**: a click adds that shape in the middle of the stage, selected.
- **The stage**: your scene over a sky like Pulse's, at the size of a 16:9 screen. The **horizon** line is where
  Pulse's floor starts. The **dashed zones** are under the side panels and the clock: what you put there will be
  hidden on your wallpaper (unless you hide those panels with `omarchy-pulse layout edit`).
  - drag a shape to move it; its bottom snaps onto the horizon (hold **Alt** to place it freely);
  - drag a **corner** to resize it (hold **Shift** to keep its proportions);
  - click empty space to select nothing;
  - a click on a shape that has a *click* text shows that text under the stage, as the wallpaper will.
- **Layers**: every shape, the front one at the top. ↑ and ↓ bring a shape forward or back, ◉ hides it (◌ shows it
  again). A green dot means the shape moves with your data.
- **Scene**: *Pulse's real sky* (your scene draws only what you add; the real sky, the sun, the moon, the weather and
  the planes show behind it) or *its own* sky in one of the theme's colours; *Pulse's far city behind* or not.
- **Demo data**: sliders for CPU, RAM, network, the hour, how many agents, rain; *motion* full or reduced; *privacy*
  on or off. Tick **my live data** to see your scene with your real data instead.
- **Under the stage, right**: how long a frame takes to draw. "✓ light enough" is what you want; a wallpaper runs all
  day next to your work.

**Keys** (when you are not typing in a field): **Delete** removes the shape, **Ctrl+D** duplicates it, the **arrows**
move it (**Shift**: ten times more), **Ctrl+Z** / **Ctrl+Y** undo and redo, **Ctrl+S** saves, **Esc** selects nothing.

**Nothing is lost**: what you have not saved is kept in the browser and comes back the next time you open the editor
with the same name. Leaving the page with changes not saved asks you first.

## 4. The shapes

| Shape | What it is | Its own settings |
|---|---|---|
| **box** | a rectangle | round: from square corners to a pill |
| **circle** | an ellipse (make width and height the same for a circle) | |
| **line** | a line from one corner of its box to the other | its width (in *look*) |
| **star** | a star or a polygon | points (3 to 12), inner (how deep the points are) |
| **text** | a line of text, with live values (section 8) | text, size, bold |
| **gauge** | a ring that fills with a level | thick, level |
| **bars** | a small bar chart | one per CPU core, per agent, per repo, or one bar for the level |
| **building** | a tower whose windows light up with a level | windows (the level) |
| **wave** | a line that waves | waves (how many), height |
| **particles** | dots that fall, rise, fly across or float like fireflies | go (direction), how many, dot size |

Every shape has **place**: *x* and *y* (its centre, from 0 to 1 across and down the screen), *width*, *height*
(fractions of the screen) and *rotate* (degrees). Using fractions, the same scene fits a laptop and a 4K monitor.

## 5. Look and motion

**Colour**: one of the theme's colours (*accent*, *accent 2*, *green (ok)*, *amber (warn)*, *red (crit)*, *text*,
*dim*, *background*) or **custom…** for a colour of your own. With the theme's colours your scene changes with every
Omarchy theme, and with the colours of your music or your wallpaper if you turned them on: prefer them.

**2nd colour**: the colour the shape goes towards with *colour → second colour* in *follows your data* (green to red
with the CPU, blue to amber with the hour...).

**Opacity**, **glow** (a soft light around it), **style** filled or outline, **line** (the width of outlines, lines and
waves).

**Motion**: *still*, *pulse* (grows and shrinks a little), *float up and down*, *sway*, *spin*, *blink*, *breathe*
(fades in and out), *drift across* (crosses the screen and comes back from the other side), and its **speed**. Copies
of a repeated shape move a little out of step, so a row of lanterns does not bob as one. With `motion = "reduced"` in
Pulse, every shape keeps still by itself: you do not have to do anything.

## 6. Follow your data

This is what makes a scene alive. Select a shape, press **+ follow data**, and say:

- **what moves**: x position, y position, width, height, opacity, rotation, glow, *colour → second colour*, motion
  speed, *level* (for gauge, building and bars), *how many* (particles), *wave height*;
- **with which data**:

| Data | From → to |
|---|---|
| CPU %, RAM %, GPU %, disk used % | 0 → 100 |
| CPU temperature °C | 30 → 95 |
| network MB/s (down and up together) | 0 → 10 |
| hour of the day | 0 → 24 |
| seconds | 0 → 60 |
| outside temperature | −10 → 35 |
| rain mm, wind km/h, clouds % | 0 → 5, 0 → 60, 0 → 100 |
| day (1) or night (0) | 0 → 1 |
| AI agents, agents working | 0 → 8 |
| agents waiting for you, agents failed | 0 → 4 |
| commits this week | 0 → 60 |
| CI failing (repos) | 0 → 3 |
| focus session, you are away | 0 or 1 |
| each copy's own value (section 7) | 0 → 1 |

- **from** and **to**: what the property is when the data is at its low and at its high. CPU 0 → 100 % with height
  from 0.05 to 0.3: a shape from short to tall. Put a bigger "from" than "to" to go the other way (the opacity of a
  sun that fades as the clouds grow).

A shape can follow more than one data: a building whose windows follow the RAM and whose colour goes red with the
temperature. Remove one with **×**. A dot in *Layers* tells you which shapes follow your data.

## 7. Repeat: one per agent, repo or core

**Repeat → one per**:

- **AI agent**: a copy for each agent working for you (Claude Code, Codex, Gemini, OpenCode, Grok...); none when no
  agent is there;
- **Git repo**: a copy for each repository of your Git city;
- **CPU core**: a copy for each core;
- **a fixed number**: as many copies as you say (a row of street lamps).

Then the **layout**: *spread across* (from x to x: the copies share the space evenly, however many they are) or *a
step each* (each copy moved by the same step, across and down: a column, a staircase).

**Colours: by state** gives each copy the colour of its state: working = accent, waiting for you = amber, done =
green, failed = red, idle = dim. For repos the state is their CI (running, green, red).

**Each copy's own value**, in *follows your data*, is that agent (1 working, 0.6 waiting, 0.3 done, 0 failed), that
repo (its commits of the week, 30 = full) or that core (its load). That is how the *Core skyline* template makes each
building as bright as its own core.

## 8. Clicks

**Click** is the line Pulse shows over the city when you click the shape on your wallpaper (on an empty desktop). In
it, these are filled in live:

| | |
|---|---|
| `{cpu}` `{ram}` `{gpu}` `{temp}` | percentages and °C |
| `{net}` | MB/s |
| `{time}` `{hour}` `{date}` | the clock |
| `{outside}` | the outside temperature |
| `{agents}` `{working}` `{waiting}` | your agents |
| `{commits}` | commits this week |
| `{name}` `{state}` `{item}` | for a repeated shape: that agent's or repo's name, its state, its value in % |

`{name} · {state}` on a lantern per agent says "claude · omarchy-pulse · working". Names are empty while you share the
screen or privacy is on, so write clicks that still make sense without them.

## 9. Save, try, export

- **Save** (Ctrl+S): writes `~/.config/omarchy-pulse/scenes/NAME.js` (names: a-z, 0-9 and -), checks it like
  `omarchy-pulse scene check` does, and tells you if it is ready to share.
- **Try on wallpaper**: saves and shows it on your desktop at once, until Pulse restarts; press it again (*Back to my
  scene*) to go back. To keep it: `scene = "NAME"` in `[pulse]`.
- **Export .js**: downloads the scene file, to send it or to put it in a pull request.
- **Lab**: opens the scene in the scene lab (more demo data, a PNG and a 6-second video of the scene alone).
- **New…**: start again from a template or a blank page.

The editor never overwrites a scene written by hand: if a hand-written `NAME.js` exists, it asks you for another
name. Open your scene again any time with `omarchy-pulse scene editor NAME`.

## 10. Recipes

**A lantern for every agent** (the *Agent lanterns* template): a circle, glow 1, motion *float*; repeat one per *AI
agent*, *spread across* from 0.3 to 0.7, *colours by state*; click `{name} · {state}`. Add a text with
`{working} working · {waiting} waiting` under them.

**Your CPU as a skyline** (*Core skyline*): a building, repeat one per *CPU core*, spread; follows *level* with *each
copy's own value* 0.05 → 1 and *colour → second colour* with the same, second colour red.

**Network rain** (*Packet rain*): particles going down; *how many* with network 20 → 260 and *motion speed* with
network 0.5 → 3. A gauge in the middle whose level follows the CPU.

**A sky that follows the hour**: a big circle (the sun) with *y position* following *hour of the day* from 0.8 to
0.3, and *opacity* following *day or night* from 0 to 1.

**A garden for your repos** (*Night garden*): a star with 6 points per *Git repo*, *colours by state* (the CI), its
size following each repo's commits; fireflies whose number follows the agents working.

**An alarm light**: a circle, red, motion *blink*, *opacity* following *CI failing* from 0 to 1: it is there only when a
build is red.

**A focus lamp**: a soft circle whose *glow* follows *focus session* from 0 to 2: it lights up while you concentrate.

## 11. Good scenes: tips

- **Use the floor and the middle.** The side panels and the clock cover the dashed zones; what people see is the
  middle, from a little above the horizon to the bottom.
- **Theme colours first.** Your scene will look right in every Omarchy theme.
- **Less is more.** A wallpaper is seen from the corner of the eye all day: a few shapes that mean something beat many
  that move for nothing. Keep the frame time "✓ light enough" (under 8 ms); particles and many copies cost the most.
- **It must make sense with no data.** Try 0 agents, privacy on, motion reduced, rain and no rain: the editor's
  sliders are there for that.
- **Your own art.** No logos, characters or brands of others in a scene you share (section 12).

## 12. Share your scene

A scene made with the editor is shared like any community scene ([SCENES.md](SCENES.md#10-sharing-your-scene)):

1. **Export .js** (or take `~/.config/omarchy-pulse/scenes/NAME.js`).
2. In a fork of [piermark/omarchy-pulse-theme](https://github.com/piermark/omarchy-pulse-theme):
   `community/scenes/NAME/NAME.js`, a `README.md` that says what each shape means, and a screenshot made with the
   editor's demo data (or the lab's).
3. Open a pull request with that scene.

Others install it by copying `NAME.js` into `~/.config/omarchy-pulse/scenes/` and setting `scene = "NAME"`; they can
open it in their editor and make it their own.

## 13. Questions and problems

**"cannot reach Pulse"**: Pulse is not running. Start it (log in to Omarchy, or `systemctl --user start
omarchy-pulse`), or `omarchy-pulse serve --demo` to try with demo data.

**"a scene written by hand has this name"**: the editor does not touch scenes written in code. Choose another name.

**My scene does not appear after Save**: Save only writes the file. Press *Try on wallpaper*, or set
`scene = "NAME"` in `[pulse]`. Check that no window covers the desktop.

**Part of my scene is hidden**: it is under the panels or the clock (the dashed zones). Move it, or hide those panels
with `omarchy-pulse layout edit`.

**It moves too much / it is heavy**: lower the speeds, use fewer particles and copies, look at the frame time.

**Where is my scene?** `~/.config/omarchy-pulse/scenes/NAME.js`. The design is plain data at the top of the file, the
code after it draws it; [SCENES.md section 12](SCENES.md#12-the-scene-editor-16) explains the format.

**I want more than the editor can do**: start from your editor scene in code: [SCENES.md](SCENES.md) explains how a
scene works, what data it gets and how to draw anything.
