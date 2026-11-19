import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readSession, sessionIsAuthed } from "./lib/session.js";

declare module "fastify" {
  interface FastifyRequest {
    ragiOwnerId?: string;
    ragiSessionHash?: string;
  }
  interface FastifyInstance {
    requireOwner: (req: FastifyRequest, reply: FastifyReply) => Promise<void | FastifyReply>;
  }
}

export async function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  const session = await readSession(req);
  if (!session || !sessionIsAuthed(session.gatesPassed)) {
    return reply.code(401).send({ error: "sign_in_required", message: "Sign in to open this room." });
  }
  req.ragiOwnerId = session.ownerId;
  req.ragiSessionHash = session.tokenHash;
}

export async function registerAuthGuard(app: FastifyInstance) {
  app.decorate("requireOwner", requireOwner);
}
