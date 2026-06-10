import { makePasswordRecord, requireAdmin } from "../../../_lib/auth.js";
import { badRequest, json, readJson } from "../../../_lib/http.js";

export async function onRequestPatch(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;

  const id = context.params.id;
  const body = await readJson(context.request);
  const current = await context.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first();

  if (!current) return badRequest("账号不存在。");

  const updates = [];
  const values = [];
  let coinsUpdated = false;

  if (typeof body?.displayName === "string") {
    const displayName = body.displayName.trim() || current.username;
    updates.push("display_name = ?");
    values.push(displayName);
  }

  if (body?.role === "admin" || body?.role === "user") {
    if (id === auth.user.id && body.role !== "admin") {
      return badRequest("不能取消自己的管理员权限。");
    }
    updates.push("role = ?");
    values.push(body.role);
  }

  if (typeof body?.disabled === "boolean") {
    if (id === auth.user.id && body.disabled) return badRequest("不能停用自己的账号。");
    updates.push("disabled = ?");
    values.push(body.disabled ? 1 : 0);
  }

  if (typeof body?.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) return badRequest("密码至少 6 位。");
    const passwordRecord = await makePasswordRecord(body.password);
    updates.push("password_hash = ?", "password_salt = ?", "password_iterations = ?");
    values.push(passwordRecord.hash, passwordRecord.salt, passwordRecord.iterations);
    await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "coins")) {
    const coins = Number(body.coins);
    if (!Number.isFinite(coins) || coins < 0 || coins > 9999999) {
      return badRequest("金币数量必须是 0 到 9999999 之间的数字。");
    }

    const normalizedCoins = Math.floor(coins);
    const stateRow = await context.env.DB.prepare("SELECT data FROM flow_state WHERE user_id = ?")
      .bind(id)
      .first();
    let state = {};
    try {
      state = stateRow?.data ? JSON.parse(stateRow.data) : {};
    } catch {
      state = {};
    }

    state.wallet = {
      ...(state.wallet || {}),
      coins: normalizedCoins,
      lifetimeCoins: Math.max(Number(state.wallet?.lifetimeCoins) || 0, normalizedCoins),
    };

    await context.env.DB.prepare(
      `INSERT INTO flow_state (user_id, data, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         data = excluded.data,
         updated_at = datetime('now')`
    )
      .bind(id, JSON.stringify(state))
      .run();

    coinsUpdated = true;
  }

  if (updates.length === 0 && !coinsUpdated) return badRequest("没有可更新的内容。");

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    await context.env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values, id)
      .run();
  }

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;

  const id = context.params.id;
  if (id === auth.user.id) return badRequest("不能停用自己的账号。");

  await context.env.DB.prepare(
    "UPDATE users SET disabled = 1, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  return json({ ok: true });
}
