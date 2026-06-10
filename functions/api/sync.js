import { publicUser, requireUser } from "../_lib/auth.js";
import { badRequest, json, readJson } from "../_lib/http.js";

export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  const row = await context.env.DB.prepare(
    "SELECT data, updated_at FROM flow_state WHERE user_id = ?"
  )
    .bind(auth.user.id)
    .first();

  return json({
    user: publicUser(auth.user),
    state: row ? JSON.parse(row.data) : null,
    updatedAt: row?.updated_at || null,
  });
}

export async function onRequestPut(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;

  const body = await readJson(context.request);
  if (!body || typeof body.state !== "object" || Array.isArray(body.state)) {
    return badRequest("同步数据格式不正确。");
  }

  const data = JSON.stringify(body.state);
  if (data.length > 900000) return badRequest("同步数据过大，请先导出备份。");

  await context.env.DB.prepare(
    `INSERT INTO flow_state (user_id, data, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       data = excluded.data,
       updated_at = datetime('now')`
  )
    .bind(auth.user.id, data)
    .run();

  return json({ ok: true, syncedAt: new Date().toISOString() });
}
