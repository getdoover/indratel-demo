import * as React from "react";

import {cn} from "../../lib/utils";

export function Card({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 rounded-xl border border-border py-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-start justify-between gap-2 px-4", className)}
      {...props}
    />
  );
}

export function CardTitle({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-sm font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

export function CardContent({className, ...props}: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-4", className)} {...props} />;
}

export function CardFooter({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-4", className)}
      {...props}
    />
  );
}
