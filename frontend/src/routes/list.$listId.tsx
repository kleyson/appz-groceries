import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import { useList, useItems, useCategories } from "@/hooks";
import {
  Button,
  Card,
  CardContent,
  Modal,
  Input,
  Badge,
  Checkbox,
} from "@/components/ui";
import {
  cn,
  formatCurrency,
  formatQuantity,
  getCategoryColor,
} from "@/lib/utils";
import type { CreateItemRequest } from "@/types";

export const Route = createFileRoute("/list/$listId")({
  component: ListDetailPage,
});

function ListDetailPage() {
  const { listId } = Route.useParams();
  const { list, isLoading: listLoading } = useList(listId);
  const {
    items,
    isLoading: itemsLoading,
    checkedCount,
    uncheckedCount,
    totalPrice,
    createItem,
    toggleItem,
    deleteItem,
    isCreating,
  } = useItems(listId);
  const { categories, getCategoryById } = useCategories();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateItemRequest>({
    name: "",
    quantity: 1,
    categoryId: "other",
  });

  const isLoading = listLoading || itemsLoading;

  const resetForm = () => {
    setFormData({
      name: "",
      quantity: 1,
      categoryId: formData.categoryId || "other",
    });
  };

  const handleAddItem = async (e: FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    await createItem({
      ...formData,
      name: formData.name.trim(),
      quantity: formData.quantity || 1,
      categoryId: formData.categoryId || "other",
    });

    if (keepOpen) {
      resetForm();
      // Focus back on the name input
      const nameInput = document.querySelector<HTMLInputElement>(
        'input[name="itemName"]',
      );
      nameInput?.focus();
    } else {
      setFormData({ name: "", quantity: 1, categoryId: "other" });
      setIsAddModalOpen(false);
    }
  };

  const handleToggle = async (id: string) => {
    await toggleItem(id);
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
    setDeleteConfirm(null);
  };

  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors touch-target"
          aria-label="Back to lists"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white truncate">
            {list?.name ?? "List"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {uncheckedCount} remaining · {checkedCount} done
            {totalPrice > 0 && ` · ${formatCurrency(totalPrice)}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </header>

      {/* Progress */}
      {items.length > 0 && (
        <div className="mb-6">
          <div className="progress-bar h-2">
            <div
              className="progress-bar-fill"
              style={{
                width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Plus className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No items yet
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Add items to your grocery list
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-5 h-5" />
              Add Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Unchecked Items */}
          {uncheckedItems.length > 0 && (
            <div className="space-y-2">
              {uncheckedItems.map((item, index) => {
                const category = getCategoryById(item.categoryId);
                const categoryColor = getCategoryColor(item.categoryId);

                return (
                  <Card
                    key={item.id}
                    className={cn(
                      "animate-slide-up",
                      `stagger-${Math.min(index + 1, 5)}`,
                    )}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={item.checked}
                          onChange={() => handleToggle(item.id)}
                          aria-label={`Mark ${item.name} as done`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-white truncate">
                              {item.name}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                {formatQuantity(item.quantity, item.unit)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              size="sm"
                              style={{
                                backgroundColor: `${categoryColor}20`,
                                color: categoryColor,
                              }}
                            >
                              {category?.name ?? "Other"}
                            </Badge>
                            {item.price && (
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                {formatCurrency(item.price)}
                                {item.quantity > 1 &&
                                  ` (${formatCurrency(item.price * item.quantity)})`}
                              </span>
                            )}
                            {item.store && (
                              <span className="text-sm text-slate-400 dark:text-slate-500">
                                @ {item.store}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-target"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Checked Items */}
          {checkedItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Completed ({checkedItems.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {checkedItems.map((item) => {
                  const category = getCategoryById(item.categoryId);
                  const categoryColor = getCategoryColor(item.categoryId);

                  return (
                    <Card key={item.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={item.checked}
                            onChange={() => handleToggle(item.id)}
                            aria-label={`Unmark ${item.name}`}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-slate-500 dark:text-slate-400 line-through truncate">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                size="sm"
                                style={{
                                  backgroundColor: `${categoryColor}20`,
                                  color: categoryColor,
                                }}
                              >
                                {category?.name ?? "Other"}
                              </Badge>
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteConfirm(item.id)}
                            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-target"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setFormData({ name: "", quantity: 1, categoryId: "other" });
        }}
        title="Add Item"
      >
        <form onSubmit={(e) => handleAddItem(e, true)} className="space-y-4">
          <Input
            label="Item Name"
            name="itemName"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Milk"
            autoFocus
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              min={1}
              value={formData.quantity ?? 1}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value) || 1,
                })
              }
            />
            <Input
              label="Unit (optional)"
              value={formData.unit ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              placeholder="e.g., lbs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isSelected = formData.categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, categoryId: cat.id })
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                      isSelected
                        ? "ring-2 ring-offset-2 ring-primary-500"
                        : "hover:opacity-80",
                    )}
                    style={{
                      backgroundColor: `${cat.color}20`,
                      color: cat.color,
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (optional)"
              type="number"
              min={0}
              step={0.01}
              value={formData.price ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  price: e.target.value
                    ? parseFloat(e.target.value)
                    : undefined,
                })
              }
              placeholder="0.00"
            />
            <Input
              label="Store (optional)"
              value={formData.store ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, store: e.target.value })
              }
              placeholder="e.g., Costco"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="w-full" isLoading={isCreating}>
              Save & Add Another
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormData({ name: "", quantity: 1, categoryId: "other" });
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                isLoading={isCreating}
                onClick={(e) => handleAddItem(e as unknown as FormEvent, false)}
              >
                Add & Close
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Item"
      >
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Are you sure you want to delete this item?
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
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
