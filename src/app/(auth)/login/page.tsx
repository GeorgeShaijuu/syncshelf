"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/features/auth/auth-context";
import { AuthGuard } from "@/features/auth/auth-guard";
import { formatAuthError } from "@/features/auth/auth-helpers";
import { OrganicBackgroundArtwork } from "@/components/ui/organic-background-artwork";
import { ClayButton, ClayInput, ClaySurface } from "@/components/ui/clay";
import { Layers, Loader2, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [error, setError] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.push("/");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first to receive a password reset link.");
      return;
    }

    setError(null);
    setResetLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase Authentication is not configured.");
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthGuard requireAuth={false}>
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#FAF7F0] px-4 py-12 sm:px-6 lg:px-8 overflow-hidden select-none">
        {/* Organic Corner Background Artwork */}
        <OrganicBackgroundArtwork />

        <div className="relative z-10 w-full max-w-md space-y-7">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="group flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#24211F] font-sans group-hover:opacity-85 transition-opacity">
                syncshelf
              </span>
            </Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#24211F]">
              Sign in to your shelf
            </h1>
            <p className="mt-1 text-xs text-[#817A72]">
              Search, capture, and synchronize your team&apos;s clipboard.
            </p>
          </div>

          {/* Form Clay Surface */}
          <div className="clay-surface p-6 sm:p-8 space-y-6">
            {error && (
              <div className="rounded-xl border border-[#EE624E]/40 bg-[#EE624E]/10 p-3 text-xs text-[#EE624E] flex items-start gap-2">
                <span className="font-semibold">Error:</span>
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-600 flex items-start gap-2">
                <span className="font-semibold">Notice:</span>
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Google Sign-in */}
            <button
              type="button"
              disabled={loading || googleLoading}
              onClick={handleGoogleSignIn}
              className="clay-btn-secondary w-full h-10 text-xs font-bold flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#F58B35]" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-[#EDE5D9]" />
              <span className="absolute bg-[#FFFEFA] px-2 text-[11px] font-semibold text-[#817A72]">
                or with email
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24211F]">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || googleLoading}
                  required
                  className="clay-inset w-full h-10 px-3.5 text-xs font-medium rounded-xl text-[#24211F] placeholder:text-[#AAA197] transition-all focus:outline-none focus:bg-[#FFFEFA]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#24211F]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading || loading}
                    className="text-[11px] font-medium text-[#F58B35] hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="h-3 w-3" />
                    <span>Forgot password?</span>
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Your account password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || googleLoading}
                  required
                  className="clay-inset w-full h-10 px-3.5 text-xs font-medium rounded-xl text-[#24211F] placeholder:text-[#AAA197] transition-all focus:outline-none focus:bg-[#FFFEFA]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="clay-btn-primary w-full h-10 text-xs font-bold flex items-center justify-center gap-1.5 mt-2 cursor-pointer active:scale-98"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="flex flex-col items-center gap-2 text-center text-xs text-[#817A72]">
            <div>
              Don&apos;t have an account yet?{" "}
              <Link
                href="/register"
                className="font-bold text-[#F58B35] hover:underline"
              >
                Create one now
              </Link>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#AAA197]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#F58B35]" />
              <span>Firebase Authentication &bull; Secure session</span>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
