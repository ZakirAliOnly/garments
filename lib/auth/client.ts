async function post(url: string, body?: unknown): Promise<{ error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return { error: data.error ?? "Request failed" };
  } catch {
    return { error: "Unable to reach the server. Please try again." };
  }
}

export const authClient = {
  signIn: (email: string, password: string, rememberMe: boolean) => post("/api/auth/login", { email, password, rememberMe }),
  signOut: () => post("/api/auth/logout"),
  changePassword: (currentPassword: string, newPassword: string) =>
    post("/api/auth/change-password", { currentPassword, newPassword }),
  async getSession(): Promise<boolean> {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },
};
