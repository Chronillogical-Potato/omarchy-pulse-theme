# unifi

A UniFi gateway on your wallpaper:

- `pulse-unifi`: WAN download as a stat with a sparkline, upload and ISP in the note. Red when the WAN is down.
- `pulse-unifi clients`: the busiest clients as a name → down/up table, how many are online in the note.

## Needs

- `python3` (standard library only)
- A UniFi gateway on UniFi OS (Network 9 or newer) and an API key: UniFi Settings > Control Plane > Integrations > Create API Key. Tested on a UniFi Express 7 with Network 10.6.

## Config

| Variable | Required | Description |
|---|---|---|
| `UNIFI_URL` | yes | Gateway address on the LAN, e.g. `https://192.168.1.1` |
| `UNIFI_KEY_FILE` | yes (or `UNIFI_KEY`) | File with the API key, one line, `chmod 600` |
| `UNIFI_KEY` | no | The key itself, if you prefer it in the command |
| `UNIFI_SITE` | no | Site name, default `default` |
| `UNIFI_LIMIT` | no | Rows in `clients`, default 8 |
| `UNIFI_HIDE_NAMES` | no | `1` shows clients as "device 1", "device 2"... (for screenshots) |
| `UNIFI_VERIFY_TLS` | no | `1` checks the certificate. Off by default, since gateways use a self-signed one on the LAN |

Save the key:

```bash
mkdir -p ~/.config/pulse-unifi
nano ~/.config/pulse-unifi/key        # paste the key, one line
chmod 600 ~/.config/pulse-unifi/key
```

## Install

```bash
cp community/unifi/pulse-unifi ~/.config/omarchy-pulse/sources/
chmod +x ~/.config/omarchy-pulse/sources/pulse-unifi
```

Then paste `source.toml` into `~/.config/omarchy-pulse/pulse.toml` (tokens and addresses go there or in environment variables, never inside the script). The clients panel is `private = true` (hidden while you share the screen): device names are often people's names.

Pulse runs as a systemd user service and does **not** see your terminal environment. Set the variables in the command line of `source.toml` (see the active `command =` there).

## Notes

Read-only: GET requests to `/proxy/network` on the gateway (`stat/health`, `clients/active`). Contacts only `UNIFI_URL`. The key has the rights of the UniFi user that created it; the script never writes. Client rates are from the gateway's side, so the script swaps them to show what each device downloads and uploads.
