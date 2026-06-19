"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const configError = searchParams.get("error") === "config";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!data.configured) {
          setConfigured(false);
          return;
        }
        if (data.authenticated) {
          router.replace(from);
          return;
        }
      } catch {
        setError("Could not check session");
      } finally {
        setChecking(false);
      }
    })();
  }, [from, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.replace(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <p className="text-text-dim font-mono text-sm text-center">Checking session…</p>
    );
  }

  if (!configured || configError) {
    return (
      <div className="rounded border border-warn/40 bg-amber-50 px-3 py-3 text-sm text-text">
        <p className="font-medium text-warn mb-2">Authentication not configured</p>
        <p className="text-text-dim text-xs leading-relaxed">
          Add both variables to <code className="text-accent">.env</code> and restart
          the server:
        </p>
        <pre className="mt-2 font-mono text-[10px] bg-bg-elev rounded p-2 overflow-x-auto">
          {`AUTH_PASSWORD=your-strong-password\nAUTH_SECRET=$(openssl rand -hex 32)`}
        </pre>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block font-mono text-[10px] uppercase tracking-wider text-text-faint mb-1"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded border border-border bg-bg-elev px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/25"
          placeholder="Team directory password"
        />
      </div>

      {error && <p className="text-bad text-xs">{error}</p>}

      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded border border-accent/50 bg-accent/15 py-2.5 text-sm font-medium text-accent hover:bg-accent/25 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg-card shadow-card-lg p-6">
        <p className="font-mono text-[10px] text-text-faint tracking-widest uppercase mb-2">
          Techverx · Internal
        </p>
        <h1 className="font-display text-2xl mb-1">Team Directory</h1>
        <p className="text-text-dim text-sm mb-6">
          Sign in to access the team skills database.
        </p>

        <Suspense
          fallback={
            <p className="text-text-dim font-mono text-sm text-center">
              Loading…
            </p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
