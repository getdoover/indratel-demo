/**
 * Pure helpers that turn the device's `tag_values` and `deployment_config`
 * aggregates into the shapes each panel renders. Kept free of React so they can
 * be unit tested against real aggregate payloads.
 */

export type TagBag = Record<string, unknown>;
export type AppConfig = Record<string, unknown>;
export type Applications = Record<string, AppConfig>;

export interface DeploymentConfig {
  applications?: Applications;
}

export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function num(value: unknown, fallback: number): number {
  return isNum(value) ? value : fallback;
}

export function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** Clamp a value into 0..1 given a range, tolerating a zero-width range. */
export function fraction(value: number, min: number, max: number): number {
  if (!Number.isFinite(max - min) || max - min === 0) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Resolve a configured app key against what is actually deployed.
 *
 * The configured key wins whenever the device knows about it. When it doesn't —
 * an app was renamed, or a second instance replaced the first — fall back to the
 * nth install of the matching application type, so the dashboard keeps working
 * instead of silently going blank. `null` means nothing matches.
 */
export function resolveAppKey(
  configured: string | undefined,
  applications: Applications,
  applicationName: string,
  ordinal: number,
): string | null {
  if (configured && applications[configured]) return configured;

  const candidates = Object.keys(applications)
    .filter((key) => applications[key]?.APPLICATION_NAME === applicationName)
    .sort();
  return candidates[ordinal] ?? null;
}

export function displayNameOf(cfg: AppConfig | undefined, fallback: string): string {
  return str(cfg?.APP_INSTALL_DISPLAY_NAME ?? cfg?.APP_DISPLAY_NAME, fallback);
}

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

export interface TankSource {
  appKey: string | null;
  displayName: string;
  /** The 4-20mA app's `value` tag, already scaled into engineering units. */
  value: unknown;
  units: string;
  min: number;
  max: number;
  /** Raw loop current in mA — below ~3.5 mA the loop is open. */
  rawMilliamps: unknown;
}

export function buildTank(
  configured: string | undefined,
  applications: Applications,
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

// ---------------------------------------------------------------------------
// Flow meters
// ---------------------------------------------------------------------------

export interface FlowSource {
  appKey: string | null;
  displayName: string;
  /** "Pulse" or "Analog" — pulse meters have no analog signal to fault. */
  meterMode: string;
  flowRate: unknown;
  totaliser: unknown;
  flowActive: unknown;
  eventStarted: unknown;
  eventVolume: unknown;
  eventPeakFlow: unknown;
  lastEventSummary: unknown;
  pulseCount: unknown;
  lastPulseAt: unknown;
  /** The app publishes `sensor_fault_hidden` — true means healthy. */
  sensorFaultHidden: unknown;
  /** e.g. "L" */
  volumeUnits: string;
  /** e.g. "L/hr" */
  rateUnits: string;
  maxFlow: number;
  ratePrecision: number;
  /** Pulses per unit volume, straight from the meter's k-factor. */
  kFactor: number;
}

const RATE_SUFFIXES: Record<string, string> = {
  "Per Second": "/s",
  "Per Minute": "/min",
  "Per Hour": "/hr",
  "Per Day": "/day",
};

export function buildFlow(
  configured: string | undefined,
  applications: Applications,
  tags: Record<string, TagBag>,
  ordinal: number,
  fallbackName: string,
): FlowSource {
  const appKey = resolveAppKey(configured, applications, "analog_flow_meter", ordinal);
  const cfg = appKey ? applications[appKey] : undefined;
  const tag = (appKey ? tags[appKey] : undefined) ?? {};

  const volumeUnits = str(cfg?.flow_units, "L");
  // The rate label is a config choice on the meter; mirror it so the gauge
  // never claims units the device isn't using.
  const suffix = RATE_SUFFIXES[str(cfg?.flow_rate_time_base, "Per Hour")] ?? "/hr";

  return {
    appKey,
    displayName: displayNameOf(cfg, fallbackName),
    meterMode: str(cfg?.meter_mode, "Pulse"),
    flowRate: tag.flow_rate,
    totaliser: tag.totaliser,
    flowActive: tag.flow_active,
    eventStarted: tag.event_started,
    eventVolume: tag.event_volume,
    eventPeakFlow: tag.event_peak_flow,
    lastEventSummary: tag.last_event_summary,
    pulseCount: tag.pulse_count,
    lastPulseAt: tag.last_pulse_dt,
    sensorFaultHidden: tag.sensor_fault_hidden,
    volumeUnits,
    rateUnits: `${volumeUnits}${suffix}`,
    maxFlow: num(cfg?.maximum_flow, 1000),
    ratePrecision: num(cfg?.flow_decimal_precision, 1),
    kFactor: num(cfg?.kfactor_pulses_per_unit, 1),
  };
}

// ---------------------------------------------------------------------------
// Elpro hardware diagnostics
// ---------------------------------------------------------------------------

export interface IoChannel {
  label: string;
  state: boolean;
}

export interface AnalogChannel {
  label: string;
  value: number;
  /** Empty unless an app on the device tells us what is wired to the channel. */
  units: string;
}

export interface DiagnosticsSource {
  /** The tag namespace the platform interface publishes under. */
  tagKey: string;
  reporting: boolean;
  deviceType: string;
  voltage: unknown;
  powerWatts: unknown;
  temperatureC: unknown;
  uptimeSeconds: unknown;
  firmwareVersion: unknown;
  digitalInputs: IoChannel[];
  digitalOutputs: IoChannel[];
  analogInputs: AnalogChannel[];
  analogOutputs: AnalogChannel[];
}

export interface ConnectionSource {
  determination: string | null;
  status: string | null;
  latencyMs: unknown;
  lastOnline: unknown;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Collect `PREFIX<n>` tags into an ordered list. The platform interface names
 * its IO tags positionally (DI0, DO3, AI5), including slave channels in the same
 * flat namespace, so sorting numerically keeps a 10-channel unit in board order.
 */
function collectIndexed(tags: TagBag, prefix: string): Array<{index: number; value: unknown}> {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  return Object.keys(tags)
    .map((key) => ({key, match: pattern.exec(key)}))
    .filter((entry): entry is {key: string; match: RegExpExecArray} => entry.match !== null)
    .map((entry) => ({index: Number(entry.match[1]), value: tags[entry.key]}))
    .sort((a, b) => a.index - b.index);
}

function digitalChannels(tags: TagBag, prefix: string): IoChannel[] {
  return collectIndexed(tags, prefix)
    .filter((entry) => typeof entry.value === "boolean")
    .map((entry) => ({label: `${prefix}${entry.index}`, state: entry.value === true}));
}

/**
 * Which analog input channels are 4-20mA loops, according to the apps wired to
 * them.
 *
 * The platform interface publishes bare numbers with no units, and the reading
 * alone can't tell you: a disconnected 4-20mA loop reads 0, which is
 * indistinguishable from 0 V. Only the app that owns the pin knows, so ask it.
 */
export function currentLoopPins(applications: Applications): Set<number> {
  const pins = new Set<number>();
  for (const cfg of Object.values(applications)) {
    if (cfg?.APPLICATION_NAME === "4_20ma_sensor" && isNum(cfg.ai_pin_number)) {
      pins.add(cfg.ai_pin_number);
    }
    // Pulse-mode meters read a digital input; only analog mode claims an AI.
    if (
      cfg?.APPLICATION_NAME === "analog_flow_meter" &&
      cfg.meter_mode === "Analog" &&
      isNum(cfg.analog_input_pin)
    ) {
      pins.add(cfg.analog_input_pin);
    }
  }
  return pins;
}

function analogChannels(tags: TagBag, prefix: string, milliampPins: Set<number>): AnalogChannel[] {
  return collectIndexed(tags, prefix)
    .filter((entry) => isNum(entry.value))
    .map((entry) => ({
      label: `${prefix}${entry.index}`,
      value: entry.value as number,
      units: milliampPins.has(entry.index) ? "mA" : "",
    }));
}

export function buildDiagnostics(
  configuredTagKey: string | undefined,
  applications: Applications,
  tags: Record<string, TagBag>,
): DiagnosticsSource {
  const tagKey = configuredTagKey && configuredTagKey.length > 0 ? configuredTagKey : "platform";
  const tag = tags[tagKey] ?? {};

  // Every app install records the device type it was deployed onto; any of them
  // will do, and they all agree.
  const deviceType = str(
    Object.values(applications).find((cfg) => typeof cfg?.DEVICE_TYPE === "string")?.DEVICE_TYPE,
    "Elpro",
  );

  return {
    tagKey,
    reporting: Object.keys(tag).length > 0,
    deviceType,
    voltage: tag.voltage,
    powerWatts: tag.power_watts,
    temperatureC: tag.temperature_c,
    uptimeSeconds: tag.uptime_s,
    firmwareVersion: tag.firmware_version,
    digitalInputs: digitalChannels(tag, "DI"),
    digitalOutputs: digitalChannels(tag, "DO"),
    analogInputs: analogChannels(tag, "AI", currentLoopPins(applications)),
    // Nothing on the device declares what an output drives, so leave it bare.
    analogOutputs: analogChannels(tag, "AO", new Set()),
  };
}

export function buildConnection(connection: Record<string, any> | undefined): ConnectionSource {
  const status = connection?.status ?? {};
  return {
    determination: typeof connection?.determination === "string" ? connection.determination : null,
    status: typeof status.status === "string" ? status.status : null,
    latencyMs: status.latency_ms,
    lastOnline: status.last_online,
    ip: typeof status.ip === "string" ? status.ip : null,
    userAgent: typeof status.user_agent === "string" ? status.user_agent : null,
  };
}

/**
 * Elpro units run on a nominal 12 V or 24 V supply. Rather than guess which,
 * band against the absolute limits the hardware tolerates.
 */
export function supplyHealth(volts: number): "low" | "ok" | "high" {
  if (volts < 10.5) return "low";
  if (volts > 30) return "high";
  return "ok";
}
