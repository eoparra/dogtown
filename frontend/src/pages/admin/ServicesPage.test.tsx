import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminServicesPage from './ServicesPage';
import { admin } from '@/services/api';
import type { Service } from '@/types';

// ── mock ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  admin: {
    getServices: vi.fn(),
    createService: vi.fn(),
    updateService: vi.fn(),
    deleteService: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'Grooming',
    description: 'Full grooming session',
    pricingType: 'FIXED',
    price: 45,
    priceSmall: null,
    priceMedium: null,
    priceLarge: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeBySizeService(overrides: Partial<Service> = {}): Service {
  return makeService({
    id: 'svc-2',
    name: 'Bath',
    description: null,
    pricingType: 'BY_SIZE',
    price: null,
    priceSmall: 30,
    priceMedium: 50,
    priceLarge: 70,
    ...overrides,
  });
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('ServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(admin.getServices).mockResolvedValue({ services: [] });
    vi.mocked(admin.createService).mockResolvedValue({ service: makeService() });
    vi.mocked(admin.updateService).mockResolvedValue({ service: makeService() });
    vi.mocked(admin.deleteService).mockResolvedValue({ success: true });
  });

  // ── loading & initial state ──────────────────────────────────────────────────

  it('shows loading spinner while fetching', () => {
    vi.mocked(admin.getServices).mockImplementation(() => new Promise(() => {}));
    render(<AdminServicesPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when there are no services', async () => {
    render(<AdminServicesPage />);
    await screen.findByText(/no services yet/i);
  });

  // ── service list ─────────────────────────────────────────────────────────────

  it('renders FIXED service name, description, and price', async () => {
    vi.mocked(admin.getServices).mockResolvedValue({ services: [makeService()] });
    render(<AdminServicesPage />);
    await screen.findByText('Grooming');
    expect(screen.getByText('Full grooming session')).toBeInTheDocument();
    expect(screen.getByText('$45.00')).toBeInTheDocument();
  });

  it('renders BY_SIZE service with S/M/L price breakdown', async () => {
    vi.mocked(admin.getServices).mockResolvedValue({ services: [makeBySizeService()] });
    render(<AdminServicesPage />);
    await screen.findByText('Bath');
    expect(screen.getByText(/S \$30\.00 · M \$50\.00 · L \$70\.00/)).toBeInTheDocument();
  });

  it('renders service with null description gracefully', async () => {
    vi.mocked(admin.getServices).mockResolvedValue({
      services: [makeService({ description: null })],
    });
    render(<AdminServicesPage />);
    await screen.findByText('Grooming');
  });

  // ── add FIXED service ─────────────────────────────────────────────────────────

  it('opens the add form when "Add Service" is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminServicesPage />);
    await screen.findByText(/no services yet/i);

    await user.click(screen.getByRole('button', { name: /add service/i }));
    expect(screen.getByText('New Service')).toBeInTheDocument();
  });

  it('shows single price input by default (FIXED mode)', async () => {
    const user = userEvent.setup();
    render(<AdminServicesPage />);
    await screen.findByText(/no services yet/i);

    await user.click(screen.getByRole('button', { name: /add service/i }));

    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(screen.queryByLabelText(/small/i)).not.toBeInTheDocument();
  });

  it('calls createService with FIXED payload and adds the service', async () => {
    const user = userEvent.setup();
    const newService = makeService({ id: 'svc-new', name: 'Bath', price: 25, description: null });
    vi.mocked(admin.createService).mockResolvedValue({ service: newService });

    render(<AdminServicesPage />);
    await screen.findByText(/no services yet/i);

    await user.click(screen.getByRole('button', { name: /add service/i }));

    await user.type(screen.getByPlaceholderText(/grooming, bath, training/i), 'Bath');
    await user.type(screen.getByPlaceholderText('0.00'), '25');

    await user.click(screen.getByRole('button', { name: /create service/i }));

    await waitFor(() => {
      expect(admin.createService).toHaveBeenCalledWith({
        name: 'Bath',
        description: null,
        pricingType: 'FIXED',
        price: 25,
      });
    });
    await screen.findByText('Bath');
  });

  // ── add BY_SIZE service ────────────────────────────────────────────────────────

  it('switches to three size inputs when "By dog size" is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminServicesPage />);
    await screen.findByText(/no services yet/i);

    await user.click(screen.getByRole('button', { name: /add service/i }));
    await user.click(screen.getByRole('button', { name: /by dog size/i }));

    expect(screen.getAllByPlaceholderText('0.00')).toHaveLength(3);
  });

  it('calls createService with BY_SIZE payload', async () => {
    const user = userEvent.setup();
    const newService = makeBySizeService({ id: 'svc-new', name: 'Bath' });
    vi.mocked(admin.createService).mockResolvedValue({ service: newService });

    render(<AdminServicesPage />);
    await screen.findByText(/no services yet/i);

    await user.click(screen.getByRole('button', { name: /add service/i }));
    await user.click(screen.getByRole('button', { name: /by dog size/i }));

    await user.type(screen.getByPlaceholderText(/grooming, bath, training/i), 'Bath');
    const [smallInput, medInput, largeInput] = screen.getAllByPlaceholderText('0.00');
    await user.type(smallInput, '30');
    await user.type(medInput, '50');
    await user.type(largeInput, '70');

    await user.click(screen.getByRole('button', { name: /create service/i }));

    await waitFor(() => {
      expect(admin.createService).toHaveBeenCalledWith({
        name: 'Bath',
        description: null,
        pricingType: 'BY_SIZE',
        priceSmall: 30,
        priceMedium: 50,
        priceLarge: 70,
      });
    });
  });

  // ── edit service ─────────────────────────────────────────────────────────────

  it('opens the edit form pre-filled and calls updateService on submit', async () => {
    const user = userEvent.setup();
    const service = makeService({ id: 'svc-1', name: 'Grooming', price: 45 });
    const updated = makeService({ id: 'svc-1', name: 'Premium Grooming', price: 60 });
    vi.mocked(admin.getServices).mockResolvedValue({ services: [service] });
    vi.mocked(admin.updateService).mockResolvedValue({ service: updated });

    render(<AdminServicesPage />);
    await screen.findByText('Grooming');

    await user.click(screen.getByRole('button', { name: /edit grooming/i }));
    expect(screen.getByText('Edit Service')).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Grooming');
    await user.clear(nameInput);
    await user.type(nameInput, 'Premium Grooming');

    const priceInput = screen.getByDisplayValue('45');
    await user.clear(priceInput);
    await user.type(priceInput, '60');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(admin.updateService).toHaveBeenCalledWith('svc-1', {
        name: 'Premium Grooming',
        description: 'Full grooming session',
        pricingType: 'FIXED',
        price: 60,
      });
    });
    await screen.findByText('Premium Grooming');
  });

  it('pre-fills BY_SIZE toggle and size prices when editing a BY_SIZE service', async () => {
    const user = userEvent.setup();
    const service = makeBySizeService();
    vi.mocked(admin.getServices).mockResolvedValue({ services: [service] });

    render(<AdminServicesPage />);
    await screen.findByText('Bath');

    await user.click(screen.getByRole('button', { name: /edit bath/i }));

    // Should show three size inputs pre-filled
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('70')).toBeInTheDocument();
    // Single price input should not be visible
    expect(screen.queryByDisplayValue('45')).not.toBeInTheDocument();
  });

  // ── delete service ───────────────────────────────────────────────────────────

  it('opens confirm dialog and calls deleteService on confirm', async () => {
    const user = userEvent.setup();
    const service = makeService();
    vi.mocked(admin.getServices).mockResolvedValue({ services: [service] });

    render(<AdminServicesPage />);
    await screen.findByText('Grooming');

    await user.click(screen.getByRole('button', { name: /delete grooming/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(admin.deleteService).toHaveBeenCalledWith('svc-1');
    });
    expect(screen.queryByText('Grooming')).not.toBeInTheDocument();
  });

  it('dismisses confirm dialog on cancel', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getServices).mockResolvedValue({ services: [makeService()] });

    render(<AdminServicesPage />);
    await screen.findByText('Grooming');

    await user.click(screen.getByRole('button', { name: /delete grooming/i }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(admin.deleteService).not.toHaveBeenCalled();
  });
});
