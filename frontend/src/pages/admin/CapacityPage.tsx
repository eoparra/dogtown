import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pencil, Check, X, Home, Sun } from 'lucide-react';
import type { Capacity } from '@/types';

export default function AdminCapacityPage() {
  const [capacity, setCapacity] = useState<Capacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCapacity();
  }, []);

  const [fetchError, setFetchError] = useState('');
  const [error, setError] = useState('');

  const loadCapacity = async () => {
    setFetchError('');
    try {
      const { capacity } = await admin.getCapacity();
      setCapacity(capacity);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load capacity');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type: string, currentValue: number) => {
    setEditingType(type);
    setEditValue(currentValue);
  };

  const handleSave = async (type: 'HOTEL' | 'DAYCARE') => {
    setSaving(true);
    try {
      await admin.updateCapacity(type, editValue);
      await loadCapacity();
      setEditingType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update capacity');
    } finally {
      setSaving(false);
    }
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
        <Button onClick={loadCapacity}>Retry</Button>
      </div>
    );
  }

  const hotelCapacity = capacity.find((c) => c.type === 'HOTEL');
  const daycareCapacity = capacity.find((c) => c.type === 'DAYCARE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Capacity Settings</h1>
        <p className="text-muted-foreground">
          Set the maximum number of dogs that can be accommodated
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Hotel Capacity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Hotel Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Maximum number of dogs that can stay overnight at any given time.
            </p>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <span className="font-medium">Max Dogs per Night</span>
              <div className="flex items-center gap-3">
                {editingType === 'HOTEL' ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      value={editValue}
                      onChange={(e) => setEditValue(parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSave('HOTEL')}
                      disabled={saving}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingType(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold">
                      {hotelCapacity?.maxCapacity ?? 0}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit('HOTEL', hotelCapacity?.maxCapacity ?? 1)}
                      aria-label="Edit hotel capacity"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daycare Capacity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Daycare Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Maximum number of dogs that can attend daycare on any given day.
            </p>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <span className="font-medium">Max Dogs per Day</span>
              <div className="flex items-center gap-3">
                {editingType === 'DAYCARE' ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      value={editValue}
                      onChange={(e) => setEditValue(parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSave('DAYCARE')}
                      disabled={saving}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingType(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold">
                      {daycareCapacity?.maxCapacity ?? 0}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit('DAYCARE', daycareCapacity?.maxCapacity ?? 1)}
                      aria-label="Edit daycare capacity"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Sun className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium">How capacity works</h3>
              <p className="text-sm text-muted-foreground mt-1">
                When a booking is made, the system checks if capacity is available for each
                night/day in the booking period. If any date exceeds capacity, the booking
                will be rejected. Existing bookings are not affected by capacity changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
