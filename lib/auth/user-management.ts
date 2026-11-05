import { MODULES, isModule, type ModuleId } from "./permissions";
import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  allowedModules: true,
  createdAt: true,
  updatedAt: true,
} as const;
export class UserError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function parseModules(value: unknown): ModuleId[] {
  if (!Array.isArray(value) || value.some((m) => !isModule(m)))
    throw new UserError("Choose valid module permissions");
  return MODULES.filter((m) => value.includes(m.id)).map((m) => m.id);
}
export function parseProfile(body: Record<string, unknown>) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.trim().length > 80
  )
    throw new UserError("Enter a name of 1–80 characters");
  if (
    typeof body.email !== "string" ||
    body.email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(body.email.trim())
  )
    throw new UserError("Enter a valid email address");
  if (body.role !== "admin" && body.role !== "user")
    throw new UserError("Choose Administrator or Regular user");
  if (typeof body.active !== "boolean")
    throw new UserError("Choose an account status");
  return {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    role: body.role,
    active: body.active,
  };
}
export function validNewPassword(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw new UserError("Password must contain 8–128 characters");
  return true;
}
export function userError(error: unknown) {
  if (error instanceof UserError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return NextResponse.json(
      { error: "This email is already registered" },
      { status: 409 },
    );
  console.error("User management failed", error);
  return NextResponse.json(
    { error: "Unable to save users. Refresh and try again." },
    { status: 500 },
  );
}
