import { describe, expect, it } from "vitest";
import { DEV_OMH_URL, PRODUCTION_OMH_URL, omhPublicUrl } from "../ecosystem-urls";

describe("omhPublicUrl", () => {
  it("uses the explicit env value when set", () => {
    expect(omhPublicUrl({ NEXT_PUBLIC_OMH_URL: "https://arnova-omh.onrender.com/", NODE_ENV: "development" })).toBe(
      "https://arnova-omh.onrender.com",
    );
  });

  it("never falls back to localhost in production", () => {
    expect(omhPublicUrl({ NODE_ENV: "production" })).toBe(PRODUCTION_OMH_URL);
    expect(omhPublicUrl({ NODE_ENV: "production" })).not.toMatch(/localhost/);
  });

  it("uses localhost only in development when unset", () => {
    expect(omhPublicUrl({ NODE_ENV: "development" })).toBe(DEV_OMH_URL);
  });
});
