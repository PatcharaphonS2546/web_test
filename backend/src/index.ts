import { Elysia } from "elysia";
import { Pool } from "pg";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

type LoginBody = {
  username?: string;
  password?: string;
};

type JwtPayload = {
  sub: string;
  username: string;
  name?: string;
};

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV ?? "development";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const AUTH_COOKIE = "auth_token";
const JWT_EXPIRES_IN = "1d";

const buildCookie = (name: string, value: string, options: string[]) => {
  const encodedValue = encodeURIComponent(value);
  return [`${name}=${encodedValue}`, ...options].join("; ");
};

const parseCookies = (cookieHeader?: string | null) => {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) continue;
    result[rawKey] = decodeURIComponent(rawValue.join("="));
  }

  return result;
};

const signToken = (payload: JwtPayload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: "web_test",
    audience: "web_test_frontend",
  });
};

const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET, {
    issuer: "web_test",
    audience: "web_test_frontend",
  }) as JwtPayload;
};

const cookieOptions = () => {
  const options = ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=86400"];

  if (NODE_ENV === "production") {
    options.push("Secure");
  }

  return options;
};

const clearCookieOptions = () => {
  const options = ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];

  if (NODE_ENV === "production") {
    options.push("Secure");
  }

  return options;
};

const app = new Elysia()
  .onRequest(({ headers, set }) => {
    const origin = headers.origin;
    if (origin === FRONTEND_ORIGIN) {
      set.headers["Access-Control-Allow-Origin"] = origin;
      set.headers["Access-Control-Allow-Credentials"] = "true";
    }

    set.headers["Access-Control-Allow-Methods"] =
      "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  })
  .options("/*", ({ set }) => {
    set.status = 204;
    return "";
  })
  .get("/", () => "Hello Elysia")
  .get("/api/message", () => ({ message: "Hello from backend API" }))
  .post("/api/login", async ({ body, set }) => {
    const { username, password } = (body ?? {}) as LoginBody;

    if (!username || !password) {
      set.status = 400;
      return { error: "Username and password are required" };
    }

    const result = await pool.query(
      "SELECT id, username, password_hash, name FROM users WHERE username = $1 LIMIT 1",
      [username],
    );

    const user = result.rows[0];

    if (!user) {
      set.status = 401;
      return { error: "Invalid username or password" };
    }

    const isValid = await argon2.verify(user.password_hash, password);
    if (!isValid) {
      set.status = 401;
      return { error: "Invalid username or password" };
    }

    const token = signToken({
      sub: String(user.id),
      username: user.username,
      name: user.name ?? undefined,
    });

    set.headers["Set-Cookie"] = buildCookie(
      AUTH_COOKIE,
      token,
      cookieOptions(),
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    };
  })
  .get("/api/me", ({ headers, set }) => {
    const cookies = parseCookies(headers.cookie);
    const token = cookies[AUTH_COOKIE];

    if (!token) {
      set.status = 401;
      return { error: "Missing session cookie" };
    }

    try {
      const payload = verifyToken(token);
      return {
        user: {
          id: payload.sub,
          username: payload.username,
          name: payload.name ?? null,
        },
      };
    } catch {
      set.status = 401;
      return { error: "Invalid or expired session" };
    }
  })
  .post("/api/logout", ({ set }) => {
    set.headers["Set-Cookie"] = buildCookie(
      AUTH_COOKIE,
      "",
      clearCookieOptions(),
    );
    return { success: true };
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
