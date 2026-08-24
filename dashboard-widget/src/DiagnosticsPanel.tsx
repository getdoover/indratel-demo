import {BoltIcon, ChipIcon, PlugIcon, SignalIcon, ThermometerIcon, TimerIcon} from "./components/icons";

import {Badge} from "./components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "./components/ui/card";
import {cn} from "./lib/utils";
import {absTime, fmt, fmtDuration, fromNow, isNum} from "./lib/format";
import {supplyHealth, type ConnectionSource, type DiagnosticsSource, type IoChannel, type AnalogChannel} from "./sources";

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

function IoRow({title, channels}: {title: string; channels: IoChannel[]}) {
  if (channels.length === 0) return null;
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{title}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {channels.map((channel) => (
          <span
            key={channel.label}
            title={`${channel.label}: ${channel.state ? "on" : "off"}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none",
              channel.state
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                channel.state ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            {channel.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnalogRow({title, channels}: {title: string; channels: AnalogChannel[]}) {
  if (channels.length === 0) return null;
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{title}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {channels.map((channel) => (
          <span
            key={channel.label}
            className="border-border text-foreground inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none"
          >
            <span className="text-muted-foreground">{channel.label}</span>
            <span className="tabular-nums">{fmt(channel.value, 2)}</span>
            {channel.units && <span className="text-muted-foreground">{channel.units}</span>}
          </span>
        ))}
      </div>
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
          <div className="text-muted-foreground mt-1 text-xs">
            {connection.ip ? `${connection.ip}` : "address unknown"}
            {typeof diagnostics.firmwareVersion === "string" && ` · fw ${diagnostics.firmwareVersion}`}
          </div>
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              // The platform interface reports negative watts while the unit is
              // charging its battery rather than drawing down.
              value={fmt(isNum(diagnostics.powerWatts) ? Math.abs(diagnostics.powerWatts as number) : null, 2)}
              units="W"
              hint={
                isNum(diagnostics.powerWatts) && (diagnostics.powerWatts as number) < 0
                  ? "charging"
                  : undefined
              }
            />
            {/* Not every platform build publishes these; an empty tile reads as
                a fault, so drop them rather than showing a dash. */}
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <IoRow title="Digital inputs" channels={diagnostics.digitalInputs} />
            <IoRow title="Digital outputs" channels={diagnostics.digitalOutputs} />
            <AnalogRow title="Analog inputs" channels={diagnostics.analogInputs} />
            <AnalogRow title="Analog outputs" channels={diagnostics.analogOutputs} />
          </div>

          {connection.userAgent && (
            <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <ChipIcon className="size-3" /> {connection.userAgent}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
