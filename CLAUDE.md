# Indratel Demo (Site Overview)

A Doover **cloud processor + React widget** app. The Python side only registers
the remote component; every value on screen comes from other apps' tags on the
same device.

## Commands

```bash
uv sync
uv run export-config                     # -> doover_config.json config_schema
uv run export-ui                         # -> doover_config.json ui_schema
uv run pytest tests -v
npm --prefix dashboard-widget install
npm --prefix dashboard-widget run build  # -> dashboard-widget/assets/IndratelDemoWidget.js
doover app publish                       # exports both schemas, builds + uploads the widget
```

## Structure

```
src/indratel_demo/{__init__,application,app_config,app_ui}.py
dashboard-widget/src/{IndratelDemoWidget,TankPanel,FlowPanel,RainPanel}.tsx
dashboard-widget/src/components/ui/   # shadcn-style primitives
```

## Conventions that matter here

- **Config element names come from the display name**, not the attribute name
  (`config.String("Tank 1 App")` -> key `tank_1_app`). Keep the attribute name
  and the sanitized display name identical, or `$config.app().<key>` in
  `app_ui.py` silently resolves to nothing.
- **Extra kwargs on `ui.RemoteComponent` are passed straight through** to the
  widget as fields on `uiElement` — that is how the app keys reach the JS.
- **Data hooks come from `doover-js/react`** (`useAgentChannel`), not the
  `customer_site/hooks` re-exports. `RemoteComponentWrapper` and
  `useRemoteParams` still come from `customer_site` (not in doover-js).
  `doover-js`, `doover-js/react`, react, react-dom and `@tanstack/react-query`
  are Module Federation singletons so the widget shares the host's client.
- **Styling is Tailwind v4 + shadcn tokens.** `styles.css` maps the host site's
  CSS variables into the Tailwind theme, so the widget follows site dark mode.
- All tags for every app on a device live in the single `tag_values` aggregate,
  keyed by app key — one subscription feeds all four panels.
