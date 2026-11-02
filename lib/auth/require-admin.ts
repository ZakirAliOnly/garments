import { auth } from "./server";

export async function requireAdmin() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "admin") return Response.json({ error: "Admin access required" }, { status: 403 });
  return null;
}
