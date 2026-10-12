import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../shared/config.js";
import { audit } from "../../shared/security/audit.js";
import { db } from "../../shared/db.js";

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.post("/api/v1/ai/chat", async (req, reply) => {
    if (!env.GEMINI_API_KEY) {
      return reply.code(503).send({
        error: "gemini_not_configured",
        hint: "Set GEMINI_API_KEY in backend/.env — never commit it.",
      });
    }

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

    const system = `You are RAGI, a private owner-only secretary. Mode: ${mode}. Be concise, practical, and loyal to the single owner. Do not invent private facts.`;

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
      await audit({
        ownerId: owner.id,
        action: "ai.chat",
        outcome: "error",
        detail: { status: res.status },
        vaultSalt: owner.vaultSalt,
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] ?? ""),
      });
      return reply.code(502).send({ error: "gemini_failed", detail: errText.slice(0, 500) });
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
      "(empty response)";

    await audit({
      ownerId: owner.id,
      action: "ai.chat",
      outcome: "ok",
      detail: { mode, chars: text.length },
      vaultSalt: owner.vaultSalt,
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    });

    return { reply: text, mode, model: env.GEMINI_MODEL };
  });
};
