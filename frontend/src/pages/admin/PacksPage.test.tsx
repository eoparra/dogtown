import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPacksPage from './PacksPage';
import { admin } from '@/services/api';
import type { ServicePack } from '@/types';

// ── mock ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  admin: {
    getPacks: vi.fn(),
    createPack: vi.fn(),
    updatePack: vi.fn(),
    deletePack: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return {
    id: 'pack-1',
    name: '10-Day Daycare Card',
    description: 'Great for regulars',
    packType: 'DAYCARE_DAYS',
    unitsIncluded: 10,
    priceSmall: 150,
    priceMedium: 200,
    priceLarge: 250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const hotelPack = makePack({
  id: 'pack-2',
  name: '5-Night Hotel Pack',
  description: null,
  packType: 'HOTEL_NIGHTS',
  unitsIncluded: 5,
  priceSmall: 300,
  priceMedium: 400,
  priceLarge: 500,
});

// ── suite ─────────────────────────────────────────────────────────────────────

describe('PacksPage', () => {
  beforeEach(() => {
    vi.mocked(admin.getPacks).mockResolvedValue({ packs: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading and list', () => {
    it('shows loading spinner initially', () => {
      vi.mocked(admin.getPacks).mockReturnValue(new Promise(() => {}));
      render(<AdminPacksPage />);
      expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    });

    it('shows empty state when there are no packs', async () => {
      render(<AdminPacksPage />);
      await screen.findByText('No packs yet. Add your first prepaid pack above.');
    });

    it('renders packs in a table after loading', async () => {
      const pack = makePack();
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [pack] });

      render(<AdminPacksPage />);

      await screen.findByText('10-Day Daycare Card');
      expect(screen.getByText('Daycare Days')).toBeDefined();
      expect(screen.getByText('10 days')).toBeDefined();
      // Price column (S / M / L)
      expect(screen.getByText(/\$150\.00 · \$200\.00 · \$250\.00/)).toBeDefined();
    });

    it('renders Hotel Nights badge for hotel packs', async () => {
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [hotelPack] });

      render(<AdminPacksPage />);

      await screen.findByText('5-Night Hotel Pack');
      expect(screen.getByText('Hotel Nights')).toBeDefined();
      expect(screen.getByText('5 nights')).toBeDefined();
    });

    it('shows fetch error with retry button', async () => {
      vi.mocked(admin.getPacks).mockRejectedValue(new Error('Network error'));

      render(<AdminPacksPage />);

      await screen.findByText('Network error');
      expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    });

    it('retries on retry button click', async () => {
      const pack = makePack();
      vi.mocked(admin.getPacks)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ packs: [pack] });

      render(<AdminPacksPage />);
      await screen.findByText('Network error');

      await userEvent.click(screen.getByRole('button', { name: /retry/i }));

      await screen.findByText('10-Day Daycare Card');
    });
  });

  describe('create pack', () => {
    it('opens the create form when Add Pack is clicked', async () => {
      const user = userEvent.setup();
      render(<AdminPacksPage />);

      await user.click(screen.getByRole('button', { name: /add pack/i }));

      expect(screen.getByText('New Pack')).toBeDefined();
    });

    it('hides Add Pack button while form is open', async () => {
      const user = userEvent.setup();
      render(<AdminPacksPage />);

      await user.click(screen.getByRole('button', { name: /add pack/i }));

      expect(screen.queryByRole('button', { name: /add pack/i })).toBeNull();
    });

    it('creates a pack and adds it to the list', async () => {
      const user = userEvent.setup();
      const newPack = makePack();
      vi.mocked(admin.createPack).mockResolvedValue({ pack: newPack });

      render(<AdminPacksPage />);

      await user.click(screen.getByRole('button', { name: /add pack/i }));

      await user.type(screen.getByPlaceholderText(/10-Day Daycare Card/i), '10-Day Daycare Card');
      await user.type(screen.getByPlaceholderText('e.g. 10'), '10');
      // Prices
      const [small, medium, large] = screen.getAllByPlaceholderText('0.00');
      await user.type(small, '150');
      await user.type(medium, '200');
      await user.type(large, '250');

      await user.click(screen.getByRole('button', { name: /create pack/i }));

      await screen.findByText('10-Day Daycare Card');
      expect(vi.mocked(admin.createPack)).toHaveBeenCalledOnce();
    });

    it('shows error message when createPack fails', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.createPack).mockRejectedValue(new Error('Already exists'));

      render(<AdminPacksPage />);
      await user.click(screen.getByRole('button', { name: /add pack/i }));

      await user.type(screen.getByPlaceholderText(/10-Day Daycare Card/i), 'Test Pack');
      await user.type(screen.getByPlaceholderText('e.g. 10'), '5');
      const [small, medium, large] = screen.getAllByPlaceholderText('0.00');
      await user.type(small, '100');
      await user.type(medium, '120');
      await user.type(large, '140');

      await user.click(screen.getByRole('button', { name: /create pack/i }));

      await screen.findByText('Already exists');
    });

    it('closes form on Cancel', async () => {
      const user = userEvent.setup();
      render(<AdminPacksPage />);

      await user.click(screen.getByRole('button', { name: /add pack/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByText('New Pack')).toBeNull();
      expect(screen.getByRole('button', { name: /add pack/i })).toBeDefined();
    });

    it('switches pack type to Hotel Nights via toggle', async () => {
      const user = userEvent.setup();
      const newPack = makePack({ packType: 'HOTEL_NIGHTS' });
      vi.mocked(admin.createPack).mockResolvedValue({ pack: newPack });

      render(<AdminPacksPage />);
      await user.click(screen.getByRole('button', { name: /add pack/i }));

      await user.click(screen.getByRole('button', { name: /hotel nights/i }));

      // Placeholder should reflect hotel nights context
      expect(screen.getByPlaceholderText('e.g. 5')).toBeDefined();
    });
  });

  describe('edit pack', () => {
    it('opens edit form pre-filled with pack data', async () => {
      const user = userEvent.setup();
      const pack = makePack();
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [pack] });

      render(<AdminPacksPage />);
      await screen.findByText('10-Day Daycare Card');

      await user.click(screen.getByRole('button', { name: /edit 10-day daycare card/i }));

      expect(screen.getByText('Edit Pack')).toBeDefined();
      const nameInput = screen.getByDisplayValue('10-Day Daycare Card');
      expect(nameInput).toBeDefined();
    });

    it('saves updated pack and reflects changes in list', async () => {
      const user = userEvent.setup();
      const pack = makePack();
      const updatedPack = makePack({ name: 'Renamed Pack', priceSmall: 180 });
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [pack] });
      vi.mocked(admin.updatePack).mockResolvedValue({ pack: updatedPack });

      render(<AdminPacksPage />);
      await screen.findByText('10-Day Daycare Card');

      await user.click(screen.getByRole('button', { name: /edit 10-day daycare card/i }));

      const nameInput = screen.getByDisplayValue('10-Day Daycare Card');
      await user.clear(nameInput);
      await user.type(nameInput, 'Renamed Pack');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByText('Renamed Pack');
      expect(vi.mocked(admin.updatePack)).toHaveBeenCalledWith('pack-1', expect.objectContaining({ name: 'Renamed Pack' }));
    });
  });

  describe('delete pack', () => {
    it('opens confirm dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      const pack = makePack();
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [pack] });

      render(<AdminPacksPage />);
      await screen.findByText('10-Day Daycare Card');

      await user.click(screen.getByRole('button', { name: /delete 10-day daycare card/i }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: /delete/i })).toBeDefined();
      expect(within(dialog).getByText(/10-Day Daycare Card/)).toBeDefined();
    });

    it('deletes pack and removes it from the list', async () => {
      const user = userEvent.setup();
      const pack = makePack();
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [pack] });
      vi.mocked(admin.deletePack).mockResolvedValue({ success: true });

      render(<AdminPacksPage />);
      await screen.findByText('10-Day Daycare Card');

      await user.click(screen.getByRole('button', { name: /delete 10-day daycare card/i }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /delete/i }));

      await waitFor(() => {
        expect(screen.queryByText('10-Day Daycare Card')).toBeNull();
      });
      expect(vi.mocked(admin.deletePack)).toHaveBeenCalledWith('pack-1');
    });

    it('cancels delete dialog without removing pack', async () => {
      const user = userEvent.setup();
      const pack = makePack();
      vi.mocked(admin.getPacks).mockResolvedValue({ packs: [pack] });

      render(<AdminPacksPage />);
      await screen.findByText('10-Day Daycare Card');

      await user.click(screen.getByRole('button', { name: /delete 10-day daycare card/i }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(screen.getByText('10-Day Daycare Card')).toBeDefined();
      expect(vi.mocked(admin.deletePack)).not.toHaveBeenCalled();
    });
  });
});
