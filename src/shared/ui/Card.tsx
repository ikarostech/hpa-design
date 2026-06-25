import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

type CardProps = HTMLAttributes<HTMLElement>;
type CardSectionProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <section className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: CardSectionProps) {
  return <div className={cn("border-b px-4 py-3", className)} {...props} />;
}

export function CardBody({ className, ...props }: CardSectionProps) {
  return <div className={cn("p-4", className)} {...props} />;
}
