import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../shared/config.js";
import { db } from "../../shared/db.js";
import { encryptString, decryptString, randomToken } from "../../shared/crypto.js";
import { cacheSet, cacheGet, cacheDel } from "../../shared/redis.js";

async function salt(ownerId: string) {
  return (await db.owner.findUniqueOrThrow({ where: { id: ownerId } })).vaultSalt;
}

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  // OAuth browser callbacks — no session cookie required (state binds owner)
  app.get("/api/v1/calendar/google/callback", async (req, reply) => {
    const q = z.object({ code: z.string(), state: z.string() }).parse(req.query);
    const ownerId = await cacheGet(`oauth:google:${q.state}`);
    if (!ownerId) return reply.code(400).send({ error: "bad_state" });
    await cacheDel(`oauth:google:${q.state}`);

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      return reply.code(503).send({ error: "google_oauth_not_configured" });
    }

    const body = new URLSearchParams({
      code: q.code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenRes.ok) return reply.code(502).send({ error: "google_token_exchange_failed" });
    const json = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    const s = await salt(ownerId);
    await db.oAuthToken.upsert({
      where: { ownerId_provider: { ownerId, provider: "google" } },
      create: {
        ownerId,
        provider: "google",
        accessEnc: encryptString(json.access_token, s),
        refreshEnc: json.refresh_token ? encryptString(json.refresh_token, s) : null,
        expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
        scope: json.scope,
      },
      update: {
        accessEnc: encryptString(json.access_token, s),
        refreshEnc: json.refresh_token ? encryptString(json.refresh_token, s) : undefined,
        expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
        scope: json.scope,
      },
    });
    return reply
      .type("text/html")
      .send("<html><body>RAGI Google calendar connected. You can close this tab.</body></html>");
  });

  app.get("/api/v1/calendar/microsoft/callback", async (req, reply) => {
    const q = z.object({ code: z.string(), state: z.string() }).parse(req.query);
    const ownerId = await cacheGet(`oauth:ms:${q.state}`);
    if (!ownerId) return reply.code(400).send({ error: "bad_state" });
    await cacheDel(`oauth:ms:${q.state}`);

    if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.MS_REDIRECT_URI) {
      return reply.code(503).send({ error: "microsoft_oauth_not_configured" });
    }

    const body = new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      code: q.code,
      redirect_uri: env.MS_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
    );
    if (!tokenRes.ok) return reply.code(502).send({ error: "microsoft_token_exchange_failed" });
    const json = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    const s = await salt(ownerId);
    await db.oAuthToken.upsert({
      where: { ownerId_provider: { ownerId, provider: "microsoft" } },
      create: {
        ownerId,
        provider: "microsoft",
        accessEnc: encryptString(json.access_token, s),
        refreshEnc: json.refresh_token ? encryptString(json.refresh_token, s) : null,
        expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
        scope: json.scope,
      },
      update: {
        accessEnc: encryptString(json.access_token, s),
        refreshEnc: json.refresh_token ? encryptString(json.refresh_token, s) : undefined,
        expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
        scope: json.scope,
      },
    });
    return reply
      .type("text/html")
      .send("<html><body>RAGI Outlook calendar connected. You can close this tab.</body></html>");
  });

  app.get("/api/v1/calendar/status", { preHandler: app.requireOwner }, async (req) => {
    const tokens = await db.oAuthToken.findMany({ where: { ownerId: req.ragiOwnerId! } });
    return {
      googleConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      microsoftConfigured: Boolean(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET),
      connected: tokens.map((t) => t.provider),
    };
  });

  app.get("/api/v1/calendar/google/start", { preHandler: app.requireOwner }, async (req, reply) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      return reply.code(503).send({ error: "google_oauth_not_configured" });
    }
    const state = randomToken(24);
    await cacheSet(`oauth:google:${state}`, req.ragiOwnerId!, 600);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

  app.get("/api/v1/calendar/microsoft/start", { preHandler: app.requireOwner }, async (req, reply) => {
    if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.MS_REDIRECT_URI) {
      return reply.code(503).send({ error: "microsoft_oauth_not_configured" });
    }
    const state = randomToken(24);
    await cacheSet(`oauth:ms:${state}`, req.ragiOwnerId!, 600);
    const url = new URL(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", env.MS_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", env.MS_REDIRECT_URI);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "offline_access Calendars.Read");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

  app.get("/api/v1/calendar/events", { preHandler: app.requireOwner }, async (req, reply) => {
    const q = z
      .object({
        provider: z.enum(["google", "microsoft"]),
        days: z.coerce.number().int().min(1).max(30).default(7),
      })
      .parse(req.query);

    const token = await db.oAuthToken.findUnique({
      where: { ownerId_provider: { ownerId: req.ragiOwnerId!, provider: q.provider } },
    });
    if (!token) return reply.code(404).send({ error: "provider_not_connected" });
    const s = await salt(req.ragiOwnerId!);
    const access = decryptString(token.accessEnc, s);

    if (q.provider === "google") {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + q.days * 86400000).toISOString();
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
      if (!res.ok) return reply.code(502).send({ error: "google_events_failed" });
      const data = (await res.json()) as { items?: unknown[] };
      return { provider: "google", events: data.items ?? [] };
    }

    const start = new Date().toISOString();
    const end = new Date(Date.now() + q.days * 86400000).toISOString();
    const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
    url.searchParams.set("startDateTime", start);
    url.searchParams.set("endDateTime", end);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!res.ok) return reply.code(502).send({ error: "microsoft_events_failed" });
    const data = (await res.json()) as { value?: unknown[] };
    return { provider: "microsoft", events: data.value ?? [] };
  });
};
