import { useState, useEffect, useCallback } from 'react';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { InventoryItem, StockMovement, ItemCategory } from '@/types';
import { format } from 'date-fns';

const CATEGORIES = [
  { value: 'PET_ACCESSORIES', label: 'Pet Accessories' },
  { value: 'PET_FOOD', label: 'Pet Food' },
  { value: 'VETERINARY', label: 'Veterinary' },
];

const CATEGORY_COLORS: Record<ItemCategory, 'default' | 'success' | 'warning'> = {
  PET_ACCESSORIES: 'default',
  PET_FOOD: 'success',
  VETERINARY: 'warning',
};

const ALL_CATEGORIES = [{ value: '', label: 'All Categories' }, ...CATEGORIES];

interface ItemForm {
  sku: string;
  name: string;
  description: string;
  category: ItemCategory;
  unitOfMeasure: string;
  costPrice: string;
  sellingPrice: string;
  currentStock: string;
  lowStockThreshold: string;
  expiryDate: string;
}

const emptyForm: ItemForm = {
  sku: '',
  name: '',
  description: '',
  category: 'PET_ACCESSORIES',
  unitOfMeasure: 'units',
  costPrice: '',
  sellingPrice: '',
  currentStock: '0',
  lowStockThreshold: '10',
  expiryDate: '',
};

