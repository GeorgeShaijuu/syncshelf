"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { AuthGuard } from "@/features/auth/auth-guard";
import { formatAuthError } from "@/features/auth/auth-helpers";
import { OrganicBackgroundArtwork } from "@/components/ui/organic-background-artwork";
import { ClayButton, ClayInput, ClaySurface } from "@/components/ui/clay";
import { Layers, Loader2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

function sanitizeReturnUrl(url: string | null | undefined): string {
  if (!url) return "/";
  const trimmed = url.trim();
  // Strictly enforce relative return path to prevent open-redirect vulnerabilities
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }
  return "/";
}

function RegisterForm() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawReturnUrl = searchParams.get("returnUrl") || searchParams.get("continue");
  const targetReturnUrl = sanitizeReturnUrl(rawReturnUrl);
  const isSharedDestination = targetReturnUrl.startsWith("/s/");

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.push(targetReturnUrl);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push(targetReturnUrl);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-md space-y-7">
      {/* Header & Logo */}
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-[#24211F] font-sans group-hover:opacity-85 transition-opacity">
            syncshelf
          </span>
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#24211F]">
          {isSharedDestination ? "Create an account to collaborate" : "Create your account"}
        </h1>
        <p className="mt-1 text-xs text-[#817A72]">
          {isSharedDestination
            ? "Sign up to collaborate on this shared shelf and return directly to it."
            : "Start synchronizing notes, code, links, and files across all your devices."}
        </p>

        {isSharedDestination && (
          <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE4D0]/60 border border-[#F58B35]/30 text-[11px] font-medium text-[#A65E26]">
            <Sparkles className="h-3 w-3 text-[#F58B35]" />
            <span>Shared space destination preserved</span>
          </div>
        )}
      </div>

      {/* Main Clay Card Form */}
      <ClaySurface
        variant="soft"
        className="rounded-3xl border border-[#EDE5D9] bg-[#FFFEFA]/90 backdrop-blur-md p-6 sm:p-8 space-y-6 shadow-[0_20px_40px_rgba(36,33,31,0.06)]"
      >
        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Quick Google Sign Up */}
        <ClayButton
          type="button"
          variant="secondary"
          disabled={googleLoading || loading}
          onClick={handleGoogleSignUp}
          className="w-full h-11 text-xs font-semibold gap-2.5 rounded-2xl border-[#EDE5D9] bg-[#FAF7F0] hover:bg-[#F5EFE5] text-[#24211F] shadow-xs active:scale-[0.99]"
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
          <span>Sign up with Google</span>
        </ClayButton>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-[#EDE5D9]"></div>
          <span className="absolute bg-[#FFFEFA] px-3 text-[11px] font-medium text-[#AAA197] uppercase tracking-wider">
            Or with email
          </span>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24211F]">
              Your Name
            </label>
            <ClayInput
              type="text"
              placeholder="Alex Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || googleLoading}
              className="text-xs bg-[#FAF7F0] border-[#EDE5D9] rounded-2xl h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24211F]">
              Email address
            </label>
            <ClayInput
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || googleLoading}
              className="text-xs bg-[#FAF7F0] border-[#EDE5D9] rounded-2xl h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24211F]">
              Password
            </label>
            <ClayInput
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              className="text-xs bg-[#FAF7F0] border-[#EDE5D9] rounded-2xl h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24211F]">
              Confirm Password
            </label>
            <ClayInput
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || googleLoading}
              className="text-xs bg-[#FAF7F0] border-[#EDE5D9] rounded-2xl h-11"
              required
            />
          </div>

          <ClayButton
            type="submit"
            disabled={loading || googleLoading}
            className="w-full h-11 text-xs font-bold gap-2 rounded-2xl bg-[#F58B35] hover:bg-[#EE624E] text-white shadow-[0_4px_14px_rgba(245,139,53,0.35)] mt-2 active:scale-[0.99] transition-all"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </ClayButton>
        </form>
      </ClaySurface>

      {/* Footer Info */}
      <div className="flex flex-col items-center gap-2 text-center text-xs text-[#817A72]">
        <div>
          Already have an account?{" "}
          <Link
            href={
              rawReturnUrl
                ? `/login?returnUrl=${encodeURIComponent(rawReturnUrl)}`
                : "/login"
            }
            className="font-bold text-[#F58B35] hover:underline"
          >
            Sign in
          </Link>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#AAA197]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#F58B35]" />
          <span>Firebase Authentication &bull; Secure session</span>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthGuard requireAuth={false}>
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#FAF7F0] px-4 py-12 sm:px-6 lg:px-8 overflow-hidden select-none">
        <OrganicBackgroundArtwork />
        <React.Suspense
          fallback={
            <div className="flex h-32 w-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#F58B35]" />
            </div>
          }
        >
          <RegisterForm />
        </React.Suspense>
      </div>
    </AuthGuard>
  );
}
