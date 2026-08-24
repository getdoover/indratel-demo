import {BoltIcon, PlugIcon, SignalIcon, ThermometerIcon, TimerIcon} from "./components/icons";

import {Badge} from "./components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "./components/ui/card";
import {cn} from "./lib/utils";
import {absTime, fmt, fmtDuration, fromNow, isNum} from "./lib/format";
import {supplyHealth, type ConnectionSource, type DiagnosticsSource} from "./sources";

/**
 * Hardware health only.
 *
 * Deliberately no IO channel readout: the Device IO Tester app already renders
 * every DI/DO/AI/AO on this page, and the tank and flow panels above show what
 * the wired channels actually mean. Repeating the raw channels here would be
 * the same information with less context.
 */
function Metric({
  icon: Icon,
  label,
  value,
  units,
  hint,
  tone,
}: {
  icon: (props: {className?: string}) => JSX.Element;
  label: string;
  value: string;
  units?: string;
  hint?: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2.5">
      <div className="text-muted-foreground flex items-center gap-1 text-[11px] uppercase tracking-wide">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "danger" && "text-red-600 dark:text-red-400",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value}
        </span>
        {units && <span className="text-muted-foreground text-xs">{units}</span>}
      </div>
      {hint && <div className="text-muted-foreground mt-0.5 text-[11px]">{hint}</div>}
    </div>
  );
}

export function DiagnosticsPanel({
  diagnostics,
  connection,
}: {
  diagnostics: DiagnosticsSource;
  connection: ConnectionSource;
}) {
  const online = connection.determination === "Online";
  const volts = isNum(diagnostics.voltage) ? (diagnostics.voltage as number) : null;
  const health = volts == null ? null : supplyHealth(volts);

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{diagnostics.deviceType} diagnostics</CardTitle>
          {typeof diagnostics.firmwareVersion === "string" && (
            <div className="text-muted-foreground mt-1 text-xs">
              firmware {diagnostics.firmwareVersion}
            </div>
          )}
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
          The platform interface hasn't published under <code>{diagnostics.tagKey}</code> yet.
        </CardContent>
      ) : (
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            icon={BoltIcon}
            label="Supply"
            value={fmt(diagnostics.voltage, 2)}
            units="V"
            tone={health === "low" ? "danger" : health === "high" ? "warning" : undefined}
            hint={health === "low" ? "below 10.5 V" : health === "high" ? "above 30 V" : undefined}
          />
          <Metric
            icon={PlugIcon}
            label="Power"
            value={fmt(isNum(diagnostics.powerWatts) ? Math.abs(diagnostics.powerWatts as number) : null, 2)}
            units="W"
            hint={
              isNum(diagnostics.powerWatts) && (diagnostics.powerWatts as number) < 0
                ? "charging"
                : undefined
            }
          />
          {/* Not every platform build publishes these; an empty tile reads as a
              fault, so drop them rather than showing a dash. */}
          {isNum(diagnostics.temperatureC) && (
            <Metric
              icon={ThermometerIcon}
              label="Temp"
              value={fmt(diagnostics.temperatureC, 1)}
              units="°C"
            />
          )}
          {isNum(diagnostics.uptimeSeconds) && (
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
