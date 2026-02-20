import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pencil, Check, X } from 'lucide-react';
import type { HotelRate, DaycareRate } from '@/types';

const RATE_LABELS: Record<string, string> = {
  REGULAR: 'Regular Rate',
  HOLIDAY: 'Holiday Rate',
  LONG_WEEKEND: 'Long Weekend Rate',
  VACATION: 'Vacation Rate',
};

const RATE_DESCRIPTIONS: Record<string, string> = {
  REGULAR: 'Standard daily/nightly rate',
  HOLIDAY: 'Applies during defined holiday periods',
  LONG_WEEKEND: 'Applies during long weekend periods',
  VACATION: 'Applies during vacation season periods',
};

export default function AdminRatesPage() {
  const [hotelRates, setHotelRates] = useState<HotelRate[]>([]);
  const [daycareRate, setDaycareRate] = useState<DaycareRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setFetchError('');
    try {
      const { hotelRates, daycareRate } = await admin.getRates();
      setHotelRates(hotelRates);
      setDaycareRate(daycareRate);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  };

  const handleEditHotelRate = (type: string, currentPrice: number) => {
    setEditingRate(`hotel-${type}`);
    setEditValue(currentPrice);
  };

  const handleEditDaycareRate = (currentPrice: number) => {
    setEditingRate('daycare');
    setEditValue(currentPrice);
  };

  const handleSaveHotelRate = async (type: string) => {
    setSaving(true);
    try {
      await admin.updateHotelRate(type, editValue);
      await loadRates();
      setEditingRate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDaycareRate = async () => {
    setSaving(true);
    try {
      await admin.updateDaycareRate(editValue);
      await loadRates();
      setEditingRate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rate');
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
        <Button onClick={loadRates}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rates Management</h1>
        <p className="text-muted-foreground">Configure pricing for hotel and daycare services</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Hotel Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Hotel Rates (per night)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(['REGULAR', 'HOLIDAY', 'LONG_WEEKEND', 'VACATION'] as const).map((type) => {
              const rate = hotelRates.find((r) => r.type === type);
              const isEditing = editingRate === `hotel-${type}`;

              return (
                <div
                  key={type}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{RATE_LABELS[type]}</span>
                      {type !== 'REGULAR' && (
                        <Badge variant="outline" className="text-xs">
                          Special Period
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{RATE_DESCRIPTIONS[type]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span>$</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveHotelRate(type)}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRate(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">
                          ${rate?.pricePerNight ?? 0}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditHotelRate(type, rate?.pricePerNight ?? 0)}
                          aria-label={`Edit ${RATE_LABELS[type]}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daycare Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Daycare Rate (per day)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <span className="font-medium">Fixed Daily Rate</span>
              <p className="text-sm text-muted-foreground">
                Same rate applies year-round for daycare services
              </p>
            </div>
            <div className="flex items-center gap-3">
              {editingRate === 'daycare' ? (
                <>
                  <div className="flex items-center gap-1">
                    <span>$</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveDaycareRate}
                    disabled={saving}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingRate(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold">
                    ${daycareRate?.pricePerDay ?? 0}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditDaycareRate(daycareRate?.pricePerDay ?? 0)}
                    aria-label="Edit daycare rate"
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
  );
}
