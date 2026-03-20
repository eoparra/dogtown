import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesPage from './SalesPage';
import { admin } from '@/services/api';
import type { CatalogItem, ClientSearchUser } from '@/types';

// ── mock ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  admin: {
    searchCatalog: vi.fn(),
    searchClients: vi.fn(),
    createSale: vi.fn(),
    daycareFinalize: vi.fn(),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const bySizeService: CatalogItem = {
  id: 'svc-1',
  sourceType: 'SERVICE',
  name: 'Bath',
  description: 'Full bath service',
  price: null,
  pricingType: 'BY_SIZE',
  priceSmall: 25,
  priceMedium: 40,
  priceLarge: 60,
};

const fixedService: CatalogItem = {
  id: 'svc-2',
  sourceType: 'SERVICE',
  name: 'Nail Trim',
  description: null,
  price: 15,
  pricingType: 'FIXED',
};

const productItem: CatalogItem = {
  id: 'prod-1',
  sourceType: 'PRODUCT',
  name: 'Dog Food',
  description: null,
  price: 20,
  pricingType: 'FIXED',
  currentStock: 10,
  unitOfMeasure: 'units',
};

const bySizePack: CatalogItem = {
  id: 'pack-1',
  sourceType: 'PACK',
  name: '10-Day Daycare Card',
  description: null,
  price: null,
  pricingType: 'BY_SIZE',
  priceSmall: 150,
  priceMedium: 200,
  priceLarge: 250,
  unitsIncluded: 10,
};

const fixedPack: CatalogItem = {
  id: 'pack-2',
  sourceType: 'PACK',
  name: '5-Night Hotel Pack',
  description: null,
  price: 300,
  pricingType: 'FIXED',
  priceSmall: null,
  priceMedium: null,
  priceLarge: null,
  unitsIncluded: 5,
};

const clientWithDogs: ClientSearchUser = {
  id: 'user-1',
  name: 'Maria Garcia',
  email: 'maria@test.com',
  phone: '+1 555-0101',
  dogs: [
    { id: 'dog-small', name: 'Milo', size: 'SMALL' },
    { id: 'dog-medium', name: 'Coco', size: 'MEDIUM' },
    { id: 'dog-large', name: 'Luna', size: 'LARGE' },
  ],
};

