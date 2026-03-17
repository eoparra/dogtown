import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

export interface DogFormData {
  name: string;
  breed: string;
  age: number;
  weight: number;
  vaccinationInfo: string;
  notes: string;
  // Extended fields
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  color: string;
  sex: 'MALE' | 'FEMALE' | '';
  sterilized: boolean;
  character: string;
  specialRequirements: string;
  foodType: string;
  foodQuantity: string;
  foodAdditionalIndication: string;
}

export const emptyDogForm: DogFormData = {
  name: '',
  breed: '',
  age: 0,
  weight: 0,
  vaccinationInfo: '',
  notes: '',
  size: 'MEDIUM',
  color: '',
  sex: '',
  sterilized: false,
  character: '',
  specialRequirements: '',
  foodType: '',
  foodQuantity: '',
  foodAdditionalIndication: '',
};

interface DogFormFieldsProps {
  formData: DogFormData;
  onChange: (data: DogFormData) => void;
  extended?: boolean;
}

export function DogFormFields({ formData, onChange, extended = false }: DogFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Base fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          id="name"
          label="Name"
          value={formData.name}
          onChange={(e) => onChange({ ...formData, name: e.target.value })}
          required
          maxLength={100}
        />
        <Input
          id="breed"
          label="Breed"
          value={formData.breed}
          onChange={(e) => onChange({ ...formData, breed: e.target.value })}
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
          onChange={(e) => onChange({ ...formData, age: parseInt(e.target.value) || 0 })}
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
          onChange={(e) => onChange({ ...formData, weight: parseFloat(e.target.value) || 0 })}
          required
        />
      </div>
      <Input
        id="vaccinationInfo"
        label="Vaccination Information"
        placeholder="List vaccinations and dates (required for booking)"
        value={formData.vaccinationInfo}
        onChange={(e) => onChange({ ...formData, vaccinationInfo: e.target.value })}
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
          onChange={(e) => onChange({ ...formData, notes: e.target.value })}
        />
      </div>

      {/* Extended fields */}
      {extended && (
        <>
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground border-b pb-1">Profile</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                id="size"
                label="Size"
                value={formData.size}
                onChange={(e) => onChange({ ...formData, size: e.target.value as 'SMALL' | 'MEDIUM' | 'LARGE' })}
                options={[
                  { value: 'SMALL', label: 'S — Small' },
                  { value: 'MEDIUM', label: 'M — Medium' },
                  { value: 'LARGE', label: 'L — Large' },
                ]}
              />
              <Select
                id="sex"
                label="Sex"
                value={formData.sex}
                onChange={(e) => onChange({ ...formData, sex: e.target.value as 'MALE' | 'FEMALE' | '' })}
                options={[
                  { value: '', label: '— Not specified —' },
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                ]}
              />
              <Input
                id="color"
                label="Color"
                value={formData.color}
                onChange={(e) => onChange({ ...formData, color: e.target.value })}
                maxLength={100}
                placeholder="e.g. Golden, Black & White"
              />
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="sterilized"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={formData.sterilized}
                  onChange={(e) => onChange({ ...formData, sterilized: e.target.checked })}
                />
                <label htmlFor="sterilized" className="text-sm font-medium">
                  Sterilized
                </label>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <label htmlFor="character" className="block text-sm font-medium">
                  Character
                </label>
                <textarea
                  id="character"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  maxLength={2000}
                  placeholder="Describe the dog's personality"
                  value={formData.character}
                  onChange={(e) => onChange({ ...formData, character: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="specialRequirements" className="block text-sm font-medium">
                  Special Requirements
                </label>
                <textarea
                  id="specialRequirements"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  maxLength={2000}
                  placeholder="Any special care requirements"
                  value={formData.specialRequirements}
                  onChange={(e) => onChange({ ...formData, specialRequirements: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground border-b pb-1">Food</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                id="foodType"
                label="Type of Food"
                value={formData.foodType}
                onChange={(e) => onChange({ ...formData, foodType: e.target.value })}
                maxLength={200}
                placeholder="e.g. Dry kibble, Raw diet"
              />
              <Input
                id="foodQuantity"
                label="Quantity"
                value={formData.foodQuantity}
                onChange={(e) => onChange({ ...formData, foodQuantity: e.target.value })}
                maxLength={200}
                placeholder="e.g. 2 cups twice a day"
              />
            </div>
            <div className="space-y-1 mt-4">
              <label htmlFor="foodAdditionalIndication" className="block text-sm font-medium">
                Additional Indication
              </label>
              <textarea
                id="foodAdditionalIndication"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                maxLength={2000}
                placeholder="Any feeding instructions or dietary restrictions"
                value={formData.foodAdditionalIndication}
                onChange={(e) => onChange({ ...formData, foodAdditionalIndication: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
