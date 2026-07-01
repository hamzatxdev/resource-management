"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Field, Input } from "@/components/Field";
import { uiBtn } from "@/lib/ui";

export function ScreenLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authEnabled, setAuthEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const active = authEnabled && pathname !== "/login";

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setAuthEnabled(Boolean(data.configured && data.authenticated));
      })
      .catch(() => {});
  }, [pathname]);

  const lock = useCallback(() => {
    if (!active) return;
    setLocked(true);
    setPin("");
    setError("");
  }, [active]);

  useEffect(() => {
    if (!active) {
      setLocked(false);
      return;
    }

    const onVisibility = () => {
      if (document.hidden) lock();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, lock]);

  useEffect(() => {
    if (locked) {
      const t = setTimeout(() => pinRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [locked]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && data.error === "Unauthorized") {
          window.location.href = "/login";
          return;
        }
        throw new Error(data.error ?? "Incorrect PIN");
      }
      setLocked(false);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
      setPin("");
      pinRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <div
        className={
          locked && active
            ? "min-h-screen blur-md scale-[1.01] pointer-events-none select-none"
            : "min-h-screen"
        }
        aria-hidden={locked && active}
      >
        {children}
      </div>

      {locked && active && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Screen locked"
        >
          <div className="w-full max-w-xs ui-card p-6 shadow-card-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Screen locked
            </p>
            <h2 className="text-xl font-semibold text-slate-900 mb-1">Enter PIN</h2>
            <p className="text-slate-500 text-sm mb-5 leading-relaxed">
              You switched tabs or left the browser. Enter your PIN to continue.
            </p>

            <form onSubmit={handleUnlock} className="space-y-4">
              <Field label="PIN">
                <Input
                  ref={pinRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="text-center font-mono tracking-widest"
                />
              </Field>
              {error && <p className="text-red-600 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={verifying || !pin}
                className={`w-full ${uiBtn.primary}`}
              >
                {verifying ? "Checking…" : "Unlock"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
