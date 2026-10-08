import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { parseCredentials } from "./auth.js";
import { discovery } from "./discovery.js";
import { dining, HttpError } from "./dining.js";
import { ageBand } from "./event-eligibility.js";

const app = express();
const cookieName = "eatigo_session";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/" };
const publicUser = {
  id: true,
  name: true,
  email: true,
  singpassVerified: true,
  dateOfBirth: true,
  gender: true,
} as const;
function accountView(user: {
  id: string;
  name: string;
  email: string;
  singpassVerified: boolean;
  dateOfBirth: Date | null;
  gender: string | null;
}) {
  const { dateOfBirth, ...account } = user;
  return { ...account, ageBand: ageBand(dateOfBirth) };
}
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});
app.post("/api/auth/login", async (req, res) => {
  const credentials = parseCredentials(req.body);
  if (!credentials) {
    res.status(400).json({ message: "Enter an email and password." });
    return;
  }
  const user = await db.user.findUnique({
    where: { email: credentials.email },
  });
  if (!user || user.demoPassword !== credentials.password) {
    res.status(401).json({ message: "Email or password is incorrect." });
    return;
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.$transaction(async (tx) => {
    if (typeof req.cookies[cookieName] === "string") {
      await tx.session.deleteMany({
        where: { token: req.cookies[cookieName] },
      });
    }
    await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await tx.session.create({ data: { token, userId: user.id, expiresAt } });
  });
  res.cookie(cookieName, token, { ...cookieOptions, expires: expiresAt });
  const { id, name, email, singpassVerified, dateOfBirth, gender } = user;
  res.json({
    user: accountView({ id, name, email, singpassVerified, dateOfBirth, gender }),
  });
});
app.get("/api/auth/me", async (req, res) => {
  const token: unknown = req.cookies[cookieName];
  const session =
    typeof token === "string"
      ? await db.session.findUnique({
          where: { token },
          include: { user: { select: publicUser } },
        })
      : null;
  if (!session || session.expiresAt <= new Date()) {
    res.clearCookie(cookieName, cookieOptions);
    res.status(401).json({ message: "Please log in." });
    return;
  }
  res.set("Cache-Control", "no-store").json({ user: accountView(session.user) });
});
app.post("/api/auth/logout", async (req, res) => {
  if (typeof req.cookies[cookieName] === "string") {
    await db.session.deleteMany({ where: { token: req.cookies[cookieName] } });
  }
  res.clearCookie(cookieName, cookieOptions).sendStatus(204);
});
// Dining middleware authenticates all downstream routes, including discovery.
app.use("/api", dining);
app.use("/api", discovery);
app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint not found." });
});
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ message: "Invalid JSON body." });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};
app.use(errors);
const server = app.listen(4000, "0.0.0.0", () =>
  console.log("API listening on port 4000"),
);
async function shutdown() {
  server.close();
  await db.$disconnect();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
