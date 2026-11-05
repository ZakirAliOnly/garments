ALTER TABLE "AdminUser"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
-- Before module access existed, every account was an administrator.
-- Preserve those accounts; future regular users remain deny-by-default.
UPDATE "AdminUser" SET "role" = 'admin';
ALTER TABLE "AdminUser" ADD CONSTRAINT "user_role_valid" CHECK ("role" IN ('admin','user'));
