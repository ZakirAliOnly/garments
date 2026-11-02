"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

interface LoginPageProps {
  /** Called when Neon authentication succeeds. */
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cardAnim, setCardAnim] = useState<"enter" | "shake" | "none">("enter");

  // Clear the entry animation after it completes
  useEffect(() => {
    const t = setTimeout(() => setCardAnim("none"), 650);
    return () => clearTimeout(t);
  }, []);

  // Load remembered credentials (only when enabled)
  useEffect(() => {
    try {
      localStorage.removeItem("sk_login_password");
      const remember = localStorage.getItem("sk_login_remember") === "1";
      if (!remember) return;

      const savedEmail = localStorage.getItem("sk_login_email") ?? "";
      if (!savedEmail) return;

      setRememberMe(true);
      setEmail(savedEmail);

    } catch {
      // Ignore localStorage access issues (e.g. privacy mode)
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await authClient.signIn.email({ email, password, rememberMe })
      .catch(() => ({ error: { message: "Unable to reach the login service. Please try again." } }));

    if (authError) {
      setError("Incorrect email or password.");
      setCardAnim("shake");
      setTimeout(() => setCardAnim("none"), 400);
      setLoading(false);
      return;
    }

    // Remember the email only; session cookies are managed by Neon Auth.
    try {
      if (rememberMe) {
        localStorage.setItem("sk_login_remember", "1");
        localStorage.setItem("sk_login_email", email);
        localStorage.removeItem("sk_login_password");
      } else {
        localStorage.setItem("sk_login_remember", "0");
        localStorage.removeItem("sk_login_email");
        localStorage.removeItem("sk_login_password");
      }
    } catch {
      // Ignore localStorage write issues
    }

    onLogin();
    setLoading(false);
  };

  const cardAnimation =
    cardAnim === "enter" ? "slideUp .6s cubic-bezier(.16,1,.3,1) both" :
    cardAnim === "shake" ? "shake .4s ease" :
    "none";

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px 11px 42px",
    border: "1.5px solid var(--bg2)",
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "var(--bg)",
    transition: "all var(--tr)",
    color: "var(--ink)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink3)",
    display: "block",
    marginBottom: 5,
    letterSpacing: ".5px",
    textTransform: "uppercase",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--ink)", overflow: "hidden",
    }}>

      {/* ── Animated background ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, var(--ink) 0%, #0e2a58 45%, #0d4a94 100%)",
        overflow: "hidden",
      }}>
        {/* Orbs */}
        <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", animation: "drift 8s ease-in-out infinite", width: 500, height: 500, background: "rgba(26,111,204,.35)", top: -120, right: -80 }} />
        <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", animation: "drift 8s ease-in-out infinite", animationDelay: "-4s", width: 350, height: 350, background: "rgba(46,143,224,.25)", bottom: -80, left: -60 }} />
        <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", animation: "drift 8s ease-in-out infinite", animationDelay: "-2s", width: 200, height: 200, background: "rgba(240,165,0,.18)", bottom: "20%", right: "10%" }} />
        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
      </div>

      {/* ── Card wrapper ── */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>

        <div style={{
          background: "rgba(255,255,255,.97)",
          backdropFilter: "blur(20px)",
          borderRadius: 24,
          padding: "40px 44px 36px",
          width: 400,
          maxWidth: "calc(100vw - 32px)",
          boxShadow: "0 24px 80px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.1)",
          animation: cardAnimation,
        }}>

          {/* Logo area */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 88, height: 88, borderRadius: 18,
              margin: "0 auto 12px",
              boxShadow: "0 8px 32px rgba(16,87,160,.3)",
              background: "white",
              padding: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Garments" style={{ objectFit: "contain", width: "100%", height: "100%" }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", letterSpacing: ".3px", lineHeight: 1.3, margin: 0 }}>
              Garments
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, margin: "2px 0 0" }}>
              Management System — Admin Portal
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Error banner */}
            {error && (
              <div style={{ background: "#fff0f0", color: "var(--red)", fontSize: 12, padding: "9px 13px", borderRadius: 8, marginBottom: 12, border: "1px solid #ffdada", fontWeight: 500 }}>
                <i className="fa-solid fa-circle-exclamation"></i>&nbsp; {error}
              </div>
            )}

            {/* Email */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
                style={fieldStyle}
                onFocus={e => {
                  e.target.style.borderColor = "var(--blue2)";
                  e.target.style.background = "white";
                  e.target.style.boxShadow = "0 0 0 4px rgba(26,111,204,.1)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "var(--bg2)";
                  e.target.style.background = "var(--bg)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <i className="fa-solid fa-envelope" style={{ position: "absolute", left: 14, bottom: 13, color: "var(--muted)", fontSize: 14, pointerEvents: "none" }}></i>
            </div>

            {/* Password */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                style={fieldStyle}
                onFocus={e => {
                  e.target.style.borderColor = "var(--blue2)";
                  e.target.style.background = "white";
                  e.target.style.boxShadow = "0 0 0 4px rgba(26,111,204,.1)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "var(--bg2)";
                  e.target.style.background = "var(--bg)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <i className="fa-solid fa-lock" style={{ position: "absolute", left: 14, bottom: 13, color: "var(--muted)", fontSize: 14, pointerEvents: "none" }}></i>
            </div>

            {/* Sign in button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--blue)" }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)" }}>Remember me</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: 13, marginTop: 6,
                background: "linear-gradient(135deg, var(--blue) 0%, var(--blue2) 100%)",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: ".3px",
                transition: "all var(--tr)",
                boxShadow: "0 4px 20px rgba(16,87,160,.4)",
                opacity: loading ? .75 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(16,87,160,.5)";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(16,87,160,.4)";
              }}
            >
              <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-right-to-bracket"}`}></i>
              {loading ? "Signing in..." : "Sign In to Dashboard"}
            </button>

          </form>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,.5)", textAlign: "center" }}>
          Developed by{" "}
          <span style={{ color: "rgba(255,255,255,.8)", fontWeight: 600 }}>AddsMint.com</span>
          &nbsp;&bull;&nbsp; All Rights Reserved &copy; 2025
        </div>

      </div>
    </div>
  );
}
