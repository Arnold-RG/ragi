import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { db } from "../../../shared/db.js";
import { env } from "../../../shared/config.js";

export async function registrationOptions(ownerId: string) {
  const existing = await db.webAuthnCredential.findMany({ where: { ownerId } });
  return generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: "ragi-owner",
    userDisplayName: "RAGI Owner",
    userID: new TextEncoder().encode(ownerId),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: JSON.parse(c.transports) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
}

export async function verifyRegistration(ownerId: string, response: unknown, expectedChallenge: string) {
  const verification = await verifyRegistrationResponse({
    response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: env.RP_ORIGIN,
    expectedRPID: env.RP_ID,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("webauthn registration failed");
  }
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await db.webAuthnCredential.create({
    data: {
      ownerId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: BigInt(credential.counter),
      transports: JSON.stringify(credential.transports ?? []),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
  });
  await db.owner.update({
    where: { id: ownerId },
    data: { webauthnEnabled: true },
  });
  return true;
}

export async function authenticationOptions() {
  const creds = await db.webAuthnCredential.findMany();
  return generateAuthenticationOptions({
    rpID: env.RP_ID,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: JSON.parse(c.transports) as AuthenticatorTransportFuture[],
    })),
    userVerification: "required",
  });
}

export async function verifyAuthentication(response: unknown, expectedChallenge: string) {
  const body = response as { id: string };
  const cred = await db.webAuthnCredential.findUnique({ where: { credentialId: body.id } });
  if (!cred) throw new Error("unknown credential");

  const verification = await verifyAuthenticationResponse({
    response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: env.RP_ORIGIN,
    expectedRPID: env.RP_ID,
    credential: {
      id: cred.credentialId,
      publicKey: Buffer.from(cred.publicKey, "base64url"),
      counter: Number(cred.counter),
      transports: JSON.parse(cred.transports) as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) throw new Error("webauthn auth failed");

  await db.webAuthnCredential.update({
    where: { id: cred.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return cred.ownerId;
}
