import { AsyncLocalStorage } from "node:async_hooks";
// An interactive transaction sets its actor once; nested model queries reuse it.
// Next.js may load this module in multiple route bundles or during hot reload.
// Keep one process-local context so an interactive transaction is never wrapped
// in a separate transaction by a different copy of the Prisma extension.
const globalContext = globalThis as unknown as {
  garmentsActivityTransaction?: AsyncLocalStorage<boolean>;
};
export const activityTransaction =
  (globalContext.garmentsActivityTransaction ??=
    new AsyncLocalStorage<boolean>());
export async function activityActor() {
  const { getSessionUser } = await import("./auth/session");
  const user = await getSessionUser();
  return JSON.stringify(
    user ? { id: user.id, name: user.name, email: user.email } : {},
  );
}
