import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DogFormFields, DogFormData, emptyDogForm } from '@/components/DogFormFields';
import { Pencil, Trash2, Search, Sun, Bed } from 'lucide-react';
import type { Dog } from '@/types';

export default function AdminDogsPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<DogFormData>(emptyDogForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadDogs();
  }, []);

  const loadDogs = async () => {
    setFetchError('');
    try {
      const { dogs } = await admin.getDogs();
      setDogs(dogs);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load dogs');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (dog: Dog) => {
    setEditingId(dog.id);
    setError('');
    setEditData({
      name: dog.name,
      breed: dog.breed,
      age: dog.age,
      weight: dog.weight,
      vaccinationInfo: dog.vaccinationInfo || '',
      notes: dog.notes || '',
      size: dog.size,
      color: dog.color || '',
      sex: dog.sex || '',
      sterilized: dog.sterilized,
      character: dog.character || '',
      specialRequirements: dog.specialRequirements || '',
      foodType: dog.foodType || '',
      foodQuantity: dog.foodQuantity || '',
      foodAdditionalIndication: dog.foodAdditionalIndication || '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      setSaving(true);
      setError('');
      await admin.updateDog(editingId, { ...editData, sex: editData.sex || undefined });
      await loadDogs();
      setEditingId(null);
      setEditData(emptyDogForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dog');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(emptyDogForm);
    setError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setError('');
      await admin.deleteDog(deleteTarget);
      await loadDogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dog');
    }
    setDeleteTarget(null);
  };

  const filteredDogs = dogs.filter(
    (dog) =>
      dog.name.toLowerCase().includes(search.toLowerCase()) ||
      dog.breed.toLowerCase().includes(search.toLowerCase()) ||
      dog.user?.name.toLowerCase().includes(search.toLowerCase()) ||
      dog.user?.email.toLowerCase().includes(search.toLowerCase())
  );

  const dogBeingEdited = editingId ? dogs.find((d) => d.id === editingId) : null;

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
        <Button onClick={loadDogs}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dogs Management</h1>
        <p className="text-muted-foreground">View and manage all registered dogs</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, breed, or owner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {editingId && dogBeingEdited && (
        <Card>
          <CardHeader>
            <CardTitle>
              Editing: {dogBeingEdited.name} — {dogBeingEdited.user?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave}>
              <DogFormFields formData={editData} onChange={setEditData} extended />
              <div className="flex gap-2 mt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filteredDogs.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">
              {search ? 'No dogs match your search.' : 'No dogs registered yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th scope="col" className="text-left py-3 px-4 font-medium">Dog</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Owner</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Details</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Size</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Status</th>
                <th scope="col" className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDogs.map((dog) => (
                <tr key={dog.id} className={`border-b hover:bg-gray-50 ${editingId === dog.id ? 'bg-blue-50' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium">{dog.name}</div>
                    <div className="text-sm text-muted-foreground">{dog.breed}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{dog.user?.name}</div>
                    <div className="text-sm text-muted-foreground">{dog.user?.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{dog.age} years old</div>
                    <div className="text-sm text-muted-foreground">{dog.weight} kg</div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={dog.size === 'LARGE' ? 'default' : 'outline'}>
                      {dog.size}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {dog.vaccinationInfo ? (
                        <Badge variant="success">Vaccinated</Badge>
                      ) : (
                        <Badge variant="warning">No vaccination</Badge>
                      )}
                      {dog.packBalances?.filter((b) => b.remainingUnits > 0).map((b) => (
                        b.packType === 'DAYCARE_DAYS' ? (
                          <span key={b.packType} className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700" title={`${b.remainingUnits} daycare days remaining`}>
                            <Sun className="h-3.5 w-3.5" />{b.remainingUnits}
                          </span>
                        ) : (
                          <span key={b.packType} className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-700" title={`${b.remainingUnits} hotel nights remaining`}>
                            <Bed className="h-3.5 w-3.5" />{b.remainingUnits}
                          </span>
                        )
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(dog)} aria-label={`Edit ${dog.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(dog.id)} aria-label={`Delete ${dog.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
