import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ShoppingCart, WifiOff } from "lucide-react";
import { useAuth, useOnlineStatus } from "@/hooks";
import { Button, Input, Card, CardContent } from "@/components/ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const {
    isAuthenticated,
    canRegister,
    login,
    register,
    isLoggingIn,
    isRegistering,
    loginError,
    registerError,
  } = useAuth();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (canRegister && name.trim().length < 1) {
      setError("Name is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (canRegister && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      if (canRegister) {
        await register({ username, name: name.trim(), password });
      } else {
        await login({ username, password });
      }
      navigate({ to: "/" });
    } catch {
      setError(
        canRegister ? "Registration failed" : "Invalid username or password",
      );
    }
  };

  const displayError = error || loginError?.message || registerError?.message;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm animate-scale-in">
        <CardContent className="pt-8 pb-6">
          {/* Offline Banner */}
          {!isOnline && (
            <div
              className="mb-6 -mt-2 -mx-2 p-4 rounded-xl bg-slate-800 dark:bg-slate-700 text-white"
              role="alert"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">You're offline</p>
                  <p className="text-sm text-slate-300">
                    Connect to the internet to sign in
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-4 shadow-lg">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
              Groceries
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {canRegister
                ? "Create your admin account"
                : "Sign in to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {canRegister && (
              <Input
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                disabled={!isOnline}
                required
              />
            )}

            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={!isOnline}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete={canRegister ? "new-password" : "current-password"}
              disabled={!isOnline}
              required
            />

            {canRegister && (
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={!isOnline}
                required
              />
            )}

            {displayError && (
              <p className="text-sm text-red-500 text-center" role="alert">
                {displayError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!isOnline}
              isLoading={isLoggingIn || isRegistering}
            >
              {canRegister ? "Create Account" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
