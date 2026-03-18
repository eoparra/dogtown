import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ShoppingCart, Search, UserX, Plus, Minus, Trash2, CheckCircle, Copy, MessageCircle } from 'lucide-react';
import { admin } from '@/services/api';
import { Button } from '@/components/ui/Button';
import type { CatalogItem, Sale, ClientSearchUser } from '@/types';

type DogSize = 'SMALL' | 'MEDIUM' | 'LARGE';
type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

interface CartItem {
  cartId: string;
  sourceType: 'PRODUCT' | 'SERVICE' | 'PACK';
  pricingType: 'FIXED' | 'BY_SIZE';
  sourceId: string;
  itemName: string;
  unitPrice: number; // 0 = unresolved BY_SIZE (no dog selected yet)
  quantity: number;
  dogId: string | null;
  dogName: string | null;
  priceSmall: number | null;
  priceMedium: number | null;
  priceLarge: number | null;
}

const STORAGE_KEY = 'dogtown_sales_draft';

interface SalesDraft {
  cartItems: CartItem[];
  selectedClient: ClientSearchUser | null;
  walkInName: string;
  walkInPhone: string;
  clientMode: 'search' | 'walkin';
  paymentMethod: PaymentMethod;
  notes: string;
}

function getDefaultDraft(): SalesDraft {
  return { cartItems: [], selectedClient: null, walkInName: '', walkInPhone: '', clientMode: 'search', paymentMethod: 'CASH', notes: '' };
}

