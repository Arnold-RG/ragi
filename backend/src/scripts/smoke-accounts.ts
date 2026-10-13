import { buildApp } from "../app.js";

const password = "correct-horse-battery";

async function main() {
  const app = await buildApp();
  const stamp = Date.now().toString(36);

  const a = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: `a-${stamp}@example.com`, handle: `keeper-a-${stamp}`, password },
  });
  const b = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: `b-${stamp}@example.com`, handle: `keeper-b-${stamp}`, password: password + "-b" },
  });
  if (a.statusCode !== 200 || b.statusCode !== 200) {
    throw new Error(`register failed ${a.statusCode} ${a.body} / ${b.statusCode} ${b.body}`);
  }
  const tokenA = a.json().token as string;
  const tokenB = b.json().token as string;

  const weak = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: `c-${stamp}@example.com`, handle: `keeper-c-${stamp}`, password: "short" },
  });
  if (weak.statusCode !== 400) throw new Error(`weak password should be 400, got ${weak.statusCode}`);

  const bad = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: `a-${stamp}@example.com`, password: "not-the-password" },
  });
  if (bad.statusCode !== 401) throw new Error(`bad login should be 401, got ${bad.statusCode}`);

  const note = await app.inject({
    method: "POST",
    url: "/api/v1/notes",
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { title: `private-${stamp}`, body: "only A may read this" },
  });
  if (note.statusCode !== 200) throw new Error(`note create ${note.statusCode} ${note.body}`);

  const seen = await app.inject({
    method: "GET",
    url: "/api/v1/notes",
    headers: { authorization: `Bearer ${tokenB}` },
  });
  const titles = JSON.stringify(seen.json());
  if (titles.includes(`private-${stamp}`)) throw new Error("account B could read account A's note");

  const snap = await app.inject({
    method: "POST",
    url: "/api/v1/storage/snapshot",
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { reason: "smoke" },
  });
  if (snap.statusCode !== 200) throw new Error(`snapshot ${snap.statusCode} ${snap.body}`);
  const snapId = snap.json().snapshot.id as string;
  if (JSON.stringify(snap.json()).includes("jsonPath")) throw new Error("snapshot response leaked a server path");

  const foreign = await app.inject({
    method: "GET",
    url: `/api/v1/storage/snapshots/${snapId}`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  if (foreign.statusCode !== 404) throw new Error(`B should not read A's snapshot, got ${foreign.statusCode}`);

  const listB = await app.inject({
    method: "GET",
    url: "/api/v1/storage/snapshots",
    headers: { authorization: `Bearer ${tokenB}` },
  });
  if (JSON.stringify(listB.json()).includes(snapId)) throw new Error("B listed A's snapshot");

  console.log("accounts isolated");
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