const clientNoDogs: ClientSearchUser = {
  id: 'user-2',
  name: 'John Smith',
  email: 'john@test.com',
  phone: null,
  dogs: [],
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function searchCatalog(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByPlaceholderText('Search products and services...');
  await user.type(input, query);
  // Wait for the 300ms debounce to fire and results to render
  await screen.findByRole('button', { name: new RegExp(`Add ${query}`, 'i') }, { timeout: 2000 });
}

async function addItemToCart(user: ReturnType<typeof userEvent.setup>, itemName: string) {
  const addBtn = screen.getByRole('button', { name: new RegExp(`Add ${itemName} to cart`, 'i') });
  await user.click(addBtn);
}

async function searchAndSelectClient(user: ReturnType<typeof userEvent.setup>, client: ClientSearchUser) {
  const input = screen.getByPlaceholderText('Search by name or email...');
  await user.type(input, client.name.slice(0, 4));
  const option = await screen.findByText(client.name, {}, { timeout: 2000 });
  await user.click(option);
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('SalesPage', () => {
  beforeEach(() => {
    vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [] });
    vi.mocked(admin.searchClients).mockResolvedValue({ users: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('catalog search', () => {
    it('hides results until user types', () => {
      render(<SalesPage />);
      expect(screen.queryByRole('button', { name: /Add .* to cart/i })).toBeNull();
    });

    it('shows results after typing and debounce', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });

      render(<SalesPage />);
      const input = screen.getByPlaceholderText('Search products and services...');
      await user.type(input, 'Nail');

      await screen.findByText('Nail Trim', {}, { timeout: 2000 });
      expect(screen.getByText('$15.00')).toBeDefined();
    });

    it('shows "Price by dog size" label for BY_SIZE services', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });

      render(<SalesPage />);
      const input = screen.getByPlaceholderText('Search products and services...');
      await user.type(input, 'Bath');

      await screen.findByText('Price by dog size', {}, { timeout: 2000 });
    });

    it('disables add button for BY_SIZE service with no size prices', async () => {
      const user = userEvent.setup();
      const noPriceBySize = { ...bySizeService, priceSmall: null, priceMedium: null, priceLarge: null };
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [noPriceBySize] });

      render(<SalesPage />);
      const input = screen.getByPlaceholderText('Search products and services...');
      await user.type(input, 'Bath');

      const addBtn = await screen.findByRole('button', { name: /Add Bath to cart/i }, { timeout: 2000 });
      expect(addBtn).toBeDisabled();
    });

    it('disables add button for out-of-stock products', async () => {
      const user = userEvent.setup();
      const outOfStock = { ...productItem, currentStock: 0 };
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [outOfStock] });

      render(<SalesPage />);
      const input = screen.getByPlaceholderText('Search products and services...');
      await user.type(input, 'Dog');

      const addBtn = await screen.findByRole('button', { name: /Add Dog Food to cart/i }, { timeout: 2000 });
      expect(addBtn).toBeDisabled();
    });
  });

  describe('adding items to cart', () => {
    it('adds a FIXED service to cart with correct price', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });

      render(<SalesPage />);
      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');

      // "Nail Trim" appears in both catalog and cart — just confirm it's in the cart
      expect(screen.getAllByText('Nail Trim').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('$15.00 each')).toBeDefined();
    });

    it('adds a BY_SIZE service to cart with $0.00 placeholder price', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');

      // "Bath" appears in both catalog results and cart
      expect(screen.getAllByText('Bath').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('$0.00 each')).toBeDefined();
    });

    it('blocks sale completion when BY_SIZE item has no dog selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });

      render(<SalesPage />);

      // Set walk-in name so clientName is valid
      const walkInBtn = screen.getByText('Walk-in');
      await user.click(walkInBtn);
      const nameInput = screen.getByPlaceholderText('Walk-in name *');
      await user.type(nameInput, 'Test Client');

      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');

      const completeBtn = screen.getByRole('button', { name: /complete sale/i });
      expect(completeBtn).toBeDisabled();
      expect(screen.getByText('Select a dog for all services')).toBeDefined();
    });

    it('blocks sale completion when FIXED service has no dog selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });

      render(<SalesPage />);

      // Set walk-in name so clientName is valid
      const walkInBtn = screen.getByText('Walk-in');
      await user.click(walkInBtn);
      const nameInput = screen.getByPlaceholderText('Walk-in name *');
      await user.type(nameInput, 'Test Client');

      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');

      const completeBtn = screen.getByRole('button', { name: /complete sale/i });
      expect(completeBtn).toBeDisabled();
      expect(screen.getByText('Select a dog for all services')).toBeDefined();
    });
  });

  describe('BY_SIZE price resolution in cart', () => {
    it('updates price when a SMALL dog is selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);

      // Add BY_SIZE service to cart
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');

      // Select client with dogs
      await searchAndSelectClient(user, clientWithDogs);

      // Verify dog dropdown is shown for BY_SIZE item
      const dogSelect = screen.getByRole('combobox', { name: /dog for bath/i });
      expect(dogSelect).toBeDefined();

      // Select the SMALL dog
      await user.selectOptions(dogSelect, 'dog-small');

      // Price should resolve to priceSmall = 25
      await waitFor(() => {
        expect(screen.getByText('$25.00 each')).toBeDefined();
        expect(screen.getAllByText('$25.00')).toHaveLength(2); // "each" label + line total
      });
    });

    it('updates price when a MEDIUM dog is selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');
      await searchAndSelectClient(user, clientWithDogs);

      const dogSelect = screen.getByRole('combobox', { name: /dog for bath/i });
      await user.selectOptions(dogSelect, 'dog-medium');

      await waitFor(() => {
        expect(screen.getByText('$40.00 each')).toBeDefined();
      });
    });

    it('updates price when a LARGE dog is selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');
      await searchAndSelectClient(user, clientWithDogs);

      const dogSelect = screen.getByRole('combobox', { name: /dog for bath/i });
      await user.selectOptions(dogSelect, 'dog-large');

      await waitFor(() => {
        expect(screen.getByText('$60.00 each')).toBeDefined();
      });
    });

    it('enables Complete Sale button after all BY_SIZE items have a dog', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');
      await searchAndSelectClient(user, clientWithDogs);

      // Should be disabled while no dog is selected
      const completeBtn = screen.getByRole('button', { name: /complete sale/i });
      expect(completeBtn).toBeDisabled();

      // Select a dog
      const dogSelect = screen.getByRole('combobox', { name: /dog for bath/i });
      await user.selectOptions(dogSelect, 'dog-medium');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /complete sale/i })).not.toBeDisabled();
      });
    });

    it('resets price to $0 when dog selection is cleared', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');
      await searchAndSelectClient(user, clientWithDogs);

      const dogSelect = screen.getByRole('combobox', { name: /dog for bath/i });
      await user.selectOptions(dogSelect, 'dog-medium');

      await waitFor(() => expect(screen.getByText('$40.00 each')).toBeDefined());

      // Clear the dog selection
      await user.selectOptions(dogSelect, '');
      await waitFor(() => expect(screen.getByText('$0.00 each')).toBeDefined());
    });

    it('shows dog dropdown for FIXED services', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');
      await searchAndSelectClient(user, clientWithDogs);

      // Dog dropdown should appear for FIXED services too
      expect(screen.getByRole('combobox', { name: /dog for nail trim/i })).toBeDefined();
    });

    it('selecting a dog for a FIXED service attaches dog without changing price', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');
      await searchAndSelectClient(user, clientWithDogs);

      // Price is $15 before dog selection
      expect(screen.getByText('$15.00 each')).toBeDefined();

      const dogSelect = screen.getByRole('combobox', { name: /dog for nail trim/i });
      await user.selectOptions(dogSelect, clientWithDogs.dogs[0].id);

      // Price must remain $15 after selecting a dog
      expect(screen.getByText('$15.00 each')).toBeDefined();
    });

    it('does not show dog dropdown when client has no dogs', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientNoDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');
      await searchAndSelectClient(user, clientNoDogs);

      // No dog dropdown if client has no dogs
      expect(screen.queryByRole('combobox', { name: /dog for bath/i })).toBeNull();
      // Instead shows the "no dogs" message
      expect(screen.getByText('Select a client with dogs to set price')).toBeDefined();
    });
  });

  describe('pack items in catalog and cart', () => {
    it('shows Pack badge and units count in catalog results', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizePack] });

      render(<SalesPage />);
      const input = screen.getByPlaceholderText('Search products and services...');
      await user.type(input, 'Day');

      await screen.findByText('Pack', {}, { timeout: 2000 });
      expect(screen.getByText('10 units')).toBeDefined();
      expect(screen.getByText('Price by dog size')).toBeDefined();
    });

    it('adds a BY_SIZE pack to cart with $0.00 placeholder price', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizePack] });

      render(<SalesPage />);
      await searchCatalog(user, '10-Day');
      await addItemToCart(user, '10-Day Daycare Card');

      expect(screen.getAllByText('10-Day Daycare Card').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('$0.00 each')).toBeDefined();
    });

    it('adds a FIXED pack to cart with correct price', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedPack] });

      render(<SalesPage />);
      await searchCatalog(user, '5-Night');
      await addItemToCart(user, '5-Night Hotel Pack');

      expect(screen.getAllByText('5-Night Hotel Pack').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('$300.00 each')).toBeDefined();
    });

    it('shows dog dropdown for a PACK item when client has dogs', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizePack] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, '10-Day');
      await addItemToCart(user, '10-Day Daycare Card');
      await searchAndSelectClient(user, clientWithDogs);

      expect(screen.getByRole('combobox', { name: /dog for 10-day daycare card/i })).toBeDefined();
    });

    it('blocks sale completion when PACK item has no dog selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizePack] });

      render(<SalesPage />);

      const walkInBtn = screen.getByText('Walk-in');
      await user.click(walkInBtn);
      const nameInput = screen.getByPlaceholderText('Walk-in name *');
      await user.type(nameInput, 'Test Client');

      await searchCatalog(user, '10-Day');
      await addItemToCart(user, '10-Day Daycare Card');

      const completeBtn = screen.getByRole('button', { name: /complete sale/i });
      expect(completeBtn).toBeDisabled();
      expect(screen.getByText('Select a dog for all services')).toBeDefined();
    });

    it('resolves BY_SIZE pack price from selected dog size', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizePack] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, '10-Day');
      await addItemToCart(user, '10-Day Daycare Card');
      await searchAndSelectClient(user, clientWithDogs);

      const dogSelect = screen.getByRole('combobox', { name: /dog for 10-day daycare card/i });
      await user.selectOptions(dogSelect, 'dog-medium'); // priceMedium = 200

      await waitFor(() => {
        expect(screen.getByText('$200.00 each')).toBeDefined();
      });
    });

    it('enables Complete Sale once PACK item has a dog selected', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizePack] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, '10-Day');
      await addItemToCart(user, '10-Day Daycare Card');
      await searchAndSelectClient(user, clientWithDogs);

      expect(screen.getByRole('button', { name: /complete sale/i })).toBeDisabled();

      const dogSelect = screen.getByRole('combobox', { name: /dog for 10-day daycare card/i });
      await user.selectOptions(dogSelect, 'dog-small');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /complete sale/i })).not.toBeDisabled();
      });
    });

    it('includes FIXED pack in cart total without dog requirement', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedPack] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, '5-Night');
      await addItemToCart(user, '5-Night Hotel Pack');
      await searchAndSelectClient(user, clientWithDogs);

      // Dog dropdown shown for PACK (FIXED)
      const dogSelect = screen.getByRole('combobox', { name: /dog for 5-night hotel pack/i });
      expect(dogSelect).toBeDefined();

      // Price stays $300 regardless of dog selection
      await user.selectOptions(dogSelect, clientWithDogs.dogs[0].id);
      expect(screen.getByText('$300.00 each')).toBeDefined();
    });
  });

  describe('localStorage persistence', () => {
    const STORAGE_KEY = 'dogtown_sales_draft';

    it('restores cart items from localStorage on mount', () => {
      const draft = {
        cartItems: [
          {
            cartId: 'test-id-1',
            sourceType: 'SERVICE',
            pricingType: 'FIXED',
            sourceId: 'svc-2',
            itemName: 'Nail Trim',
            unitPrice: 15,
            quantity: 2,
            dogId: null,
            dogName: null,
            priceSmall: null,
            priceMedium: null,
            priceLarge: null,
          },
        ],
        selectedClient: null,
        walkInName: '',
        walkInPhone: '',
        clientMode: 'search',
        paymentMethod: 'CASH',
        notes: '',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

      render(<SalesPage />);

      expect(screen.getByText('Nail Trim')).toBeDefined();
      expect(screen.getByText('$15.00 each')).toBeDefined();
    });

    it('restores walk-in client fields from localStorage on mount', () => {
      const draft = {
        cartItems: [],
        selectedClient: null,
        walkInName: 'Carlos Rivera',
        walkInPhone: '+1 555-9999',
        clientMode: 'walkin',
        paymentMethod: 'CARD',
        notes: '',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

      render(<SalesPage />);

      const nameInput = screen.getByPlaceholderText('Walk-in name *') as HTMLInputElement;
      expect(nameInput.value).toBe('Carlos Rivera');

      const phoneInput = screen.getByPlaceholderText('Phone (for WhatsApp receipt)') as HTMLInputElement;
      expect(phoneInput.value).toBe('+1 555-9999');
    });

    it('persists cart to localStorage when item is added', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });

      render(<SalesPage />);
      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const draft = JSON.parse(stored!);
      expect(draft.cartItems).toHaveLength(1);
      expect(draft.cartItems[0].itemName).toBe('Nail Trim');
      expect(draft.cartItems[0].unitPrice).toBe(15);
    });

    it('clears localStorage after successful sale completion', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });
      vi.mocked(admin.createSale).mockResolvedValue({
        sale: {
          id: 'sale-1',
          clientId: clientWithDogs.id,
          clientName: clientWithDogs.name,
          clientPhone: clientWithDogs.phone,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          total: 15,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lineItems: [],
        },
      });

      render(<SalesPage />);

      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');
      await searchAndSelectClient(user, clientWithDogs);

      // Attach a dog to the service so the sale can be completed
      const dogSelect = screen.getByRole('combobox', { name: /dog for nail trim/i });
      await user.selectOptions(dogSelect, clientWithDogs.dogs[0].id);

      const beforeSale = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(beforeSale.cartItems).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: /complete sale/i }));
      await screen.findByText('Sale Complete!');

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('daycare pack checkout (daycarePackInfo in draft)', () => {
    const STORAGE_KEY = 'dogtown_sales_draft';

    const packDraft = {
      pendingDaycareVisitId: 'visit-123',
      daycarePackInfo: { remainingUnits: 5, dogName: 'Buddy' },
      cartItems: [
        {
          cartId: 'cart-1',
          sourceType: 'SERVICE',
          pricingType: 'FIXED',
          sourceId: 'svc-daycare',
          itemName: 'Daycare 1 day',
          unitPrice: 0,
          quantity: 1,
          dogId: 'dog-1',
          dogName: 'Buddy',
          priceSmall: null,
          priceMedium: null,
          priceLarge: null,
        },
      ],
      selectedClient: clientWithDogs,
      walkInName: '',
      walkInPhone: '',
      clientMode: 'search',
      paymentMethod: 'CASH',
      notes: 'Daycare checkout - Buddy',
    };

    it('hides the payment field when daycarePackInfo is present', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packDraft));
      render(<SalesPage />);
      expect(screen.queryByRole('combobox', { name: /payment/i })).toBeNull();
      expect(screen.queryByLabelText(/payment/i)).toBeNull();
    });

    it('shows the pack note banner with dog name and remaining days', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packDraft));
      render(<SalesPage />);
      expect(screen.getByText(/buddy/i, { selector: 'span' })).toBeDefined();
      expect(screen.getByText(/5 days remaining/i)).toBeDefined();
    });

    it('shows remaining visits in the receipt modal after completing sale', async () => {
      const user = userEvent.setup();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packDraft));

      vi.mocked(admin.createSale).mockResolvedValue({
        sale: {
          id: 'sale-99',
          clientId: clientWithDogs.id,
          clientName: clientWithDogs.name,
          clientPhone: clientWithDogs.phone,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          total: 0,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lineItems: [{ id: 'li-1', saleId: 'sale-99', sourceType: 'SERVICE', sourceId: 'svc-daycare', itemName: 'Daycare 1 day', dogName: 'Buddy', dogId: 'dog-1', quantity: 1, unitPrice: 0 }],
        },
      });
      vi.mocked(admin.daycareFinalize).mockResolvedValue({
        success: true,
        packDeducted: true,
        remainingUnits: 4,
      });

      render(<SalesPage />);
      await user.click(screen.getByRole('button', { name: /complete sale/i }));

      await screen.findByText('Sale Complete!');
      expect(screen.getByText(/4 daycare visits remaining/i)).toBeDefined();
    });

    it('hides payment line in receipt modal for pack checkout', async () => {
      const user = userEvent.setup();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packDraft));

      vi.mocked(admin.createSale).mockResolvedValue({
        sale: {
          id: 'sale-99',
          clientId: clientWithDogs.id,
          clientName: clientWithDogs.name,
          clientPhone: null,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          total: 0,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lineItems: [],
        },
      });
      vi.mocked(admin.daycareFinalize).mockResolvedValue({
        success: true,
        packDeducted: true,
        remainingUnits: 4,
      });

      render(<SalesPage />);
      await user.click(screen.getByRole('button', { name: /complete sale/i }));

      await screen.findByText('Sale Complete!');
      expect(screen.queryByText(/pago:/i)).toBeNull();
    });
  });

  describe('cart total', () => {
    it('sums fixed-price items correctly', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [fixedService] });

      render(<SalesPage />);
      await searchCatalog(user, 'Nail');
      await addItemToCart(user, 'Nail Trim');
      await addItemToCart(user, 'Nail Trim');

      // Two Nail Trim at $15 each = $30 total
      await waitFor(() => {
        const totals = screen.getAllByText('$30.00');
        expect(totals.length).toBeGreaterThan(0);
      });
    });

    it('includes resolved BY_SIZE prices in total', async () => {
      const user = userEvent.setup();
      vi.mocked(admin.searchCatalog).mockResolvedValue({ items: [bySizeService] });
      vi.mocked(admin.searchClients).mockResolvedValue({ users: [clientWithDogs] });

      render(<SalesPage />);
      await searchCatalog(user, 'Bath');
      await addItemToCart(user, 'Bath');
      await searchAndSelectClient(user, clientWithDogs);

      const dogSelect = screen.getByRole('combobox', { name: /dog for bath/i });
      await user.selectOptions(dogSelect, 'dog-large'); // $60

      await waitFor(() => {
        // Total should be $60
        const totals = screen.getAllByText('$60.00');
        expect(totals.length).toBeGreaterThan(0);
      });
    });
  });
});
