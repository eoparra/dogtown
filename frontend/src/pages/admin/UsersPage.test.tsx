import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUsersPage from './UsersPage';
import { admin } from '@/services/api';
import { renderWithRouter } from '@/test-helpers/render';
import type { User } from '@/types';

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

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.mocked(admin.getUsers).mockResolvedValue({ users: [] });
    vi.mocked(admin.getUserDogs).mockResolvedValue({ dogs: [] });
    vi.mocked(admin.updateUser).mockResolvedValue({ user: makeUser() });
    vi.mocked(admin.deleteUser).mockResolvedValue({ success: true });
    mockNavigate.mockReset();
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
});
