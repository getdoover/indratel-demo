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
npm --prefix dashboard-widget test       # vitest over src/sources.ts
npm --prefix dashboard-widget run check  # tsc --noEmit
npm --prefix dashboard-widget run build  # -> dashboard-widget/assets/IndratelDemoWidget.js
doover app publish                       # exports both schemas, builds + uploads the widget
```

## Structure

```
src/indratel_demo/{__init__,application,app_config,app_ui}.py
dashboard-widget/src/IndratelDemoWidget.tsx           # subscriptions + layout
dashboard-widget/src/sources.ts                       # pure, tested aggregate -> props
dashboard-widget/src/{Tank,Flow,Diagnostics}Panel.tsx
dashboard-widget/src/components/ui/                   # shadcn-style primitives
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
- **Styling is Tailwind v4 + shadcn-shaped primitives written locally.**
  `styles.css` maps the host site's CSS variables into the Tailwind theme, so
  the widget follows site dark mode.
- **Keep the runtime dependency list to React alone.** The widget ships as one
  concatenated module-federated file; an earlier build with `lucide-react`,
  `dayjs` and `class-variance-authority` failed to initialise in the host with
  `Cannot access 'tA' before initialization` and rendered as "Remote component
  has failed to load". Icons, relative-time formatting and the `cn`/variant
  helpers are all local (`components/icons.tsx`, `lib/format.ts`,
  `lib/utils.ts`) — the same dependency footprint as the working
  `device_io_tester` widget. Adding a package here is a deployment risk, so
  verify on a real agent page after any dependency change.
- All tags for every app on a device live in the single `tag_values` aggregate,
  keyed by app key — one subscription feeds every panel. The platform interface
  publishes hardware diagnostics under the key `platform`, not its install key
  `platform_interface_1`.
- **Show nothing the rest of the agent page already shows.** The panels are an
  at-a-glance summary, not a second copy of the device's raw IO or its static
  setup values — that feedback shaped the current layout, so resist adding
  channel dumps, "% of range" restatements or config echoes back in.
- **Only the value carries a tone colour.** Tinting the small label and hint
  text to match its tile made them unreadable against the wash; those stay on
  `text-muted-foreground` / `text-foreground/75`. The pastel background plus a
  coloured value is enough to read the state.
- **Health bands belong to the source app, not to this one.** `signalBand`
  reads the ELPRO app's `weak_signal_threshold_dbm` out of `deployment_config`,
  and `batteryBand` scales off the charger's `charge_voltage_v` setpoint to tell
  a 12 V bank from a 24 V one. Don't hard-code a second, disagreeing opinion.
- **Keep aggregate-shaping logic in `sources.ts`**, not in components: it is the
  only part with real edge cases (missing apps, seconds-vs-milliseconds
  timestamps, numerically-ordered IO channels) and the only part under test.
- Follow the shape of the official examples in `~/Coding/doover/examples`
  (`examples/device-widget-tag-values`): explicit no-agent / loading / error
  states, `globals.d.ts` for the `customer_site/*` remotes, `npm run check`, and
  a README project-map table.
