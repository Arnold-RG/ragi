import { ArrowUpRight } from "lucide-react";

export const OMH_URL = process.env.NEXT_PUBLIC_OMH_URL ?? "http://localhost:3420";

export function OpenInMoneyHub({
  href = "/",
  children = "Open in Money Hub",
  className = "linkish inline-flex items-center gap-1",
}: {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const url = href.startsWith("http") ? href : `${OMH_URL}${href === "/" ? "" : href}`;
  return (
    <a href={url} className={className} title="Opens Our Money Hub. It uses a separate account and session.">
      {children}
      <ArrowUpRight size={12} aria-hidden />
    </a>
  );
}
