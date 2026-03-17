import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDogsPage from './DogsPage';
import { admin } from '@/services/api';
import type { Dog } from '@/types';

// ── mock ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  admin: {
    getDogs: vi.fn(),
    updateDog: vi.fn(),
    deleteDog: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    id: 'dog-1',
    userId: 'user-1',
    name: 'Rex',
    breed: 'Labrador',
    age: 3,
    weight: 25,
    size: 'LARGE',
    color: 'Golden',
    sex: 'MALE',
    sterilized: false,
    character: 'Playful',
    specialRequirements: 'Needs a large yard',
    foodType: 'Dry kibble',
    foodQuantity: '2 cups twice a day',
    foodAdditionalIndication: 'No treats',
    notes: null,
    vaccinationInfo: 'Rabies 2024',
    createdAt: new Date().toISOString(),
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
    ...overrides,
  };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AdminDogsPage', () => {
  beforeEach(() => {
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [] });
    vi.mocked(admin.updateDog).mockResolvedValue({ dog: makeDog() });
    vi.mocked(admin.deleteDog).mockResolvedValue({ success: true });
  });

  // ── loading & initial state ─────────────────────────────────────────────────

  it('shows loading spinner while fetching', () => {
    vi.mocked(admin.getDogs).mockImplementation(() => new Promise(() => {}));
    render(<AdminDogsPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when there are no dogs', async () => {
    render(<AdminDogsPage />);
    await screen.findByText(/No dogs registered yet/i);
  });

  // ── dog table ───────────────────────────────────────────────────────────────

  it('renders dog name, breed, age, weight and owner in the table', async () => {
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');
    expect(screen.getByText('Labrador')).toBeInTheDocument();
    expect(screen.getByText('3 years old')).toBeInTheDocument();
    expect(screen.getByText('25 kg')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('shows vaccination badge', async () => {
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Vaccinated');
  });

  it('shows no-vaccination badge when vaccinationInfo is null', async () => {
    vi.mocked(admin.getDogs).mockResolvedValue({
      dogs: [makeDog({ vaccinationInfo: null })],
    });
    render(<AdminDogsPage />);
    await screen.findByText('No vaccination');
  });

  it('filters dogs by search query', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getDogs).mockResolvedValue({
      dogs: [makeDog({ id: 'd1', name: 'Rex' }), makeDog({ id: 'd2', name: 'Luna', breed: 'Poodle' })],
    });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');
    await screen.findByText('Luna');

    await user.type(screen.getByPlaceholderText(/search by name, breed, or owner/i), 'luna');

    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(screen.queryByText('Rex')).not.toBeInTheDocument();
  });

  // ── edit card ───────────────────────────────────────────────────────────────

  it('no edit card is visible before clicking the pencil icon', async () => {
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');
    expect(screen.queryByText(/Editing:/)).not.toBeInTheDocument();
  });

  it('clicking the edit button reveals an edit card with the dog and owner name', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');

    await user.click(screen.getByRole('button', { name: /edit rex/i }));

    expect(screen.getByText('Editing: Rex — John Doe')).toBeInTheDocument();
  });

  it('edit card is pre-populated with the dog name and breed', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');

    await user.click(screen.getByRole('button', { name: /edit rex/i }));

    expect(screen.getByDisplayValue('Rex')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Labrador')).toBeInTheDocument();
  });

  it('edit card shows extended profile section with pre-populated color', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');

    await user.click(screen.getByRole('button', { name: /edit rex/i }));

    // Extended section headers
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    // Extended field values
    expect(screen.getByDisplayValue('Golden')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Male')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dry kibble')).toBeInTheDocument();
  });

  it('clicking cancel hides the edit card', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');

    await user.click(screen.getByRole('button', { name: /edit rex/i }));
    expect(screen.getByText('Editing: Rex — John Doe')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Editing: Rex — John Doe')).not.toBeInTheDocument();
  });

  it('save calls admin.updateDog with extended fields and reloads the list', async () => {
    const user = userEvent.setup();
    const updated = makeDog({ name: 'Rex Updated', color: 'White' });
    vi.mocked(admin.getDogs)
      .mockResolvedValueOnce({ dogs: [makeDog()] })
      .mockResolvedValueOnce({ dogs: [updated] });
    vi.mocked(admin.updateDog).mockResolvedValue({ dog: updated });
    render(<AdminDogsPage />);
    await screen.findByText('Rex');

    await user.click(screen.getByRole('button', { name: /edit rex/i }));

    // Update name and color fields
    const nameInput = screen.getByDisplayValue('Rex');
    await user.clear(nameInput);
    await user.type(nameInput, 'Rex Updated');
    const colorInput = screen.getByDisplayValue('Golden');
    await user.clear(colorInput);
    await user.type(colorInput, 'White');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(admin.updateDog).toHaveBeenCalledWith(
        'dog-1',
        expect.objectContaining({
          name: 'Rex Updated',
          color: 'White',
          sex: 'MALE',
          sterilized: false,
          character: 'Playful',
          foodType: 'Dry kibble',
        }),
      );
    });
    // Edit card closes after successful save
    await waitFor(() => {
      expect(screen.queryByText(/Editing:/)).not.toBeInTheDocument();
    });
  });

  it('shows error message when updateDog fails', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getDogs).mockResolvedValue({ dogs: [makeDog()] });
    vi.mocked(admin.updateDog).mockRejectedValue(new Error('Server error'));
    render(<AdminDogsPage />);
    await screen.findByText('Rex');

    await user.click(screen.getByRole('button', { name: /edit rex/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await screen.findByText('Server error');
  });
});
