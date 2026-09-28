export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

export async function api<T>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  // Use the base AbortController API for browsers without newer AbortSignal helpers.
  const controller = new AbortController();
  const { signal } = controller;
  const abort = () => controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    abort();
  }, options.timeoutMs ?? 30_000);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  let response: Response, data: unknown;
  try {
    if (signal.aborted) throw new DOMException("Request cancelled.", "AbortError");
    response = await fetch(`/api${path}`, {
      signal,
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (response.status !== 204) {
      // A restarting proxy may return HTML instead of the API's JSON error body.
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok)
          throw new ApiError(
            response.status,
            "Unexpected server response. Please try again.",
          );
      }
    }
    if (signal.aborted) throw new DOMException("Request cancelled.", "AbortError");
  } catch (error) {
    // Cancelled page reads must not report errors or invalidate a newer login.
    if (options.signal?.aborted) throw error;
    if (timedOut)
      throw new Error(
        "Request timed out. Refresh to check the latest state before retrying.",
      );
    if (error instanceof ApiError) throw error;
    throw new Error("Cannot reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && path !== "/auth/me")
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      response.status,
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "The server is temporarily unavailable. Please try again.",
    );
  }
  return data as T;
}
