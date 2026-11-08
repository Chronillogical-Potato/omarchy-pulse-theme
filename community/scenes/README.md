# Community scenes

Whole worlds for the wallpaper, one JavaScript file each, drawn from your real data (AI agents, CPU, Git, weather).
How to make one, try it in the scene lab and share it: [docs/SCENES.md](../../docs/SCENES.md).

## Install one

```bash
mkdir -p ~/.config/omarchy-pulse/scenes
cp community/scenes/NAME/NAME.js ~/.config/omarchy-pulse/scenes/
```

Then `scene = "NAME"` in `[pulse]` of `~/.config/omarchy-pulse/pulse.toml`.

Scenes run in a sandbox: no network, no token, no access to your files or to Pulse, only a read-only copy of a small
part of the state. You can install them from anyone.

## Scenes

| Name | Shows | By |
|---|---|---|
| pond (comes with Pulse) | a night pond: every AI agent a fish, every repo a water lily with its CI as the flower | Marco Porro |

Wanted: a garage, a Git forest, a space station, an aquarium, a train yard, your idea. One scene per PR.
