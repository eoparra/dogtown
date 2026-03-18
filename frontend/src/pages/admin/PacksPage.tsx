import { useState, useEffect, useCallback } from 'react';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { ServicePack, PackType } from '@/types';

interface PackForm {
  name: string;
  description: string;
  packType: PackType;
  unitsIncluded: string;
  priceSmall: string;
  priceMedium: string;
  priceLarge: string;
}

const emptyForm: PackForm = {
  name: '',
  description: '',
  packType: 'DAYCARE_DAYS',
  unitsIncluded: '',
  priceSmall: '',
  priceMedium: '',
  priceLarge: '',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const PACK_TYPE_LABELS: Record<PackType, string> = {
  DAYCARE_DAYS: 'Daycare Days',
  HOTEL_NIGHTS: 'Hotel Nights',
};

const PACK_TYPE_UNIT: Record<PackType, string> = {
  DAYCARE_DAYS: 'days',
  HOTEL_NIGHTS: 'nights',
};

export default function AdminPacksPage() {
  const [packs, setPacks] = useState<ServicePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PackForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadPacks = useCallback(async () => {
    setFetchError('');
    try {
      const { packs } = await admin.getPacks();
      setPacks(packs);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const handleEdit = (pack: ServicePack) => {
    setFormData({
      name: pack.name,
      description: pack.description ?? '',
      packType: pack.packType,
      unitsIncluded: String(pack.unitsIncluded),
      priceSmall: String(pack.priceSmall),
      priceMedium: String(pack.priceMedium),
      priceLarge: String(pack.priceLarge),
    });
    setEditingId(pack.id);
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
      name: formData.name,
      description: formData.description || null,
      packType: formData.packType,
      unitsIncluded: parseInt(formData.unitsIncluded, 10),
      priceSmall: parseFloat(formData.priceSmall),
      priceMedium: parseFloat(formData.priceMedium),
      priceLarge: parseFloat(formData.priceLarge),
    };

    try {
      if (editingId) {
        const { pack } = await admin.updatePack(editingId, payload);
        setPacks((prev) => prev.map((p) => (p.id === editingId ? pack : p)));
      } else {
        const { pack } = await admin.createPack(payload);
        setPacks((prev) => [...prev, pack]);
      }
      handleCancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save pack');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await admin.deletePack(deleteTarget);
      setPacks((prev) => prev.filter((p) => p.id !== deleteTarget));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete pack');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packs</h1>
          <p className="text-sm text-gray-500 mt-1">Manage prepaid service packs (daycare cards, hotel night bundles)</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyForm); setFormError(''); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Pack
          </Button>
        )}
      </div>

      {fetchError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {fetchError}
          <button className="ml-2 underline" onClick={loadPacks}>Retry</button>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Pack' : 'New Pack'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 10-Day Daycare Card, 5-Night Hotel Pack"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pack Type <span className="text-red-500">*</span>
                </label>
                <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, packType: 'DAYCARE_DAYS' }))}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      formData.packType === 'DAYCARE_DAYS'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Daycare Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, packType: 'HOTEL_NIGHTS' }))}
                    className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                      formData.packType === 'HOTEL_NIGHTS'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Hotel Nights
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Units included <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.unitsIncluded}
                  onChange={(e) => setFormData((f) => ({ ...f, unitsIncluded: e.target.value }))}
                  placeholder={formData.packType === 'DAYCARE_DAYS' ? 'e.g. 10' : 'e.g. 5'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price by dog size <span className="text-red-500">*</span>
                </label>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Small</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.priceSmall}
                      onChange={(e) => setFormData((f) => ({ ...f, priceSmall: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medium</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.priceMedium}
                      onChange={(e) => setFormData((f) => ({ ...f, priceMedium: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Large</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.priceLarge}
                      onChange={(e) => setFormData((f) => ({ ...f, priceLarge: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Pack'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Loading" />
        </div>
      ) : packs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No packs yet. Add your first prepaid pack above.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Price (S / M / L)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packs.map((pack) => (
                  <tr key={pack.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{pack.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        pack.packType === 'DAYCARE_DAYS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {PACK_TYPE_LABELS[pack.packType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {pack.unitsIncluded} {PACK_TYPE_UNIT[pack.packType]}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800 whitespace-nowrap hidden md:table-cell">
                      {fmt(pack.priceSmall)} · {fmt(pack.priceMedium)} · {fmt(pack.priceLarge)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(pack)}
                          aria-label={`Edit ${pack.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(pack.id)}
                          aria-label={`Delete ${pack.name}`}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Pack"
        description={`Are you sure you want to delete "${packs.find((p) => p.id === deleteTarget)?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
