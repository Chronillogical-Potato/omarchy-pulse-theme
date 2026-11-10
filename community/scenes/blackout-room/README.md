# Blackout room

A server room on a street at night. When the grid goes down, the street goes dark and the line from the pole goes
out, but the rack keeps blinking on its batteries. By Anatolii (tolixx), MIT. Made for a homelab in Kyiv that rides
out power cuts on battery stations.

| What | Follows |
|---|---|
| the windows of the houses, the line from the pole | your panel `grid`: the share of your UPSes on grid power, 0 to 100 |
| "on battery" over the room | shown only while `grid` is 0 |
| the battery bank, the colour of the rack's lights | your panel `ups`: the battery level, 0 to 100 (green when full, red when low) |
| the meter on the roof | your panel `watts`: what the homelab draws, full at 500 W |
| the label | `{panel:watts} W · ups {panel:ups}% · grid {panel:grid}%` |

**Install it**: `omarchy-pulse scene get blackout-room` (or the editor: **Community** → blackout-room → **Install**),
then `scene = "blackout-room"` under `[pulse]` in `~/.config/omarchy-pulse/pulse.toml`.

**Actions**: click the room → a banner with the watts and the battery · `grid` drops to 0 → lightning and
"power cut: on battery", the room flashes red · `grid` comes back → a chime and "the grid is back" · `ups` drops
below 30 → the battery flashes and a tip says the level.

With no panels yet, every value is 0: you see the street in a power cut.

**The panels**: any source that prints a number ([GUIDE.md](../../../docs/GUIDE.md)). With one UPS on NUT, for
example:

```toml
[[source]]
name = "grid"
command = "upsc myups@localhost ups.status | grep -q OL && echo 100 || echo 0"
every = 30

[[source]]
name = "ups"
command = "upsc myups@localhost battery.charge"
every = 60

[[source]]
name = "watts"
command = "upsc myups@localhost ups.realpower"
every = 60
```

**No UPS? Try it** with fixed numbers: `command = "echo 100"` for `grid`, `"echo 96"` for `ups`, `"echo 240"` for
`watts`; then change the grid to `"echo 0"` and the power goes out within half a minute.

With several UPSes, `grid` is how many of them take power from the grid, in %: on mine, five EcoFlow stations, so a
cut in one building shows as a half-dark street. Another range for your draw: select the meter and change *its range*
in *follows your data*.
