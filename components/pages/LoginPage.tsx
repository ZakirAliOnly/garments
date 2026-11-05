"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import styles from "./LoginPage.module.css";

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    const result = await authClient.signIn(email.trim(), password, rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPassword("");
    onLogin();
  }

  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-label="Garments management system">
        <Link className={styles.brand} href="/" aria-label="Garments home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width="54" height="54" />
          <span>Garments<small>TAILOR MANAGEMENT SYSTEM</small></span>
        </Link>
        <div className={styles.story}>
          <span className={styles.eyebrow}>MADE FOR YOUR BUSINESS</span>
          <h1>Every detail. <br />Every order. <br /><span>All together.</span></h1>
          <p>A simpler way to manage your stock, invoices, workers, and everyday business.</p>
          <div className={styles.features}>
            <span><i className="fa-solid fa-boxes-stacked" aria-hidden="true" /> Stock & inventory</span>
            <span><i className="fa-solid fa-file-invoice" aria-hidden="true" /> Sales & invoices</span>
            <span><i className="fa-solid fa-scissors" aria-hidden="true" /> Tailor workflow</span>
          </div>
        </div>
        <div className={styles.introFooter}>Built for the way you work. <span>Powered by AddsMint.com</span></div>
      </section>

      <section className={styles.formPanel} aria-labelledby="login-heading">
        <div className={styles.formWrap}>
          <div className={styles.portal}><span /> ADMIN PORTAL</div>
          <h2 id="login-heading">Welcome back.</h2>
          <p className={styles.subtitle}>Sign in to your Garments dashboard.</p>
          <form onSubmit={handleSubmit} aria-busy={loading}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.label} htmlFor="login-email">Email address</label>
            <input className={styles.input} id="login-email" name="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={loading} />
            <label className={styles.label} htmlFor="login-password">Password</label>
            <div className={styles.passwordField}>
              <input className={styles.input} id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required disabled={loading} />
              <button className={styles.reveal} type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            <label className={styles.remember}><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} disabled={loading} /> Keep me signed in</label>
            <button className={styles.submit} type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in to dashboard"}<span aria-hidden="true">→</span></button>
          </form>
          <div className={styles.secure}><i className="fa-solid fa-lock" aria-hidden="true" /> Your business, securely connected.</div>
        </div>
        <footer className={styles.footer}>Garments Management System <span>© {new Date().getFullYear()} AddsMint.com</span></footer>
      </section>
    </main>
  );
}
