import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { SpecialPeriod } from '@/types';
import { format } from 'date-fns';

const PERIOD_TYPES = [
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'LONG_WEEKEND', label: 'Long Weekend' },
  { value: 'VACATION', label: 'Vacation Season' },
];

const TYPE_COLORS: Record<string, 'default' | 'success' | 'warning'> = {
  HOLIDAY: 'default',
  LONG_WEEKEND: 'warning',
  VACATION: 'success',
};

interface PeriodForm {
  name: string;
  type: 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';
  startDate: string;
  endDate: string;
}

const emptyForm: PeriodForm = {
  name: '',
  type: 'HOLIDAY',
  startDate: '',
  endDate: '',
};

export default function AdminPeriodsPage() {
  const [periods, setPeriods] = useState<SpecialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PeriodForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    setFetchError('');
    try {
      const { periods } = await admin.getSpecialPeriods();
      setPeriods(periods);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load periods');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingId) {
        await admin.updateSpecialPeriod(editingId, formData);
      } else {
        await admin.createSpecialPeriod(formData);
      }
      await loadPeriods();
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save period');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (period: SpecialPeriod) => {
    setFormData({
      name: period.name,
      type: period.type,
      startDate: format(new Date(period.startDate), 'yyyy-MM-dd'),
      endDate: format(new Date(period.endDate), 'yyyy-MM-dd'),
    });
    setEditingId(period.id);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await admin.deleteSpecialPeriod(deleteTarget);
      await loadPeriods();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete period');
    }
    setDeleteTarget(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{fetchError}</p>
        <Button onClick={loadPeriods}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Special Periods</h1>
          <p className="text-muted-foreground">
            Define holidays, long weekends, and vacation seasons for hotel pricing
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Period
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Period' : 'Add New Period'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  id="name"
                  label="Period Name"
                  placeholder="e.g., Christmas Holiday"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Select
                  id="type"
                  label="Rate Type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION',
                    })
                  }
                  options={PERIOD_TYPES}
                />
                <Input
                  id="startDate"
                  type="date"
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
                <Input
                  id="endDate"
                  type="date"
                  label="End Date"
                  min={formData.startDate}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Check className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : editingId ? 'Update Period' : 'Add Period'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Periods List */}
      {periods.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No special periods defined. Add periods to apply different hotel rates during
              holidays and vacation seasons.
            </p>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Period
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {periods.map((period) => {
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            const isPast = endDate < new Date();

            return (
              <Card key={period.id} className={isPast ? 'opacity-60' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{period.name}</h3>
                        <Badge variant={TYPE_COLORS[period.type]}>{period.type.replace('_', ' ')}</Badge>
                        {isPast && <Badge variant="outline">Past</Badge>}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {format(startDate, 'MMMM d, yyyy')} - {format(endDate, 'MMMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(period)} aria-label={`Edit ${period.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(period.id)} aria-label={`Delete ${period.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Special Period"
        description="Are you sure you want to delete this special period?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">How special periods work</h3>
          <p className="text-sm text-muted-foreground">
            When calculating hotel booking prices, the system checks each night against defined
            special periods. If a night falls within a special period, the corresponding rate
            (Holiday, Long Weekend, or Vacation) is applied instead of the regular rate.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Note:</strong> Special periods only affect hotel pricing. Daycare uses a fixed
            rate year-round.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
