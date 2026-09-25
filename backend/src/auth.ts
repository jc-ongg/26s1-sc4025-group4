export function parseCredentials(
  body: unknown,
): { email: string; password: string } | null {
  if (!body || typeof body !== "object") return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  if (!email.trim() || !password || email.length > 254 || password.length > 128)
    return null;
  return { email: email.trim().toLowerCase(), password };
}
