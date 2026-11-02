import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
const response = await fetch(`${process.env.NEON_AUTH_BASE_URL}/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
  body: JSON.stringify({ email, password, name: "Administrator" }),
});
const result = await response.json();
if (!response.ok) throw new Error(`Account creation failed: ${response.status} ${result.code ?? result.message}`);
console.log(`Created user: ${result.user.id}`);
console.log("Assign the admin role with neon neon-auth user set-role <id> --roles admin");
