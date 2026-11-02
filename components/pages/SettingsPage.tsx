"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/* ─── Style helpers ───────────────────────────────── */
const card: React.CSSProperties = {
  background: "white", borderRadius: "var(--r)", boxShadow: "var(--sh)",
  padding: 24, marginBottom: 20, border: "1px solid rgba(205,216,236,.5)",
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--ink3)",
  letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 5, display: "block",
};
const inp: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1.5px solid var(--bg2)",
  borderRadius: "var(--r2)", fontSize: 13, fontFamily: "inherit",
  outline: "none", background: "white", color: "var(--ink)", boxSizing: "border-box",
};
const inpFocus: React.CSSProperties = { ...inp, border: "1.5px solid var(--blue)" };

function InfoRow({ icon, label, value, mono }: { icon: string; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 16px", borderRadius: "var(--r2)",
      background: "var(--bg)", border: "1px solid rgba(205,216,236,.6)",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: "var(--blue5)", color: "var(--blue)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
      }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: ".4px", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2, fontFamily: mono ? "monospace" : "inherit" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  /* ── password form state ── */
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused]         = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  /* password strength */
  const strength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8)          s++;
    if (/[A-Z]/.test(newPw))        s++;
    if (/[0-9]/.test(newPw))        s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "var(--red)", "var(--gold)", "var(--blue)", "var(--green)"][strength];

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPw) { showToast("Enter your current password", false); return; }
    if (newPw.length < 8) { showToast("New password must be at least 8 characters", false); return; }
    if (newPw !== confirmPw) { showToast("New passwords do not match", false); return; }
    if (newPw === currentPw) { showToast("New password must differ from current password", false); return; }

    setSaving(true);
    try {
      const { error: updateErr } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        revokeOtherSessions: true,
      });
      if (updateErr) {
        showToast(updateErr.message || "Failed to update password", false);
        setSaving(false);
        return;
      }

      showToast("Password updated successfully", true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch {
      showToast("An unexpected error occurred", false);
    } finally {
      setSaving(false);
    }
  };

  const pwInputStyle = (field: string): React.CSSProperties =>
    focused === field ? inpFocus : inp;

  return (
    <div style={{ maxWidth: 780, animation: "pgIn .3s cubic-bezier(.16,1,.3,1)" }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.ok ? "var(--green)" : "var(--red)",
          color: "white", padding: "11px 18px", borderRadius: "var(--r2)",
          boxShadow: "var(--shm)", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 9,
          animation: "pgIn .25s cubic-bezier(.16,1,.3,1)",
        }}>
          <i className={`fa-solid ${toast.ok ? "fa-circle-check" : "fa-circle-exclamation"}`} />
          {toast.msg}
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="fa-solid fa-gear" style={{ color: "var(--blue)" }} />
          Settings
        </h1>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          Manage your application preferences and account security.
        </p>
      </div>

      {/* ── Product Info ── */}
      <div style={card}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
          paddingBottom: 16, borderBottom: "1.5px solid var(--bg2)",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, var(--blue), var(--blue2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 16, flexShrink: 0,
          }}>
            <i className="fa-solid fa-circle-info" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Product Information</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>License &amp; activation details</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoRow icon="fa-box-open"    label="Product Name"    value="TMS by AddsMint" />
          <InfoRow icon="fa-code-branch" label="Version"         value="2.0" mono />
          <InfoRow icon="fa-calendar-check" label="Activation Date" value="25 March 2026" />
          <InfoRow icon="fa-calendar-xmark" label="Renewal Date"    value="25 March 2027" />
        </div>

        <div style={{
          marginTop: 16, padding: "11px 16px", borderRadius: "var(--r2)",
          background: "#e6f9f2", border: "1px solid #b2eed8",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: "var(--green)", fontSize: 15 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>License Active</div>
            <div style={{ fontSize: 11, color: "var(--green)", opacity: .8 }}>
              Your TMS license is valid and active. Contact AddsMint.com to renew.
            </div>
          </div>
        </div>
      </div>

      {/* ── Password Update ── */}
      <div style={card}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 24,
          paddingBottom: 16, borderBottom: "1.5px solid var(--bg2)",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 16, flexShrink: 0,
          }}>
            <i className="fa-solid fa-lock" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Change Password</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Update the password used to log in to this application.
            </div>
          </div>
        </div>

        <form onSubmit={handlePasswordUpdate} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Current password */}
          <div>
            <label style={lbl}>Current Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                style={{ ...pwInputStyle("current"), paddingRight: 42 }}
                placeholder="Enter your current password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                onFocus={() => setFocused("current")}
                onBlur={() => setFocused(null)}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", fontSize: 13, padding: 2,
              }}>
                <i className={`fa-solid ${showCurrent ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label style={lbl}>New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                style={{ ...pwInputStyle("new"), paddingRight: 42 }}
                placeholder="Minimum 8 characters"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                onFocus={() => setFocused("new")}
                onBlur={() => setFocused(null)}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", fontSize: 13, padding: 2,
              }}>
                <i className={`fa-solid ${showNew ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>

            {/* Strength meter */}
            {newPw && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      height: 3, flex: 1, borderRadius: 3,
                      background: i <= strength ? strengthColor : "var(--bg2)",
                      transition: "background .3s",
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: strengthColor }}>
                  {strengthLabel}
                  {strength < 3 && <span style={{ color: "var(--muted)", fontWeight: 400 }}> — add uppercase, numbers or symbols</span>}
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label style={lbl}>Confirm New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                style={{
                  ...pwInputStyle("confirm"),
                  paddingRight: 42,
                  ...(confirmPw && newPw && confirmPw !== newPw
                    ? { border: "1.5px solid var(--red)" }
                    : confirmPw && newPw && confirmPw === newPw
                    ? { border: "1.5px solid var(--green)" }
                    : {}),
                }}
                placeholder="Repeat new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", fontSize: 13, padding: 2,
              }}>
                <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
            {confirmPw && newPw && confirmPw !== newPw && (
              <div style={{ fontSize: 11, color: "var(--red)", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                <i className="fa-solid fa-circle-exclamation" />
                Passwords do not match
              </div>
            )}
            {confirmPw && newPw && confirmPw === newPw && (
              <div style={{ fontSize: 11, color: "var(--green)", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                <i className="fa-solid fa-circle-check" />
                Passwords match
              </div>
            )}
          </div>

          {/* Requirements hint */}
          <div style={{
            padding: "12px 14px", borderRadius: "var(--r2)",
            background: "var(--bg)", border: "1px solid var(--bg2)",
            fontSize: 11, color: "var(--muted)", lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 600, color: "var(--ink3)", marginBottom: 4 }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight: 5, color: "var(--blue)" }} />
              Password Requirements
            </div>
            {[
              { check: newPw.length >= 8,          text: "At least 8 characters" },
              { check: /[A-Z]/.test(newPw),         text: "One uppercase letter" },
              { check: /[0-9]/.test(newPw),         text: "One number" },
              { check: /[^A-Za-z0-9]/.test(newPw), text: "One special character" },
            ].map(({ check, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <i className={`fa-solid ${check ? "fa-check" : "fa-xmark"}`}
                  style={{ fontSize: 10, color: check ? "var(--green)" : "var(--muted)", width: 12 }} />
                <span style={{ color: check ? "var(--ink3)" : "var(--muted)" }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 24px",
                background: saving ? "var(--bg2)" : "linear-gradient(135deg, var(--blue), var(--blue2))",
                color: saving ? "var(--muted)" : "white",
                border: "none", borderRadius: "var(--r2)",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "opacity .2s",
              }}
            >
              <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-key"}`} />
              {saving ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
