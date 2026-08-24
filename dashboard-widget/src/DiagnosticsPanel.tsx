import {
  AntennaIcon,
  BatteryIcon,
  PlugIcon,
  SignalIcon,
  ThermometerIcon,
  TimerIcon,
} from "./components/icons";

import {Badge} from "./components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "./components/ui/card";
import {cn} from "./lib/utils";
import {absTime, fmt, fmtDuration, fromNow, isNum} from "./lib/format";
import {
  batteryBand,
  chargerBand,
  radioBand,
  signalBand,
  type ConnectionSource,
  type DiagnosticsSource,
  type Tone,
} from "./sources";

/**
 * Hardware health only.
 *
 * Deliberately no IO channel readout: the Device IO Tester app already renders
 * every DI/DO/AI/AO on this page, and the tank and flow panels above show what
 * the wired channels actually mean. Repeating the raw channels here would be
 * the same information with less context.
 *
 * Each tile carries a pastel wash of its own state, so a glance at the colours
 * answers "is this unit healthy" before any number is read. The tints are
 * alpha over the host's background rather than fixed pastels, so they stay soft
 * in light mode and don't glare in dark mode.
 */
const TONE_SURFACE: Record<Tone, string> = {
  good: "bg-emerald-500/10 border-emerald-500/25",
  fair: "bg-amber-500/10 border-amber-500/25",
  poor: "bg-red-500/10 border-red-500/25",
  neutral: "bg-muted/50 border-border",
};

/**
 * Only the value carries the tone. Labels and hints stay on the host's own
 * foreground tokens: small text tinted to match its tile is the first thing to
 * become unreadable, and the wash plus the coloured value already say the state.
 */
const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-700 dark:text-emerald-300",
  fair: "text-amber-800 dark:text-amber-300",
  poor: "text-red-700 dark:text-red-300",
  neutral: "text-foreground",
};

function Metric({
  icon: Icon,
  label,
  value,
  units,
  hint,
  tone = "neutral",
}: {
  icon: (props: {className?: string}) => JSX.Element;
  label: string;
  value: string;
  units?: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", TONE_SURFACE[tone])}>
      <div className="text-muted-foreground flex items-center gap-1 text-[11px] uppercase tracking-wide">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn("text-xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</span>
        {units && <span className="text-muted-foreground text-xs">{units}</span>}
      </div>
      {hint && <div className="text-foreground/75 mt-0.5 text-[11px]">{hint}</div>}
    </div>
  );
}

const SIGNAL_LABEL: Record<Tone, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  neutral: "No signal reported",
};

function batteryHint(diagnostics: DiagnosticsSource): string | undefined {
  const source = diagnostics.runningOnBattery
    ? "on battery"
    : typeof diagnostics.activeSource === "string"
      ? `on ${diagnostics.activeSource}`
      : undefined;
  // Negative current means the battery is carrying the unit, positive that it
  // is being charged — sign is the whole story, so keep it.
  const current = isNum(diagnostics.batteryCurrent)
    ? `${fmt(diagnostics.batteryCurrent, 2)} A`
    : undefined;
  return [source, current].filter(Boolean).join(" · ") || undefined;
}

function chargeHint(diagnostics: DiagnosticsSource): string | undefined {
  if (diagnostics.chargerCharging && isNum(diagnostics.chargerInputPower)) {
    return `charging · ${fmt(diagnostics.chargerInputPower, 1)} W in`;
  }
  if (typeof diagnostics.chargerStatus === "string") return diagnostics.chargerStatus;
  return diagnostics.chargerPresent ? undefined : "no charger";
}

function radioHint(diagnostics: DiagnosticsSource): string | undefined {
  if (diagnostics.radioAlarm) return "radio alarm";
  const frequency = isNum(diagnostics.txFrequencyMhz)
    ? `${fmt(diagnostics.txFrequencyMhz, 1)} MHz`
    : undefined;
  const power = isNum(diagnostics.txPowerDbm)
    ? `${fmt(diagnostics.txPowerDbm, 0)} dBm`
    : undefined;
  return [frequency, power].filter(Boolean).join(" · ") || undefined;
}

