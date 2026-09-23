import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

export function AccountChip() {
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending) {
    return (
      <div className="account-slot" aria-hidden="true">
        <div className="account-skeleton" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-slot">
        <Link to="/login" className="login-btn">
          Log in
        </Link>
      </div>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="account-slot" ref={rootRef}>
      <button
        type="button"
        className="account-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {user.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {open ? (
        <div className="account-menu" role="menu">
          <p className="account-name">{label}</p>
          {user.primaryEmail ? <p className="account-email">{user.primaryEmail}</p> : null}
          <p className="account-plan">Cloud studio unlocked</p>
          {authEnabled && !gateSession ? (
            <button
              type="button"
              className="ghost-btn account-signout"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut("/").catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
