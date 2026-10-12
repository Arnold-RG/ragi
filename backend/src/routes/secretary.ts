import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { decryptString, encryptString } from "../lib/crypto.js";

async function ownerSalt(ownerId: string) {
  const owner = await db.owner.findUniqueOrThrow({ where: { id: ownerId } });
  return owner.vaultSalt;
}

export const secretaryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.get("/api/v1/mode", async (req) => {
    const row = await db.modeState.findUnique({ where: { ownerId: req.ragiOwnerId! } });
    return { mode: row?.mode ?? "work" };
  });

  app.put("/api/v1/mode", async (req) => {
    const body = z.object({ mode: z.enum(["work", "personal"]) }).parse(req.body);
    const row = await db.modeState.upsert({
      where: { ownerId: req.ragiOwnerId! },
      create: { ownerId: req.ragiOwnerId!, mode: body.mode },
      update: { mode: body.mode },
    });
    return { mode: row.mode };
  });

  app.get("/api/v1/briefing", async (req) => {
    const salt = await ownerSalt(req.ragiOwnerId!);
    const cached = await db.briefingCache.findUnique({ where: { ownerId: req.ragiOwnerId! } });
    if (cached) {
      return { source: "cache", generatedAt: cached.generatedAt, briefing: JSON.parse(decryptString(cached.payloadEnc, salt)) };
    }

    const jobs = await db.jobEntry.count({ where: { ownerId: req.ragiOwnerId! } });
    const focus = await db.focusBlock.findFirst({
      where: { ownerId: req.ragiOwnerId!, completed: false, endsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    const mode = await db.modeState.findUnique({ where: { ownerId: req.ragiOwnerId! } });

    const briefing = {
      mode: mode?.mode ?? "work",
      openJobs: jobs,
      nextFocus: focus
        ? {
            label: decryptString(focus.labelEnc, salt),
            startsAt: focus.startsAt,
            endsAt: focus.endsAt,
          }
        : null,
      summary: `Morning briefing ready. Mode ${mode?.mode ?? "work"}. ${jobs} job tracks. Focus ${focus ? "scheduled" : "clear"}.`,
    };

    await db.briefingCache.upsert({
      where: { ownerId: req.ragiOwnerId! },
      create: {
        ownerId: req.ragiOwnerId!,
        payloadEnc: encryptString(JSON.stringify(briefing), salt),
      },
      update: {
        payloadEnc: encryptString(JSON.stringify(briefing), salt),
        generatedAt: new Date(),
      },
    });

    return { source: "live", generatedAt: new Date().toISOString(), briefing };
  });

  app.get("/api/v1/jobs", async (req) => {
    const salt = await ownerSalt(req.ragiOwnerId!);
    const rows = await db.jobEntry.findMany({
      where: { ownerId: req.ragiOwnerId! },
      orderBy: { updatedAt: "desc" },
    });
    return {
      jobs: rows.map((r) => ({
        id: r.id,
        title: decryptString(r.titleEnc, salt),
        company: r.companyEnc ? decryptString(r.companyEnc, salt) : null,
        status: r.status,
        url: r.urlEnc ? decryptString(r.urlEnc, salt) : null,
        notes: r.notesEnc ? decryptString(r.notesEnc, salt) : null,
        updatedAt: r.updatedAt,
      })),
    };
  });

  app.post("/api/v1/jobs", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        company: z.string().optional(),
        status: z.enum(["watch", "draft", "applied", "interview", "offer", "closed"]).default("watch"),
        url: z.string().url().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const salt = await ownerSalt(req.ragiOwnerId!);
    const row = await db.jobEntry.create({
      data: {
        ownerId: req.ragiOwnerId!,
        titleEnc: encryptString(body.title, salt),
        companyEnc: body.company ? encryptString(body.company, salt) : null,
        status: body.status,
        urlEnc: body.url ? encryptString(body.url, salt) : null,
        notesEnc: body.notes ? encryptString(body.notes, salt) : null,
      },
    });
    return { id: row.id, status: row.status };
  });

  app.patch("/api/v1/jobs/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        company: z.string().optional(),
        status: z.enum(["watch", "draft", "applied", "interview", "offer", "closed"]).optional(),
        url: z.string().url().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const salt = await ownerSalt(req.ragiOwnerId!);
    const data: {
      titleEnc?: string;
      companyEnc?: string | null;
      status?: string;
      urlEnc?: string | null;
      notesEnc?: string | null;
    } = {};
    if (body.title) data.titleEnc = encryptString(body.title, salt);
    if (body.company !== undefined) data.companyEnc = body.company ? encryptString(body.company, salt) : null;
    if (body.status) data.status = body.status;
    if (body.url !== undefined) data.urlEnc = body.url ? encryptString(body.url, salt) : null;
    if (body.notes !== undefined) data.notesEnc = body.notes ? encryptString(body.notes, salt) : null;

    const existing = await db.jobEntry.findFirst({
      where: { id: params.id, ownerId: req.ragiOwnerId! },
    });
    if (!existing) {
      const err = new Error("job_not_found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const row = await db.jobEntry.update({
      where: { id: params.id },
      data,
    });
    return { id: row.id, status: row.status };
  });

  app.get("/api/v1/focus", async (req) => {
    const salt = await ownerSalt(req.ragiOwnerId!);
    const rows = await db.focusBlock.findMany({
      where: { ownerId: req.ragiOwnerId! },
      orderBy: { startsAt: "desc" },
      take: 50,
    });
    return {
      blocks: rows.map((r) => ({
        id: r.id,
        label: decryptString(r.labelEnc, salt),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        completed: r.completed,
      })),
    };
  });

  app.post("/api/v1/focus", async (req) => {
    const body = z
      .object({
        label: z.string().min(1),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      })
      .parse(req.body);
    const salt = await ownerSalt(req.ragiOwnerId!);
    const row = await db.focusBlock.create({
      data: {
        ownerId: req.ragiOwnerId!,
        labelEnc: encryptString(body.label, salt),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      },
    });
    return { id: row.id };
  });

  app.post("/api/v1/focus/:id/complete", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const existing = await db.focusBlock.findFirst({
      where: { id: params.id, ownerId: req.ragiOwnerId! },
    });
    if (!existing) {
      const err = new Error("focus_not_found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await db.focusBlock.update({
      where: { id: params.id },
      data: { completed: true },
    });
    return { ok: true };
  });

  app.get("/api/v1/notes", async (req) => {
    const salt = await ownerSalt(req.ragiOwnerId!);
    const rows = await db.secureNote.findMany({
      where: { ownerId: req.ragiOwnerId! },
      orderBy: { updatedAt: "desc" },
    });
    return {
      notes: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: decryptString(r.titleEnc, salt),
        body: decryptString(r.bodyEnc, salt),
        updatedAt: r.updatedAt,
      })),
    };
  });

  app.post("/api/v1/notes", async (req) => {
    const body = z
      .object({
        kind: z.string().default("note"),
        title: z.string().min(1),
        body: z.string().default(""),
      })
      .parse(req.body);
    const salt = await ownerSalt(req.ragiOwnerId!);
    const row = await db.secureNote.create({
      data: {
        ownerId: req.ragiOwnerId!,
        kind: body.kind,
        titleEnc: encryptString(body.title, salt),
        bodyEnc: encryptString(body.body, salt),
      },
    });
    return { id: row.id };
  });

  app.get("/api/v1/export", async (req) => {
    const salt = await ownerSalt(req.ragiOwnerId!);
    const [jobs, notes, focus, mode] = await Promise.all([
      db.jobEntry.findMany({ where: { ownerId: req.ragiOwnerId! } }),
      db.secureNote.findMany({ where: { ownerId: req.ragiOwnerId! } }),
      db.focusBlock.findMany({ where: { ownerId: req.ragiOwnerId! } }),
      db.modeState.findUnique({ where: { ownerId: req.ragiOwnerId! } }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      mode: mode?.mode ?? "work",
      jobs: jobs.map((r) => ({
        title: decryptString(r.titleEnc, salt),
        company: r.companyEnc ? decryptString(r.companyEnc, salt) : null,
        status: r.status,
      })),
      notes: notes.map((r) => ({
        kind: r.kind,
        title: decryptString(r.titleEnc, salt),
        body: decryptString(r.bodyEnc, salt),
      })),
      focus: focus.map((r) => ({
        label: decryptString(r.labelEnc, salt),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        completed: r.completed,
      })),
    };
  });
};
