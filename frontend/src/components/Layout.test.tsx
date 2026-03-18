import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AdminLayout } from './Layout';
import { admin } from '@/services/api';

vi.mock('@/services/api', () => ({
  admin: { getLowStockCount: vi.fn() },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Admin' }, logout: vi.fn() }),
}));

function renderAdminLayout(initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminLayout>
        <div>page content</div>
      </AdminLayout>
    </MemoryRouter>,
  );
}

describe('AdminLayout — Inventory dropdown', () => {
  beforeEach(() => {
    vi.mocked(admin.getLowStockCount).mockResolvedValue({ count: 0 });
  });

  it('opens when the Inventory button is clicked', async () => {
    const user = userEvent.setup();
    renderAdminLayout();

    expect(screen.queryByRole('link', { name: /^products$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /inventory/i }));

    expect(screen.getByRole('link', { name: /^products$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^services$/i })).toBeInTheDocument();
  });

  it('closes after clicking a sub-item link', async () => {
    const user = userEvent.setup();
    renderAdminLayout();

    await user.click(screen.getByRole('button', { name: /inventory/i }));
    expect(screen.getByRole('link', { name: /^products$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /^products$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /^products$/i })).not.toBeInTheDocument();
    });
  });

  it('stays closed when already on an inventory page', async () => {
    renderAdminLayout('/admin/inventory/products');

    // Dropdown should not be auto-expanded
    expect(screen.queryByRole('link', { name: /^products$/i })).not.toBeInTheDocument();
  });
});
