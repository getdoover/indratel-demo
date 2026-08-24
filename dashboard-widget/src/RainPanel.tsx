import {CloudRain, CloudOff, Umbrella} from "lucide-react";

import {Badge} from "./components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "./components/ui/card";
import {absTime, fmt, fromNow, isNum} from "./lib/format";

export interface RainSource {
  appKey: string | null;
  displayName: string;
  /** True when the app key resolves to something actually reporting tags. */
  reporting: boolean;
  since9am: unknown;
  sinceEvent: unknown;
  totalRainfall: unknown;
  intensity: unknown;
  eventStarted: unknown;
}

/** Intensity bands follow the BOM's rain-rate descriptors. */
function intensityLabel(mmPerHour: number): {label: string; variant: "muted" | "info" | "warning" | "danger"} {
  if (mmPerHour <= 0) return {label: "Dry", variant: "muted"};
  if (mmPerHour < 2.5) return {label: "Light", variant: "info"};
  if (mmPerHour < 10) return {label: "Moderate", variant: "info"};
  if (mmPerHour < 50) return {label: "Heavy", variant: "warning"};
  return {label: "Violent", variant: "danger"};
}

function Stat({
  label,
  value,
  units,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  units: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2.5">
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className={
            emphasis
              ? "text-3xl font-semibold tabular-nums tracking-tight"
              : "text-xl font-semibold tabular-nums"
          }
        >
          {value}
        </span>
        <span className="text-muted-foreground text-xs">{units}</span>
      </div>
      {hint && <div className="text-muted-foreground mt-0.5 text-[11px]">{hint}</div>}
    </div>
  );
}

export function RainPanel({rain}: {rain: RainSource}) {
  if (!rain.appKey || !rain.reporting) {
    return (
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="truncate">{rain.displayName}</CardTitle>
            <div className="text-muted-foreground mt-1 text-xs">
              {rain.appKey ? `Waiting on ${rain.appKey}` : "No rain gauge app configured"}
            </div>
          </div>
          <Badge variant="muted">
            <CloudOff className="size-3" /> Offline
          </Badge>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-xs">
          <Umbrella className="size-4 shrink-0" />
          <span>
            This panel populates as soon as a rain gauge app publishes tags on this device.
          </span>
        </CardContent>
      </Card>
    );
  }

  const intensity = isNum(rain.intensity) ? (rain.intensity as number) : 0;
  const band = intensityLabel(intensity);
  const raining = intensity > 0;

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{rain.displayName}</CardTitle>
          <div className="text-muted-foreground mt-1 text-xs">
            {isNum(rain.eventStarted) ? (
              <span title={absTime(rain.eventStarted)}>Event started {fromNow(rain.eventStarted)}</span>
            ) : (
              "No active rain event"
            )}
          </div>
        </div>
        <Badge variant={band.variant}>
          <CloudRain className="size-3" /> {band.label}
        </Badge>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Since 9am" value={fmt(rain.since9am, 1)} units="mm" emphasis />
        <Stat
          label="This event"
          value={fmt(rain.sinceEvent, 1)}
          units="mm"
          hint={raining ? `${fmt(intensity, 1)} mm/hr` : undefined}
        />
        <Stat label="Intensity" value={fmt(intensity, 1)} units="mm/hr" />
        <Stat label="Total" value={fmt(rain.totalRainfall, 1)} units="mm" />
      </CardContent>
    </Card>
  );
}
