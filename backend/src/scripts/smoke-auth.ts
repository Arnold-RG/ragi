const base = process.env.RAGI_PUBLIC_ORIGIN ?? "http://127.0.0.1:8787";

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

const c = await post("/api/v1/auth/challenge", {});
console.log("challenge", c);
const g1 = await post("/api/v1/auth/gate/1", {
  challengeId: (c.json as { challengeId: string }).challengeId,
  passphrase: process.env.OWNER_PASSPHRASE ?? "Ragi-Sole-9mK#w4Qp",
});
console.log("gate1", g1);
const g2 = await post("/api/v1/auth/gate/2", {
  challengeId: (c.json as { challengeId: string }).challengeId,
  code: process.env.OWNER_BACKUP_CODE ?? "739184",
});
console.log("gate2", g2);
const g3 = await post("/api/v1/auth/gate/3", {
  challengeId: (c.json as { challengeId: string }).challengeId,
  deviceKey: process.env.OWNER_DEVICE_KEY ?? "SOLE-KEY-RAGI-01",
});
console.log("gate3", {
  status: g3.status,
  ok: (g3.json as { ok?: boolean }).ok,
  gates: (g3.json as { gates?: string[] }).gates,
  hasToken: Boolean((g3.json as { token?: string }).token),
});
