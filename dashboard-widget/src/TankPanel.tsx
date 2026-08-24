import {useId} from "react";
import {Droplets, TriangleAlert} from "lucide-react";

import {Badge} from "./components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "./components/ui/card";
import {Skeleton} from "./components/ui/skeleton";
import {cn} from "./lib/utils";
import {fmt, isNum} from "./lib/format";
import {fraction, type TankSource} from "./sources";

type Level = {label: string; variant: "danger" | "warning" | "info" | "success"; fill: string};

/**
 * Level bands are a display convention, not a device alarm: the 4-20mA app's
 * own alarm points are per-install and often unset, so colouring here is purely
 * about making a glance meaningful.
 */
function levelFor(pct: number): Level {
  if (pct < 0.15) return {label: "Low", variant: "danger", fill: "#ef4444"};
  if (pct < 0.3) return {label: "Getting low", variant: "warning", fill: "#f59e0b"};
  if (pct > 0.9) return {label: "Near full", variant: "info", fill: "#0ea5e9"};
  return {label: "Normal", variant: "success", fill: "#0ea5e9"};
}

/** A sensor reading below the 4mA floor means a broken loop, not an empty tank. */
function isSensorFaulted(rawMilliamps: unknown): boolean {
  return isNum(rawMilliamps) && rawMilliamps < 3.5;
}

interface TankGraphicProps {
  /** 0..1 */
  fill: number;
  colour: string;
  faulted: boolean;
}

/**
 * The tank body is drawn once in a 0..120 x 0..160 viewBox. The liquid is a
 * clipped rect whose height animates via a CSS transition, with two offset sine
 * paths riding on top for a surface that never sits perfectly still.
 */
function TankGraphic({fill, colour, faulted}: TankGraphicProps) {
  const uid = useId().replace(/:/g, "");
  const clipId = `tank-clip-${uid}`;
  const gradId = `tank-grad-${uid}`;

  // Liquid surface y in viewBox units; the body's inner cavity is y 26..146.
  const top = 146 - fill * 120;

  return (
    <svg viewBox="0 0 120 160" className="h-40 w-full" role="img" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="16" y="26" width="88" height="120" rx="10" />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.75" />
          <stop offset="100%" stopColor={colour} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Cavity */}
      <rect
        x="16"
        y="26"
        width="88"
        height="120"
        rx="10"
        className="fill-muted/60"
      />

      {!faulted && (
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="16"
            y={top}
            width="88"
            height={146 - top + 4}
            fill={`url(#${gradId})`}
            style={{transition: "y 900ms cubic-bezier(0.4, 0, 0.2, 1), height 900ms cubic-bezier(0.4, 0, 0.2, 1)"}}
          />
          {fill > 0.01 && (
            <g style={{transform: `translateY(${top}px)`, transition: "transform 900ms cubic-bezier(0.4, 0, 0.2, 1)"}}>
              <path
                className="idw-wave"
                d="M0 4 q 11 -6 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0 V 20 H0 Z"
                fill={colour}
                fillOpacity="0.45"
              />
              <path
                className="idw-wave-slow"
                d="M0 6 q 14 5 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0 V 20 H0 Z"
                fill={colour}
                fillOpacity="0.3"
              />
            </g>
          )}
        </g>
      )}

      {/* Fill-level graduations */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="16"
          x2="30"
          y1={146 - g * 120}
          y2={146 - g * 120}
          className="stroke-border"
          strokeWidth="1.5"
        />
      ))}

      {/* Shell */}
      <rect
        x="16"
        y="26"
        width="88"
        height="120"
        rx="10"
        fill="none"
        className="stroke-border"
        strokeWidth="3"
      />
      {/* Neck + base */}
      <rect x="46" y="14" width="28" height="12" rx="4" className="fill-muted stroke-border" strokeWidth="2.5" />
      <rect x="26" y="146" width="14" height="10" rx="3" className="fill-muted stroke-border" strokeWidth="2.5" />
      <rect x="80" y="146" width="14" height="10" rx="3" className="fill-muted stroke-border" strokeWidth="2.5" />
    </svg>
  );
}

export function TankPanel({tank}: {tank: TankSource}) {
  if (!tank.appKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tank.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          No level sensor app configured.
        </CardContent>
      </Card>
    );
  }

  const faulted = isSensorFaulted(tank.rawMilliamps);
  const hasValue = isNum(tank.value) && !faulted;
  const pct = hasValue ? fraction(tank.value as number, tank.min, tank.max) : 0;
  const level = levelFor(pct);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{tank.displayName}</CardTitle>
          <div className="text-muted-foreground mt-1 text-xs">
            {tank.min}–{tank.max} {tank.units}
          </div>
        </div>
        {faulted ? (
          <Badge variant="danger">
            <TriangleAlert className="size-3" /> Sensor fault
          </Badge>
        ) : hasValue ? (
          <Badge variant={level.variant}>{level.label}</Badge>
        ) : (
          <Badge variant="muted">No data</Badge>
        )}
      </CardHeader>

      <CardContent className="flex items-center gap-4">
        <div className="w-28 shrink-0">
          <TankGraphic fill={pct} colour={level.fill} faulted={faulted} />
        </div>

        <div className="min-w-0 flex-1">
          {hasValue ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold tabular-nums tracking-tight">
                {fmt(tank.value, 1)}
              </span>
              <span className="text-muted-foreground text-lg">{tank.units}</span>
            </div>
          ) : (
            <Skeleton className="h-10 w-24" />
          )}

          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <Droplets className="size-3.5" />
            {hasValue ? `${Math.round(pct * 100)}% of range` : "Waiting for a reading"}
          </div>

          {/* Compact bar mirrors the tank for small screens where the graphic
              is squeezed. */}
          <div className="bg-muted mt-4 h-2 w-full overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full transition-[width] duration-700 ease-out")}
              style={{width: `${pct * 100}%`, backgroundColor: level.fill}}
            />
          </div>

          {isNum(tank.rawMilliamps) && (
            <div className="text-muted-foreground mt-2 text-[11px] tabular-nums">
              loop {fmt(tank.rawMilliamps, 2)} mA
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
