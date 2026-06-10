import { hashPassword, hashToken, randomId, randomSalt, randomToken, safeEqual } from "./crypto.js";
import { forbidden, getCookie, json, sessionCookie, unauthorized } from "./http.js";

const SESSION_DAYS = 30;

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.displayName || user.username,
    role: user.role,
    disabled: Boolean(user.disabled),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function verifyPassword(password, user) {
  const hash = await hashPassword(password, user.password_salt, user.password_iterations);
  return safeEqual(hash, user.password_hash);
}

export async function makePasswordRecord(password) {
  const salt = randomSalt();
  const iterations = 210000;
  const hash = await hashPassword(password, salt, iterations);
  return { salt, iterations, hash };
}

export async function createSession(env, userId) {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const id = randomId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(id, userId, tokenHash, expiresAt)
    .run();

  return { token, expiresAt };
}

export async function getCurrentUser(context) {
  const token = getCookie(context.request, "fd_session");
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const row = await context.env.DB.prepare(
    `SELECT users.id, users.username, users.display_name, users.role, users.disabled,
            users.created_at, users.updated_at, sessions.id AS session_id
       FROM sessions
       JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
        AND sessions.expires_at > datetime('now')
        AND users.disabled = 0`
  )
    .bind(tokenHash)
    .first();

  if (!row) return null;

  await context.env.DB.prepare(
    "UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?"
  )
    .bind(row.session_id)
    .run();

  return row;
}

export async function requireUser(context) {
  const user = await getCurrentUser(context);
  if (!user) return { response: unauthorized() };
  return { user };
}

export async function requireAdmin(context) {
  const result = await requireUser(context);
  if (result.response) return result;
  if (result.user.role !== "admin") return { response: forbidden() };
  return result;
}

export function loginResponse(user, session) {
  return json(
    { user: publicUser(user) },
    { headers: { "set-cookie": sessionCookie(session.token, session.expiresAt) } }
  );
}
