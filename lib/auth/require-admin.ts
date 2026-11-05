import { getSessionUser } from "./session";
import { hasPage, type ModuleId } from "./permissions";
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin")
    return Response.json(
      { error: "Administrator access is required" },
      { status: 403 },
    );
  return null;
}
export async function requireModuleAccess(module: ModuleId | ModuleId[]) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const modules = Array.isArray(module) ? module : [module];
  if (!modules.some((page) => hasPage(user, page)))
    return Response.json(
      { error: "Access to this module is denied" },
      { status: 403 },
    );
  return null;
}
