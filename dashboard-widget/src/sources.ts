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

/**
 * Round to the precision the panel actually displays.
 *
 * The device publishes live tags at ~2 Hz and they jitter in the third decimal
 * and beyond — 57.611945 then 57.612937 for a tank that has not moved. Carrying
 * that noise into the source objects meant every sample produced a "different"
 * object, re-rendering and repainting the whole page for a picture identical to
 * the last one. Quantising here to what is shown means the objects compare
 * equal, `useStable` holds the previous one, and nothing repaints until a digit
 * on screen genuinely changes.
 */
export function quantise(value: unknown, decimals: number): number | undefined {
  if (!isNum(value)) return undefined;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Round to a whole number of `step` units — for timestamps and uptimes. */
export function quantiseStep(value: unknown, step: number): number | undefined {
  if (!isNum(value)) return undefined;
  return Math.round(value / step) * step;
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
    // Displayed to 1 dp and 2 dp respectively; see `quantise`.
    value: quantise(tag.value, 1),
    units: str(cfg?.measurement_units, "%"),
    min: num(cfg?.min_range, 0),
    max: num(cfg?.max_range, 100),
    rawMilliamps: quantise(tag.raw_value, 2),
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
  const ratePrecision = num(cfg?.flow_decimal_precision, 1);

  return {
    appKey,
    displayName: displayNameOf(cfg, fallbackName),
    meterMode: str(cfg?.meter_mode, "Pulse"),
    flowRate: quantise(tag.flow_rate, ratePrecision),
    totaliser: quantise(tag.totaliser, 0),
    flowActive: tag.flow_active,
    // Timestamps only ever render as relative text, so second resolution is
    // more than the display can show.
    eventStarted: quantiseStep(tag.event_started, 1000),
    eventVolume: quantise(tag.event_volume, 0),
    eventPeakFlow: quantise(tag.event_peak_flow, ratePrecision),
    lastEventSummary: tag.last_event_summary,
    pulseCount: quantise(tag.pulse_count, 0),
    lastPulseAt: quantiseStep(tag.last_pulse_dt, 1000),
    sensorFaultHidden: tag.sensor_fault_hidden,
    volumeUnits,
    rateUnits: `${volumeUnits}${suffix}`,
    maxFlow: num(cfg?.maximum_flow, 1000),
    ratePrecision,
    kFactor: num(cfg?.kfactor_pulses_per_unit, 1),
  };
}

// ---------------------------------------------------------------------------
// Elpro hardware diagnostics
// ---------------------------------------------------------------------------

/**
 * How a reading is doing, in four steps. Panels turn this into a pastel tint so
 * the state of the unit reads from across a room without anyone parsing dBm.
 */
export type Tone = "good" | "fair" | "poor" | "neutral";

export interface DiagnosticsSource {
  /** Tag key the readings came from — the Elpro app if installed, else the platform. */
  tagKey: string;
  reporting: boolean;
  /** True when the readings come from the Elpro diagnostics app rather than the platform interface. */
  detailed: boolean;
  deviceType: string;
  unitModel: unknown;
  firmwareVersion: unknown;

  // Power. `batteryVoltage` is the rail the unit actually runs from; the
  // platform interface's plain `voltage` stands in when the Elpro app is absent.
  batteryVoltage: unknown;
  batteryCurrent: unknown;
  batteryPower: unknown;
  activeSource: unknown;
  runningOnBattery: boolean;

  // Charger. `chargeVoltage` is the setpoint the charger is aiming at, which is
  // only meaningful next to whether it is actually charging.
  chargerPresent: boolean;
  chargeVoltage: unknown;
  chargerStatus: unknown;
  chargerCharging: boolean;
  chargerInputPower: unknown;
  maxChargeCurrent: unknown;

  // Radio.
  radioPresent: boolean;
  radioInitialised: boolean;
  radioAlarm: boolean;
  radioState: unknown;
  radioDriverState: unknown;
  radioUptimeSeconds: unknown;
  rssiDbm: unknown;
  rssiBackgroundDbm: unknown;
  /** The operator's own weak-signal threshold, read from the Elpro app's config. */
  weakSignalDbm: number;
  txFrequencyMhz: unknown;
  txPowerDbm: unknown;
  paTemperatureC: unknown;

  temperatureC: unknown;
  uptimeSeconds: unknown;
}

export interface ConnectionSource {
  determination: string | null;
  status: string | null;
  latencyMs: unknown;
  lastOnline: unknown;
}

/**
 * Band a battery rail against the charger's own setpoint.
 *
 * A 12 V and a 24 V unit want different numbers, and the charge setpoint is the
 * one tag that tells them apart without a config option — 13.8 V means a 12 V
 * bank, 27.6 V means 24 V. Thresholds are per-12V-of-nominal: below 11.4 V a
 * lead-acid bank is close to flat, and below 12.0 V it is under half charge.
 */
export function batteryBand(volts: unknown, chargeVoltage: unknown): Tone {
  if (!isNum(volts)) return "neutral";
  const scale = isNum(chargeVoltage) && chargeVoltage > 20 ? 2 : 1;
  if (volts < 11.4 * scale) return "poor";
  if (volts < 12.0 * scale) return "fair";
  return "good";
}

/**
 * Band received signal against the operator's weak-signal threshold.
 *
 * The Elpro app raises its own warning below `weakSignalDbm` (default -100 dBm
 * on a narrowband licensed link), so match that boundary rather than inventing
 * a second opinion, and call anything a further 10 dB down "poor" — that is the
 * app's own Poor/Fair split.
 */
export function signalBand(rssiDbm: unknown, weakSignalDbm: number): Tone {
  if (!isNum(rssiDbm)) return "neutral";
  if (rssiDbm < weakSignalDbm - 10) return "poor";
  if (rssiDbm < weakSignalDbm) return "fair";
  return "good";
}

export function radioBand(diagnostics: DiagnosticsSource): Tone {
  if (!diagnostics.radioPresent) return "neutral";
  if (diagnostics.radioAlarm || !diagnostics.radioInitialised) return "poor";
  return "good";
}

export function chargerBand(diagnostics: DiagnosticsSource): Tone {
  if (!diagnostics.chargerPresent) return "neutral";
  if (diagnostics.chargerCharging) return "good";
  // Not charging while the battery carries the unit is the state worth noticing:
  // the bank is going down with nothing putting charge back in.
  return diagnostics.runningOnBattery ? "fair" : "neutral";
}

export function buildDiagnostics(
  configuredElproKey: string | undefined,
  configuredPlatformKey: string | undefined,
  applications: Applications,
  tags: Record<string, TagBag>,
): DiagnosticsSource {
  const elproKey =
    resolveAppKey(configuredElproKey, applications, "elpro_quantum_diagnostics", 0) ??
    configuredElproKey ??
    null;
  const elpro = (elproKey ? tags[elproKey] : undefined) ?? {};
  const detailed = Object.keys(elpro).length > 0;

  // The platform interface publishes a plain voltage and power for every device
  // type; it is the fallback when the Elpro-specific app isn't installed.
  const platformKey =
    configuredPlatformKey && configuredPlatformKey.length > 0 ? configuredPlatformKey : "platform";
  const platform = tags[platformKey] ?? {};

  // Every app install records the device type it was deployed onto; any of them
  // will do, and they all agree.
  const deviceType = str(
    Object.values(applications).find((cfg) => typeof cfg?.DEVICE_TYPE === "string")?.DEVICE_TYPE,
    "Elpro",
  );

  // The operator sets the weak-signal threshold on the Elpro app, so read it
  // from there rather than hard-coding a second, disagreeing default here.
  const elproConfig = elproKey ? applications[elproKey] : undefined;

  return {
    tagKey: detailed ? (elproKey as string) : platformKey,
    reporting: detailed || Object.keys(platform).length > 0,
    detailed,
    deviceType,
    unitModel: elpro.unit_model,
    firmwareVersion: elpro.unit_firmware ?? platform.firmware_version,

    batteryVoltage: quantise(elpro.battery_voltage_v ?? platform.voltage, 2),
    batteryCurrent: quantise(elpro.battery_current_a, 2),
    batteryPower: quantise(elpro.battery_power_w ?? platform.power_watts, 2),
    activeSource: elpro.active_source,
    runningOnBattery: elpro.running_on_battery === true,

    chargerPresent: elpro.charger_present === true,
    chargeVoltage: quantise(elpro.charge_voltage_v, 1),
    chargerStatus: elpro.charger_status,
    chargerCharging: elpro.charger_charging === true,
    chargerInputPower: quantise(elpro.charger_input_power_w, 1),
    maxChargeCurrent: quantise(elpro.max_charge_current_a, 1),

    radioPresent: elpro.radio_present === true,
    radioInitialised: elpro.radio_initialised === true,
    radioAlarm: elpro.radio_alarm === true,
    radioState: elpro.radio_driver_state ?? elpro.radio_state,
    radioDriverState: elpro.radio_driver_state,
    // Rendered as "10d 22h", so anything finer than a minute is invisible.
    radioUptimeSeconds: quantiseStep(elpro.radio_uptime_s, 60),
    rssiDbm: quantise(elpro.rssi_last_dbm ?? elpro.rssi_dbm, 0),
    rssiBackgroundDbm: quantise(elpro.rssi_background_dbm, 0),
    weakSignalDbm: num(elproConfig?.weak_signal_threshold_dbm, -100),
    txFrequencyMhz: quantise(elpro.tx_frequency_mhz, 1),
    txPowerDbm: quantise(elpro.tx_power_dbm, 0),
    paTemperatureC: quantise(elpro.pa_temperature_c, 0),

    temperatureC: quantise(platform.temperature_c, 1),
    uptimeSeconds: quantiseStep(platform.uptime_s, 60),
  };
}

export function buildConnection(connection: Record<string, any> | undefined): ConnectionSource {
  const status = connection?.status ?? {};
  return {
    determination: typeof connection?.determination === "string" ? connection.determination : null,
    status: typeof status.status === "string" ? status.status : null,
    latencyMs: quantise(status.latency_ms, 0),
    lastOnline: quantiseStep(status.last_online, 1000),
  };
}
