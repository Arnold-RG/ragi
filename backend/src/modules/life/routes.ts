import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDashboard } from "./dashboard.js";
import * as life from "./service.js";

export const lifeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.get("/api/v1/dashboard", async (req) => getDashboard(req.ragiOwnerId!));

  app.get("/api/v1/projects", async (req) => {
    const q = z.object({ realm: z.string().optional() }).parse(req.query);
    return life.listProjects(req.ragiOwnerId!, q.realm);
  });

  app.post("/api/v1/projects", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        notes: z.string().optional(),
        realm: z.enum(["work", "personal"]).default("personal"),
        status: z.string().optional(),
        progress: z.number().int().min(0).max(100).optional(),
        dueAt: z.string().datetime().optional(),
      })
      .parse(req.body);
    return life.createProject(req.ragiOwnerId!, body);
  });

  app.patch("/api/v1/projects/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        notes: z.string().optional(),
        realm: z.enum(["work", "personal"]).optional(),
        status: z.string().optional(),
        progress: z.number().int().min(0).max(100).optional(),
        dueAt: z.string().datetime().nullable().optional(),
      })
      .parse(req.body);
    return life.updateProject(req.ragiOwnerId!, params.id, body);
  });

  app.get("/api/v1/goals", async (req) => life.listGoals(req.ragiOwnerId!));

  app.post("/api/v1/goals", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        realm: z.enum(["work", "personal"]).default("personal"),
        progress: z.number().int().min(0).max(100).optional(),
        target: z.string().optional(),
      })
      .parse(req.body);
    return life.createGoal(req.ragiOwnerId!, body);
  });

  app.patch("/api/v1/goals/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        progress: z.number().int().min(0).max(100).optional(),
        status: z.string().optional(),
        target: z.string().optional(),
      })
      .parse(req.body);
    return life.updateGoal(req.ragiOwnerId!, params.id, body);
  });

  app.get("/api/v1/activities", async (req) => {
    const q = z.object({ day: z.string().optional() }).parse(req.query);
    return life.listActivities(req.ragiOwnerId!, q.day);
  });

  app.post("/api/v1/activities", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        kind: z.string().optional(),
        day: z.string().optional(),
      })
      .parse(req.body);
    return life.createActivity(req.ragiOwnerId!, body);
  });

  app.post("/api/v1/activities/:id/toggle", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.toggleActivity(req.ragiOwnerId!, params.id);
  });

  app.get("/api/v1/finance", async (req) => life.listFinance(req.ragiOwnerId!));

  app.post("/api/v1/finance", async (req) => {
    const body = z
      .object({
        kind: z.enum(["income", "expense", "budget"]),
        amount: z.number().positive(),
        label: z.string().min(1),
        category: z.string().optional(),
        at: z.string().datetime().optional(),
      })
      .parse(req.body);
    return life.createFinance(req.ragiOwnerId!, body);
  });

  app.get("/api/v1/meetings", async (req) => life.listMeetings(req.ragiOwnerId!));

  app.post("/api/v1/meetings", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        place: z.string().optional(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      })
      .parse(req.body);
    return life.createMeeting(req.ragiOwnerId!, body);
  });

  app.get("/api/v1/reminders", async (req) => life.listReminders(req.ragiOwnerId!));

  app.post("/api/v1/reminders", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        dueAt: z.string().datetime(),
        priority: z.enum(["low", "normal", "high"]).optional(),
      })
      .parse(req.body);
    return life.createReminder(req.ragiOwnerId!, body);
  });

  app.post("/api/v1/reminders/:id/complete", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.completeReminder(req.ragiOwnerId!, params.id);
  });

  app.get("/api/v1/emergencies", async (req) => life.listEmergencies(req.ragiOwnerId!));

  app.post("/api/v1/emergencies", async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        body: z.string().default(""),
        severity: z.enum(["low", "high", "critical"]).optional(),
      })
      .parse(req.body);
    return life.createEmergency(req.ragiOwnerId!, body);
  });

  app.post("/api/v1/emergencies/:id/resolve", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.resolveEmergency(req.ragiOwnerId!, params.id);
  });

  // Soft-delete (archive) — snapshots first; rows stay in durable DB
  app.delete("/api/v1/projects/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveProject(req.ragiOwnerId!, params.id);
  });
  app.post("/api/v1/projects/:id/restore", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.restoreProject(req.ragiOwnerId!, params.id);
  });
  app.delete("/api/v1/goals/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveGoal(req.ragiOwnerId!, params.id);
  });
  app.patch("/api/v1/activities/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        kind: z.string().optional(),
        done: z.boolean().optional(),
      })
      .parse(req.body);
    return life.updateActivity(req.ragiOwnerId!, params.id, body);
  });
  app.delete("/api/v1/activities/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveActivity(req.ragiOwnerId!, params.id);
  });
  app.patch("/api/v1/finance/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        kind: z.enum(["income", "expense", "budget"]).optional(),
        amount: z.number().positive().optional(),
        label: z.string().optional(),
        category: z.string().optional(),
      })
      .parse(req.body);
    return life.updateFinance(req.ragiOwnerId!, params.id, body);
  });
  app.delete("/api/v1/finance/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveFinance(req.ragiOwnerId!, params.id);
  });
  app.patch("/api/v1/meetings/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        place: z.string().optional(),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
        status: z.string().optional(),
      })
      .parse(req.body);
    return life.updateMeeting(req.ragiOwnerId!, params.id, body);
  });
  app.delete("/api/v1/meetings/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveMeeting(req.ragiOwnerId!, params.id);
  });
  app.patch("/api/v1/reminders/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        dueAt: z.string().datetime().optional(),
        priority: z.enum(["low", "normal", "high"]).optional(),
        done: z.boolean().optional(),
      })
      .parse(req.body);
    return life.updateReminder(req.ragiOwnerId!, params.id, body);
  });
  app.delete("/api/v1/reminders/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveReminder(req.ragiOwnerId!, params.id);
  });
  app.patch("/api/v1/emergencies/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        body: z.string().optional(),
        severity: z.enum(["low", "high", "critical"]).optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);
    return life.updateEmergency(req.ragiOwnerId!, params.id, body);
  });
  app.delete("/api/v1/emergencies/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveEmergency(req.ragiOwnerId!, params.id);
  });
  app.patch("/api/v1/notes/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        title: z.string().optional(),
        body: z.string().optional(),
        kind: z.string().optional(),
      })
      .parse(req.body);
    return life.updateNote(req.ragiOwnerId!, params.id, body);
  });
  app.delete("/api/v1/notes/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveNote(req.ragiOwnerId!, params.id);
  });
  app.delete("/api/v1/jobs/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return life.archiveJob(req.ragiOwnerId!, params.id);
  });
};
