# zabbix

Current Zabbix problems as green/amber/red status tiles (severity ≥ 4 = crit, ≥ 2 = warn).

## Needs

- `curl`, `jq`
- Zabbix API token (*User settings → API tokens*)
- Network reachability to your Zabbix server

## Config

| Variable | Required | Description |
|---|---|---|
| `ZABBIX_URL` | yes | Base URL or full `…/api_jsonrpc.php` |
| `ZABBIX_TOKEN` | yes | API bearer token |
| `ZABBIX_LIMIT` | no | Max problems (default 8) |

## Install

```bash
cp community/zabbix/pulse-zabbix ~/.config/omarchy-pulse/sources/
chmod +x ~/.config/omarchy-pulse/sources/pulse-zabbix
```

Then paste `source.toml` into `~/.config/omarchy-pulse/pulse.toml`.

Pulse runs as a systemd user service and does **not** see your terminal environment. Set the variables in the command line of `source.toml` (see the active `command =` there). Environment variables only work if you set them for the systemd user service (for example with `Environment=` / `EnvironmentFile=` in the unit).

## Notes

Read-only by default: calls `problem.get` only. Contacts only the host in `ZABBIX_URL`.

**Acknowledge from the wallpaper (Pulse 1.5, off by default).** When this panel has a critical problem, a storm
hangs over the city. Add `ack = '''... pulse-zabbix --ack'''` to the source (see `source.toml`) and a **double
click** on the storm (two clicks within 5 seconds) acknowledges its problems on Zabbix with the message
"acknowledged from Omarchy Pulse" (`event.acknowledge`, action 6). The token needs the right to acknowledge.
