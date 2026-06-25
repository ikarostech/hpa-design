import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1",
  {
    variants: {
      tone: {
        blue: "bg-blue-50 text-blue-700 ring-blue-200",
        green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        amber: "bg-amber-50 text-amber-700 ring-amber-200",
        slate: "bg-muted text-muted-foreground ring-border",
      },
    },
    defaultVariants: {
      tone: "slate",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
