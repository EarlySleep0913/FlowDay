import { makePasswordRecord, publicUser, requireAdmin } from "../../_lib/auth.js";
import { badRequest, json, readJson } from "../../_lib/http.js";
import { randomId } from "../../_lib/crypto.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;

  const result = await context.env.DB.prepare(
    `SELECT id, username, display_name, role, disabled, created_at, updated_at
       FROM users
      ORDER BY created_at DESC`
  ).all();

  return json({ users: (result.results || []).map(publicUser) });
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;

  const body = await readJson(context.request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  const displayName = String(body?.displayName || username).trim();
  const role = body?.role === "admin" ? "admin" : "user";

  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return badRequest("用户名只能包含字母、数字、下划线和横线，长度 3-32。");
  }
  if (password.length < 6) return badRequest("密码至少 6 位。");

  const passwordRecord = await makePasswordRecord(password);

  try {
    await context.env.DB.prepare(
      `INSERT INTO users (
        id, username, display_name, password_hash, password_salt,
        password_iterations, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        randomId(),
        username,
        displayName || username,
        passwordRecord.hash,
        passwordRecord.salt,
        passwordRecord.iterations,
        role
      )
      .run();
  } catch {
    return badRequest("用户名已存在。");
  }

  return json({ ok: true }, { status: 201 });
}
