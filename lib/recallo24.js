// Recallo24 SMS API v1 client (server only). The key never leaves the server.
const BASE = (process.env.RECALLO24_API_URL || "https://recallo24.oyolloo.com/api/v1").replace(/\/$/, "");

async function call(apiKey, path, init = {}) {
  if (!apiKey) return { ok: false, status: 0, error: "No Recallo24 API key saved." };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data };
    return {
      ok: false,
      status: res.status,
      code: data?.error?.code,
      error: data?.error?.message || `Recallo24 answered ${res.status}.`,
    };
  } catch (err) {
    return { ok: false, status: 0, error: `Could not reach Recallo24 (${err?.name || "error"}).` };
  }
}

// Sends one SMS now. idempotencyKey makes a retry return the first result.
export function sendSms(apiKey, { to, body, reference, idempotencyKey }) {
  return call(apiKey, "/messages", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ to, body, reference }),
  });
}

export function getBalance(apiKey) {
  return call(apiKey, "/balance");
}
