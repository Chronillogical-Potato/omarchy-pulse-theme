# Omarchy Pulse — the guide

Everything about Pulse: what the scene means, how to put any live data on your wallpaper, the AI brief, cameras,
privacy, tuning and troubleshooting. The short version is in the [README](../README.md).

- [1. Install, update, remove](#1-install-update-remove)
- [2. The scene](#2-the-scene)
- [3. Panels and where they go](#3-panels-and-where-they-go)
- [4. Sources](#4-sources)
- [5. What a source can print](#5-what-a-source-can-print)
- [6. Levels, thresholds and alerts](#6-levels-thresholds-and-alerts)
- [7. Push from anywhere](#7-push-from-anywhere)
- [8. AI on your wallpaper](#8-ai-on-your-wallpaper)
- [9. Cookbook](#9-cookbook)
- [10. Built-in panels](#10-built-in-panels)
- [11. Privacy and security](#11-privacy-and-security)
- [12. Light on the PC](#12-light-on-the-pc)
- [13. Troubleshooting](#13-troubleshooting)
- [14. Files](#14-files)
- New in 1.1:
  [15. The LED sphere](#15-the-led-sphere) ·
  [16. AI agents as drones](#16-ai-agents-as-drones) ·
  [17. Music, fireworks and focus](#17-music-fireworks-and-focus) ·
  [18. Colours, news, clicks and the sun](#18-colours-news-clicks-and-the-sun) ·
  [19. The face that sees you, and "while you were away"](#19-the-face-that-sees-you-and-while-you-were-away) ·
  [20. Your network on the grid](#20-your-network-on-the-grid) ·
  [21. The voice](#21-the-voice)

---

## 1. Install, update, remove

Made for **Omarchy 4.5** (Hyprland, Wayland). Run these from a terminal on the PC itself, not over SSH.

```
omarchy-theme-install https://github.com/piermark/omarchy-pulse-theme
~/.config/omarchy/themes/pulse/extras/install-live
```

The first line installs the **pulse** theme: colours, window borders (cyan to magenta), btop, icons and two still
wallpapers (`01-pulse-skyline`, `02-pulse-orbit`; Omarchy's next-background key switches between them). The still is
what you see under the live wallpaper and when Pulse is off.

The second line makes it live. It installs what is missing (`python-gobject`, `gtk-layer-shell`, `webkit2gtk-4.1`,
`ffmpeg`, `playerctl`) with pacman, copies the engine to `~/.local/share/omarchy-pulse`, links the
`omarchy-pulse` command in `~/.local/bin`, asks your city for the weather, writes your config
`~/.config/omarchy-pulse/pulse.toml` (never overwritten later) and starts Pulse. From then on:

- it starts at every login (XDG autostart + a systemd user unit, `omarchy-pulse.service`);
- it follows the theme: pick **pulse** and it starts, pick another theme and it stops (Omarchy's theme-set hook).

| | |
|---|---|
| Live with every theme, in that theme's colours | `extras/install-live --always` |
| Back to the pulse theme only | `extras/install-live --theme` |
| Update | `omarchy-theme-install https://github.com/piermark/omarchy-pulse-theme` again, then `extras/install-live` |
| Remove the live wallpaper (your `pulse.toml` stays) | `extras/install-live --remove` |
| Check dependencies, config and sources | `omarchy-pulse doctor` |
| Logs | `journalctl --user -u omarchy-pulse -f` |
| Restart | `systemctl --user restart omarchy-pulse` |

## 2. The scene

Nothing in the scene is decoration only:

| You see | It is |
|---|---|
| the towers of the skyline | your CPU cores, one tower each, as tall as that core's load (red top above 90 %) |
| the lit windows | your RAM: the more is used, the more windows are on |
| the horizon line | your pulse: one beat per heartbeat, from 46 to about 140 a minute as the CPU works |
| the LED sphere (scene **sphere**) | a screen: clock, weather, CPU, news, camera, alerts, music, focus, your agent's face (section 15) |
| the wireframe core | beats with the pulse and turns faster with the load; your agent's face lives in it |
| the drones | your AI agents and jobs at work (section 16) |
| the grid on the floor | runs toward you as fast as the CPU works |
| the aurora | your network traffic |
| the sky | your real weather: stars on a clear night, rain, snow, fog, lightning in a storm |
| a red or amber shockwave | an alert (section 6), with the **INCOMING** banner |

Scenes (`scene =` in `[pulse]`): **sphere** (the LED sphere in the middle of the city, the default from 1.1),
**skyline** (the city around a wireframe core), **orbit** (each core becomes a moon on its own ring around a
larger core; faster moons, busier cores) and **calm** (a still grid, at most 10 frames a second).

To change the scene, edit `scene` in `~/.config/omarchy-pulse/pulse.toml`, or in one line:

```
sed -i 's/^scene = .*/scene = "orbit"/' ~/.config/omarchy-pulse/pulse.toml    # sphere | skyline | orbit | calm
```

The live wallpaper switches by itself within about 3 seconds (`omarchy-pulse reload` to do it now). Check the
current one with `grep ^scene ~/.config/omarchy-pulse/pulse.toml`.

The three still wallpapers of the theme (`01-pulse-skyline`, `02-pulse-orbit`, `03-pulse-sphere`, switched with Omarchy's
next-background key) are what you see while Pulse is off or starting; they do not change the live scene.

## 3. Panels and where they go

Every source is a panel in the Omarchy box style (title cut into the border). Four places:

| `slot` | Where | Good for |
|---|---|---|
| `left` | the left column, under system and network | values, gauges, tables |
| `right` | the right column, under the weather | cameras, status tiles, lists |
| `center` | under the clock | the AI brief, text, notifications |
| `ticker` | the line at the bottom, one headline every 6 seconds | news, prices, feeds |
| `auto` (default) | cameras and tiles right, text center, the rest wherever there is more room | |

`order` sorts panels in a column (smaller first). A panel that does not fit in its column is hidden, never cut in
half: put the important ones first. The age of the data (`2m`, `1h`) is shown top right; an error appears in amber
at the bottom of its panel.

## 4. Sources

`~/.config/omarchy-pulse/pulse.toml`. When you save it, Pulse reloads in about 3 seconds (or run
`omarchy-pulse reload`). A typo does not take the wallpaper down: a red **pulse.toml** panel tells you where.

```toml
[[source]]
name = "nas"                  # unique; also the name you push to
title = "nas · disk"          # shown on the panel (default: name)
icon = "󰋊"                    # any Nerd Font glyph (Omarchy's font has them all)
command = "ssh nas df --output=pcent /volume1 | tail -1"
every = 300                   # seconds
slot = "left"
warn_above = 80
crit_above = 92
```

Exactly one of these says where the data comes from:

| Key | What happens |
|---|---|
| `command = "..."` | runs in bash every `every` seconds (default 30); what it prints is the data. A failing command with no output shows its error. |
| `stream = "..."` | starts once and keeps running; every line it prints is an update. Restarted if it stops (3 s, then up to 60 s). For text/list/status panels the last `lines` lines (default 8) are kept. |
| `url = "..."` | HTTP GET every `every` seconds. JSON (pick a part with `path`), text or an image. `headers = { Authorization = "Bearer ..." }`. |
| `file = "..."` | read again whenever it changes (checked every 2 s). Text, JSON or an image (`.jpg .png .webp .gif`). |
| `camera = "..."` | a live thumbnail: one ffmpeg kept open (`rtsp://`, `rtsps://`, `http(s)://` video, anything ffmpeg opens), `fps` frames a second (default 2), `width` pixels (default 640), `transport = "udp"` if your camera needs it. With `snapshot = true` the URL is an image fetched every `every` seconds instead. |
| `push = true` | runs nothing; it waits for `omarchy-pulse push NAME ...` (section 7). |

The other keys:

| Key | Default | |
|---|---|---|
| `title`, `icon` | name, none | |
| `type` | `auto` | force `stat`, `gauge`, `list`, `status`, `text`, `kv`, `chart`, `image` |
| `slot`, `order` | `auto`, file order | section 3 |
| `every` | 30 | seconds between runs/requests |
| `timeout` | 60 (url: 20) | seconds before a run is given up |
| `path` | | for `url`: `data.items.0.value`, `result[2].name` |
| `unit` | | shown next to a value when the source does not say it |
| `warn_above`, `crit_above`, `warn_below`, `crit_below` | | section 6 |
| `notify` | false | also a desktop notification when the panel turns amber/red |
| `private` | false (cameras: true) | hidden while you share the screen (section 11) |
| `lines` | 8 | for `stream` text/list panels |
| `enabled` | true | `false` keeps the source in the file but off |

`command` and `stream` run with `~/.config/omarchy-pulse/sources/` and the built-in helpers on the PATH, and with
`PULSE_THEME` set to the current theme. Tip: TOML `'''...'''` strings take quotes and backslashes as they are, so a
long `curl | jq` pipeline needs no escaping.

Built-in helpers (in `~/.local/share/omarchy-pulse/sources/`):

- `pulse-ping HOST...`: one status tile per host with its ping time; `gateway` means your router; amber above 150 ms,
  red when it does not answer.
- `pulse-systemd`: failed system and user units (red tiles), or the number of running services.
- `pulse-table`: tab-separated (or 2+ space) lines on stdin to a two-column table.
- `pulse-ai`: section 8.

## 5. What a source can print

Pulse looks at the output and picks the panel:

| Output | Panel |
|---|---|
| `42` · `21.5 °C` · `1.2 kW` (a number, optional unit) | **stat**: big value + sparkline of the last 90 values |
| any other text | **text**, typed out when it changes (the last lines of a `stream`) |
| `{"value": 72, "unit": "%", "note": "step 4/6"}` | **stat**; with `"type": "gauge"` (or `type = "gauge"`) a segmented bar, `min`/`max` default 0–100 |
| `{"items": [{"title": "...", "text": "...", "right": "...", "level": "ok"}]}` or a JSON list | **list** |
| the same with `"type": "status"` (or `type = "status"`) | **status** tiles; `"note"` on the right, `"ok": true/false` works too |
| `{"rows": [["immich", "up 3d"], ["n8n", "up 6h"]]}` | **kv** table |
| `{"series": [{"values": [1, 3, 2]}, {"values": [2, 2, 4]}]}` | **chart** (up to 4 lines) |
| `{"text": "..."}` | **text** |
| any other JSON object | a table of its keys |
| an image (url, file, camera, push) | **image** |

Any JSON may also carry `"title"` (replaces the panel title unless you set one), `"level"` and `"note"`. In items,
`"t"` (a Unix time) shows as an age (`5m`, `2h`). Plain lines with `type = "list"` or `"status"` become items.

## 6. Levels, thresholds and alerts

Every panel and item can have a level: **ok** (green), **info** (cyan), **warn** (amber), **crit** (red, blinking).

- From the data: `"level": "crit"` in the JSON, or `--level crit` on a push.
- From thresholds, for numbers: `warn_above`, `crit_above`, `warn_below`, `crit_below`. Above/below the line the panel
  turns amber/red, back to ok on its own.

When a panel **becomes** warn or crit, Pulse raises an alert: a shockwave runs through the city, the horizon turns
red, and **INCOMING** shows the title and the text for 7 seconds (decrypted letter by letter); the alert also goes in
the ticker for an hour. With `notify = true` you also get a desktop notification. Built-in alerts: the CPU above
`temp_crit` (90 °C by default) and the root disk above 95 %.

## 7. Push from anywhere

Any script, cron job, git hook, CI step or home automation can put something on the wallpaper. A name that is not in
`pulse.toml` gets a panel of its own; a configured name keeps its title, slot and thresholds.

```
omarchy-pulse push deploy 72 --type gauge --title "deploy · web"
omarchy-pulse push backup "38 GB · 04:12" --level ok
make && omarchy-pulse push build ok --level ok || omarchy-pulse push build "failed" --level crit
omarchy-pulse push doorbell ~/Pictures/doorbell.jpg            # an image
journalctl -n 5 -p err -o cat | omarchy-pulse push errors -      # stdin
omarchy-pulse push news '{"items":[{"title":"Omarchy 4.5 is out"}]}' --slot ticker
```

Options: `--title`, `--type`, `--level`, `--slot`. Over HTTP (local only):

```
curl -s -X POST -H "X-Pulse-Token: $(cat ~/.config/omarchy-pulse/token)" \
     --data '{"value": 21.5, "unit": "°C"}' "http://127.0.0.1:47800/api/push/garage?level=ok"
curl -s -X POST -H "X-Pulse-Token: $(cat ~/.config/omarchy-pulse/token)" -H "Content-Type: image/jpeg" \
     --data-binary @snap.jpg http://127.0.0.1:47800/api/push/snapshot
```

Other endpoints: `GET /api/state` (everything the wallpaper shows, as JSON), `POST /api/privacy` (`on`, `off`,
`auto`, `toggle`), `POST /api/reload`. All need the token.

## 8. AI on your wallpaper

Any AI you can run from a terminal can write a panel. `pulse-ai` (ships with Pulse) gives it everything the wallpaper
shows right now — system, weather, every panel, their levels and errors, the last alerts — and asks for at most four
short lines on what deserves your attention first.

```toml
[[source]]
name = "ai"
title = "ai · brief"
icon = "󰚩"
command = "pulse-ai claude -p"
every = 1800
timeout = 180
slot = "center"
```

| AI | command |
|---|---|
| Claude Code | `pulse-ai claude -p` |
| a local model with ollama (nothing leaves the PC) | `pulse-ai ollama run llama3.2` |
| OpenAI Codex CLI | `pulse-ai codex exec` |
| Gemini CLI | `pulse-ai gemini -p` |
| any other CLI that takes the prompt as its last argument | `pulse-ai my-ai --flag` |

- Your own question: `pulse-ai --ask "Anything wrong with my servers? One line." ollama run llama3.2`
- See what would be sent, without sending it: `pulse-ai --dry-run`
- Private panels (cameras, notifications, anything `private = true`) are **left out** unless you add `--private`.
  Cloud AIs receive what you send them: use a local model when the data should stay home.
- The panel named `ai` never reads itself (`PULSE_AI_SELF` changes the name).
- Not only briefs: any command whose output is text is a panel, so `command = "claude -p 'One line on today in tech'"`
  or a script that asks your AI about your inbox work too. Keep `every` long (AI calls cost time and money).

## 9. Cookbook

Ready-made community sources (copy a folder, paste the TOML): [`community/`](../community/).

**Zabbix: current problems as tiles** (API token from *User settings → API tokens*)

```toml
[[source]]
name = "zabbix"
title = "zabbix"
icon = "󰒋"
type = "status"
every = 30
slot = "right"
notify = true
command = '''curl -s -H "Authorization: Bearer ZABBIX_TOKEN" -H "Content-Type: application/json-rpc" \
  -d '{"jsonrpc":"2.0","method":"problem.get","params":{"output":["name","severity"],"recent":true,"sortfield":["eventid"],"sortorder":"DESC","limit":8},"id":1}' \
  https://zabbix.example.lan/api_jsonrpc.php \
  | jq '{items: [.result[] | {title: .name, level: (if (.severity|tonumber) >= 4 then "crit" elif (.severity|tonumber) >= 2 then "warn" else "info" end)}]}' '''
```

**Home Assistant: any entity** (long-lived token from your profile)

```toml
[[source]]
name = "power"
title = "home · power"
icon = "󱐋"
url = "http://homeassistant.local:8123/api/states/sensor.house_power"
headers = { Authorization = "Bearer HA_TOKEN" }
path = "state"
type = "stat"
unit = "W"
warn_above = 3000
every = 10
```

**Security cameras**

```toml
[[source]]
name = "cam-gate"
title = "cam · gate"
camera = "rtsp://user:password@192.168.1.50:554/stream2"   # the camera's small stream is plenty
fps = 2

[[source]]
name = "cam-garden"
camera = "http://go2rtc.local:1984/api/frame.jpeg?src=garden"   # or any snapshot URL
snapshot = true
every = 2
```

**Proxmox: VMs and containers**

```toml
[[source]]
name = "proxmox"
type = "status"
every = 60
command = '''ssh root@pve pvesh get /cluster/resources --type vm --output-format json \
  | jq '{items: map({title: .name, note: .status, level: (if .status == "running" then "ok" else "warn" end)})}' '''
```

**GitHub Actions: the last runs of a repo**

```toml
[[source]]
name = "ci"
title = "ci · omarchytv"
type = "status"
every = 120
command = '''gh run list -R piermark/omarchytv -L 6 --json displayTitle,status,conclusion \
  | jq '{items: map({title: .displayTitle, level: (if .conclusion == "success" then "ok" elif .conclusion == "failure" then "crit" elif .status != "completed" then "info" else "warn" end)})}' '''
```

**MQTT: a sensor that keeps the panel live**

```toml
[[source]]
name = "garage"
title = "garage · °C"
stream = "mosquitto_sub -h 192.168.1.10 -t home/garage/temperature"
type = "stat"
crit_above = 45
```

**A log that never stops**

```toml
[[source]]
name = "errors"
stream = "journalctl -f -p err -o cat"
type = "text"
lines = 6
slot = "center"
```

**News in the ticker (RSS)**

```toml
[[source]]
name = "hn"
title = "HN"
slot = "ticker"
type = "list"
every = 900
command = '''curl -s https://hnrss.org/frontpage | python3 -c "import sys,xml.etree.ElementTree as E; print('\n'.join(i.findtext('title') for i in E.parse(sys.stdin).iter('item')))" | head -8'''
```

**Docker, pacman updates, hosts, failed units**

```toml
[[source]]
name = "docker"
command = "docker ps --format '{{.Names}}\t{{.Status}}' | pulse-table"
every = 30

[[source]]
name = "updates"
command = "checkupdates 2>/dev/null | wc -l"     # pacman-contrib
warn_above = 50
every = 1800

[[source]]
name = "lan"
type = "status"
command = "pulse-ping gateway nas.local pve.local 1.1.1.1"
every = 20

[[source]]
name = "services"
type = "status"
command = "pulse-systemd"
every = 60
```

**Backups from cron** (nothing in `pulse.toml` needed)

```
0 4 * * * restic backup ~ && omarchy-pulse push backup "ok $(date +\%H:\%M)" --level ok || omarchy-pulse push backup "FAILED" --level crit
```

## 10. Built-in panels

In `[builtin]` (`false` hides one):

| Key | Panel |
|---|---|
| `system` | CPU (with every core and a sparkline), load, uptime, RAM, GPU (AMD through sysfs, NVIDIA through `nvidia-smi`; not shown on other GPUs), CPU temperature, disk, battery |
| `network` | download/upload with sparklines, `user@host`, local IP |
| `weather` | Open-Meteo, no key: `city = "Milan"` (or `latitude`/`longitude`) in `[pulse]`, `units = "imperial"` for °F and mph |
| `media` | now playing (playerctl): title, artist, progress |
| `notifications` | the last desktop notifications (Omarchy 4.5 or mako); private |
| `github = ["owner/repo", ...]` | latest release and commits of the repos you follow (`[]` to hide) |
| `github_notifications` | your GitHub notifications, after `gh auth login` |

`[pulse]` also has: `clock = "12h"`, `title = "MISSION CONTROL"` (a word under the clock), `font`, `port`
(default 47800), `temp_crit`, `dim_with_windows`.

## 11. Privacy and security

- **Screen sharing**: when you share or record the screen, Hyprland tells Pulse and the **privacy mode** starts by
  itself: cameras, notifications, your IP and every `private = true` panel are covered, the INCOMING banner hides its
  text, and a `◉ PRIVACY · screen shared` badge appears. It ends when you stop sharing.
  (`privacy_on_screenshare = false` turns this off.)
- **By hand**: `omarchy-pulse privacy on | off | auto | toggle`. Bind it to a key in your Hyprland config to cover
  the desktop before a screenshot.
- The hub listens on **127.0.0.1 only**, answers only requests addressed to that address, and every API call needs
  the token in `~/.config/omarchy-pulse/token` (created with mode 600).
- Camera addresses and passwords stay in the hub: the page only sees `/img/name`, and errors are shown with the
  password replaced by `***`. In privacy mode the hub does not even send camera frames.
- Sources run as you, with your permissions: only put commands you trust in `pulse.toml`.
- In privacy mode the drones, the names and addresses of the cars and the private lines of "while you were away"
  are hidden, and the voice is silent. MAC addresses never leave the hub; the pointer position never leaves the PC.

## 12. Light on the PC

- Pulse pauses each monitor's drawing and panel updates when windows cover at least 95% of its usable area; the small
  allowance avoids treating normal window gaps as an exposed desktop. It resumes when the monitor is uncovered. Set
  `[pulse]` `pause_when_covered = false` to keep the original behavior. This uses window geometry, so translucent
  windows can appear covered even when the wallpaper is visible through them. If compositor data is unavailable,
  Pulse keeps drawing. Source collection and alert checks continue in the hub while a view is paused.
- 20 frames a second only while you look at an empty desktop (`fps`), 8 with windows open, almost nothing with an app
  full screen; at most 12 on battery; panels refresh once a second; no CSS animations (blinking happens once a
  second, with the data).
- A PC that cannot keep up gets fewer frames by itself.
- `scene = "calm"`: a still grid at 10 frames a second.
- `gpu = "never"` if the wallpaper is heavy on a PC without a working GPU driver (with no GPU device at all Pulse does
  that by itself); `"always"` to force the GPU.
- WebKitGTK uses about 400 MB of memory with one monitor. Every monitor gets its own page (only the first shows
  INCOMING).
- Check it in `btop`: the `WebKitWebProcess` and `python3` processes.

## 13. Troubleshooting

| Problem | Try |
|---|---|
| Still a still wallpaper | `systemctl --user status omarchy-pulse`, `journalctl --user -u omarchy-pulse -e`, `omarchy-pulse doctor`. Is the theme **pulse** (or `--always` set)? Run `extras/install-live` from a terminal on the PC, not SSH. |
| `missing dependencies` in the log | `extras/install-live` again (it installs them). |
| Black or empty on NVIDIA | Pulse already sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` on NVIDIA; also try `gpu = "never"`. |
| A panel does not appear | read the amber line at its bottom; run the command yourself in a terminal; `omarchy-pulse reload`. |
| A panel is missing from a full column | it does not fit: lower its `order`, move it to another `slot`, or turn something off. |
| The weather says `set city` | `city = "Your city"` in `[pulse]`. |
| `omarchy-pulse: command not found` | `~/.local/bin` must be on your PATH (it is on Omarchy). |
| Port 47800 busy | `port = 47801` in `[pulse]`. |
| Too heavy | lower `fps`, `scene = "calm"` or `"skyline"` (the sphere draws the most), `gpu = "never"`, fewer cameras or a lower camera `fps`. |
| The city does not dance | install cava (`sudo pacman -S cava`); it listens only while something plays (playerctl); `[music] input = "pipewire"` if `pulse` does not work; `omarchy-pulse doctor`. |
| No drone for Claude Code | check the hooks in `~/.claude/settings.json` (section 16) and that `omarchy-pulse` is on the PATH of the shell Claude Code uses. |
| Too many fireworks | `celebrate = false` in `[pulse]` (only `omarchy-pulse fireworks` still fires them). |
| The eyes do not follow the pointer | Hyprland only (Pulse reads the pointer from its socket); `eyes = true` in `[presence]`; `face` must not be `"off"`. |
| No "while you were away" | you must be away at least `digest_after` minutes; locking the screen counts, or add the hypridle listener (section 19). |
| No cars on the grid | `ip` must work (`iproute2`) and the network must be a private one (192.168.x, 10.x, 172.16-31.x); install `fping` to see every device. |
| A new-device alert for a known device | name it in `[lan] names`; a phone with a private Wi-Fi address gets a new one per network (turn it off for your home Wi-Fi). |
| The voice says nothing | `enabled = true` in `[voice]`; `omarchy-pulse say "test"`; `omarchy-pulse doctor` (piper-tts or espeak-ng); check `quiet`. |

## 14. Files

```
~/.config/omarchy/themes/pulse/            the theme (colours, borders, btop, stills, extras/)
~/.local/share/omarchy-pulse/              the engine: omarchy-pulse, pulse-live, web/, sources/
~/.local/bin/omarchy-pulse                 the command
~/.config/omarchy-pulse/pulse.toml         your sources
~/.config/omarchy-pulse/sources/           your own scripts (on the sources' PATH)
~/.config/omarchy-pulse/token              the local API token
~/.config/omarchy-pulse/live.conf          ALWAYS=1 with --always
~/.config/systemd/user/omarchy-pulse.service
~/.config/autostart/omarchy-pulse.desktop
~/.config/omarchy/hooks/theme-set.d/omarchy-pulse
~/.local/state/omarchy-pulse/cava.conf     written by Pulse for cava (1.1)
~/.local/state/omarchy-pulse/lan.json      the devices already seen on each network (1.1)
~/.local/state/omarchy-pulse/voice.wav     the last line spoken (1.1)
```

MIT, © 2026 Marco Porro ([x.com/MarcoPorro](https://x.com/MarcoPorro)). Weather by [Open-Meteo](https://open-meteo.com).

---

## 15. The LED sphere

`scene = "sphere"` (the default from 1.1). A globe of LEDs stands in the middle of the city and turns. Every pixel
looks up its place on a screen painted live, so from your chair it reads as one continuous image, with the fine LED
grid, a softer edge, a halo in the colours it shows, its light on the plaza and its reflection on the wet floor.
What faces you stays readable while the sphere turns.

It changes program every 11 seconds, and something important takes over at once:

| Program | When |
|---|---|
| **alert** (red, with a big "!") | right after an alert (section 6) |
| **focus** (the countdown) | during focus mode (section 17) |
| **face** | while one of your agents works, waits, has finished or failed (section 16), or always with `face = "always"` |
| **music** (the spectrum) | while music plays and cava listens (section 17) |
| **clock**, **weather**, **cpu** (your CPU history), **news** (the latest headline or the AI brief) | in turn, the rest of the time |
| **camera** | in turn, when a camera panel exists (never in privacy mode) |

Two looks, `sphere =` in `[pulse]`: **real** (default: one continuous image, as from across the street) or **led**
(thousands of separate lights on a dark globe, the clock and the agent's eyes lit up in them).

It is the heaviest scene to draw: on a PC without a GPU, `scene = "skyline"` is lighter.

## 16. AI agents as drones

Every agent (or any long job) is a drone over the city, with a tag: its name, what it is doing, for how long.

| State | The drone |
|---|---|
| `working` | flies and scans the city with its beam; the face thinks |
| `waiting` | blinks amber with a "!": it needs you; the face looks up, surprised |
| `done` | lands with a green light and small fireworks; the face smiles; gone after 90 s |
| `failed` | lands red and raises an alert; the face is sad; gone after 90 s |
| `idle` | hovers, dim |

From anything:

```
omarchy-pulse agent grok working "reading the issue"
omarchy-pulse agent grok waiting "needs your OK"
omarchy-pulse agent grok done            # or failed, idle, gone
omarchy-pulse watch build -- make release      # working while it runs, done or failed with its exit code
curl -s -X POST -H "X-Pulse-Token: $(cat ~/.config/omarchy-pulse/token)" \
     "http://127.0.0.1:47800/api/agent/grok?state=working&text=reading"
```

**Claude Code**: add the hooks to `~/.claude/settings.json` (merge them with the hooks you already have):

```json
{
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "omarchy-pulse hook claude" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "omarchy-pulse hook claude" }] }],
    "PreToolUse":       [{ "matcher": "", "hooks": [{ "type": "command", "command": "omarchy-pulse hook claude" }] }],
    "Notification":     [{ "hooks": [{ "type": "command", "command": "omarchy-pulse hook claude" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "omarchy-pulse hook claude" }] }],
    "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "omarchy-pulse hook claude" }] }]
  }
}
```

One drone per project (`claude · <folder>`). The hook reads only the event, the tool name and the folder name: your
prompts, your code and the commands it runs never reach the wallpaper. It always exits at once and never blocks
Claude Code, even when Pulse is not running.

**Codex CLI**: in `~/.codex/config.toml`, `notify = ["omarchy-pulse", "hook", "codex"]`: a drone lands at the end of
every turn.

**Grok Bot, or any other agent**: call `omarchy-pulse agent NAME STATE "text"` from its hooks or its scripts, or
start it with `omarchy-pulse watch NAME -- ...`.

Drones are hidden in privacy mode: agent names are often project names.

## 17. Music, fireworks and focus

**Music.** With [cava](https://github.com/karlstav/cava) installed (`sudo pacman -S cava`), the skyline, the horizon,
the floor, the aurora and the sphere move with what you play. Pulse starts cava only while something plays
(playerctl) and stops it after. In `[music]`: `enabled = "auto"` (default) | `"always"` | `"off"`, `input = "pulse"`
(works with PipeWire) or `"pipewire"`, `bars = 24`.

**Fireworks.** By themselves when an agent finishes, a focus session ends, or an alert goes back to green (a small
burst); `celebrate = false` turns those off. By hand, with an optional text in the sky:

```
omarchy-pulse fireworks "v1.1 shipped"
git push && omarchy-pulse fireworks "pushed"
```

**Focus mode.** `omarchy-pulse focus 25 "write the guide"`: every panel dims, the countdown goes on the sphere (or
around the core) and under the clock; at the end, fireworks and a desktop notification. `omarchy-pulse focus off`
stops it.

## 18. Colours, news, clicks and the sun

**Colours.** In `[colors]`: `preset = "theme"` (default: the colours of the Omarchy theme in use), or `synthwave`,
`matrix`, `amber`, `ice`, `vapor`, `inferno`; then any single colour on top: `bg`, `fg`, `accent`, `accent2`, `ok`,
`warn`, `crit`, `dim` (`accent = "#39e1ff"`).

**News.** The `news` source, on by default, shows the Omarchy releases and DHH's posts. `pulse-feed` reads any RSS
or Atom feed, merges several by date and marks what is new in the last 24 hours:

```toml
command = "pulse-feed 'Omarchy=https://github.com/basecamp/omarchy/releases.atom' 'DHH=https://world.hey.com/dhh/feed.atom' 'HN=https://hnrss.org/frontpage'"
```

**Clicks.** Any source can run a command when you click its panel on the desktop:
`click = "xdg-open https://zabbix.example.lan"`, `click = "alacritty -e journalctl -f"`. Only commands written in
your `pulse.toml` run: the page cannot send its own.

**The sun.** The sky follows sunrise and sunset from your weather: a warm dawn and dusk, a lighter day, the night
with its stars. `sun = false` keeps the night.

**Shooting stars** cross the sky when a notification or a news item arrives.

## 19. The face that sees you, and "while you were away"

**Eyes.** The face's eyes follow your pointer, on every monitor (Pulse reads it from Hyprland a few times a second,
only while a wallpaper is on screen). Move the pointer on an empty desktop and the face wakes up and looks at you,
even with no agent at work; after a few seconds it goes back to the sphere's programs.

**Sleep.** When you leave, the face falls asleep (closed eyes, z z z) and the wallpaper slows down to save power.
Pulse knows you left when:

- you lock the screen (hyprlock, swaylock or gtklock) or the Omarchy screensaver starts: by itself;
- hypridle tells it, with a listener in `~/.config/hypr/hypridle.conf` (the most precise, also without locking):

```
listener {
    timeout = 300
    on-timeout = omarchy-pulse away
    on-resume = omarchy-pulse back
}
```

- or you say so: `omarchy-pulse away` / `omarchy-pulse back`.

**While you were away.** When you are back the face wakes up and smiles, and a card shows what happened since you
left: the alerts, the agents that finished, the new devices on your network, the new posts, how many notifications
(without their text). Click it to close it, or it goes by itself. It also comes as a desktop notification, and the
voice can read it (section 21).

```toml
[presence]
eyes = true          # the eyes follow the pointer
lock = true          # lock screen / screensaver = away
digest_after = 2     # minutes away before a digest
notify = true        # the digest as a desktop notification too
```

## 20. Your network on the grid

Every device on your network is a car driving on the grid: two lights and a light trail, coming toward you or going
away. Named devices carry their name; a **new** device (never seen on this network before) blinks amber with its
address, raises an alert (INCOMING) and a notification.

Pulse reads the devices your PC knows (`ip neigh`, no root); with `fping` installed (`sudo pacman -S fping`) it also
looks for every device on the network every 5 minutes. On a network it has never seen it first learns: for 10 minutes
(and until its first full scan, with fping) the devices already there raise no alerts. Only private networks, and nothing leaves the PC; the MAC addresses stay in
`~/.local/state/omarchy-pulse/lan.json` and never reach the page.

```toml
[lan]
enabled = true
cars = true                  # false: no cars, only the alert
scan = "auto"                # "off": only the devices your PC already talks to
alert_new = true
names = { "192.168.1.5" = "nas", "aa:bb:cc:dd:ee:ff" = "tv" }   # by IP or MAC; else the name your router gives
every = 60
```

In privacy mode the cars drive without names or addresses.

## 21. The voice

Pulse can speak, offline: alerts, an agent that finishes, fails or needs you, the digest when you are back ("Welcome
back. While you were away, 25 minutes: claude, omarchytv finished; new device on your network"), the end of a focus.
Off by default.

```toml
[voice]
enabled = true
events = ["alerts", "agents", "digest", "focus"]
quiet = "23:00-08:00"        # never at night ("" = any time)
# model = "~/.local/share/piper/it_IT-paola-medium.onnx"
# command = "spd-say -e"     # or any command that reads the text on stdin
```

It uses [piper](https://github.com/rhasspy/piper) (a natural voice, on your PC) or, if piper is not there,
`espeak-ng` (`sudo pacman -S espeak-ng`). For piper: `yay -S piper-tts-bin` (or `pipx install piper-tts`), then put
a voice (the `.onnx` file and its `.onnx.json`) in `~/.local/share/piper/`, from
[the piper voices](https://huggingface.co/rhasspy/piper-voices): `en_US-lessac-medium`, `it_IT-paola-medium` and many
more. Pulse plays it with `pw-play`, `paplay` or `aplay`.

It never speaks while you share or record the screen, while you are away (the digest waits for you), in focus mode,
or in the quiet hours. Private panels are never read aloud. Try it: `omarchy-pulse say "hello from Pulse"`.
