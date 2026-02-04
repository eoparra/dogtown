import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pencil, Trash2, X, Check, Search } from 'lucide-react';
import type { Dog } from '@/types';

export default function AdminDogsPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Dog>>({});

  useEffect(() => {
    loadDogs();
  }, []);

  const loadDogs = async () => {
    try {
      const { dogs } = await admin.getDogs();
      setDogs(dogs);
    } catch (err) {
      console.error(err);
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
      vaccinationInfo: dog.vaccinationInfo || '',
      notes: dog.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      await admin.updateDog(editingId, editData);
      await loadDogs();
      setEditingId(null);
      setEditData({});
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update dog');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dog? This will also delete all their bookings.')) {
      return;
    }

    try {
      await admin.deleteDog(id);
      await loadDogs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete dog');
    }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dogs Management</h1>
        <p className="text-muted-foreground">View and manage all registered dogs</p>
      </div>

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
                <th className="text-left py-3 px-4 font-medium">Dog</th>
                <th className="text-left py-3 px-4 font-medium">Owner</th>
                <th className="text-left py-3 px-4 font-medium">Details</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
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
                          value={editData.age}
                          onChange={(e) => setEditData({ ...editData, age: parseInt(e.target.value) })}
                          placeholder="Age"
                        />
                        <Input
                          type="number"
                          step="0.1"
                          value={editData.weight}
                          onChange={(e) => setEditData({ ...editData, weight: parseFloat(e.target.value) })}
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
                          <Button variant="ghost" size="sm" onClick={handleSave}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditData({});
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(dog)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(dog.id)}>
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
    </div>
  );
}
