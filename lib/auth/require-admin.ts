import { getSessionUser } from "./session";

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
