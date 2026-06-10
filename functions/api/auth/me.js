import { getCurrentUser, publicUser } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

export async function onRequestGet(context) {
  const user = await getCurrentUser(context);
  return json({ user: publicUser(user) });
}
