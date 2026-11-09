# The scene editor — make your own world for Omarchy Pulse

The scene editor (new in 1.6) lets you build a **scene**, a whole world on your wallpaper, with the mouse and no
code. You place shapes on a stage, give them the theme's colours and a little motion, and tell each one which of your
data moves it: a building as tall as your RAM, rain as heavy as your network, a lantern for every AI agent. Save, and it
is on your wallpaper.

What the editor makes is a normal community scene: it runs in the same sandbox as every scene (no network, no token),
you can share it like any other, and you can always open it again in the editor to change it. If you would rather
write code, see [SCENES.md](SCENES.md); this page is about the editor.

**New in 1.7, "Creator"**: your own **pictures** and **backgrounds** (section 9), **animations** made of keyframes
(10), **actions**, "when this happens, do that", with Pulse's own effects (11), shapes that follow **your own panels**
and the sky (6), and **.pulse files** to share a scene and to open other people's, with the **Community** gallery
(12, 13, 16).

- [1. Open it](#1-open-it)
- [2. Your first scene in two minutes](#2-your-first-scene-in-two-minutes)
- [3. The editor, part by part](#3-the-editor-part-by-part)
- [4. The shapes](#4-the-shapes)
- [5. Look and motion](#5-look-and-motion)
- [6. Follow your data](#6-follow-your-data)
- [7. Repeat: one per agent, repo or core](#7-repeat-one-per-agent-repo-or-core)
- [8. Clicks](#8-clicks)
- [9. Pictures and backgrounds](#9-pictures-and-backgrounds)
- [10. Animations](#10-animations)
- [11. Actions: when this happens, do that](#11-actions-when-this-happens-do-that)
- [12. Save, try, export](#12-save-try-export)
- [13. Import, and the Community](#13-import-and-the-community)
- [14. Recipes](#14-recipes)
- [15. Good scenes: tips](#15-good-scenes-tips)
- [16. Share your scene](#16-share-your-scene)
- [17. Questions and problems](#17-questions-and-problems)

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
┌ name · New… · ↶ ↷ ──── status · Lab · Import… · Community · .js · Export .pulse · Try on wallpaper · Save ┐
│ ADD          │                                                         │ INSPECTOR                   │
│ box circle   │                  the stage                              │ the selected shape:         │
│ line star    │   (Pulse's sky, the horizon line, the dashed zones      │ place · look · motion ·     │
│ text gauge   │    the panels and the clock cover)                      │ follows your data · repeat  │
│ bars building│                                                         │ · click                     │
│ wave particles · picture                                               │ · animation                 │
│ LAYERS       │ demo data: my live data · CPU · RAM · network · hour ·  │                             │
│ SCENE        │ agents · rain · planes · ISS · your panels · motion ·   │                             │
│ PICTURES     │ privacy                                                 │                             │
│ ACTIONS      │                                                         │                             │
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
  the planes show behind it) or *its own* sky in one of the theme's colours; *Pulse's far city behind* or not; a
  **picture** as the background, and **colours**: the Omarchy theme's, or a palette of its own (section 9).
- **Pictures**: the pictures of this scene (section 9). **Actions**: what happens when (section 11).
- **Demo data**: sliders for CPU, RAM, network, the hour, how many agents, rain, planes overhead, the ISS, **your
  panels** (from 0 to 100% of each panel's range); *motion* full or reduced; *privacy* on or off. Tick **my live
  data** to see your scene with your real data instead. Actions fire in the preview too: the effect they ask for is
  shown in a box over the stage.
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
| **picture** (1.7) | one of your pictures (section 9) | which picture, its own colours or painted in the shape's colour, mirror |

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
| minutes, day of the week (0 Monday) | 0 → 60, 0 → 6 |
| the Sun's height ° (below 0: night), the Moon lit % | −30 → 70, 0 → 100 |
| planes overhead, Starlink satellites up | 0 → 10, 0 → 20 |
| the ISS's height ° (0: not up), aurora Kp | 0 → 90, 0 → 9 |
| minutes to the next launch | 0 → 60 |
| music playing, in a meeting | 0 or 1 |
| **your panel: NAME** (1.7) | its own range (below) |

**Your own panels** (1.7): every panel with a number (a `[[source]]` that prints one, `omarchy-pulse push`, Home
Assistant, the energy of your home...) is in the list as *your panel: NAME*. Its range is the one you set under it
(**its range**: 0 → 5 for kW, 0 → 2000 for W), or the panel's own when it is a gauge with a min and a max, or 0 → 100.
That is how a tower grows with your homelab's power draw, a lake fills with your disk, a flag rises with your
download. Only numbers reach the scene (and, for repeating, the names and states of a list's rows: section 7), never
the panel's notes or text, and a panel you marked `private = true` is never there.

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
- **plane** (1.7): a copy for each plane overhead (its value is its height in the sky);
- **row of your panel** (1.7): a copy for each row of one of your panels with a list, a status or a table: a tower per
  Proxmox VM, a fish per Docker container, a lamp per Home Assistant light. *By state* colours each copy green, amber or
  red with its row (a table row that says "up..." is green, "exited..." red); its value is the row's number if it has
  one, else its state. Pulse's own panels (system, notifications, the car...) and private panels are not in the list;
  names are empty in privacy mode;
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
| `{panel:NAME}` (1.7) | the number of your panel NAME with its unit (`2.3kW`) |
| `{planes}` `{kp}` `{moon}` (1.7) | planes overhead, the aurora Kp, the Moon lit % |

`{name} · {state}` on a lantern per agent says "claude · omarchy-pulse · working". Names are empty while you share the
screen or privacy is on, so write clicks that still make sense without them.

## 9. Pictures and backgrounds

**+ import pictures** in *Pictures* (or drop pictures on the page): PNG, JPEG, WebP or SVG. A drawing of your own, a
photo of your server rack, a whole background. The editor redraws photos at 1920 pixels at most, as WebP, so they stay
small and lose their metadata (GPS, camera); SVGs are kept as they are, if they have no scripts or links in them. A
scene can carry 40 pictures, 3 MB together: the status tells you how much you used.

Each picture has three buttons: **+** puts it on the stage as a **picture** shape, **▭** makes it the background,
**×** removes it (and the shapes that use it). The **picture** tool in *Add* does the same with the last picture, or
asks you for one.

A **picture shape** is like any other shape: place, opacity, glow, motion, follow your data, repeat, click, animation.
*Tint → painted in the colour below* fills its shape with the shape's colour: a white drawing becomes accent, amber or
red with the theme (or with *colour → second colour*, with your data). **Mirror** flips it.

**Background** (in *Scene*): the picture behind the whole scene, *fill the screen* (cut to fit) or *whole picture*, and
**dim**, to keep the panels readable; its **opacity**, and *top ↕ bottom*: which part of a picture cut to fit
shows. Pulse's real sky, and what Pulse draws in it (rain, planes, fireworks, the rockets of your actions), is behind the
background: give it an opacity under 1, or use a picture with a transparent sky, to let them through.

**Colours → its own palette**: eight colours of the scene's own (the background, the text, accent, accent 2, ok, warn,
crit, dim) instead of the Omarchy theme's. Shapes keep using *accent*, *warn*...: they take the palette's colours. Use
it when your pictures need their colours; keep the theme's when you can, so the scene follows every theme.

## 10. Animations

Motion (section 5) is a loop that never stops. An **animation** is yours: a few moments (**frames**) that say where the
shape is, how big and how visible, and Pulse goes smoothly from one to the next.

- **play**: *all the time* (a loop), or *when an action says so* (section 11: the tower shakes when CI fails), *once*
  or *then keep going*;
- **seconds**: how long it lasts; **ease**: *smooth* (slow at the ends) or *steady*;
- **frames**: *at* goes from 0 (the start) to 1 (the end); **→** and **↓** move the shape by a share of the screen
  (0.1 = a tenth), **size** (1 = as drawn), **opac.** (0 to 1), **°** turns it. Leave a box empty for "as drawn";
  **+ frame** adds one, **×** removes it;
- **presets**: *jump*, *fly* (across the screen), *fade*, *grow*, *shake*, *spin*: a start you can change.
- **▶ play it** tries an animation that waits for an action.

An animation adds to what the shape already does: a building that follows your RAM can still jump. With
`motion = "reduced"` animations keep still, like every motion.

## 11. Actions: when this happens, do that

**+ action** in *Actions*. An action is **when** something happens, **do** one or more things.

**When**:

- **something happens**: an AI agent starts waiting for you, finishes, fails, or a new one starts; CI fails on a repo,
  or passes again; a new commit; a new hour; a plane comes overhead; the ISS rises; a rocket lifts off; it starts
  raining; a focus session starts; you come back; music starts; **a row of your panels turns red**, or **is green
  again**; **you click** a shape (or any shape); the scene starts; **every N seconds** (5 at least);
- **a value rises above** or **falls below** a line: any data of section 6, your panels included (*your panel: power
  rises above 4*). It fires once, on the way across, not all the time while it stays above.

**Do**:

| | |
|---|---|
| **Pulse effect** | Pulse's own: fireworks, a banner across the sky, a lightning bolt, a shooting star, a hot-air balloon with your text, a rocket lifting off, a solar flare, a chime, or a line of text over the city. With a text of up to 60 characters, live values too (`CPU {cpu}%`, `{panel:power}`) |
| **play a shape's animation** | its animation set to *when an action says so* (section 10) |
| **flash a shape** | in a colour, for some seconds |
| **show / hide / show or hide a shape** | a shape hidden in *Layers* can appear when its moment comes |

**At most once every N seconds** (10 by default) keeps an action from repeating. Pulse adds its own limits to its
effects on your wallpaper: one every 4 seconds, the same one every 15, none while a window covers the desktop, and only
the text with reduced motion. **Try it** in the action plays what it does at once.

In the list, **✎** changes an action, **●** turns it off and on, **×** removes it. Actions work in the editor's preview
with the demo sliders (move CPU across the line, click a shape), and on your wallpaper with your real data.

## 12. Save, try, export

- **Save** (Ctrl+S): writes `~/.config/omarchy-pulse/scenes/NAME.js` (names: a-z, 0-9 and -), checks it like
  `omarchy-pulse scene check` does, and tells you if it is ready to share.
- **Try on wallpaper**: saves and shows it on your desktop at once, until Pulse restarts; press it again (*Back to my
  scene*) to go back. To keep it: `scene = "NAME"` in `[pulse]`.
- **Export .pulse** (1.7): a file to share, with the scene, its pictures, animations and actions, a preview, your name
  and a licence ([PACKAGES.md](PACKAGES.md)). Section 16.
- **.js**: downloads the scene's code file, for the scene lab or to go on by hand in code.
- **Lab**: opens the scene in the scene lab (more demo data, a PNG and a 6-second video of the scene alone).
- **New…**: start again from a template or a blank page (1.7 adds *Homelab city* and *Launch pad*).

The editor never overwrites a scene written by hand: if a hand-written `NAME.js` exists, it asks you for another
name. Open your scene again any time with `omarchy-pulse scene editor NAME`.

## 13. Import, and the Community

**Import…** (or drop a `.pulse` file on the page) opens someone's scene: you see its preview, who made it, its licence
and Pulse's checks. **Open in the editor** puts it on your stage, to change it and **Save** it under your name for it;
**Install** adds it to your scenes as it is.

**Community** shows the scenes people shared in the project's gallery: a preview of each, who made it, what it shows.
**Install** adds it to your scenes (`scene = "NAME"` to use it); **Install & edit** opens it here, to make it yours.
Keep the author's name in the description when you share a scene you changed.

Every scene runs in Pulse's sandbox, so installing one is safe: no network, no access to your files, nothing that runs
on your computer ([PACKAGES.md, section 5](PACKAGES.md#5-what-is-in-a-pulse-file-and-what-never-is)).

## 14. Recipes

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

**A tower that grows with your homelab's power** (1.7, the *homelab-tower* scene in the Community): a picture of a
rack whose *height* follows *your panel: power* (its range 0 → 5 kW) and whose *y position* follows the same panel, so
its foot stays on the horizon; particles rising above it, more with more power; a click → it shakes (an animation that
plays when an action says so) and a banner says `{panel:power}`.

**A rocket for every green build** (1.7): an action *CI passes again* → *Pulse effect: a rocket lifts off*, text
`deploy ok`.

**Your homelab as a city** (1.7, the *Homelab city* template): a building repeated *one per row of your panel*
`homelab`, *colours by state*, its windows following *each copy's own value*; an action *a row of your panels turns
red* → lightning and the building flashes. The *Container aquarium* in the Community does the same with fish.

**A rocket for your builds** (1.7, the *Launch pad* template): a picture of a rocket whose animation plays when an
action says so; *CI passes again* → play it and Pulse's own launch.

**Your agent is waiting** (1.7): a picture of a bell, hidden; an action *an AI agent starts waiting for you* → *show the
bell* and *play its animation* (*shake*); another action *you click the bell* → *hide the bell*.

**Midnight** (1.7): *a new hour* fires every hour; for midnight only, use *hour of the day falls below 0.1* →
*fireworks*: the hour goes from 23.98 back to 0 once a day.

**The night sky** (1.7): a moon picture whose *opacity* follows *the Moon lit %*, a star field whose *how many*
follows *the Sun's height* from 120 to 0 (more stars when the Sun is low), a plane picture repeated *one per plane*.

## 15. Good scenes: tips

- **Use the floor and the middle.** The side panels and the clock cover the dashed zones; what people see is the
  middle, from a little above the horizon to the bottom.
- **Theme colours first.** Your scene will look right in every Omarchy theme.
- **Less is more.** A wallpaper is seen from the corner of the eye all day: a few shapes that mean something beat many
  that move for nothing. Keep the frame time "✓ light enough" (under 8 ms); particles and many copies cost the most.
- **It must make sense with no data.** Try 0 agents, privacy on, motion reduced, rain and no rain: the editor's
  sliders are there for that.
- **Your own art.** No logos, characters or brands of others in a scene you share (section 16).
- **Effects are a treat.** Actions that ask Pulse for fireworks every few minutes wear thin; keep them for what
  matters (a build back to green, midnight, a rocket).
- **A panel by name.** A scene that follows `panel:power` needs a panel called `power`: say it in its description.

## 16. Share your scene

1. **Export .pulse**: a title, your name, a licence (MIT, CC0, CC-BY or CC-BY-SA), a few words and tags. The editor
   makes a preview from the stage and downloads `NAME.pulse`.
2. Send the file to anyone: they open it with **Import…**.
3. For the **Community** gallery: put it in `community/scenes/NAME/` in a fork of
   [piermark/omarchy-pulse-theme](https://github.com/piermark/omarchy-pulse-theme), run
   `python3 tools/scene-index.py`, and open a pull request with that scene. Once it is merged, it is in everyone's
   Community tab. Step by step: [PACKAGES.md, section 4](PACKAGES.md#4-put-your-scene-in-the-gallery).

Only what is yours to share: your pictures, or pictures whose licence allows it.

## 17. Questions and problems

**"cannot reach Pulse"**: Pulse is not running. Start it (log in to Omarchy, or `systemctl --user start
omarchy-pulse`), or `omarchy-pulse serve --demo` to try with demo data.

**"a scene written by hand has this name"**: the editor does not touch scenes written in code. Choose another name.

**My scene does not appear after Save**: Save only writes the file. Press *Try on wallpaper*, or set
`scene = "NAME"` in `[pulse]`. Check that no window covers the desktop.

**Part of my scene is hidden**: it is under the panels or the clock (the dashed zones). Move it, or hide those panels
with `omarchy-pulse layout edit`.

**It moves too much / it is heavy**: lower the speeds, use fewer particles and copies, look at the frame time.

**Where is my scene?** `~/.config/omarchy-pulse/scenes/NAME.js`. The design is plain data at the top of the file, the
code after it draws it; [SCENES.md section 12](SCENES.md#12-the-scene-editor-16-and-17) explains the format.

**"too many pictures" / Save refuses the pictures**: a scene carries 3 MB of pictures. Remove some, or use smaller ones
(a background at 1920 pixels is plenty; an SVG is often tiny).

**My SVG is refused**: it has scripts, events or links to the internet. Save it again as a plain or optimized SVG, or
as a PNG.

**An action does not fire**: a value must cross the line (from below to above) to fire; it waits its *at most once
every* time after firing; Pulse's effects wait 4 seconds after any other and do not show while a window covers the
desktop. *Try it* in the action shows what it does.

**My panel is not in the list**: only panels with a number are (a stat or a gauge), and not the private ones. The list
comes from Pulse when the editor opens: with `serve --demo` you see the demo panels. A panel you follow but do not have
yet is still kept in the design.

**I want more than the editor can do**: start from your editor scene in code: [SCENES.md](SCENES.md) explains how a
scene works, what data it gets and how to draw anything.
