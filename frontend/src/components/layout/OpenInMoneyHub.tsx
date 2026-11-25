import { ArrowUpRight } from "lucide-react";
import { omhPublicUrl } from "@/lib/ecosystem-urls";

export const OMH_URL = omhPublicUrl();

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
