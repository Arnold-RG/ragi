import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as github from "./service.js";

export const githubRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.get("/api/v1/github/repos", async (req, reply) => {
    try {
      return await github.listGithubProjects(req.ragiOwnerId!);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "github_failed";
      return reply.code(502).send({ error: "github_failed", detail: msg.slice(0, 300) });
    }
  });

  app.put("/api/v1/github/login", async (req) => {
    const body = z
      .object({
        login: z
          .string()
          .trim()
          .max(39)
          .refine((s) => s === "" || /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(s), {
            message: "That does not look like a GitHub username.",
          }),
      })
      .parse(req.body);
    return github.setGithubLogin(req.ragiOwnerId!, body.login);
  });

  app.put("/api/v1/github/progress", async (req) => {
    const body = z
      .object({
        fullName: z.string().min(3),
        progress: z.number().int().min(0).max(100),
        notes: z.string().optional(),
      })
      .parse(req.body);
    return github.setGithubProgress(
      req.ragiOwnerId!,
      body.fullName,
      body.progress,
      body.notes,
    );
  });
};
