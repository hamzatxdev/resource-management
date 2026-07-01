"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Field, Input } from "@/components/Field";
import { uiBtn } from "@/lib/ui";

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
      <p className="text-slate-500 text-sm text-center">Checking session…</p>
    );
  }

  if (!configured || configError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-slate-800">
        <p className="font-semibold text-amber-800 mb-2">Authentication not configured</p>
        <p className="text-slate-600 text-sm leading-relaxed">
          Add both variables to <code className="ui-kbd">.env</code> and restart
          the server:
        </p>
        <pre className="mt-3 font-mono text-xs bg-white rounded-lg border border-slate-200 p-3 overflow-x-auto">
          {`AUTH_PASSWORD=your-strong-password\nAUTH_SECRET=$(openssl rand -hex 32)`}
        </pre>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Password">
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          placeholder="Team directory password"
        />
      </Field>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !password}
        className={`w-full ${uiBtn.primary}`}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="w-full max-w-md ui-card p-8 shadow-card-lg">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Techverx · Internal
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Team Directory</h1>
          <p className="text-slate-500 text-sm mt-2">
            Sign in to access the team skills database.
          </p>
        </div>

        <Suspense
          fallback={
            <p className="text-slate-500 text-sm text-center">Loading…</p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
