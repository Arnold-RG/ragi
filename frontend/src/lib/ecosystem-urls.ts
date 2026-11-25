/** Public URL of Our Money Hub. Production builds never fall back to localhost. */
export const PRODUCTION_OMH_URL = "https://arnova-omh.onrender.com";
export const DEV_OMH_URL = "http://localhost:3420";

export function omhPublicUrl(env: {
  NEXT_PUBLIC_OMH_URL?: string;
  NODE_ENV?: string;
} = typeof process !== "undefined" ? process.env : {}): string {
  const explicit = (env.NEXT_PUBLIC_OMH_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (env.NODE_ENV === "production") return PRODUCTION_OMH_URL;
  return DEV_OMH_URL;
}
