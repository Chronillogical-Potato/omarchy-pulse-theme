# Homelab tower

A server rack on the horizon that grows with the power your homelab draws, heat rising off it, a red beacon on top.
By Marco Porro, MIT. An example of what the 1.7 editor can do: a picture of its own (an SVG rack), shapes that follow
one of your panels, an animation and actions.

| What | Follows |
|---|---|
| the rack's height, the beacon | your panel `power`, from 0 to 5 (kW) |
| the heat | the same panel: more power, more heat |
| the label | `homelab · {panel:power}` |

**Actions**: click the rack → it shakes and a banner says the power · CI fails on a repo → the rack flashes red ·
CI passes again → a rocket lifts off · the power rises above 4 → a balloon tells you.

**Make it yours**: *Install & edit* in the editor's Community tab. If your panel has another name (`watts`, `ups`...)
or another range (0 to 2000 W), select the rack, the beacon and the heat and change *with* and *its range* in
*follows your data*, and the value in the last action.

A panel called `power` comes from any source that prints a number: Home Assistant, a smart plug, your UPS
([GUIDE.md](../../../docs/GUIDE.md)).
