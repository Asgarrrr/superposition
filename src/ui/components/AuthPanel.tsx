// Email + password sign in / sign up, shown inside the daily win overlay when
// the player has no session. On success, better-auth updates the session store
// and the overlay re-renders past this panel — no callback needed.

import { useState } from "react";
import type { FormEvent } from "react";
import { m } from "../../paraglide/messages.js";
import { signIn, signUp } from "../../lib/auth-client.ts";

const FIELD =
  "w-full rounded-xs border border-paper/20 bg-transparent px-3 py-2 font-mono text-[13px] text-paper placeholder:text-paper/30 outline-none focus:border-tape/70";

export function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const handle = username.trim();
    const res =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({
            email,
            password,
            username: handle,
            name: handle,
          });
    setBusy(false);
    if (res.error) {
      // the username plugin reports a taken/invalid handle with a USERNAME_* code
      const taken = res.error.code?.includes("USERNAME");
      setError(taken ? m.auth_username_taken() : m.auth_error());
    }
  };

  return (
    <form onSubmit={submit} className="flex w-[min(88vw,300px)] flex-col gap-2">
      <p className="text-center text-[11px] tracking-[0.1em] text-paper/50">
        {m.daily_signin_prompt()}
      </p>
      {mode === "signup" && (
        <input
          className={FIELD}
          type="text"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_.]+"
          placeholder={m.auth_username()}
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
      )}
      <input
        className={FIELD}
        type="email"
        required
        placeholder={m.auth_email()}
        value={email}
        autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className={FIELD}
        type="password"
        required
        minLength={8}
        placeholder={m.auth_password()}
        value={password}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className="text-center text-[11px] text-ink-magenta">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="btn border-paper/40 text-paper disabled:opacity-50"
      >
        {mode === "signin" ? m.auth_signin() : m.auth_signup()}
      </button>
      <button
        type="button"
        className="btn border-none p-0 text-[11px] text-paper/40"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
        }}
      >
        {mode === "signin" ? m.auth_to_signup() : m.auth_to_signin()}
      </button>
    </form>
  );
}
