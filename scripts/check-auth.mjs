import assert from "node:assert/strict";

const base = process.env.DEMO_URL ?? "http://localhost:3000";
async function request(path, { cookie, body, method = "GET" } = {}) {
  return fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const cookies = [];
try {
  assert.equal((await request("/health")).status, 200);
  assert.equal((await request("/auth/me")).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "jacob@gmail.com", password: "wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: ["jacob@gmail.com"], password: "password123" },
      })
    ).status,
    400,
  );
  for (const name of ["Jacob", "Chongwei", "Yojin", "Wallace", "Harsh", "Hansen"]) {
    const login = await request("/auth/login", {
      method: "POST",
      body: { email: `${name.toLowerCase()}@gmail.com`, password: "password123" },
    });
    assert.equal(login.status, 200);
    const account = await login.json();
    assert.deepEqual(Object.keys(account.user).sort(), ["email", "id", "name"]);
    assert.equal(account.user.name, name);
    const header = login.headers.get("set-cookie");
    assert.ok(header?.includes("HttpOnly"));
    const cookie = header.split(";")[0];
    cookies.push(cookie);
    const me = await request("/auth/me", { cookie });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.name, name);
  }
  assert.equal(
    (await (await request("/auth/me", { cookie: cookies[0] })).json()).user.name,
    "Jacob",
  );
  assert.equal(
    (await request("/auth/logout", { method: "POST", cookie: cookies[0] })).status,
    204,
  );
  assert.equal((await request("/auth/me", { cookie: cookies[0] })).status, 401);
  assert.equal((await request("/auth/me", { cookie: cookies[1] })).status, 200);
  console.log(
    "PASS: readiness, validation, credential matching, safe user response, session persistence, independent accounts, logout revocation.",
  );
} finally {
  await Promise.all(
    cookies.map((cookie) => request("/auth/logout", { method: "POST", cookie })),
  );
}
