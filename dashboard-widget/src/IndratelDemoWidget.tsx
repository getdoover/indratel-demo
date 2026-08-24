import "./styles.css";
import {useMemo} from "react";
import RemoteComponentWrapper from "customer_site/RemoteComponentWrapper";
import {useRemoteParams} from "customer_site/useRemoteParams";
import {useAgentChannel} from "doover-js/react";
import {RadioTower} from "lucide-react";

import {Badge} from "./components/ui/badge";
import {FlowPanel, type FlowSource} from "./FlowPanel";
import {RainPanel, type RainSource} from "./RainPanel";
import {TankPanel, type TankSource} from "./TankPanel";
import {absTime, dayjs, fromNow, isNum} from "./lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The extra fields our `ui.RemoteComponent` carries through from app_ui.py. */
interface IndratelDemoElement {
  app_key?: string;
  site_name?: string;
  tank_1_app?: string;
  tank_2_app?: string;
  flow_meter_app?: string;
  rain_gauge_app?: string;
}

type TagBag = Record<string, unknown>;
type AppConfig = Record<string, unknown>;

interface DeploymentConfig {
  applications?: Record<string, AppConfig>;
}

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a configured app key against what is actually deployed.
 *
 * The configured key wins whenever the device knows about it. When it doesn't —
 * an app was renamed, or a second instance replaced the first — we fall back to
 * the nth install of the matching application type, so the dashboard keeps
 * working instead of silently going blank. `null` means nothing matches.
 */
function resolveAppKey(
  configured: string | undefined,
  applications: Record<string, AppConfig>,
  applicationName: string,
  ordinal: number,
): string | null {
  if (configured && applications[configured]) return configured;

  const candidates = Object.keys(applications)
    .filter((key) => applications[key]?.APPLICATION_NAME === applicationName)
    .sort();
  return candidates[ordinal] ?? null;
}

