import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DogsPage from './DogsPage';
import { dogs as dogsApi } from '@/services/api';
import type { Dog } from '@/types';

// ── mock ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  dogs: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    id: 'dog-1',
    userId: 'user-1',
    name: 'Bella',
    breed: 'Beagle',
    age: 2,
    weight: 10,
    size: 'MEDIUM',
    color: 'Brown',
    sex: 'FEMALE',
    sterilized: true,
    character: 'Gentle',
    specialRequirements: 'Needs a calm environment',
    foodType: 'Wet food',
    foodQuantity: '1 can per meal',
    foodAdditionalIndication: 'Twice a day',
    notes: 'Very friendly',
    vaccinationInfo: 'Up to date',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('Client DogsPage', () => {
  beforeEach(() => {
    vi.mocked(dogsApi.list).mockResolvedValue({ dogs: [] });
    vi.mocked(dogsApi.create).mockResolvedValue({ dog: makeDog() });
    vi.mocked(dogsApi.update).mockResolvedValue({ dog: makeDog() });
    vi.mocked(dogsApi.delete).mockResolvedValue({ success: true });
  });

  // ── loading & initial state ─────────────────────────────────────────────────

  it('shows loading spinner while fetching', () => {
    vi.mocked(dogsApi.list).mockImplementation(() => new Promise(() => {}));
    render(<DogsPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it("shows empty state when the user has no dogs", async () => {
    render(<DogsPage />);
    await screen.findByText(/You haven't added any dogs yet/i);
  });

  // ── dog cards ───────────────────────────────────────────────────────────────

  it('renders a dog card with name, breed and age', async () => {
    vi.mocked(dogsApi.list).mockResolvedValue({ dogs: [makeDog()] });
    render(<DogsPage />);
    await screen.findByText('Bella');
    expect(screen.getByText('Beagle')).toBeInTheDocument();
    expect(screen.getByText('2 years')).toBeInTheDocument();
  });

  it('shows vaccination badge when dog has vaccination info', async () => {
    vi.mocked(dogsApi.list).mockResolvedValue({ dogs: [makeDog()] });
    render(<DogsPage />);
    await screen.findByText('Vaccination info on file');
  });

  it('shows add-vaccination badge when dog has no vaccination info', async () => {
    vi.mocked(dogsApi.list).mockResolvedValue({
      dogs: [makeDog({ vaccinationInfo: null })],
    });
    render(<DogsPage />);
    await screen.findByText('Add vaccination info');
  });

  // ── add dog form ─────────────────────────────────────────────────────────────

  it('shows "Add Dog" button and opens form when clicked', async () => {
    const user = userEvent.setup();
    render(<DogsPage />);
    await screen.findByText(/You haven't added any dogs yet/i);

    await user.click(screen.getByRole('button', { name: /add your first dog/i }));
    expect(screen.getByText('Add New Dog')).toBeInTheDocument();
  });

  it('calls dogs.create with form data when adding a new dog', async () => {
    const user = userEvent.setup();
    const newDog = makeDog({ id: 'dog-new', name: 'Max' });
    vi.mocked(dogsApi.create).mockResolvedValue({ dog: newDog });
    vi.mocked(dogsApi.list)
      .mockResolvedValueOnce({ dogs: [] })
      .mockResolvedValueOnce({ dogs: [newDog] });
    render(<DogsPage />);
    await screen.findByText(/You haven't added any dogs yet/i);

    await user.click(screen.getByRole('button', { name: /add your first dog/i }));
    await user.type(screen.getByLabelText(/^name$/i), 'Max');
    await user.type(screen.getByLabelText(/breed/i), 'Labrador');
    await user.type(screen.getByLabelText(/age/i), '4');
    await user.type(screen.getByLabelText(/weight/i), '30');

    await user.click(screen.getByRole('button', { name: /add dog/i }));

    await waitFor(() => {
      expect(dogsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Max', breed: 'Labrador' }),
      );
    });
    await screen.findByText('Max');
  });

  // ── edit form ─────────────────────────────────────────────────────────────

  it('clicking edit opens form with pre-populated basic fields', async () => {
    const user = userEvent.setup();
    vi.mocked(dogsApi.list).mockResolvedValue({ dogs: [makeDog()] });
    render(<DogsPage />);
    await screen.findByText('Bella');

    await user.click(screen.getByRole('button', { name: /edit bella/i }));

    expect(screen.getByText('Edit Dog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bella')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beagle')).toBeInTheDocument();
  });

  it('save calls dogs.update including all extended fields from the dog', async () => {
    const user = userEvent.setup();
    const updated = makeDog({ name: 'Bella Updated' });
    vi.mocked(dogsApi.list)
      .mockResolvedValueOnce({ dogs: [makeDog()] })
      .mockResolvedValueOnce({ dogs: [updated] });
    vi.mocked(dogsApi.update).mockResolvedValue({ dog: updated });
    render(<DogsPage />);
    await screen.findByText('Bella');

    await user.click(screen.getByRole('button', { name: /edit bella/i }));

    const nameInput = screen.getByDisplayValue('Bella');
    await user.clear(nameInput);
    await user.type(nameInput, 'Bella Updated');

    await user.click(screen.getByRole('button', { name: /update dog/i }));

    await waitFor(() => {
      expect(dogsApi.update).toHaveBeenCalledWith(
        'dog-1',
        expect.objectContaining({
          name: 'Bella Updated',
          // extended fields passed through from handleEdit
          color: 'Brown',
          sex: 'FEMALE',
          sterilized: true,
          character: 'Gentle',
          foodType: 'Wet food',
          foodQuantity: '1 can per meal',
        }),
      );
    });
  });

  it('cancel hides the form and re-shows the dog list', async () => {
    const user = userEvent.setup();
    vi.mocked(dogsApi.list).mockResolvedValue({ dogs: [makeDog()] });
    render(<DogsPage />);
    await screen.findByText('Bella');

    await user.click(screen.getByRole('button', { name: /edit bella/i }));
    expect(screen.getByText('Edit Dog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Edit Dog')).not.toBeInTheDocument();
    expect(screen.getByText('Bella')).toBeInTheDocument();
  });

  it('shows error when update fails', async () => {
    const user = userEvent.setup();
    vi.mocked(dogsApi.list).mockResolvedValue({ dogs: [makeDog()] });
    vi.mocked(dogsApi.update).mockRejectedValue(new Error('Save failed'));
    render(<DogsPage />);
    await screen.findByText('Bella');

    await user.click(screen.getByRole('button', { name: /edit bella/i }));
    await user.click(screen.getByRole('button', { name: /update dog/i }));

    await screen.findByText('Save failed');
  });
});
