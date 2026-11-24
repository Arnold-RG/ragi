// Formatting helpers. Money is handled as decimal STRINGS from the API and is
// never converted to floating point or summed across currencies.

const MINOR_UNITS: Record<string, number> = { PLN: 2, RWF: 0, EUR: 2, USD: 2 };

export function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount == null || amount === "") return "—";
  if (!/^-?\d+(\.\d+)?$/.test(amount)) return "—";
  const digits = MINOR_UNITS[currency] ?? 2;
  const negative = amount.startsWith("-");
  const [intPart, frac = ""] = amount.replace("-", "").split(".");
  const grouped = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  const fraction = digits > 0 ? "." + (frac + "00").slice(0, digits) : "";
  return `${negative ? "−" : ""}${grouped}${fraction} ${currency}`;
}

export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  const mins = Math.round(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function humanize(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