function num(value: unknown, fallback: number): number {
  return isNum(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function displayNameOf(cfg: AppConfig | undefined, fallback: string): string {
  return str(cfg?.APP_INSTALL_DISPLAY_NAME ?? cfg?.APP_DISPLAY_NAME, fallback);
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

function IndratelDemoWidgetInner({uiElement}: {uiElement: IndratelDemoElement}) {
  const {agentId} = useRemoteParams();

  // One aggregate carries every app's tags on the device, keyed by app key, so
  // a single subscription feeds all four panels.
  const tagsQuery = useAgentChannel<Record<string, TagBag>>(agentId, "tag_values");
  const configQuery = useAgentChannel<DeploymentConfig>(agentId, "deployment_config");

  const tags = tagsQuery.data ?? {};
  const applications = configQuery.data?.applications ?? {};

  const tank1 = useMemo<TankSource>(
    () => buildTank(uiElement.tank_1_app, applications, tags, 0, "Tank 1"),
    [uiElement.tank_1_app, applications, tags],
  );
  const tank2 = useMemo<TankSource>(
    () => buildTank(uiElement.tank_2_app, applications, tags, 1, "Tank 2"),
    [uiElement.tank_2_app, applications, tags],
  );
  const flow = useMemo<FlowSource>(
    () => buildFlow(uiElement.flow_meter_app, applications, tags),
    [uiElement.flow_meter_app, applications, tags],
  );
  const rain = useMemo<RainSource>(
    () => buildRain(uiElement.rain_gauge_app, applications, tags),
    [uiElement.rain_gauge_app, applications, tags],
  );

  const lastUpdated = tagsQuery.last_updated;
  // The device polls its analog inputs every second or two, so anything older
  // than a minute means the link — not the sensor — has gone quiet.
  const stale = isNum(lastUpdated) ? dayjs().diff(dayjs(lastUpdated), "second") > 60 : true;

  return (
    <div className="text-foreground w-full space-y-3 py-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          {str(uiElement.site_name, "Site Overview")}
        </h2>
        <Badge
          variant={stale ? "muted" : "success"}
          title={lastUpdated ? absTime(lastUpdated) : undefined}
        >
          <RadioTower className="size-3" />
          {lastUpdated ? `updated ${fromNow(lastUpdated)}` : "waiting for data"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TankPanel tank={tank1} />
        <TankPanel tank={tank2} />
      </div>

      <FlowPanel flow={flow} />
      <RainPanel rain={rain} />
    </div>
  );
}

function buildTank(
  configured: string | undefined,
  applications: Record<string, AppConfig>,
  tags: Record<string, TagBag>,
  ordinal: number,
  fallbackName: string,
): TankSource {
  const appKey = resolveAppKey(configured, applications, "4_20ma_sensor", ordinal);
  const cfg = appKey ? applications[appKey] : undefined;
  const tag = (appKey ? tags[appKey] : undefined) ?? {};

  return {
    appKey,
    displayName: displayNameOf(cfg, fallbackName),
    value: tag.value,
    units: str(cfg?.measurement_units, "%"),
    min: num(cfg?.min_range, 0),
    max: num(cfg?.max_range, 100),
    rawMilliamps: tag.raw_value,
  };
}

function buildFlow(
  configured: string | undefined,
  applications: Record<string, AppConfig>,
  tags: Record<string, TagBag>,
): FlowSource {
  const appKey = resolveAppKey(configured, applications, "analog_flow_meter", 0);
  const cfg = appKey ? applications[appKey] : undefined;
  const tag = (appKey ? tags[appKey] : undefined) ?? {};

  const volumeUnits = str(cfg?.flow_units, "L");
  // The app's rate label is a config choice (Per Hour / Per Minute / …); mirror
  // it so the gauge never claims units the device isn't using.
  const timeBase = str(cfg?.flow_rate_time_base, "Per Hour");
  const rateSuffix =
    timeBase === "Per Second" ? "/s" : timeBase === "Per Minute" ? "/min" : timeBase === "Per Day" ? "/day" : "/hr";

  return {
    appKey,
    displayName: displayNameOf(cfg, "Flow Meter"),
    flowRate: tag.flow_rate,
    totaliser: tag.totaliser,
    flowActive: tag.flow_active,
    eventStarted: tag.event_started,
    eventVolume: tag.event_volume,
    eventPeakFlow: tag.event_peak_flow,
    lastEventSummary: tag.last_event_summary,
    sensorFaultHidden: tag.sensor_fault_hidden,
    volumeUnits,
    rateUnits: `${volumeUnits}${rateSuffix}`,
    maxFlow: num(cfg?.maximum_flow, 1000),
    ratePrecision: num(cfg?.flow_decimal_precision, 1),
  };
}

function buildRain(
  configured: string | undefined,
  applications: Record<string, AppConfig>,
  tags: Record<string, TagBag>,
): RainSource {
  const appKey = resolveAppKey(configured, applications, "analog_rain_gauge", 0) ?? configured ?? null;
  const cfg = appKey ? applications[appKey] : undefined;
  const tag = (appKey ? tags[appKey] : undefined) ?? {};

  return {
    appKey,
    displayName: displayNameOf(cfg, "Rain Gauge"),
    // A rain gauge that has never reported has no tags at all — distinguish
    // that from a genuine zero so the panel can say so rather than show "0.0".
    reporting: Object.keys(tag).length > 0,
    since9am: tag.since_9am,
    sinceEvent: tag.since_event,
    totalRainfall: tag.total_rainfall,
    intensity: tag.intensity,
    eventStarted: tag.event_started,
  };
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

// The query client and doover context both come from the host via
// RemoteComponentWrapper — doover-js is a shared singleton (rsbuild.config.ts),
// so the hooks below read the host's live DooverClient directly.
const IndratelDemoWidget = (props: any) => (
  <RemoteComponentWrapper>
    <IndratelDemoWidgetInner {...props} />
  </RemoteComponentWrapper>
);

export default IndratelDemoWidget;
