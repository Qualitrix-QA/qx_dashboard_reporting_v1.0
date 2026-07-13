import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/firebase/auth";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User as UserIcon } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (newMode: "login" | "signup") => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (mode === "signup" && !displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }

    // ── Domain restriction ────────────────────────────────────────────────
    const emailNormalized = email.trim().toLowerCase();
    if (!emailNormalized.endsWith("@qualitrix.com")) {
      setError("Only @qualitrix.com email addresses are allowed.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
        toast.success("Welcome back!", {
          description: "You have signed in successfully.",
        });
      } else {
        await signUp(email, password, displayName);
        toast.success("Account created!", {
          description: "Your account has been set up successfully.",
        });
      }
      onOpenChange(false);
      onSuccess?.();
      // Reset form
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err: any) {
      console.error("Auth error:", err);
      // Clean firebase error messages (e.g. auth/invalid-credential -> Invalid credentials)
      let cleanMsg = err.message || "An authentication error occurred.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        cleanMsg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        cleanMsg = "This email is already in use.";
      } else if (err.code === "auth/weak-password") {
        cleanMsg = "Password must be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        cleanMsg = "Invalid email address format.";
      }
      setError(cleanMsg);
      toast.error("Authentication failed", {
        description: cleanMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {mode === "login" ? "Sign In" : "Create Account"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Access your customized settings and custom tables."
              : "Sign up to persist and share your custom analytics dashboards."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4.5 mt-2">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive animate-fade-in">
              {error}
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Display Name
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground/60" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10 h-10 text-sm focus-visible:ring-primary"
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground/60" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-10 text-sm focus-visible:ring-primary"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground/60" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-10 text-sm focus-visible:ring-primary"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-10 text-sm font-bold shadow-lg" disabled={loading}>
            {loading ? "Authenticating..." : mode === "login" ? "Sign In" : "Register"}
          </Button>

          <div className="pt-2.5 text-center text-xs text-muted-foreground border-t border-border/50">
            {mode === "login" ? (
              <span>
                New to QualityLens?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("signup")}
                  className="font-bold text-primary hover:underline"
                  disabled={loading}
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className="font-bold text-primary hover:underline"
                  disabled={loading}
                >
                  Sign in instead
                </button>
              </span>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
