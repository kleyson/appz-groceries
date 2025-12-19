import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks";
import { Button, Input, Card, CardContent } from "@/components/ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
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
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete={canRegister ? "new-password" : "current-password"}
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
