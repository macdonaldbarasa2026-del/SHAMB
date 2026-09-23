import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onOauth(providerId: string) {
    setError(null);
    setBusy(true);
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    if (!authEnabled) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const display = name.trim() || email.split("@")[0] || "Lumina";
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: display,
          callbackURL: "/",
        });
        if (signUpError) throw new Error(signUpError.message ?? "Could not create the account.");
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (signInError) throw new Error(signInError.message ?? "Could not sign in.");
      }
      await authClient.getSession().catch(() => undefined);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-root auth-page">
      <div className="stars-bg" aria-hidden="true">
        <div id="stars" />
        <div id="stars2" />
        <div id="stars3" />
      </div>
      <div className="vignette" />
      <main className="auth-card">
        <p className="auth-kicker">Lumina</p>
        <h1>{mode === "signup" ? "Create account" : "Log in"}</h1>
        <p className="lede">
          Cloud studio needs an account — photographs, prompt edits of your pictures, and video clips.
        </p>

        {authEnabled ? (
          <>
            <div className="auth-providers">
              {GROK_PROVIDERS.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  className="auth-btn"
                  disabled={busy}
                  onClick={() => void onOauth(provider.providerId)}
                >
                  Continue with {provider.label}
                </button>
              ))}
            </div>
            <p className="auth-split">or email</p>
            <form className="auth-form" onSubmit={(event) => void onEmail(event)}>
              {mode === "signup" ? (
                <label>
                  Name
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={busy}
                  />
                </label>
              ) : null}
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </label>
              {error ? <p className="auth-error">{error}</p> : null}
              <button type="submit" className="auth-btn auth-btn-primary" disabled={busy}>
                {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
            <button
              type="button"
              className="auth-switch"
              disabled={busy}
              onClick={() => {
                setMode((current) => (current === "signup" ? "signin" : "signup"));
                setError(null);
              }}
            >
              {mode === "signup" ? "Already have an account? Log in" : "Need an account? Create one"}
            </button>
          </>
        ) : (
          <p className="lede">Sign-in is disabled.</p>
        )}

        <Link to="/" className="auth-back">
          Back to the studio
        </Link>
      </main>
    </div>
  );
}
