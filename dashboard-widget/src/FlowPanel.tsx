import {ActivityIcon, GaugeIcon, WarningIcon, WavesIcon} from "./components/icons";

import {Badge} from "./components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "./components/ui/card";
import {Skeleton} from "./components/ui/skeleton";
import {absTime, fmt, fmtInt, fromNow, isNum} from "./lib/format";
import {fraction, type FlowSource} from "./sources";

const ARC_START = -220;
const ARC_SWEEP = 260;
const RADIUS = 62;
const CENTRE = 78;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {x: CENTRE + radius * Math.cos(rad), y: CENTRE + radius * Math.sin(rad)};
}

function arcPath(fromFrac: number, toFrac: number, radius: number) {
  const a0 = ARC_START + ARC_SWEEP * fromFrac;
  const a1 = ARC_START + ARC_SWEEP * toFrac;
  const p0 = polar(a0, radius);
  const p1 = polar(a1, radius);
  const largeArc = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

/** Open-ended arc gauge: a muted track with the value swept over it. */
function FlowGauge({fraction: frac, active}: {fraction: number; active: boolean}) {
  const colour = active ? "#0ea5e9" : "#94a3b8";
  return (
    <svg viewBox="0 0 156 132" className="h-36 w-36" role="img" aria-hidden="true">
      <path
        d={arcPath(0, 1, RADIUS)}
        fill="none"
        className="stroke-muted"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {frac > 0.001 && (
        <path
          d={arcPath(0, Math.max(frac, 0.005), RADIUS)}
          fill="none"
          stroke={colour}
          strokeWidth="12"
          strokeLinecap="round"
        />
      )}
      {/* Quarter ticks give the sweep a sense of scale. */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const outer = polar(ARC_START + ARC_SWEEP * t, RADIUS + 11);
        const inner = polar(ARC_START + ARC_SWEEP * t, RADIUS + 6);
        return (
          <line
            key={t}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className="stroke-border"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function FlowPanel({flow}: {flow: FlowSource}) {
  if (!flow.appKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{flow.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          No flow meter app configured.
        </CardContent>
      </Card>
    );
  }

  const isPulse = flow.meterMode === "Pulse";
  // A pulse meter has no analog signal to fall out of range, so the app's
  // signal-fault flag only means anything in analog mode.
  const faulted = !isPulse && flow.sensorFaultHidden === false;
  const hasRate = isNum(flow.flowRate);
  const rate = hasRate ? (flow.flowRate as number) : 0;
  const active = flow.flowActive === true || rate > 0;
  const frac = fraction(rate, 0, flow.maxFlow);

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{flow.displayName}</CardTitle>
          <div className="text-muted-foreground mt-1 text-xs">
            {isPulse ? `Pulse · ${fmt(flow.kFactor, 0)}/${flow.volumeUnits}` : "Analog 4-20mA"} ·
            0–{flow.maxFlow.toLocaleString()} {flow.rateUnits}
          </div>
        </div>
        {faulted ? (
          <Badge variant="danger">
            <WarningIcon className="size-3" /> Signal fault
          </Badge>
        ) : active ? (
          <Badge variant="info">
            <WavesIcon className="size-3" /> Flowing
          </Badge>
        ) : (
          <Badge variant="muted">Idle</Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="relative shrink-0">
          <FlowGauge fraction={frac} active={active} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
            {hasRate ? (
              <>
                <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight">
                  {fmt(rate, flow.ratePrecision)}
                </span>
                <span className="text-muted-foreground mt-1 text-xs">{flow.rateUnits}</span>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </div>
        </div>

        <dl className="min-w-[9rem] flex-1 space-y-3">
          <div>
            <dt className="text-muted-foreground flex items-center gap-1 text-xs">
              <GaugeIcon className="size-3.5" /> Totaliser
            </dt>
            <dd className="text-xl font-semibold tabular-nums">
              {fmtInt(flow.totaliser)}{" "}
              <span className="text-muted-foreground text-sm font-normal">{flow.volumeUnits}</span>
            </dd>
            {isPulse && isNum(flow.pulseCount) && (
              <dd className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                {fmtInt(flow.pulseCount)} pulses counted
                {isNum(flow.lastPulseAt) && <> · last {fromNow(flow.lastPulseAt)}</>}
              </dd>
            )}
          </div>

          <div>
            <dt className="text-muted-foreground flex items-center gap-1 text-xs">
              <ActivityIcon className="size-3.5" /> {active ? "This event" : "Last event"}
            </dt>
            <dd className="text-sm">
              {active ? (
                <span className="tabular-nums">
                  {fmtInt(flow.eventVolume)} {flow.volumeUnits}
                  {isNum(flow.eventPeakFlow) && flow.eventPeakFlow > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      · peak {fmt(flow.eventPeakFlow, flow.ratePrecision)} {flow.rateUnits}
                    </span>
                  )}
                </span>
              ) : typeof flow.lastEventSummary === "string" && flow.lastEventSummary ? (
                <span className="text-foreground">{flow.lastEventSummary}</span>
              ) : (
                <span className="text-muted-foreground">No events recorded yet</span>
              )}
            </dd>
            {active && isNum(flow.eventStarted) && (
              <dd className="text-muted-foreground mt-0.5 text-xs" title={absTime(flow.eventStarted)}>
                started {fromNow(flow.eventStarted)}
              </dd>
            )}
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
