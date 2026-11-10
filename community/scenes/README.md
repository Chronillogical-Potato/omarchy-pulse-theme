# Community scenes

Whole worlds for the wallpaper, made by the people who use Pulse: shapes, pictures, animations and actions that follow
real data (AI agents, CPU, Git, weather, the sky, your own panels). Every scene runs in Pulse's sandbox: no network,
no token, no access to your files. You can install them from anyone.

## Install one

The easy way: open the scene editor (`omarchy-pulse scene editor`), press **Community**, then **Install** or
**Install & edit**. From a terminal:

```bash
omarchy-pulse scene gallery              # what is here
omarchy-pulse scene get homelab-tower    # install one
```

A `.pulse` file you downloaded: `omarchy-pulse scene import ~/Downloads/NAME.pulse` (the path to the file, wherever it
is: the paths in this folder only exist inside a copy of the repository).

Then `scene = "NAME"` in `[pulse]` of `~/.config/omarchy-pulse/pulse.toml`. A `.pulse` file from this folder can also
be opened with **Import…** in the editor, or `omarchy-pulse scene import FILE.pulse`.

## Scenes

| Scene | Shows | By |
|---|---|---|
| [container-aquarium](container-aquarium/) | a fish for every container of your `docker` panel, green, amber or red with it; lightning when one goes down | Marco Porro |
| [green-build-rocket](green-build-rocket/) | a rocket that lifts off when your CI passes again, a red light while it fails | Marco Porro |
| [moonlit-garden](moonlit-garden/) | a flower per repo, fireflies for your agents, the real Moon, fireworks at midnight | Marco Porro |
| [agent-bell](agent-bell/) | a lantern per AI agent; a bell rings when one is waiting for you | Marco Porro |
| [homelab-tower](homelab-tower/) | a server rack that grows with the power your homelab draws (a panel called `power`); click it, and it shakes and tells you | Marco Porro |
| [blackout-room](blackout-room/) | a server room on a street at night: the houses go dark in a power cut, the rack keeps blinking on its batteries (panels `grid`, `ups`, `watts`) | Anatolii (tolixx) |
| monolith (comes with Pulse, 1.8) | a crystal tower over a mirror lake: your machine, your agents as orbiting shards, your repos as pylons, your services as cubes | Marco Porro |
| mars (comes with Pulse, 1.8) | a colony on Mars with its own sky: the dome is your machine, rovers for your agents, a launch pad per repo, pods for your services, dust storms for your rain | Marco Porro |
| pond (comes with Pulse) | a night pond: every AI agent a fish, every repo a water lily with its CI as the flower | Marco Porro |

`index.json` is the list the editor reads; `tools/scene-index.py` writes it.

## Add yours

Make it in the editor, **Export .pulse**, put it in `community/scenes/NAME/NAME.pulse`, run
`python3 tools/scene-index.py`, open a pull request with one scene: [docs/PACKAGES.md](../../docs/PACKAGES.md#4-put-your-scene-in-the-gallery).
A folder has `NAME.pulse`, `preview.webp` and an optional `README.md`, nothing else.

Wanted: a garage for your agents, a Git forest, a space station, a train yard, a harbour, a server room, your city, your idea.
Every scene merged here shows up in everyone's editor, with your name on its card.
