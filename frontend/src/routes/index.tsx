import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Plus,
  ShoppingCart,
  LogOut,
  Check,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { useLists, useAuth, useDarkMode } from "@/hooks";
import { Button, Card, CardContent, Modal, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, logout, isLoggingOut } = useAuth();
  const { lists, isLoading, createList, deleteList, isCreating } = useLists();
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreateList = async (e: FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    await createList(newListName.trim());
    setNewListName("");
    setIsModalOpen(false);
  };

  const handleDeleteList = async (id: string) => {
    await deleteList(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            My Lists
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {user?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            New List
          </Button>
          {user?.isAdmin && (
            <Link to="/users">
              <Button variant="ghost" size="sm" aria-label="Manage users">
                <Users className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDarkMode}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            isLoading={isLoggingOut}
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Lists */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No lists yet
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Create your first grocery list to get started
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-5 h-5" />
              Create List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lists.map((list, index) => {
            const progress =
              list.totalItems > 0
                ? (list.checkedItems / list.totalItems) * 100
                : 0;
            const isComplete = list.totalItems > 0 && progress === 100;

            return (
              <Link
                key={list.id}
                to="/list/$listId"
                params={{ listId: list.id }}
                className="block"
              >
                <Card
                  hover
                  className={`animate-slide-up stagger-${Math.min(index + 1, 5)}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isComplete
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : "bg-primary-100 dark:bg-primary-900/30"
                        }`}
                      >
                        {isComplete ? (
                          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ShoppingCart className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {list.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span>
                            {list.checkedItems}/{list.totalItems} items
                          </span>
                          <span>·</span>
                          <span>{formatDate(list.updatedAt)}</span>
                        </div>
                        {list.totalItems > 0 && (
                          <div className="mt-2 progress-bar">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create List Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setNewListName("");
        }}
        title="Create New List"
      >
        <form onSubmit={handleCreateList} className="space-y-4">
          <Input
            label="List Name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="e.g., Weekly Groceries"
            autoFocus
            required
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsModalOpen(false);
                setNewListName("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isCreating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete List"
      >
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Are you sure you want to delete this list? This action cannot be
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
            onClick={() => deleteConfirm && handleDeleteList(deleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
