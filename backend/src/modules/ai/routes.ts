import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../shared/config.js";
import { audit } from "../../shared/security/audit.js";
import { db } from "../../shared/db.js";
import { localSecretaryReply } from "./local-secretary.js";

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.post("/api/v1/ai/chat", async (req) => {
    const body = z
      .object({
        message: z.string().min(1).max(8000),
        mode: z.enum(["work", "personal"]).optional(),
      })
      .parse(req.body);

    const owner = await db.owner.findUniqueOrThrow({ where: { id: req.ragiOwnerId! } });
    const mode =
      body.mode ??
      (await db.modeState.findUnique({ where: { ownerId: owner.id } }))?.mode ??
      "work";

    const meta = {
      ownerId: owner.id,
      vaultSalt: owner.vaultSalt,
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    };

    if (!env.GEMINI_API_KEY) {
      const reply = await localSecretaryReply(owner.id, body.message, mode);
      await audit({ ...meta, action: "ai.chat", outcome: "ok", detail: { mode, model: "ragi-local" } });
      return { reply, mode, model: "ragi-local", signal: "local" as const };
    }

    const system = `You are RAGI, a private owner-only secretary. Mode: ${mode}. Be concise, practical, and loyal to the single owner. Do not invent private facts. Prefer actionable next steps.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: body.message }] }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        const reply = await localSecretaryReply(owner.id, body.message, mode);
        await audit({
          ...meta,
          action: "ai.chat",
          outcome: "error",
          detail: { status: res.status, fallback: "ragi-local", snippet: errText.slice(0, 120) },
        });
        return {
          reply: `${reply}\n\n(cloud signal failed — used local vault brain)`,
          mode,
          model: "ragi-local",
          signal: "local-fallback" as const,
        };
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
        "(empty response)";

      await audit({
        ...meta,
        action: "ai.chat",
        outcome: "ok",
        detail: { mode, chars: text.length, model: env.GEMINI_MODEL },
      });

      return { reply: text, mode, model: env.GEMINI_MODEL, signal: "gemini" as const };
    } catch {
      const reply = await localSecretaryReply(owner.id, body.message, mode);
      await audit({ ...meta, action: "ai.chat", outcome: "error", detail: { fallback: "ragi-local" } });
      return {
        reply: `${reply}\n\n(cloud unreachable — local secretary online)`,
        mode,
        model: "ragi-local",
        signal: "local-fallback" as const,
      };
    }
  });
};
