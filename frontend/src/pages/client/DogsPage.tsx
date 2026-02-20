import { useState, useEffect } from 'react';
import { dogs as dogsApi } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import type { Dog } from '@/types';

interface DogFormData {
  name: string;
  breed: string;
  age: number;
  weight: number;
  notes: string;
  vaccinationInfo: string;
}

const emptyForm: DogFormData = {
  name: '',
  breed: '',
  age: 0,
  weight: 0,
  notes: '',
  vaccinationInfo: '',
};

export default function DogsPage() {
  const [dogsList, setDogsList] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DogFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadDogs();
  }, []);

  const loadDogs = async () => {
    setFetchError('');
    try {
      const { dogs } = await dogsApi.list();
      setDogsList(dogs);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load dogs');
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
        await dogsApi.update(editingId, formData);
      } else {
        await dogsApi.create(formData);
      }
      await loadDogs();
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dog');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dog: Dog) => {
    setFormData({
      name: dog.name,
      breed: dog.breed,
      age: dog.age,
      weight: dog.weight,
      notes: dog.notes || '',
      vaccinationInfo: dog.vaccinationInfo || '',
    });
    setEditingId(dog.id);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await dogsApi.delete(deleteTarget);
      await loadDogs();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete dog');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Loading"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{fetchError}</p>
        <Button onClick={loadDogs}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Dogs</h1>
          <p className="text-muted-foreground">Manage your registered dogs</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Dog
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Dog' : 'Add New Dog'}</CardTitle>
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
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={100}
                />
                <Input
                  id="breed"
                  label="Breed"
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  required
                  maxLength={100}
                />
                <Input
                  id="age"
                  type="number"
                  label="Age (years)"
                  min={0}
                  max={30}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                  required
                />
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  label="Weight (kg)"
                  min={0}
                  max={200}
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <Input
                id="vaccinationInfo"
                label="Vaccination Information"
                placeholder="List vaccinations and dates (required for booking)"
                value={formData.vaccinationInfo}
                onChange={(e) => setFormData({ ...formData, vaccinationInfo: e.target.value })}
                maxLength={2000}
              />
              <div className="space-y-1">
                <label htmlFor="notes" className="block text-sm font-medium">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                  maxLength={5000}
                  placeholder="Any special needs, allergies, or notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Check className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : editingId ? 'Update Dog' : 'Add Dog'}
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

      {/* Dogs List */}
      {dogsList.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You haven't added any dogs yet. Add your first dog to start booking.
            </p>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Dog
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dogsList.map((dog) => (
            <Card key={dog.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{dog.name}</h3>
                    <p className="text-muted-foreground">{dog.breed}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(dog)} aria-label={`Edit ${dog.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(dog.id)} aria-label={`Delete ${dog.name}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Age:</span>
                    <span>{dog.age} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight:</span>
                    <span>{dog.weight} kg</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  {dog.vaccinationInfo ? (
                    <Badge variant="success">Vaccination info on file</Badge>
                  ) : (
                    <Badge variant="warning">Add vaccination info</Badge>
                  )}
                </div>
                {dog.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">{dog.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Dog"
        description="Are you sure you want to delete this dog? This will also delete all their bookings."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
