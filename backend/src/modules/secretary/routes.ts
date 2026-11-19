import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as secretary from "./service.js";

export const secretaryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.get("/api/v1/mode", async (req) => secretary.getMode(req.ragiOwnerId!));

  app.put("/api/v1/mode", async (req) => {
    const body = z.object({ mode: z.enum(["work", "personal"]) }).parse(req.body);
    return secretary.setMode(req.ragiOwnerId!, body.mode);
  });

  app.get("/api/v1/briefing", async (req) => secretary.getBriefing(req.ragiOwnerId!));

  app.get("/api/v1/jobs", async (req) => secretary.listJobs(req.ragiOwnerId!));

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
    return secretary.createJob(req.ragiOwnerId!, body);
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
    return secretary.updateJob(req.ragiOwnerId!, params.id, body);
  });

  app.get("/api/v1/focus", async (req) => secretary.listFocus(req.ragiOwnerId!));

  app.post("/api/v1/focus", async (req) => {
    const body = z
      .object({
        label: z.string().min(1),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      })
      .parse(req.body);
    return secretary.createFocus(req.ragiOwnerId!, body);
  });

  app.post("/api/v1/focus/:id/complete", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return secretary.completeFocus(req.ragiOwnerId!, params.id);
  });

  app.get("/api/v1/notes", async (req) => secretary.listNotes(req.ragiOwnerId!));

  app.post("/api/v1/notes", async (req) => {
    const body = z
      .object({
        kind: z.string().default("note"),
        title: z.string().min(1),
        body: z.string().default(""),
      })
      .parse(req.body);
    return secretary.createNote(req.ragiOwnerId!, body);
  });

  app.get("/api/v1/export", async (req) => secretary.exportAll(req.ragiOwnerId!));
};
