import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  GripVertical,
  ScanBarcode,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { ProductInfo } from "@/lib/barcode-lookup";
import type { CreateItemRequest, UpdateItemRequest, Item } from "@/types";

export const Route = createFileRoute("/list/$listId")({
  component: ListDetailPage,
});

// Sortable Item Component
interface SortableItemProps {
  item: Item;
  category: { name: string; color: string } | undefined;
  categoryColor: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isChecked?: boolean;
}

function SortableItem({
  item,
  category,
  categoryColor,
  onToggle,
  onEdit,
  onDelete,
  isChecked = false,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "shadow-lg ring-2 ring-primary-500")}
    >
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 -ml-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing touch-target flex items-center justify-center"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <Checkbox
            checked={item.checked}
            onChange={onToggle}
            aria-label={`Mark ${item.name} as ${item.checked ? "not done" : "done"}`}
          />

          {/* Clickable content area for editing */}
          <button
            onClick={onEdit}
            className="flex-1 min-w-0 text-left"
            aria-label={`Edit ${item.name}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-medium truncate",
                  isChecked
                    ? "text-slate-500 dark:text-slate-400 line-through"
                    : "text-slate-900 dark:text-white",
                )}
              >
                {item.name}
              </span>
              {item.quantity > 1 && (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {formatQuantity(item.quantity, item.unit)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge
                size="sm"
                style={{
                  backgroundColor: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                {category?.name ?? "Other"}
              </Badge>
              {item.price && !isChecked && (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {formatCurrency(item.price)}
                  {item.quantity > 1 &&
                    ` (${formatCurrency(item.price * item.quantity)})`}
                </span>
              )}
              {item.store && !isChecked && (
                <span className="text-sm text-slate-400 dark:text-slate-500">
                  @ {item.store}
                </span>
              )}
              {isChecked && item.checkedByName && (
                <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                  by {item.checkedByName}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={onDelete}
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-target flex items-center justify-center"
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

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
    updateItem,
    toggleItem,
    deleteItem,
    reorderItems,
    isCreating,
    isUpdating,
  } = useItems(listId);
  const { categories, getCategoryById } = useCategories();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateItemRequest>({
    name: "",
    quantity: 1,
    categoryId: "other",
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit ?? undefined,
      categoryId: item.categoryId,
      price: item.price ?? undefined,
      store: item.store ?? undefined,
    });
  };

  const handleUpdateItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formData.name.trim()) return;

    const updateData: UpdateItemRequest = {
      name: formData.name.trim(),
      quantity: formData.quantity || 1,
      unit: formData.unit,
      categoryId: formData.categoryId || "other",
      price: formData.price,
      store: formData.store,
    };

    await updateItem({ id: editingItem.id, data: updateData });
    setEditingItem(null);
    setFormData({ name: "", quantity: 1, categoryId: "other" });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = uncheckedItems.findIndex(
        (item) => item.id === active.id,
      );
      const newIndex = uncheckedItems.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(uncheckedItems, oldIndex, newIndex);
        // Include checked items at the end to maintain full order
        const allItemIds = [...newOrder, ...checkedItems].map(
          (item) => item.id,
        );
        await reorderItems(allItemIds);
      }
    }
  };

  const handleProductScanned = (product: ProductInfo) => {
    // Map product category to our category ID
    const categoryMap: Record<string, string> = {
      Produce: "01PRODUCE000000000000000000",
      Dairy: "02DAIRY00000000000000000000",
      Meat: "03MEAT000000000000000000000",
      Bakery: "04BAKERY0000000000000000000",
      Frozen: "05FROZEN0000000000000000000",
      Beverages: "06BEVERAGES00000000000000000",
      Snacks: "07SNACKS0000000000000000000",
      Pantry: "08PANTRY0000000000000000000",
      Household: "09HOUSEHOLD00000000000000000",
    };

    const categoryId = product.category
      ? categoryMap[product.category] || "10OTHER00000000000000000000"
      : "10OTHER00000000000000000000";

    // Pre-fill the form with scanned product info
    setFormData({
      name: product.name,
      quantity: 1,
      categoryId,
    });

    // Open the add modal so user can review/edit before adding
    setIsAddModalOpen(true);
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
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors touch-target flex items-center justify-center"
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsScannerOpen(true)}
            aria-label="Scan barcode"
          >
            <ScanBarcode className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
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
          {/* Unchecked Items - Draggable */}
          {uncheckedItems.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={uncheckedItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {uncheckedItems.map((item) => {
                    const category = getCategoryById(item.categoryId);
                    const categoryColor = getCategoryColor(item.categoryId);

                    return (
                      <SortableItem
                        key={item.id}
                        item={item}
                        category={category}
                        categoryColor={categoryColor}
                        onToggle={() => handleToggle(item.id)}
                        onEdit={() => handleEditItem(item)}
                        onDelete={() => setDeleteConfirm(item.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Checked Items - Not draggable */}
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
                    <SortableItem
                      key={item.id}
                      item={item}
                      category={category}
                      categoryColor={categoryColor}
                      onToggle={() => handleToggle(item.id)}
                      onEdit={() => handleEditItem(item)}
                      onDelete={() => setDeleteConfirm(item.id)}
                      isChecked
                    />
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

      {/* Edit Item Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => {
          setEditingItem(null);
          setFormData({ name: "", quantity: 1, categoryId: "other" });
        }}
        title="Edit Item"
      >
        <form onSubmit={handleUpdateItem} className="space-y-4">
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

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setEditingItem(null);
                setFormData({ name: "", quantity: 1, categoryId: "other" });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isUpdating}>
              Save Changes
            </Button>
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

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductFound={handleProductScanned}
      />
    </div>
  );
}