export function DiagnosticsPanel({
  diagnostics,
  connection,
}: {
  diagnostics: DiagnosticsSource;
  connection: ConnectionSource;
}) {
  const online = connection.determination === "Online";
  const battery = batteryBand(diagnostics.batteryVoltage, diagnostics.chargeVoltage);
  const charge = chargerBand(diagnostics);
  const signal = signalBand(diagnostics.rssiDbm, diagnostics.weakSignalDbm);
  const radio = radioBand(diagnostics);

  const subtitle = [
    typeof diagnostics.unitModel === "string" ? diagnostics.unitModel : null,
    typeof diagnostics.firmwareVersion === "string"
      ? `firmware ${diagnostics.firmwareVersion}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{diagnostics.deviceType} diagnostics</CardTitle>
          {subtitle && <div className="text-muted-foreground mt-1 text-xs">{subtitle}</div>}
        </div>
        <Badge
          variant={online ? "success" : "danger"}
          title={connection.lastOnline ? absTime(connection.lastOnline) : undefined}
        >
          <SignalIcon className="size-3" />
          {online
            ? isNum(connection.latencyMs)
              ? `Online · ${Math.round(connection.latencyMs as number)} ms`
              : "Online"
            : `Offline · ${fromNow(connection.lastOnline)}`}
        </Badge>
      </CardHeader>

      {!diagnostics.reporting ? (
        <CardContent className="text-muted-foreground text-xs">
          Nothing has published diagnostics under <code>{diagnostics.tagKey}</code> yet.
        </CardContent>
      ) : (
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric
            icon={BatteryIcon}
            label="Battery"
            value={fmt(diagnostics.batteryVoltage, 2)}
            units="V"
            hint={batteryHint(diagnostics)}
            tone={battery}
          />

          {/* Everything below this point needs the Elpro diagnostics app; the
              platform interface publishes a voltage and nothing else. */}
          {diagnostics.detailed && (
            <>
              <Metric
                icon={PlugIcon}
                label="Charge"
                value={fmt(diagnostics.chargeVoltage, 1)}
                units="V"
                hint={chargeHint(diagnostics)}
                tone={charge}
              />
              <Metric
                icon={SignalIcon}
                label="Signal"
                value={fmt(diagnostics.rssiDbm, 0)}
                units="dBm"
                hint={
                  isNum(diagnostics.rssiBackgroundDbm)
                    ? `${SIGNAL_LABEL[signal]} · noise ${fmt(diagnostics.rssiBackgroundDbm, 0)}`
                    : SIGNAL_LABEL[signal]
                }
                tone={signal}
              />
              <Metric
                icon={AntennaIcon}
                label="Radio"
                value={
                  diagnostics.radioPresent
                    ? typeof diagnostics.radioState === "string"
                      ? diagnostics.radioState
                      : "Present"
                    : "None"
                }
                hint={radioHint(diagnostics)}
                tone={radio}
              />
              {isNum(diagnostics.paTemperatureC) && (
                <Metric
                  icon={ThermometerIcon}
                  label="Radio PA"
                  value={fmt(diagnostics.paTemperatureC, 0)}
                  units="°C"
                  tone="neutral"
                />
              )}
              {isNum(diagnostics.radioUptimeSeconds) && (
                <Metric
                  icon={TimerIcon}
                  label="Radio up"
                  value={fmtDuration(diagnostics.radioUptimeSeconds)}
                  tone="neutral"
                />
              )}
            </>
          )}

          {/* Platform-interface fallback tiles, for a device without the Elpro app. */}
          {!diagnostics.detailed && isNum(diagnostics.temperatureC) && (
            <Metric
              icon={ThermometerIcon}
              label="Temp"
              value={fmt(diagnostics.temperatureC, 1)}
              units="°C"
            />
          )}
          {!diagnostics.detailed && isNum(diagnostics.uptimeSeconds) && (
            <Metric
              icon={TimerIcon}
              label="Uptime"
              value={fmtDuration(diagnostics.uptimeSeconds)}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
