# Indratel Demo — Site Overview

A single-panel site overview for the Indratel demo device: two tank levels, the
flow meter and the rain gauge in one polished view, live off the device's tags.

It is a **cloud (processor) app with a React widget**. The Python side does
almost nothing — it registers a `uiRemoteComponent` so the widget renders on the
agent page. All the data comes from apps already installed on the same device.

![app type: processor + widget](https://img.shields.io/badge/type-processor%20%2B%20widget-blue)

## What it shows

| Panel | Source app | Tags read |
|---|---|---|
| Tank 1 / Tank 2 | `4_20ma_sensor` | `value`, `raw_value` |
| Flow meter | `analog_flow_meter` | `flow_rate`, `totaliser`, `flow_active`, `event_*`, `last_event_summary`, `sensor_fault_hidden` |
| Rain gauge | `analog_rain_gauge` | `since_9am`, `since_event`, `total_rainfall`, `intensity`, `event_started` |

Units, ranges and display names are **not** configured here — they are read from
each source app's own entry in the device's `deployment_config`, so changing a
tank's `max_range` or a flow meter's `flow_units` updates the dashboard with no
redeploy.

The widget is read-only. Controls (reset totaliser, alarm points, …) stay on
each source app's own panel, which already renders them.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `site_name` | `Indratel Demo Site` | Heading at the top of the dashboard |
| `tank_1_app` | `4_20ma_sensor_1` | App install key of the first level sensor |
| `tank_2_app` | `4_20ma_sensor_2` | App install key of the second level sensor |
| `flow_meter_app` | `analog_flow_meter_1` | App install key of the flow meter |
| `rain_gauge_app` | `analog_rain_gauge_1` | App install key of the rain gauge |

If a configured key isn't present in `deployment_config`, the widget falls back
to the nth install of that application type on the device — so the dashboard
survives an app being renamed or reinstalled. A panel whose source has never
published tags says so rather than showing a misleading zero.

## Development

```bash
uv sync                                  # Python deps
uv run export-config && uv run export-ui # regenerate doover_config.json schemas
npm --prefix dashboard-widget install    # widget deps
npm --prefix dashboard-widget run build  # -> dashboard-widget/assets/IndratelDemoWidget.js
uv run pytest tests -v
```

Publish (builds the widget, exports both schemas, uploads):

```bash
doover app publish
```

## Layout

```
src/indratel_demo/
  __init__.py       # lambda handler -> run_app(IndratelDemoApp())
  application.py    # processor app; subscribes to deployment_config
  app_config.py     # config schema (site name + the four app keys)
  app_ui.py         # the uiRemoteComponent declaration
dashboard-widget/
  src/IndratelDemoWidget.tsx  # data wiring, source resolution
  src/TankPanel.tsx           # animated tank fill graphic
  src/FlowPanel.tsx           # arc gauge + totaliser + event summary
  src/RainPanel.tsx           # rainfall stat tiles
  src/components/ui/          # shadcn-style primitives (Card, Badge, Skeleton)
```