function loadDraft(): SalesDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultDraft();
    return { ...getDefaultDraft(), ...JSON.parse(raw) };
  } catch {
    return getDefaultDraft();
  }
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  TRANSFER: 'Transfer',
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function SalesPage() {
  // Client
  const [clientMode, setClientMode] = useState<'search' | 'walkin'>(() => loadDraft().clientMode);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<ClientSearchUser[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchUser | null>(() => loadDraft().selectedClient);
  const [walkInName, setWalkInName] = useState(() => loadDraft().walkInName);
  const [walkInPhone, setWalkInPhone] = useState(() => loadDraft().walkInPhone);

  // Catalog
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadDraft().cartItems);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => loadDraft().paymentMethod);
  const [notes, setNotes] = useState(() => loadDraft().notes);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const clientRef = useRef<HTMLDivElement>(null);
  const skipDraftSyncRef = useRef(false);

  // Client search debounce
  useEffect(() => {
    if (clientMode !== 'search' || clientQuery.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { users } = await admin.searchClients(clientQuery);
        setClientResults(users);
        setShowClientDropdown(true);
      } catch {
        setClientResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientQuery, clientMode]);

  // Catalog search debounce — only fires when there is actual input
  useEffect(() => {
    if (catalogQuery.trim().length === 0) {
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const { items } = await admin.searchCatalog(catalogQuery);
        setCatalogResults(items);
      } catch {
        setCatalogResults([]);
      } finally {
        setCatalogLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [catalogQuery]);

  // Persist draft state to localStorage (suppressed after sale completion until new sale starts)
  useEffect(() => {
    if (skipDraftSyncRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cartItems, selectedClient, walkInName, walkInPhone, clientMode, paymentMethod, notes,
    }));
  }, [cartItems, selectedClient, walkInName, walkInPhone, clientMode, paymentMethod, notes]);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectClient = (client: ClientSearchUser) => {
    setSelectedClient(client);
    setClientQuery(client.name);
    setShowClientDropdown(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientQuery('');
  };

  const availableDogs = selectedClient?.dogs ?? [];

  const addToCart = (item: CatalogItem) => {
    if (item.pricingType === 'FIXED' && item.price === null) {
      setError('This item has no price configured.');
      return;
    }
    if (
      item.pricingType === 'BY_SIZE' &&
      item.priceSmall == null && item.priceMedium == null && item.priceLarge == null
    ) {
      setError('This service has no size prices configured.');
      return;
    }
    setError(null);
    setCartItems((prev) => [
      ...prev,
      {
        cartId: `${Date.now()}-${Math.random()}`,
        sourceType: item.sourceType,
        pricingType: item.pricingType,
        sourceId: item.id,
        itemName: item.name,
        unitPrice: item.pricingType === 'BY_SIZE' ? 0 : (item.price ?? 0),
        quantity: 1,
        dogId: null,
        dogName: null,
        priceSmall: item.priceSmall ?? null,
        priceMedium: item.priceMedium ?? null,
        priceLarge: item.priceLarge ?? null,
      },
    ]);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.cartId === cartId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const removeFromCart = (cartId: string) => {
    setCartItems((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const resolvePriceForSize = (item: CartItem, size: DogSize): number => {
    if (size === 'SMALL') return item.priceSmall ?? 0;
    if (size === 'MEDIUM') return item.priceMedium ?? 0;
    return item.priceLarge ?? 0;
  };

  const updateCartItemDog = (cartId: string, dog: { id: string; name: string; size: string } | null) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.cartId !== cartId) return item;
        const unitPrice =
          item.pricingType === 'BY_SIZE'
            ? (dog ? resolvePriceForSize(item, dog.size as DogSize) : 0)
            : item.unitPrice;
        return { ...item, dogId: dog?.id ?? null, dogName: dog?.name ?? null, unitPrice };
      })
    );
  };

  const total = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const clientName = clientMode === 'search' ? (selectedClient?.name ?? '') : walkInName;
  const clientPhone = clientMode === 'search' ? (selectedClient?.phone ?? null) : (walkInPhone || null);
  const hasUnresolvedService = cartItems.some(
    (item) => (item.sourceType === 'SERVICE' || item.sourceType === 'PACK') && item.dogId === null
  );
  const canComplete = cartItems.length > 0 && clientName.trim().length > 0 && !hasUnresolvedService;

  const completeSale = async () => {
    if (!canComplete) return;
    setCompleting(true);
    setError(null);
    try {
      const { sale } = await admin.createSale({
        clientId: clientMode === 'search' ? (selectedClient?.id ?? null) : null,
        clientName: clientName.trim(),
        clientPhone,
        paymentMethod,
        notes: notes.trim() || null,
        lineItems: cartItems.map((item) => ({
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          itemName: item.itemName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          dogId: item.dogId,
          dogName: item.dogName,
        })),
      });
      skipDraftSyncRef.current = true;
      setCompletedSale(sale);
      localStorage.removeItem(STORAGE_KEY);
      setCartItems([]);
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete sale');
    } finally {
      setCompleting(false);
    }
  };

  const generateReceiptText = (sale: Sale) => {
    const lines = [
      '🐾 DogTown',
      `📅 ${format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm')}`,
      `👤 Cliente: ${sale.clientName}`,
      '─────────────────────────',
      ...(sale.lineItems?.map(
        (item) =>
          `${item.itemName}${item.dogName ? ` (${item.dogName})` : ''} x${item.quantity}  ${formatCurrency(item.unitPrice * item.quantity)}`
      ) ?? []),
      '─────────────────────────',
      `TOTAL: ${formatCurrency(sale.total)}`,
      `Pago: ${PAYMENT_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod}`,
      '─────────────────────────',
      '¡Gracias por confiar en DogTown!',
    ];
    return lines.join('\n');
  };

  const copyReceipt = async (sale: Sale) => {
    await navigator.clipboard.writeText(generateReceiptText(sale));
  };

  const sendWhatsApp = (sale: Sale) => {
    const phone = sale.clientPhone?.replace(/\D/g, '') ?? '';
    const text = encodeURIComponent(generateReceiptText(sale));
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const startNewSale = () => {
    skipDraftSyncRef.current = false;
    localStorage.removeItem(STORAGE_KEY);
    setCompletedSale(null);
    setSelectedClient(null);
    setClientQuery('');
    setWalkInName('');
    setWalkInPhone('');
    setClientMode('search');
    setCatalogQuery('');
    setCatalogResults([]);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Point of Sale</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Catalog search */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Catalog</h2>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search products and services..."
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
            />
          </div>

          {/* Results — only visible while typing */}
          {catalogQuery.trim().length > 0 && (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {catalogLoading ? (
                <div className="text-center py-8 text-sm text-gray-400">Searching...</div>
              ) : catalogResults.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No items found</div>
              ) : (
                catalogResults.map((item) => (
                  <div
                    key={`${item.sourceType}-${item.id}`}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            item.sourceType === 'PRODUCT'
                              ? 'bg-blue-50 text-blue-700'
                              : item.sourceType === 'PACK'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {item.sourceType === 'PRODUCT' ? 'Product' : item.sourceType === 'PACK' ? 'Pack' : 'Service'}
                        </span>
                        {item.sourceType === 'PRODUCT' && item.currentStock !== undefined && (
                          <span
                            className={`text-xs ${
                              item.currentStock === 0 ? 'text-red-500' : 'text-gray-400'
                            }`}
                          >
                            Stock: {item.currentStock}
                          </span>
                        )}
                        {item.sourceType === 'PACK' && item.unitsIncluded !== undefined && (
                          <span className="text-xs text-gray-500">{item.unitsIncluded} units</span>
                        )}
                        {item.pricingType === 'BY_SIZE' && (
                          <span className="text-xs text-amber-600">Price by dog size</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      <span className="font-semibold text-sm w-16 text-right">
                        {item.price !== null ? formatCurrency(item.price) : '—'}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Add ${item.name} to cart`}
                        onClick={() => addToCart(item)}
                        disabled={
                          (item.pricingType === 'FIXED' && item.price === null) ||
                          (item.pricingType === 'BY_SIZE' &&
                            item.priceSmall == null && item.priceMedium == null && item.priceLarge == null) ||
                          (item.sourceType === 'PRODUCT' && (item.currentStock ?? 0) === 0)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Client + Cart */}
        <div className="space-y-4">
          {/* Client section */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Client</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => { setClientMode('search'); clearClient(); }}
                  className={`px-2 py-1 text-xs rounded ${clientMode === 'search' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Search
                </button>
                <button
                  onClick={() => { setClientMode('walkin'); clearClient(); }}
                  className={`px-2 py-1 text-xs rounded ${clientMode === 'walkin' ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Walk-in
                </button>
              </div>
            </div>

            {clientMode === 'search' ? (
              <div ref={clientRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className="w-full pl-9 pr-9 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Search by name or email..."
                    value={clientQuery}
                    onChange={(e) => { setClientQuery(e.target.value); setSelectedClient(null); }}
                    onFocus={() => clientResults.length > 0 && setShowClientDropdown(true)}
                  />
                  {(selectedClient || clientQuery) && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={clearClient}
                    >
                      <UserX className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>

                {showClientDropdown && clientResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {clientResults.map((user) => (
                      <button
                        key={user.id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        onClick={() => selectClient(user)}
                      >
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-gray-500">
                          {user.email} · {user.dogs.length} dog{user.dogs.length !== 1 ? 's' : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedClient && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-sm">
                    <span className="font-medium">{selectedClient.name}</span>
                    {selectedClient.phone && (
                      <span className="text-gray-500 ml-2">{selectedClient.phone}</span>
                    )}
                    {selectedClient.dogs.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Dogs:{' '}
                        {selectedClient.dogs
                          .map((d) => `${d.name} (${d.size.toLowerCase()})`)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Walk-in name *"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                />
                <input
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Phone (for WhatsApp receipt)"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cart
              {cartItems.length > 0 && (
                <span className="text-primary">({cartItems.length})</span>
              )}
            </h2>

            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Cart is empty — add items from the catalog ←
              </p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div
                    key={item.cartId}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.itemName}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {(item.sourceType === 'SERVICE' || item.sourceType === 'PACK') && availableDogs.length > 0 ? (
                          <select
                            aria-label={`Dog for ${item.itemName}`}
                            className={`text-xs border rounded px-1 py-0.5 bg-white ${item.dogId === null ? 'border-amber-400' : ''}`}
                            value={item.dogId ?? ''}
                            onChange={(e) => {
                              const dog = availableDogs.find((d) => d.id === e.target.value) ?? null;
                              updateCartItemDog(item.cartId, dog ?? null);
                            }}
                          >
                            <option value="">Select dog…</option>
                            {availableDogs.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.size.toLowerCase()})
                              </option>
                            ))}
                          </select>
                        ) : (item.sourceType === 'SERVICE' || item.sourceType === 'PACK') ? (
                          <span className="text-xs text-amber-600">Select a client with dogs to set price</span>
                        ) : null}
                        <span className="text-xs text-gray-400">
                          {formatCurrency(item.unitPrice)} each
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.cartId, -1)}
                        className="p-0.5 hover:bg-gray-200 rounded"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.cartId, 1)}
                        className="p-0.5 hover:bg-gray-200 rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="w-16 text-right font-medium shrink-0">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </div>

                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-red-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cartItems.length > 0 && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-20 shrink-0">Payment</label>
                  <select
                    className="flex-1 border rounded-md px-2 py-1.5 text-sm"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-20 shrink-0">Notes</label>
                  <input
                    className="flex-1 border rounded-md px-2 py-1.5 text-sm"
                    placeholder="Optional..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  className="w-full"
                  onClick={completeSale}
                  disabled={!canComplete || completing}
                >
                  {completing ? 'Processing...' : 'Complete Sale'}
                </Button>

                {!clientName.trim() && (
                  <p className="text-xs text-amber-600 text-center">
                    Add a client name to complete the sale
                  </p>
                )}
                {hasUnresolvedService && (
                  <p className="text-xs text-amber-600 text-center">
                    Select a dog for all services
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Sale Complete!</h2>
            </div>

            {/* Receipt preview */}
            <div className="bg-gray-50 rounded p-4 font-mono text-sm space-y-1 max-h-72 overflow-y-auto">
              <div className="font-bold text-center">🐾 DogTown</div>
              <div className="text-center text-xs text-gray-500">
                {format(new Date(completedSale.createdAt), 'dd/MM/yyyy HH:mm')}
              </div>
              <div className="text-center">👤 {completedSale.clientName}</div>
              <div className="border-t my-2" />
              {completedSale.lineItems?.map((item, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span className="truncate">
                    {item.itemName}
                    {item.dogName ? ` (${item.dogName})` : ''} x{item.quantity}
                  </span>
                  <span className="shrink-0">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="border-t my-2" />
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{formatCurrency(completedSale.total)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Pago:{' '}
                {PAYMENT_LABELS[completedSale.paymentMethod as PaymentMethod] ??
                  completedSale.paymentMethod}
              </div>
              <div className="border-t my-2" />
              <div className="text-center text-xs text-gray-500">
                ¡Gracias por confiar en DogTown!
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => copyReceipt(completedSale)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => sendWhatsApp(completedSale)}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
              <Button className="flex-1" onClick={startNewSale}>
                New Sale
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
