import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DogFormFields, emptyDogForm } from '@/components/DogFormFields';
import type { DogFormData } from '@/components/DogFormFields';
import { ChevronDown, ChevronUp, Pencil, Check, X, Trash2, Plus } from 'lucide-react';
import type { User, Dog } from '@/types';
import { format } from 'date-fns';

interface UserWithCount extends User {
  _count: { dogs: number };
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDogs, setUserDogs] = useState<Record<string, Dog[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserWithCount | null>(null);

  // Dog management state (scoped to currently expanded user)
  const [showDogForm, setShowDogForm] = useState(false);
  const [editingDogId, setEditingDogId] = useState<string | null>(null);
  const [dogFormData, setDogFormData] = useState<DogFormData>(emptyDogForm);
  const [savingDog, setSavingDog] = useState(false);
  const [dogError, setDogError] = useState('');
  const [deleteDogTarget, setDeleteDogTarget] = useState<Dog | null>(null);

  const loadUsers = async () => {
    setFetchError('');
    try {
      const { users } = await admin.getUsers();
      setUsers(users);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetDogForm = () => {
    setShowDogForm(false);
    setEditingDogId(null);
    setDogFormData(emptyDogForm);
    setDogError('');
  };

  const toggleExpand = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      resetDogForm();
      return;
    }

    resetDogForm();
    setExpandedUser(userId);

    if (!userDogs[userId]) {
      try {
        const { dogs } = await admin.getUserDogs(userId);
        setUserDogs((prev) => ({ ...prev, [userId]: dogs }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleEdit = (user: UserWithCount) => {
    setEditingId(user.id);
    setEditData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      userType: user.userType,
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      setError(null);
      await admin.updateUser(editingId, editData);
      await loadUsers();
      setEditingId(null);
      setEditData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setError(null);
      await admin.deleteUser(deleteTarget.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
    setDeleteTarget(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
    setError(null);
  };

  const handleSaveDog = async (e: React.FormEvent, userId: string) => {
    e.preventDefault();
    setDogError('');
    setSavingDog(true);
    try {
      const payload = {
        userId,
        name: dogFormData.name,
        breed: dogFormData.breed,
        age: dogFormData.age,
        weight: dogFormData.weight,
        size: dogFormData.size,
        color: dogFormData.color || null,
        sex: (dogFormData.sex as 'MALE' | 'FEMALE') || null,
        sterilized: dogFormData.sterilized,
        character: dogFormData.character || null,
        specialRequirements: dogFormData.specialRequirements || null,
        foodType: dogFormData.foodType || null,
        foodQuantity: dogFormData.foodQuantity || null,
        foodAdditionalIndication: dogFormData.foodAdditionalIndication || null,
        notes: dogFormData.notes || null,
        vaccinationInfo: dogFormData.vaccinationInfo || null,
      };

      if (editingDogId) {
        const { dog } = await admin.updateDog(editingDogId, payload);
        setUserDogs((prev) => ({
          ...prev,
          [userId]: prev[userId].map((d) => (d.id === editingDogId ? dog : d)),
        }));
      } else {
        const { dog } = await admin.createDog(payload);
        setUserDogs((prev) => ({ ...prev, [userId]: [...(prev[userId] ?? []), dog] }));
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, _count: { dogs: u._count.dogs + 1 } } : u))
        );
      }

      resetDogForm();
    } catch (err) {
      setDogError(err instanceof Error ? err.message : 'Failed to save dog');
    } finally {
      setSavingDog(false);
    }
  };

  const handleEditDog = (dog: Dog) => {
    setDogFormData({
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
    setEditingDogId(dog.id);
    setShowDogForm(true);
  };

  const handleDeleteDogConfirm = async (userId: string) => {
    if (!deleteDogTarget) return;
    try {
      await admin.deleteDog(deleteDogTarget.id);
      setUserDogs((prev) => ({
        ...prev,
        [userId]: prev[userId].filter((d) => d.id !== deleteDogTarget.id),
      }));
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, _count: { dogs: u._count.dogs - 1 } } : u))
      );
    } catch (err) {
      setDogError(err instanceof Error ? err.message : 'Failed to delete dog');
    }
    setDeleteDogTarget(null);
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
        <Button onClick={loadUsers}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users Management</h1>
          <p className="text-muted-foreground">View and manage registered users</p>
        </div>
        <Button onClick={() => navigate('/admin/clients/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Client
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">No users registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  {editingId === user.id ? (
                    <div className="flex-1 grid sm:grid-cols-2 gap-3 mr-4">
                      <Input
                        value={editData.name || ''}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="Name"
                        required
                        maxLength={100}
                      />
                      <Input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        placeholder="Email"
                        required
                      />
                      <Input
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        placeholder="Phone"
                        maxLength={20}
                      />
                      <Select
                        value={editData.userType || 'REGULAR'}
                        onChange={(e) => setEditData({ ...editData, userType: e.target.value as 'REGULAR' | 'PREFERENT' })}
                        options={[
                          { value: 'REGULAR', label: 'Regular' },
                          { value: 'PREFERENT', label: 'Preferent' },
                        ]}
                      />
                    </div>
                  ) : (
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => toggleExpand(user.id)}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{user.name}</h3>
                        <Badge variant={user.userType === 'PREFERENT' ? 'default' : 'outline'}>
                          {user.userType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === user.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={handleSave} aria-label="Save changes">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancel} aria-label="Cancel editing">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="text-right mr-2">
                          <div className="font-semibold">{user._count.dogs} dogs</div>
                          <div className="text-xs text-muted-foreground">
                            Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(user)} aria-label={`Edit ${user.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(user)} aria-label={`Delete ${user.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(user.id)} aria-label={expandedUser === user.id ? 'Collapse' : 'Expand'}>
                          {expandedUser === user.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {expandedUser === user.id && editingId !== user.id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Dogs</h4>
                      {!showDogForm && (
                        <Button size="sm" onClick={() => setShowDogForm(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Dog
                        </Button>
                      )}
                    </div>

                    {showDogForm && (
                      <Card className="mb-4">
                        <CardHeader>
                          <CardTitle>{editingDogId ? 'Edit Dog' : 'Add New Dog'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={(e) => handleSaveDog(e, user.id)} className="space-y-4">
                            {dogError && (
                              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                {dogError}
                              </div>
                            )}
                            <DogFormFields formData={dogFormData} onChange={setDogFormData} extended />
                            <div className="flex gap-2">
                              <Button type="submit" disabled={savingDog}>
                                <Check className="h-4 w-4 mr-2" />
                                {savingDog ? 'Saving...' : editingDogId ? 'Update Dog' : 'Add Dog'}
                              </Button>
                              <Button type="button" variant="outline" onClick={resetDogForm}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    )}

                    {dogError && !showDogForm && (
                      <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-3">{dogError}</div>
                    )}

                    {userDogs[user.id] ? (
                      userDogs[user.id].length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {userDogs[user.id].map((dog) => (
                            <div key={dog.id} className="border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium">{dog.name}</div>
                                  <div className="text-sm text-muted-foreground">{dog.breed}</div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditDog(dog)} aria-label={`Edit ${dog.name}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setDeleteDogTarget(dog)} aria-label={`Delete ${dog.name}`}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {dog.age} years, {dog.weight} kg
                              </div>
                              <Badge variant={dog.size === 'LARGE' ? 'default' : 'outline'} className="mt-1">
                                {dog.size}
                              </Badge>
                              {dog.vaccinationInfo ? (
                                <Badge variant="success" className="mt-2 ml-1">
                                  Vaccinated
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="mt-2 ml-1">
                                  No vaccination info
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        !showDogForm && <p className="text-muted-foreground text-sm">No dogs registered</p>
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" role="status" aria-label="Loading"></div>
                        Loading dogs...
                      </div>
                    )}

                    <ConfirmDialog
                      open={!!deleteDogTarget}
                      onOpenChange={(open) => { if (!open) setDeleteDogTarget(null); }}
                      title="Delete Dog"
                      description={deleteDogTarget ? `Are you sure you want to delete ${deleteDogTarget.name}? This will also delete all their bookings.` : ''}
                      confirmLabel="Delete"
                      variant="destructive"
                      onConfirm={() => handleDeleteDogConfirm(user.id)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete User"
        description={deleteTarget
          ? deleteTarget._count.dogs > 0
            ? `Are you sure you want to delete ${deleteTarget.name}? This will also delete their ${deleteTarget._count.dogs} dog(s) and all associated bookings.`
            : `Are you sure you want to delete ${deleteTarget.name}?`
          : ''}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
