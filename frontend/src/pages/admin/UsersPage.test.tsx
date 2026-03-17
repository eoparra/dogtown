import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUsersPage from './UsersPage';
import { admin } from '@/services/api';
import { renderWithRouter } from '@/test-helpers/render';
import type { User, Dog } from '@/types';

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal() as object;
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api', () => ({
  admin: {
    getUsers: vi.fn(),
    getUserDogs: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    createDog: vi.fn(),
    updateDog: vi.fn(),
    deleteDog: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

type UserWithCount = User & { _count: { dogs: number } };

function makeUser(overrides: Partial<UserWithCount> = {}): UserWithCount {
  return {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: null,
    role: 'CLIENT',
    userType: 'REGULAR',
    createdAt: new Date('2025-01-15').toISOString(),
    _count: { dogs: 2 },
    ...overrides,
  };
}

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    id: 'dog-1',
    userId: 'user-1',
    name: 'Buddy',
    breed: 'Beagle',
    age: 3,
    weight: 10,
    size: 'SMALL',
    color: null,
    sex: null,
    sterilized: false,
    character: null,
    specialRequirements: null,
    foodType: null,
    foodQuantity: null,
    foodAdditionalIndication: null,
    notes: null,
    vaccinationInfo: 'Rabies 2024',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper: render with one user and expand their row
async function renderExpandedUser(userOverrides: Partial<UserWithCount> = {}) {
  const user = userEvent.setup();
  const client = makeUser(userOverrides);
  vi.mocked(admin.getUsers).mockResolvedValue({ users: [client] });
  renderWithRouter(<AdminUsersPage />);
  await screen.findByText(client.name);
  await user.click(screen.getByRole('button', { name: /expand/i }));
  return { user, client };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(admin.getUsers).mockResolvedValue({ users: [] });
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [] });
    vi.mocked(admin.updateUser).mockResolvedValue({ user: makeUser() });
    vi.mocked(admin.deleteUser).mockResolvedValue({ success: true });
    vi.mocked(admin.createDog).mockResolvedValue({ dog: makeDog() });
    vi.mocked(admin.updateDog).mockResolvedValue({ dog: makeDog() });
    vi.mocked(admin.deleteDog).mockResolvedValue({ success: true });
  });

  // ── loading & initial state ─────────────────────────────────────────────────

  it('shows loading spinner while fetching', () => {
    vi.mocked(admin.getUsers).mockImplementation(() => new Promise(() => {}));
    renderWithRouter(<AdminUsersPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when there are no users', async () => {
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText(/No users registered yet/i);
  });

  // ── create client button ────────────────────────────────────────────────────

  it('renders the "Create Client" button', async () => {
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText(/No users registered yet/i);
    expect(screen.getByRole('button', { name: /create client/i })).toBeInTheDocument();
  });

  it('clicking "Create Client" navigates to /admin/clients/new', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText(/No users registered yet/i);

    await user.click(screen.getByRole('button', { name: /create client/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/clients/new');
  });

  // ── user list ───────────────────────────────────────────────────────────────

  it('renders user name, email and dog count', async () => {
    vi.mocked(admin.getUsers).mockResolvedValue({ users: [makeUser()] });
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText('Jane Doe');
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 dogs')).toBeInTheDocument();
  });

  it('shows the PREFERENT badge for preferent users', async () => {
    vi.mocked(admin.getUsers).mockResolvedValue({
      users: [makeUser({ userType: 'PREFERENT' })],
    });
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText('PREFERENT');
  });

  // ── inline editing ──────────────────────────────────────────────────────────

  it('clicking the edit icon reveals inline edit fields', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getUsers).mockResolvedValue({ users: [makeUser()] });
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText('Jane Doe');

    await user.click(screen.getByRole('button', { name: /edit jane doe/i }));

    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
  });

  it('save calls admin.updateUser and closes edit mode', async () => {
    const user = userEvent.setup();
    const updated = makeUser({ name: 'Jane Smith' });
    vi.mocked(admin.getUsers)
      .mockResolvedValueOnce({ users: [makeUser()] })
      .mockResolvedValueOnce({ users: [updated] });
    vi.mocked(admin.updateUser).mockResolvedValue({ user: updated });
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText('Jane Doe');

    await user.click(screen.getByRole('button', { name: /edit jane doe/i }));
    const nameInput = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(admin.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ name: 'Jane Smith' }),
      );
    });
    await screen.findByText('Jane Smith');
  });

  it('cancel hides the inline edit fields', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getUsers).mockResolvedValue({ users: [makeUser()] });
    renderWithRouter(<AdminUsersPage />);
    await screen.findByText('Jane Doe');

    await user.click(screen.getByRole('button', { name: /edit jane doe/i }));
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel editing/i }));
    expect(screen.queryByDisplayValue('Jane Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  // ── dog management ──────────────────────────────────────────────────────────

  it('expanding a row loads and shows the Add Dog button', async () => {
    await renderExpandedUser();
    expect(await screen.findByRole('button', { name: /add dog/i })).toBeInTheDocument();
  });

  it('expanding a row shows existing dogs with edit and delete buttons', async () => {
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [makeDog()] });
    await renderExpandedUser();

    await screen.findByText('Buddy');
    expect(screen.getByText('Beagle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit buddy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete buddy/i })).toBeInTheDocument();
  });

  it('clicking Add Dog shows the inline dog form', async () => {
    const { user } = await renderExpandedUser();
    await user.click(await screen.findByRole('button', { name: /add dog/i }));

    expect(screen.getByRole('heading', { name: /add new dog/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/breed/i)).toBeInTheDocument();
  });

  it('submitting the add dog form calls createDog and appends the dog', async () => {
    const newDog = makeDog({ id: 'dog-new', name: 'Milo', breed: 'Poodle' });
    vi.mocked(admin.createDog).mockResolvedValue({ dog: newDog });

    const { user } = await renderExpandedUser({ _count: { dogs: 0 } });
    await user.click(await screen.findByRole('button', { name: /add dog/i }));

    await user.type(screen.getByLabelText(/^name$/i), 'Milo');
    await user.type(screen.getByLabelText(/breed/i), 'Poodle');
    await user.type(screen.getByLabelText(/age/i), '2');
    await user.type(screen.getByLabelText(/weight/i), '8');

    await user.click(screen.getByRole('button', { name: /^add dog$/i }));

    await waitFor(() => {
      expect(admin.createDog).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', name: 'Milo', breed: 'Poodle' }),
      );
    });
    await screen.findByText('Milo');
  });

  it('adding a dog increments the dog count badge', async () => {
    const newDog = makeDog({ id: 'dog-new', name: 'Milo' });
    vi.mocked(admin.createDog).mockResolvedValue({ dog: newDog });

    const { user } = await renderExpandedUser({ _count: { dogs: 1 } });
    expect(screen.getByText('1 dogs')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /add dog/i }));
    await user.type(screen.getByLabelText(/^name$/i), 'Milo');
    await user.type(screen.getByLabelText(/breed/i), 'Poodle');
    await user.type(screen.getByLabelText(/age/i), '2');
    await user.type(screen.getByLabelText(/weight/i), '8');
    await user.click(screen.getByRole('button', { name: /^add dog$/i }));

    await waitFor(() => expect(screen.getByText('2 dogs')).toBeInTheDocument());
  });

  it('clicking edit on a dog opens the form prefilled with that dog\'s data', async () => {
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [makeDog()] });
    const { user } = await renderExpandedUser();

    await screen.findByText('Buddy');
    await user.click(screen.getByRole('button', { name: /edit buddy/i }));

    expect(screen.getByRole('heading', { name: /edit dog/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Buddy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beagle')).toBeInTheDocument();
  });

  it('submitting an edited dog calls updateDog and reflects the change', async () => {
    const original = makeDog();
    const updated = makeDog({ name: 'Buddy Jr.' });
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [original] });
    vi.mocked(admin.updateDog).mockResolvedValue({ dog: updated });

    const { user } = await renderExpandedUser();
    await screen.findByText('Buddy');

    await user.click(screen.getByRole('button', { name: /edit buddy/i }));
    const nameInput = screen.getByDisplayValue('Buddy');
    await user.clear(nameInput);
    await user.type(nameInput, 'Buddy Jr.');
    await user.click(screen.getByRole('button', { name: /update dog/i }));

    await waitFor(() => {
      expect(admin.updateDog).toHaveBeenCalledWith(
        'dog-1',
        expect.objectContaining({ name: 'Buddy Jr.' }),
      );
    });
    await screen.findByText('Buddy Jr.');
  });

  it('clicking delete opens the confirm dialog', async () => {
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [makeDog()] });
    const { user } = await renderExpandedUser();

    await screen.findByText('Buddy');
    await user.click(screen.getByRole('button', { name: /delete buddy/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/delete.*buddy/i)).toBeInTheDocument();
  });

  it('confirming delete calls deleteDog, removes the dog, and decrements count', async () => {
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [makeDog()] });
    const { user } = await renderExpandedUser({ _count: { dogs: 1 } });

    await screen.findByText('Buddy');
    expect(screen.getByText('1 dogs')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete buddy/i }));
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(admin.deleteDog).toHaveBeenCalledWith('dog-1'));
    expect(screen.queryByText('Buddy')).not.toBeInTheDocument();
    expect(screen.getByText('0 dogs')).toBeInTheDocument();
  });

  it('cancelling the add dog form hides it without calling createDog', async () => {
    const { user } = await renderExpandedUser();
    await user.click(await screen.findByRole('button', { name: /add dog/i }));

    expect(screen.getByRole('heading', { name: /add new dog/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('heading', { name: /add new dog/i })).not.toBeInTheDocument();
    expect(admin.createDog).not.toHaveBeenCalled();
  });

  it('collapsing a row resets the dog form state', async () => {
    const { user } = await renderExpandedUser();
    await user.click(await screen.findByRole('button', { name: /add dog/i }));
    expect(screen.getByRole('heading', { name: /add new dog/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse/i }));
    expect(screen.queryByRole('heading', { name: /add new dog/i })).not.toBeInTheDocument();
  });
});
