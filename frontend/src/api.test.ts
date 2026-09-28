import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "./api";

// Run the suite with the same missing helpers as older browser installations.
const abortHelpers = [
  [AbortSignal, "any"],
  [AbortSignal, "timeout"],
  [AbortSignal.prototype, "throwIfAborted"],
] as const;
const descriptors = abortHelpers.map(([target, name]) =>
  Object.getOwnPropertyDescriptor(target, name),
);
beforeEach(() => {
  for (const [target, name] of abortHelpers)
    Object.defineProperty(target, name, { configurable: true, value: undefined });
});
afterEach(() => {
  mock.restoreAll();
  abortHelpers.forEach(([target, name], index) => {
    const descriptor = descriptors[index];
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else Reflect.deleteProperty(target, name);
  });
});

test("page reads succeed without AbortSignal convenience methods", async () => {
  const controller = new AbortController();
  const removeListener = mock.method(controller.signal, "removeEventListener");
  mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.equal(options.signal?.aborted, false);
    return Response.json({ restaurants: [{ id: "test-restaurant" }] });
  });
  assert.deepEqual(await api("/restaurants", undefined, { signal: controller.signal }), {
    restaurants: [{ id: "test-restaurant" }],
  });
  assert.equal(removeListener.mock.callCount(), 1);
});

test("an already-cancelled page never sends a request", async () => {
  const controller = new AbortController();
  controller.abort();
  const request = mock.method(globalThis, "fetch");
  await assert.rejects(api("/restaurants", undefined, { signal: controller.signal }), {
    name: "AbortError",
  });
  assert.equal(request.mock.callCount(), 0);
});

test("proxy HTML failures retain their HTTP status and a readable error", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("<h1>Bad gateway</h1>", { status: 502 }),
  );
  await assert.rejects(
    api("/restaurants"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 502 &&
      error.message.includes("temporarily unavailable"),
  );
});

test("API validation messages survive without exposing a malformed response", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "This table is full." }, { status: 409 }),
  );
  await assert.rejects(api("/groups/1/join", {}), {
    status: 409,
    message: "This table is full.",
  });
});

test("empty logout responses succeed and malformed successful responses fail clearly", async () => {
  mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  assert.equal(await api("/auth/logout", {}), undefined);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => new Response("not JSON"));
  await assert.rejects(api("/restaurants"), /Unexpected server response/);
});

test("a disposed page cannot process a late response", async () => {
  const controller = new AbortController();
  mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.ok(options.signal);
    controller.abort();
    return Response.json({ restaurants: [] });
  });
  await assert.rejects(api("/restaurants", undefined, { signal: controller.signal }), {
    name: "AbortError",
  });
});

test("a stalled mutation times out without retrying an uncertain write", async () => {
  const request = mock.method(
    globalThis,
    "fetch",
    (_url: string, options: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json({})), 100);
        options.signal!.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(options.signal!.reason);
          },
          { once: true },
        );
      }),
  );
  await assert.rejects(
    api("/bookings", {}, { timeoutMs: 5 }),
    /Refresh to check the latest state/,
  );
  assert.equal(request.mock.callCount(), 1);
});
