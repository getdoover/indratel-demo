import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";

import {cn} from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        danger: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        info: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
      },
    },
    defaultVariants: {variant: "default"},
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({variant}), className)} {...props} />;
}

export {badgeVariants};
