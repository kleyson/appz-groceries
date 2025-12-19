import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, User, Shield } from "lucide-react";
import { useAuth, useUsers } from "@/hooks";
import { Button, Card, CardContent, Modal, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const {
    users,
    isLoading,
    createUser,
    deleteUser,
    isCreating,
    isDeleting,
    createError,
  } = useUsers();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!isAuthLoading && (!currentUser || !currentUser.isAdmin)) {
      navigate({ to: "/" });
    }
  }, [currentUser, isAuthLoading, navigate]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 1) {
      setError("Name is required");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await createUser({ username, name: name.trim(), password });
      setName("");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setIsModalOpen(false);
    } catch {
      setError("Failed to create user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    await deleteUser(id);
    setDeleteConfirm(null);
  };

  const displayError = error || createError?.message;

  // Don't render until we know auth state
  if (isAuthLoading) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" aria-label="Back to lists">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
              Users
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage user accounts
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </header>

      {/* Users List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <User className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No users yet
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Add users to give them access
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-5 h-5" />
              Add User
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user, index) => (
            <Card
              key={user.id}
              className={`animate-slide-up stagger-${Math.min(index + 1, 5)}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      user.isAdmin
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    {user.isAdmin ? (
                      <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </h3>
                      {user.isAdmin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span>@{user.username}</span>
                      <span>·</span>
                      <span>{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                  {!user.isAdmin && user.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(user.id)}
                      aria-label={`Delete ${user.name}`}
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setName("");
          setUsername("");
          setPassword("");
          setConfirmPassword("");
          setError("");
        }}
        title="Add New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter user's name"
            autoComplete="name"
            autoFocus
            required
          />

          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="new-password"
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            required
          />

          {displayError && (
            <p className="text-sm text-red-500 text-center" role="alert">
              {displayError}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsModalOpen(false);
                setName("");
                setUsername("");
                setPassword("");
                setConfirmPassword("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isCreating}>
              Add User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete User"
      >
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Are you sure you want to delete this user? This action cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDeleteConfirm(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            isLoading={isDeleting}
            onClick={() => deleteConfirm && handleDeleteUser(deleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
