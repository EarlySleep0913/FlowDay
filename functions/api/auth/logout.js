import { clearSessionCookie, getCookie, json } from "../../_lib/http.js";
import { hashToken } from "../../_lib/crypto.js";

export async function onRequestPost(context) {
  const token = getCookie(context.request, "fd_session");
  if (token) {
    const tokenHash = await hashToken(token);
    await context.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
