import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface TableActionHeaderProps extends ComponentPropsWithoutRef<"th"> {
  children?: ReactNode;
}

export function TableActionHeader({ children = "操作", className, ...props }: TableActionHeaderProps) {
  return <th scope="col" className={cn("px-2 py-2 text-right", className)} {...props}>{children}</th>;
}

export function TableActionCell({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-2 py-3 text-right", className)} {...props} />;
}
