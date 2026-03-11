import clsx from "clsx";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{ tone?: "default" | "ok" | "warn" | "danger" }>;

export function Tag({ tone = "default", children }: Props) {
  return (
    <span
      className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", {
        "bg-slate-100 text-slate-600": tone === "default",
        "bg-emerald-100 text-emerald-700": tone === "ok",
        "bg-amber-100 text-amber-700": tone === "warn",
        "bg-rose-100 text-rose-700": tone === "danger"
      })}
    >
      {children}
    </span>
  );
}
