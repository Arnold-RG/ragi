const base = process.env.RAGI_PUBLIC_ORIGIN ?? "http://127.0.0.1:8787";
const res = await fetch(`${base}/health`);
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
if (!res.ok) process.exit(1);
