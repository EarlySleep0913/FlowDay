import { createSession, loginResponse, verifyPassword } from "../../_lib/auth.js";
import { badRequest, readJson, unauthorized } from "../../_lib/http.js";

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!username || !password) return badRequest("请输入用户名和密码。");

  const user = await context.env.DB.prepare(
    `SELECT * FROM users WHERE username = ? AND disabled = 0`
  )
    .bind(username)
    .first();

  if (!user) return unauthorized();

  const ok = await verifyPassword(password, user);
  if (!ok) return unauthorized();

  await context.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  const session = await createSession(context.env, user.id);
  return loginResponse(user, session);
}
