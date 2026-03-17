import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DogFormFields, emptyDogForm } from '@/components/DogFormFields';
import type { DogFormData } from '@/components/DogFormFields';
import { ArrowLeft, Plus, Check, X, Trash2, Pencil } from 'lucide-react';
import type { User, Dog } from '@/types';

interface UserWithCount extends User {
  _count: { dogs: number };
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  userType: 'REGULAR' | 'PREFERENT';
}

const emptyClientForm: ClientFormData = {
  name: '',
  email: '',
  phone: '',
  userType: 'REGULAR',
};

export default function CreateClientPage() {
  const navigate = useNavigate();

  // Step 1 state: create client
  const [clientForm, setClientForm] = useState<ClientFormData>(emptyClientForm);
  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState('');
  const [createdClient, setCreatedClient] = useState<UserWithCount | null>(null);

  // Step 2 state: add dogs
  const [dogsList, setDogsList] = useState<Dog[]>([]);
  const [showDogForm, setShowDogForm] = useState(false);
  const [editingDogId, setEditingDogId] = useState<string | null>(null);
  const [dogFormData, setDogFormData] = useState<DogFormData>(emptyDogForm);
  const [savingDog, setSavingDog] = useState(false);
  const [dogError, setDogError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Dog | null>(null);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError('');
    setSavingClient(true);
    try {
      const { user } = await admin.createUser({
        name: clientForm.name,
        email: clientForm.email,
        phone: clientForm.phone,
        userType: clientForm.userType,
      });
      setCreatedClient(user);
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSavingClient(false);
    }
  };

  const handleAddDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdClient) return;
    setDogError('');
    setSavingDog(true);
    try {
      const payload = {
        userId: createdClient.id,
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
        setDogsList((prev) => prev.map((d) => (d.id === editingDogId ? dog : d)));
      } else {
        const { dog } = await admin.createDog(payload);
        setDogsList((prev) => [...prev, dog]);
      }

      setShowDogForm(false);
      setEditingDogId(null);
      setDogFormData(emptyDogForm);
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

  const handleCancelDog = () => {
    setShowDogForm(false);
    setEditingDogId(null);
    setDogFormData(emptyDogForm);
    setDogError('');
  };

  const handleDeleteDogConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await admin.deleteDog(deleteTarget.id);
      setDogsList((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    } catch (err) {
      setDogError(err instanceof Error ? err.message : 'Failed to delete dog');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')} aria-label="Back to users">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Create Client</h1>
        <p className="text-muted-foreground">Register a new client and add their dogs</p>
      </div>

      {/* Step 1: Client info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {createdClient ? (
              <>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">✓</span>
                Client Created
              </>
            ) : (
              <>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                Client Information
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {createdClient ? (
            <div className="flex items-center gap-3">
              <div>
                <div className="font-semibold">{createdClient.name}</div>
                <div className="text-sm text-muted-foreground">{createdClient.email}</div>
                {createdClient.phone && <div className="text-sm text-muted-foreground">{createdClient.phone}</div>}
              </div>
              <Badge variant={createdClient.userType === 'PREFERENT' ? 'default' : 'outline'}>
                {createdClient.userType}
              </Badge>
            </div>
          ) : (
            <form onSubmit={handleCreateClient} className="space-y-4">
              {clientError && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {clientError}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  id="clientName"
                  label="Full Name"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  required
                  maxLength={100}
                />
                <Input
                  id="clientEmail"
                  type="email"
                  label="Email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  required
                  maxLength={255}
                />
                <Input
                  id="clientPhone"
                  label="Phone"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  required
                  pattern="\d{10}"
                  title="Phone number must be exactly 10 digits"
                  placeholder="10 digit number"
                />
                <Select
                  id="clientUserType"
                  label="Client Type"
                  value={clientForm.userType}
                  onChange={(e) => setClientForm({ ...clientForm, userType: e.target.value as 'REGULAR' | 'PREFERENT' })}
                  options={[
                    { value: 'REGULAR', label: 'Regular' },
                    { value: 'PREFERENT', label: 'Preferent' },
                  ]}
                />
              </div>
              <Button type="submit" disabled={savingClient}>
                <Check className="h-4 w-4 mr-2" />
                {savingClient ? 'Creating...' : 'Create Client'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Add dogs (only shown after client is created) */}
      {createdClient && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <h2 className="text-xl font-semibold">Dogs</h2>
              <span className="text-sm text-muted-foreground">Add dogs for {createdClient.name}</span>
            </div>
            {!showDogForm && (
              <Button onClick={() => setShowDogForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Dog
              </Button>
            )}
          </div>

          {showDogForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingDogId ? 'Edit Dog' : 'Add New Dog'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddDog} className="space-y-4">
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
                    <Button type="button" variant="outline" onClick={handleCancelDog}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {dogError && !showDogForm && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{dogError}</div>
          )}

          {dogsList.length === 0 && !showDogForm ? (
            <Card className="text-center py-10">
              <CardContent>
                <p className="text-muted-foreground mb-4">No dogs added yet.</p>
                <Button onClick={() => setShowDogForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Dog
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dogsList.map((dog) => (
                <Card key={dog.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{dog.name}</h3>
                        <p className="text-sm text-muted-foreground">{dog.breed}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditDog(dog)} aria-label={`Edit ${dog.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(dog)} aria-label={`Delete ${dog.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age:</span>
                        <span>{dog.age} years</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight:</span>
                        <span>{dog.weight} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{dog.size === 'SMALL' ? 'S' : dog.size === 'MEDIUM' ? 'M' : 'L'}</span>
                      </div>
                      {dog.sex && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sex:</span>
                          <span>{dog.sex === 'MALE' ? 'Male' : 'Female'}{dog.sterilized ? ' (sterilized)' : ''}</span>
                        </div>
                      )}
                      {dog.color && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Color:</span>
                          <span>{dog.color}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      {dog.vaccinationInfo ? (
                        <Badge variant="success">Vaccination info on file</Badge>
                      ) : (
                        <Badge variant="warning">No vaccination info</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => navigate('/admin/users')}>
              Done — View All Clients
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Dog"
        description={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}? This will also delete all their bookings.` : ''}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteDogConfirm}
      />
    </div>
  );
}
