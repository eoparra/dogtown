import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pencil, Trash2, X, Check, Search } from 'lucide-react';
import type { Dog } from '@/types';

function sizeFromWeight(weight: number): 'SMALL' | 'MEDIUM' | 'LARGE' {
  return weight < 10 ? 'SMALL' : weight <= 20 ? 'MEDIUM' : 'LARGE';
}

export default function AdminDogsPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Dog>>({});
  const [error, setError] = useState('');
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
    setEditData({
      name: dog.name,
      breed: dog.breed,
      age: dog.age,
      weight: dog.weight,
      size: dog.size,
      vaccinationInfo: dog.vaccinationInfo || '',
      notes: dog.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      setError('');
      await admin.updateDog(editingId, editData);
      await loadDogs();
      setEditingId(null);
      setEditData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dog');
    }
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
                <tr key={dog.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {editingId === dog.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          placeholder="Name"
                        />
                        <Input
                          value={editData.breed}
                          onChange={(e) => setEditData({ ...editData, breed: e.target.value })}
                          placeholder="Breed"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-medium">{dog.name}</div>
                        <div className="text-sm text-muted-foreground">{dog.breed}</div>
                      </>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div>{dog.user?.name}</div>
                    <div className="text-sm text-muted-foreground">{dog.user?.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    {editingId === dog.id ? (
                      <div className="space-y-2">
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={editData.age}
                          onChange={(e) => setEditData({ ...editData, age: parseInt(e.target.value) })}
                          placeholder="Age"
                        />
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          max={200}
                          value={editData.weight}
                          onChange={(e) => {
                            const weight = parseFloat(e.target.value);
                            setEditData({ ...editData, weight, size: sizeFromWeight(weight) });
                          }}
                          placeholder="Weight"
                        />
                      </div>
                    ) : (
                      <>
                        <div>{dog.age} years old</div>
                        <div className="text-sm text-muted-foreground">{dog.weight} kg</div>
                      </>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingId === dog.id ? (
                      <Select
                        value={editData.size || 'MEDIUM'}
                        onChange={(e) => setEditData({ ...editData, size: e.target.value as 'SMALL' | 'MEDIUM' | 'LARGE' })}
                        options={[
                          { value: 'SMALL', label: 'Small (<10 kg)' },
                          { value: 'MEDIUM', label: 'Medium (10-20 kg)' },
                          { value: 'LARGE', label: 'Large (>20 kg)' },
                        ]}
                      />
                    ) : (
                      <Badge variant={dog.size === 'LARGE' ? 'default' : 'outline'}>
                        {dog.size}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingId === dog.id ? (
                      <Input
                        value={editData.vaccinationInfo || ''}
                        onChange={(e) => setEditData({ ...editData, vaccinationInfo: e.target.value })}
                        placeholder="Vaccination info"
                      />
                    ) : dog.vaccinationInfo ? (
                      <Badge variant="success">Vaccinated</Badge>
                    ) : (
                      <Badge variant="warning">No vaccination</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      {editingId === dog.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={handleSave} aria-label="Save changes">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditData({});
                            }}
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(dog)} aria-label={`Edit ${dog.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(dog.id)} aria-label={`Delete ${dog.name}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
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
