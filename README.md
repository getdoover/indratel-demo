# Indratel Demo — Site Overview

A single-panel site overview for the Indratel demo device: two tank levels, two
pulse flow meters and Elpro hardware diagnostics in one view, live off the
device's own tags.

It is a **cloud (processor) app with a React widget**. The Python side does
almost nothing — it registers a `uiRemoteComponent` so the widget renders on the
agent page. All the data comes from apps already installed on the same device.

## What it shows

| Panel | Source | Tags read |
|---|---|---|
| Tank 1 / Tank 2 | `4_20ma_sensor` installs | `value`, `raw_value` |
| Flow 1 / Flow 2 | `analog_flow_meter` installs (pulse mode) | `flow_rate`, `totaliser`, `flow_active`, `pulse_count`, `last_pulse_dt`, `event_*`, `last_event_summary` |
| Elpro diagnostics | `elpro_quantum_diagnostics` install + `doover_connection` | `battery_voltage_v`, `battery_current_a`, `active_source`, `running_on_battery`, `charge_voltage_v`, `charger_*`, `rssi_last_dbm`/`rssi_dbm`, `rssi_background_dbm`, `radio_*`, `pa_temperature_c`, `unit_model`, `unit_firmware` |

Each diagnostics tile is washed in a pastel tone for its own state — green
healthy, amber worth a look, red acting up — so the unit's condition reads
before any number does. The bands come from the source apps rather than being
invented here: the signal split is the operator's own `weak_signal_threshold_dbm`
on the ELPRO app, and the battery bands scale off the charger's voltage setpoint
so a 24 V bank isn't judged against 12 V numbers.

Units, ranges, k-factors and display names are **not** configured here — they are
read from each source app's own entry in the device's `deployment_config`, so
changing a tank's `max_range` or a meter's `flow_units` updates the dashboard
with no redeploy.

The widget is read-only, and deliberately shows nothing the rest of the page
already shows. No raw DI/DO/AI/AO channel readout (the Device IO Tester app
renders all of those with more context), no restatement of a reading as a
percentage of its own range, and no setup detail — k-factors, full-scale ranges,
IP address, agent build string — that doesn't change between glances. Controls
(reset totaliser, alarm points, output toggles) stay on each source app's own
panel, which already renders them.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `site_name` | `Indratel Demo Site` | Heading at the top of the dashboard |
| `tank_1_app` | `4_20ma_sensor_1` | App install key of the first level sensor |
| `tank_2_app` | `4_20ma_sensor_2` | App install key of the second level sensor |
| `flow_1_app` | `analog_flow_meter_1` | App install key of the first pulse flow meter |
| `flow_2_app` | `analog_flow_meter_2` | App install key of the second pulse flow meter |
| `elpro_app` | `elpro_quantum_diagnostics_1` | App install key of the ELPRO Quantum diagnostics app |
| `platform_app` | `platform` | Platform interface tag namespace — fallback when the ELPRO app isn't installed |
| `show_diagnostics` | `true` | Show the Elpro diagnostics panel |

If a configured key isn't present in `deployment_config`, the widget falls back
to the nth install of that application type — so the dashboard survives an app
being renamed or reinstalled. A panel whose source has never published tags says
so rather than showing a misleading zero.

## Install and test

The Python host app and the frontend are independently installable:

```bash
uv sync
uv run pytest

cd dashboard-widget
npm install
npm test        # vitest over the pure source-resolution helpers
npm run check   # tsc --noEmit
npm run build   # -> assets/IndratelDemoWidget.js
```

The generated asset is git-ignored — Doover runs `build_widget_command` when
packaging the app. To regenerate the checked-in schemas after changing the
Python config or UI:

```bash
uv run export-config
uv run export-ui
```

Publish (builds the widget, exports both schemas, uploads):

```bash
doover app publish
```

## Project map

| Path | Purpose |
|---|---|
| `src/indratel_demo/` | Companion processor and remote-component registration |
| `tests/` | Import, wiring, and config-reference checks |
| `dashboard-widget/src/IndratelDemoWidget.tsx` | Channel subscriptions and page layout |
| `dashboard-widget/src/sources.ts` | Tested helpers that turn aggregates into panel props |
| `dashboard-widget/src/TankPanel.tsx` | Animated tank fill graphic |
| `dashboard-widget/src/FlowPanel.tsx` | Arc gauge, totaliser, pulse count, event summary |
| `dashboard-widget/src/DiagnosticsPanel.tsx` | Battery, charger, radio and link status as pastel-toned tiles |
| `dashboard-widget/src/components/ui/` | shadcn-style primitives (Card, Badge, Skeleton) |
| `dashboard-widget/src/components/icons.tsx` | Local inline icons — no icon package |
| `dashboard-widget/rsbuild.config.ts` | Module Federation and single-file bundle configuration |
| `doover_config.json` | App metadata and generated schemas |

## Dependencies

React and nothing else at runtime. The widget is concatenated into a single
module-federated file that the host loads; an earlier build that pulled in
`lucide-react`, `dayjs` and `class-variance-authority` failed to initialise in
the host and rendered as "Remote component has failed to load". Icons, relative
time and the class-name helpers are local. Check a real agent page after any
dependency change.

## Adapting it

Keep the remote-component `name`, `scope`, module exposure and output filename in
sync if you rename the widget. Adding a panel means adding a `build*` helper in
`sources.ts` (with tests), a component beside the existing panels, and the app
key to `app_config.py` — remembering that a config key is derived from the
element's **display name**, not the attribute name.
