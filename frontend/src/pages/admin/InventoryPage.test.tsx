import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminInventoryPage from './InventoryPage';
import { admin } from '@/services/api';
import type { InventoryItem, StockMovement } from '@/types';

// ── mock ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  admin: {
    getInventory: vi.fn(),
    createInventoryItem: vi.fn(),
    updateInventoryItem: vi.fn(),
    deleteInventoryItem: vi.fn(),
    receiveStock: vi.fn(),
    deductStock: vi.fn(),
    getStockMovements: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    sku: 'FOOD-001',
    name: 'Dog Food',
    description: null,
    category: 'PET_FOOD',
    unitOfMeasure: 'units',
    costPrice: 10,
    sellingPrice: 15,
    currentStock: 50,
    lowStockThreshold: 5,
    expiryDate: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { movements: 0 },
    ...overrides,
  };
}

function makeMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mov-1',
    itemId: 'item-1',
    type: 'RECEIVE',
    quantity: 10,
    note: 'Initial stock',
    performedById: 'user-1',
    createdAt: new Date().toISOString(),
    performedBy: { id: 'user-1', name: 'Admin' },
    ...overrides,
  };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [] });
    vi.mocked(admin.createInventoryItem).mockResolvedValue({ item: makeItem() });
    vi.mocked(admin.updateInventoryItem).mockResolvedValue({ item: makeItem() });
    vi.mocked(admin.deleteInventoryItem).mockResolvedValue({ success: true });
    vi.mocked(admin.receiveStock).mockResolvedValue({ movement: makeMovement(), item: makeItem({ currentStock: 60 }) });
    vi.mocked(admin.deductStock).mockResolvedValue({ movement: makeMovement({ type: 'DEDUCT' }), item: makeItem({ currentStock: 40 }) });
    vi.mocked(admin.getStockMovements).mockResolvedValue({ movements: [] });
  });

  // ── loading & initial state ─────────────────────────────────────────────────

  it('shows loading spinner while fetching', () => {
    // Never-resolving promise keeps loading state active
    vi.mocked(admin.getInventory).mockImplementation(() => new Promise(() => {}));
    render(<AdminInventoryPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when there are no items', async () => {
    render(<AdminInventoryPage />);
    await screen.findByText(/No inventory items yet/i);
  });

  // ── item list ───────────────────────────────────────────────────────────────

  it('renders item name, SKU, and stock count', async () => {
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });
    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');
    expect(screen.getByText(/SKU: FOOD-001/)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('shows low stock alert banner when items are at or below threshold', async () => {
    const lowItem = makeItem({ name: 'Low Item', currentStock: 3, lowStockThreshold: 5 });
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [lowItem] });
    render(<AdminInventoryPage />);
    await screen.findByText(/1 item at or below low stock threshold/i);
    // 'Low Item' appears in both the banner and the item card
    expect(screen.getAllByText('Low Item').length).toBeGreaterThan(0);
  });

  it('does not show low stock banner when all items have sufficient stock', async () => {
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem({ currentStock: 50, lowStockThreshold: 5 })] });
    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');
    expect(screen.queryByText(/low stock threshold/i)).not.toBeInTheDocument();
  });

  it('filters items by name search', async () => {
    const user = userEvent.setup();
    const foodItem = makeItem({ id: 'i1', name: 'Dog Food', sku: 'FOOD-001' });
    const toyItem = makeItem({ id: 'i2', name: 'Chew Toy', sku: 'TOY-001' });
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [foodItem, toyItem] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');
    await screen.findByText('Chew Toy');

    await user.type(screen.getByPlaceholderText(/search by item name/i), 'chew');

    expect(screen.getByText('Chew Toy')).toBeInTheDocument();
    expect(screen.queryByText('Dog Food')).not.toBeInTheDocument();
  });

  it('filters items by category', async () => {
    const user = userEvent.setup();
    const foodItem = makeItem({ id: 'i1', name: 'Dog Food', category: 'PET_FOOD' });
    const toyItem = makeItem({ id: 'i2', name: 'Chew Toy', sku: 'TOY-001', category: 'PET_ACCESSORIES' });
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [foodItem, toyItem] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');
    await screen.findByText('Chew Toy');

    // Select Pet Food category
    await user.selectOptions(screen.getByRole('combobox'), 'PET_FOOD');

    expect(screen.getByText('Dog Food')).toBeInTheDocument();
    expect(screen.queryByText('Chew Toy')).not.toBeInTheDocument();
  });

  // ── add item ────────────────────────────────────────────────────────────────

  it('opens the add form when "Add Item" is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminInventoryPage />);
    await screen.findByText(/No inventory items yet/i);

    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByText('Add New Item')).toBeInTheDocument();
  });

  it('calls createInventoryItem and adds the item to the list on submit', async () => {
    const user = userEvent.setup();
    const newItem = makeItem({ id: 'item-new', name: 'New Kibble', sku: 'NEW-001' });
    vi.mocked(admin.createInventoryItem).mockResolvedValue({ item: newItem });

    render(<AdminInventoryPage />);
    await screen.findByText(/No inventory items yet/i);

    await user.click(screen.getByRole('button', { name: /add item/i }));

    await user.clear(screen.getByLabelText(/sku/i));
    await user.type(screen.getByLabelText(/sku/i), 'NEW-001');
    await user.clear(screen.getByLabelText(/item name/i));
    await user.type(screen.getByLabelText(/item name/i), 'New Kibble');
    await user.clear(screen.getByLabelText(/unit of measure/i));
    await user.type(screen.getByLabelText(/unit of measure/i), 'kg');
    await user.type(screen.getByLabelText(/cost price/i), '8');
    await user.type(screen.getByLabelText(/selling price/i), '12');
    await user.type(screen.getByLabelText(/low stock threshold/i), '5');

    await user.click(screen.getByRole('button', { name: /^add item$/i }));

    await waitFor(() => {
      expect(admin.createInventoryItem).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'NEW-001', name: 'New Kibble' }),
      );
    });
    await screen.findByText('New Kibble');
  });

  it('shows form error when createInventoryItem fails', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.createInventoryItem).mockRejectedValue(new Error('An item with this SKU already exists'));

    render(<AdminInventoryPage />);
    await screen.findByText(/No inventory items yet/i);
    await user.click(screen.getByRole('button', { name: /add item/i }));

    await user.type(screen.getByLabelText(/sku/i), 'DUP-001');
    await user.type(screen.getByLabelText(/item name/i), 'Duplicate');
    await user.type(screen.getByLabelText(/unit of measure/i), 'units');
    await user.type(screen.getByLabelText(/cost price/i), '5');
    await user.type(screen.getByLabelText(/selling price/i), '9');
    await user.type(screen.getByLabelText(/low stock threshold/i), '10');

    await user.click(screen.getByRole('button', { name: /^add item$/i }));
    await screen.findByText(/An item with this SKU already exists/i);
  });

  it('shows a readable validation error (not [object Object]) when the API returns a Zod error', async () => {
    const user = userEvent.setup();
    // Simulate what api.ts now produces after joining Zod array error messages
    vi.mocked(admin.createInventoryItem).mockRejectedValue(
      new Error('Expected string, received null'),
    );

    render(<AdminInventoryPage />);
    await screen.findByText(/No inventory items yet/i);
    await user.click(screen.getByRole('button', { name: /add item/i }));

    await user.type(screen.getByLabelText(/sku/i), 'NEW-001');
    await user.type(screen.getByLabelText(/item name/i), 'New Item');
    await user.type(screen.getByLabelText(/unit of measure/i), 'units');
    await user.type(screen.getByLabelText(/cost price/i), '5');
    await user.type(screen.getByLabelText(/selling price/i), '9');
    await user.type(screen.getByLabelText(/low stock threshold/i), '10');

    await user.click(screen.getByRole('button', { name: /^add item$/i }));
    await screen.findByText(/Expected string, received null/i);
  });

  // ── edit item ───────────────────────────────────────────────────────────────

  it('pre-populates the form with item data when edit is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /edit dog food/i }));

    expect(screen.getByText('Edit Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('FOOD-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dog Food')).toBeInTheDocument();
  });

  it('calls updateInventoryItem on edit form submit', async () => {
    const user = userEvent.setup();
    const updated = makeItem({ name: 'Gourmet Dog Food' });
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });
    vi.mocked(admin.updateInventoryItem).mockResolvedValue({ item: updated });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /edit dog food/i }));

    const nameInput = screen.getByDisplayValue('Dog Food');
    await user.clear(nameInput);
    await user.type(nameInput, 'Gourmet Dog Food');

    await user.click(screen.getByRole('button', { name: /update item/i }));

    await waitFor(() => {
      expect(admin.updateInventoryItem).toHaveBeenCalledWith('item-1', expect.objectContaining({ name: 'Gourmet Dog Food' }));
    });
    await screen.findByText('Gourmet Dog Food');
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  it('disables the delete button when the item has movement history', async () => {
    const itemWithMovements = makeItem({ _count: { movements: 3 } });
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [itemWithMovements] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    expect(screen.getByRole('button', { name: /delete dog food/i })).toBeDisabled();
  });

  it('shows confirm dialog and calls deleteInventoryItem on confirm', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /delete dog food/i }));

    // ConfirmDialog renders to document.body via Radix Portal (Dialog.Content has role="dialog")
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete inventory item/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(admin.deleteInventoryItem).toHaveBeenCalledWith('item-1');
    });
    expect(screen.queryByText('Dog Food')).not.toBeInTheDocument();
  });

  // ── receive stock ───────────────────────────────────────────────────────────

  it('opens the receive stock modal with the item name', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /receive stock for dog food/i }));
    expect(screen.getByText('Receive Stock')).toBeInTheDocument();
    expect(screen.getByText(/current stock: 50/i)).toBeInTheDocument();
  });

  it('calls receiveStock and updates the stock count on submit', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });
    vi.mocked(admin.receiveStock).mockResolvedValue({
      movement: makeMovement(),
      item: makeItem({ currentStock: 60 }),
    });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /receive stock for dog food/i }));
    await user.type(screen.getByLabelText(/quantity/i), '10');
    await user.click(screen.getByRole('button', { name: /confirm receive/i }));

    await waitFor(() => {
      expect(admin.receiveStock).toHaveBeenCalledWith('item-1', { quantity: 10, note: undefined });
    });
    // Updated stock count (60) should now be visible
    await screen.findByText('60');
  });

  // ── deduct stock ────────────────────────────────────────────────────────────

  it('shows an error in the modal when deduct fails due to insufficient stock', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });
    vi.mocked(admin.deductStock).mockRejectedValue(new Error('Insufficient stock. Available: 50'));

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /deduct stock for dog food/i }));
    await user.type(screen.getByLabelText(/quantity/i), '999');
    await user.click(screen.getByRole('button', { name: /confirm deduct/i }));

    await screen.findByText(/Insufficient stock. Available: 50/i);
  });

  // ── movement history ────────────────────────────────────────────────────────

  it('shows movement history when the history toggle is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });
    vi.mocked(admin.getStockMovements).mockResolvedValue({
      movements: [
        makeMovement({ type: 'RECEIVE', quantity: 20, note: 'Delivery', performedBy: { id: 'u1', name: 'Jane' } }),
      ],
    });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /toggle history for dog food/i }));

    await screen.findByText('+20 units');
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('shows empty history message when there are no movements', async () => {
    const user = userEvent.setup();
    vi.mocked(admin.getInventory).mockResolvedValue({ items: [makeItem()] });
    vi.mocked(admin.getStockMovements).mockResolvedValue({ movements: [] });

    render(<AdminInventoryPage />);
    await screen.findByText('Dog Food');

    await user.click(screen.getByRole('button', { name: /toggle history for dog food/i }));

    await screen.findByText(/No movement history yet/i);
  });
});