function categoryLabel(cat: ItemCategory) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Item CRUD state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ItemForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Stock movement state
  const [movementTarget, setMovementTarget] = useState<{ item: InventoryItem; type: 'RECEIVE' | 'DEDUCT' } | null>(null);
  const [movementQty, setMovementQty] = useState('');
  const [movementNote, setMovementNote] = useState('');
  const [movementError, setMovementError] = useState('');
  const [movementSaving, setMovementSaving] = useState(false);

  // History state
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadItems = useCallback(async () => {
    setFetchError('');
    try {
      const { items } = await admin.getInventory();
      setItems(items);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = filterCategory
    ? items.filter((i) => i.category === filterCategory)
    : items;

  const lowStockItems = items.filter((i) => i.currentStock <= i.lowStockThreshold);

  // --- Item form ---
  const handleEdit = (item: InventoryItem) => {
    setFormData({
      sku: item.sku,
      name: item.name,
      description: item.description ?? '',
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      costPrice: String(item.costPrice),
      sellingPrice: String(item.sellingPrice),
      currentStock: String(item.currentStock),
      lowStockThreshold: String(item.lowStockThreshold),
      expiryDate: item.expiryDate ? format(new Date(item.expiryDate), 'yyyy-MM-dd') : '',
    });
    setEditingId(item.id);
    setShowForm(true);
    setFormError('');
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const payload = {
      sku: formData.sku,
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      unitOfMeasure: formData.unitOfMeasure,
      costPrice: parseFloat(formData.costPrice),
      sellingPrice: parseFloat(formData.sellingPrice),
      currentStock: parseInt(formData.currentStock, 10),
      lowStockThreshold: parseInt(formData.lowStockThreshold, 10),
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
    };

    try {
      if (editingId) {
        const { item } = await admin.updateInventoryItem(editingId, payload);
        setItems((prev) => prev.map((i) => (i.id === editingId ? item : i)));
      } else {
        const { item } = await admin.createInventoryItem(payload);
        setItems((prev) => [...prev, item]);
      }
      handleCancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete ---
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await admin.deleteInventoryItem(deleteTarget);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete item');
    }
    setDeleteTarget(null);
  };

  // --- Stock movement ---
  const openMovement = (item: InventoryItem, type: 'RECEIVE' | 'DEDUCT') => {
    setMovementTarget({ item, type });
    setMovementQty('');
    setMovementNote('');
    setMovementError('');
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementTarget) return;
    setMovementError('');
    setMovementSaving(true);

    const qty = parseInt(movementQty, 10);
    try {
      const fn = movementTarget.type === 'RECEIVE' ? admin.receiveStock : admin.deductStock;
      const { item } = await fn(movementTarget.item.id, {
        quantity: qty,
        note: movementNote || undefined,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      setMovementTarget(null);
    } catch (err) {
      setMovementError(err instanceof Error ? err.message : 'Failed to update stock');
    } finally {
      setMovementSaving(false);
    }
  };

  // --- History ---
  const toggleHistory = async (itemId: string) => {
    if (historyItemId === itemId) {
      setHistoryItemId(null);
      return;
    }
    setHistoryItemId(itemId);
    setHistoryLoading(true);
    try {
      const { movements } = await admin.getStockMovements(itemId);
      setMovements(movements);
    } catch {
      setMovements([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{fetchError}</p>
        <Button onClick={loadItems}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Manage stock for pet accessories, food, and veterinary supplies</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyForm); setFormError(''); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      {/* Low stock alert section */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800">
                  {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} at or below low stock threshold
                </p>
                <div className="mt-2 space-y-1">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm text-amber-700">
                      <span>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-amber-500 ml-2">({item.sku})</span>
                      </span>
                      <span>
                        {item.currentStock} / {item.lowStockThreshold} {item.unitOfMeasure} threshold
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Item' : 'Add New Item'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{formError}</div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  id="sku"
                  label="SKU"
                  placeholder="e.g., FOOD-001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
                <Input
                  id="name"
                  label="Item Name"
                  placeholder="e.g., Premium Dog Kibble"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Select
                  id="category"
                  label="Category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                  options={CATEGORIES}
                />
                <Input
                  id="unitOfMeasure"
                  label="Unit of Measure"
                  placeholder="e.g., units, kg, liters"
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  required
                />
                <Input
                  id="costPrice"
                  type="number"
                  label="Cost Price ($)"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  required
                />
                <Input
                  id="sellingPrice"
                  type="number"
                  label="Selling Price ($)"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  required
                />
                {!editingId && (
                  <Input
                    id="currentStock"
                    type="number"
                    label="Initial Stock"
                    min="0"
                    step="1"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    required
                  />
                )}
                <Input
                  id="lowStockThreshold"
                  type="number"
                  label="Low Stock Threshold"
                  min="0"
                  step="1"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                  required
                />
                <Input
                  id="expiryDate"
                  type="date"
                  label="Expiry Date (optional)"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
              <Input
                id="description"
                label="Description (optional)"
                placeholder="Additional details about this item"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Check className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="w-48">
          <Select
            id="filterCategory"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={ALL_CATEGORIES}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {items.length === 0
                ? 'No inventory items yet. Add your first item to get started.'
                : 'No items match the selected category.'}
            </p>
            {items.length === 0 && !showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isLow = item.currentStock <= item.lowStockThreshold;
            const isExpiringSoon =
              item.expiryDate && new Date(item.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();
            const historyOpen = historyItemId === item.id;

            return (
              <Card key={item.id} className={isLow ? 'border-amber-300' : ''}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    {/* Left: item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.name}</span>
                        <Badge variant={CATEGORY_COLORS[item.category]}>{categoryLabel(item.category)}</Badge>
                        {isLow && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        )}
                        {isExpired && <Badge variant="default">Expired</Badge>}
                        {!isExpired && isExpiringSoon && <Badge variant="warning">Expires Soon</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                        <span>SKU: {item.sku}</span>
                        <span>Unit: {item.unitOfMeasure}</span>
                        <span>Cost: ${item.costPrice.toFixed(2)}</span>
                        <span>Price: ${item.sellingPrice.toFixed(2)}</span>
                        {item.expiryDate && (
                          <span>Expires: {format(new Date(item.expiryDate), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>

                    {/* Right: stock + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-2xl font-bold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}
                        >
                          {item.currentStock}
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">{item.unitOfMeasure}</span>
                        <div className="text-xs text-muted-foreground">
                          threshold: {item.lowStockThreshold}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMovement(item, 'RECEIVE')}
                          aria-label={`Receive stock for ${item.name}`}
                          title="Receive stock"
                        >
                          <ArrowDownCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMovement(item, 'DEDUCT')}
                          aria-label={`Deduct stock for ${item.name}`}
                          title="Deduct stock"
                        >
                          <ArrowUpCircle className="h-4 w-4 text-red-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleHistory(item.id)}
                          aria-label={`Toggle history for ${item.name}`}
                          title="Movement history"
                        >
                          <History className="h-4 w-4" />
                          {historyOpen ? (
                            <ChevronUp className="h-3 w-3 ml-0.5" />
                          ) : (
                            <ChevronDown className="h-3 w-3 ml-0.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(item.id)}
                          aria-label={`Delete ${item.name}`}
                          disabled={(item._count?.movements ?? 0) > 0}
                          title={
                            (item._count?.movements ?? 0) > 0
                              ? 'Cannot delete item with movement history'
                              : 'Delete item'
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Movement history inline */}
                  {historyOpen && (
                    <div className="mt-4 border-t pt-4">
                      {historyLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900" />
                        </div>
                      ) : movements.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No movement history yet.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Recent movements (last 100)
                          </p>
                          {movements.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                {m.type === 'RECEIVE' ? (
                                  <ArrowDownCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <ArrowUpCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                )}
                                <span className={m.type === 'RECEIVE' ? 'text-green-700' : 'text-red-600'}>
                                  {m.type === 'RECEIVE' ? '+' : '-'}{m.quantity} {item.unitOfMeasure}
                                </span>
                                {m.note && (
                                  <span className="text-muted-foreground truncate max-w-[200px]">{m.note}</span>
                                )}
                              </div>
                              <div className="text-muted-foreground text-xs text-right shrink-0">
                                <div>{m.performedBy?.name ?? 'Unknown'}</div>
                                <div>{format(new Date(m.createdAt), 'MMM d, yyyy HH:mm')}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stock movement modal */}
      {movementTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {movementTarget.type === 'RECEIVE' ? 'Receive Stock' : 'Deduct Stock'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {movementTarget.item.name}{' '}
                <span className="text-muted-foreground">— current stock: {movementTarget.item.currentStock} {movementTarget.item.unitOfMeasure}</span>
              </p>
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                {movementError && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                    {movementError}
                  </div>
                )}
                <Input
                  id="movementQty"
                  type="number"
                  label={`Quantity (${movementTarget.item.unitOfMeasure})`}
                  min="1"
                  step="1"
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  required
                  autoFocus
                />
                <Input
                  id="movementNote"
                  label="Note (optional)"
                  placeholder={movementTarget.type === 'RECEIVE' ? 'e.g., Supplier delivery' : 'e.g., Used for boarding dogs'}
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={movementSaving}
                    variant={movementTarget.type === 'RECEIVE' ? 'primary' : 'destructive'}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {movementSaving
                      ? 'Saving...'
                      : movementTarget.type === 'RECEIVE'
                      ? 'Confirm Receive'
                      : 'Confirm Deduct'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setMovementTarget(null)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Inventory Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
