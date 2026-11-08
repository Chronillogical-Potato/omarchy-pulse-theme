# homeassistant

Home Assistant entities on your wallpaper, each with **the age of its last report**, so a stale "all clear" never
looks like a healthy system.

- each entity is a tile: its name, its value, and how long ago it last reported ("5m")
- past its **max age** the tile turns amber and says `stale 3h (max 2h)` instead of the old value looking fine
- `unavailable` or `unknown` is red, never OK
- a door, window, leak or smoke sensor that is open or wet is amber
- read-only: one GET per entity, nothing is changed in Home Assistant

## Why last_reported

Home Assistant has three times on every entity. `last_changed` and `last_updated` only move when the value (or an
attribute) changes, so a door that stays closed for a week looks a week old even if it reports every minute.
`last_reported` (Home Assistant 2024.3 and newer) moves at every report, even when nothing changed: that is the one
that tells a sensor that is fine from a sensor that went silent. On older versions the script falls back to
`last_updated`; give those entities a generous max age.

## Needs

- `python3` (standard library only)
- A long-lived access token: Home Assistant, your profile, Security, Long-lived access tokens

## Config

| Variable | Required | Description |
|---|---|---|
| `HA_URL` | yes | e.g. `http://homeassistant.local:8123` |
| `HA_TOKEN_FILE` | yes (or `HA_TOKEN`) | File with the token, one line, `chmod 600` |
| `HA_ENTITIES` | yes | Comma-separated `entity_id` or `entity_id=max_age` (`90s`, `15m`, `2h`, `1d`) |
| `HA_MAX_AGE` | no | Max age for entities without their own, default `1h` |
| `HA_HIDE_NAMES` | no | `1` shows "sensor 1", "sensor 2"... (for screenshots) |

```bash
mkdir -p ~/.config/pulse-homeassistant
nano ~/.config/pulse-homeassistant/token     # paste the token, one line
chmod 600 ~/.config/pulse-homeassistant/token
cp community/homeassistant/pulse-homeassistant ~/.config/omarchy-pulse/sources/
chmod +x ~/.config/omarchy-pulse/sources/pulse-homeassistant
```

Then paste `source.toml` into `~/.config/omarchy-pulse/pulse.toml` and set your entities.

Pick the max age from how often the device reports: a Zigbee door sensor checks in every hour or so, a temperature
sensor every few minutes, a battery leak sensor maybe twice a day.

## Privacy

`private = true` in the example: the panel hides while you share the screen. Names of rooms and devices can say a
lot about a home.
