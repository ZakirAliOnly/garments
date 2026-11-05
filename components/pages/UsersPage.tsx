"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FinanceModal from "@/components/finance/FinanceModal";
import { MODULES, type ModuleId } from "@/lib/auth/permissions";
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  allowedModules: string[];
  updatedAt: string;
}
export default function UsersPage({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const cache = useQueryClient();
  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      if (!r.ok) throw Error();
      return r.json();
    },
    staleTime: 0,
  });
  const [selected, setSelected] = useState<string | null>(null),
    [modules, setModules] = useState<ModuleId[]>([]),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<User | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("user"),
    [active, setActive] = useState(true);
  const current = users.find((u) => u.id === selected);
  const baseVersion = useRef("");
  const select = (user: User) => {
    setSelected(user.id);
    setModules(
      MODULES.filter((m) => user.allowedModules.includes(m.id)).map(
        (m) => m.id,
      ),
    );
    baseVersion.current = user.updatedAt;
    setError("");
    setNotice("");
  };
  const openForm = (user?: User) => {
    setEditing(user ?? null);
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setRole(user?.role ?? "user");
    setActive(user?.active ?? true);
    setError("");
    setNotice("");
    setModal(true);
  };
  const request = async (url: string, body: unknown, method = "PATCH") => {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || "Unable to save user");
    await cache.invalidateQueries({ queryKey: ["users"] });
    window.dispatchEvent(new Event("garments:session-changed"));
    return d as User;
  };
  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request(
        editing ? `/api/users/${editing.id}` : "/api/users",
        {
          name,
          email,
          password,
          role,
          active,
          ...(editing
            ? { updatedAt: editing.updatedAt }
            : { allowedModules: [] }),
        },
        editing ? "PATCH" : "POST",
      );
      setModal(false);
      setPassword("");
      select(result);
      setNotice(
        editing
          ? "User updated."
          : "User created. Choose the modules this user can access below.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const savePermissions = async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(`/api/users/${current.id}`, {
        allowedModules: modules,
        updatedAt: baseVersion.current,
      });
      select(result);
      setNotice(
        "Module access saved. Changes are enforced immediately on the server.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggleActive = async (user: User) => {
    if (!window.confirm(`${user.active ? "Disable" : "Enable"} ${user.name}?`))
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(`/api/users/${user.id}`, {
        active: !user.active,
        updatedAt: user.updatedAt,
      });
      if (selected === user.id) select(result);
      setNotice(
        result.active
          ? "User enabled. They can sign in again."
          : "User disabled. Existing sessions are revoked.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const setAccess = (id: ModuleId, allowed: boolean) =>
    setModules((prev) =>
      allowed
        ? Array.from(new Set([...prev, id]))
        : prev.filter((m) => m !== id),
    );
  return (
    <div className="finance-page users-page">
      <div className="finance-page-heading">
        <div>
          <h2>User Management</h2>
          <p>Create users and choose which module pages they can access.</p>
        </div>
        <button className="finance-button" onClick={() => openForm()}>
          <i aria-hidden="true" className="fa-solid fa-user-plus" /> Add User
        </button>
      </div>
      {notice && (
        <div className="finance-info" role="status">
          {notice}
        </div>
      )}
      {error && !modal && (
        <div className="finance-error" role="alert">
          {error}
        </div>
      )}
      <div className="user-management-grid">
        <section className="surface">
          <div className="section-heading">
            <h2>
              <i aria-hidden="true" className="fa-solid fa-users" /> Users
            </h2>
            <span className="period-label">{users.length} accounts</span>
          </div>
          {isError ? (
            <div className="finance-error" role="alert">
              Unable to load users.{" "}
              <button onClick={() => refetch()}>Retry</button>
            </div>
          ) : isLoading ? (
            <p className="finance-empty">Loading users…</p>
          ) : (
            <div className="user-list">
              {users.map((user) => (
                <article
                  key={user.id}
                  className={`user-access-card ${selected === user.id ? "selected" : ""}`}
                >
                  <div className="user-access-identity">
                    <span className="worker-avatar">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3>
                        {user.name}
                        {user.id === currentUserId && <small> You</small>}
                      </h3>
                      <p>{user.email}</p>
                      <div className="user-badges">
                        <span>
                          {user.role === "admin"
                            ? "Administrator"
                            : "Regular user"}
                        </span>
                        <span className={user.active ? "positive" : "negative"}>
                          {user.active ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="user-access-actions">
                    <button
                      className="finance-button secondary"
                      disabled={busy}
                      onClick={() => select(user)}
                      aria-label={`Manage access for ${user.name}`}
                    >
                      Module Access
                    </button>
                    <button
                      className="finance-icon-button"
                      disabled={busy}
                      onClick={() => openForm(user)}
                      aria-label={`Edit ${user.name}`}
                      title="Edit user / reset password"
                    >
                      <i aria-hidden="true" className="fa-solid fa-pen" />
                    </button>
                    <button
                      className="finance-icon-button"
                      disabled={busy || user.id === currentUserId}
                      onClick={() => toggleActive(user)}
                      aria-label={`${user.active ? "Disable" : "Enable"} ${user.name}`}
                      title={
                        user.id === currentUserId
                          ? "You cannot disable yourself"
                          : user.active
                            ? "Disable user"
                            : "Enable user"
                      }
                    >
                      <i
                        aria-hidden="true"
                        className={`fa-solid fa-${user.active ? "user-slash" : "user-check"}`}
                      />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="surface module-permissions">
          {!current ? (
            <div className="finance-empty">
              <i aria-hidden="true" className="fa-solid fa-user-shield" />
              <h3>Select a user</h3>
              <p>Click Module Access to allow or deny pages.</p>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2>Module Access</h2>
                  <p className="finance-help">
                    {current.name} ·{" "}
                    {current.role === "admin"
                      ? "Full administrator access"
                      : `${modules.length} of ${MODULES.length} modules allowed`}
                  </p>
                </div>
                <i aria-hidden="true" className="fa-solid fa-shield-halved" />
              </div>
              {current.role === "admin" ? (
                <div className="finance-info">
                  Administrators can access every module and User Management.
                  Change the role to Regular user to set individual module
                  permissions.
                </div>
              ) : (
                <div className="permission-toolbar">
                  <button
                    className="finance-button secondary"
                    disabled={busy}
                    onClick={() => setModules(MODULES.map((m) => m.id))}
                  >
                    Allow All
                  </button>
                  <button
                    className="finance-button secondary"
                    disabled={busy}
                    onClick={() => setModules([])}
                  >
                    Deny All
                  </button>
                </div>
              )}
              <div className="permission-list">
                {MODULES.map((module) => {
                  const allowed =
                    current.role === "admin" || modules.includes(module.id);
                  return (
                    <div key={module.id} className="permission-row">
                      <span>
                        <i
                          aria-hidden="true"
                          className={`fa-solid fa-${module.icon}`}
                        />
                        {module.label}
                      </span>
                      <div role="group" aria-label={`${module.label} access`}>
                        <button
                          disabled={busy || current.role === "admin"}
                          className={allowed ? "allowed" : ""}
                          aria-pressed={allowed}
                          onClick={() => setAccess(module.id, true)}
                          aria-label={`Allow ${module.label}`}
                        >
                          Allow
                        </button>
                        <button
                          disabled={busy || current.role === "admin"}
                          className={!allowed ? "denied" : ""}
                          aria-pressed={!allowed}
                          onClick={() => setAccess(module.id, false)}
                          aria-label={`Deny ${module.label}`}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {current.role !== "admin" && (
                <>
                  <p className="finance-help">
                    A denied module is hidden from navigation and its APIs are
                    blocked. Permissions cover the whole module. Shared
                    dropdowns remain available only to the modules that need
                    them. User Management stays administrator-only.
                  </p>
                  <button
                    className="finance-button"
                    disabled={busy}
                    onClick={savePermissions}
                  >
                    {busy ? "Saving…" : "Save Permissions"}
                  </button>
                </>
              )}
            </>
          )}
        </section>
      </div>
      {modal && (
        <FinanceModal
          title={editing ? "Edit User" : "Add User"}
          subtitle={
            editing
              ? "Leave password blank to keep it unchanged."
              : "New regular users start with all modules denied."
          }
          busy={busy}
          onClose={() => {
            setModal(false);
            setPassword("");
          }}
        >
          <form onSubmit={saveUser} className="finance-form">
            {error && (
              <div className="finance-error" role="alert">
                {error}
              </div>
            )}
            <label>
              FULL NAME
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                autoComplete="name"
              />
            </label>
            <label>
              EMAIL ADDRESS
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                autoComplete="username"
              />
            </label>
            <label>
              {editing ? "NEW PASSWORD (OPTIONAL)" : "PASSWORD"}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editing}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <div className="finance-form-grid">
              <label>
                ROLE
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={editing?.id === currentUserId}
                >
                  <option value="user">Regular user</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label>
                STATUS
                <select
                  value={active ? "active" : "disabled"}
                  onChange={(e) => setActive(e.target.value === "active")}
                  disabled={editing?.id === currentUserId}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            {role === "admin" && (
              <p className="finance-help">
                Administrators have full access, including managing other users.
              </p>
            )}
            <footer>
              <button
                type="button"
                className="finance-button secondary"
                disabled={busy}
                onClick={() => {
                  setModal(false);
                  setPassword("");
                }}
              >
                Cancel
              </button>
              <button className="finance-button" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save User" : "Create User"}
              </button>
            </footer>
          </form>
        </FinanceModal>
      )}
    </div>
  );
}
