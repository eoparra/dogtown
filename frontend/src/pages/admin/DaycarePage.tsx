import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInMinutes } from 'date-fns';
import { Search, LogIn, LogOut, Sun, Trash2, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { admin } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { DaycareVisit, DaycareSearchDog } from '@/types';

const STORAGE_KEY = 'dogtown_sales_draft';
const HISTORY_PAGE_SIZE = 20;

function formatDuration(checkInAt: string, checkOutAt: string): string {
  const mins = differenceInMinutes(new Date(checkOutAt), new Date(checkInAt));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function DaycarePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'today' | 'history'>('today');

  // ── Today tab ──────────────────────────────────────────────────────────────
  const [visits, setVisits] = useState<DaycareVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DaycareSearchDog[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DaycareVisit | null>(null);

  // ── History tab ────────────────────────────────────────────────────────────
  const [historyVisits, setHistoryVisits] = useState<DaycareVisit[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const historyTotalPages = Math.ceil(historyTotal / HISTORY_PAGE_SIZE);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { loadVisits(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (tab === 'history') loadHistory(1);
  }, [tab]);

  // Re-fetch when filters change (debounced) or page changes
  useEffect(() => {
    if (tab !== 'history') return;
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => loadHistory(1), 400);
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current); };
  }, [filterQ, filterStart, filterEnd]);

  useEffect(() => {
    if (tab !== 'history') return;
    loadHistory(historyPage);
  }, [historyPage]);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadVisits = async () => {
    try {
      const { visits } = await admin.getDaycareVisits();
      setVisits(visits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (page: number) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const result = await admin.getDaycareHistory({
        page,
        pageSize: HISTORY_PAGE_SIZE,
        q: filterQ.trim() || undefined,
        startDate: filterStart || undefined,
        endDate: filterEnd || undefined,
      });
      setHistoryVisits(result.visits);
      setHistoryTotal(result.total);
      setHistoryPage(result.page);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Today handlers ─────────────────────────────────────────────────────────
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { dogs } = await admin.searchDaycareDogs(q.trim());
        setSearchResults(dogs);
        setShowDropdown(true);
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleCheckin = async (dogId: string) => {
    try {
      setError('');
      await admin.daycareCheckin(dogId);
      const remaining = searchResults.filter((d) => d.id !== dogId);
      setSearchResults(remaining);
      if (remaining.length === 0) {
        setSearchQuery('');
        setShowDropdown(false);
      }
      await loadVisits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
    }
  };

  const handleCheckout = async (visit: DaycareVisit) => {
    try {
      setError('');
      setCheckingOut(visit.id);
      const result = await admin.daycareCheckout(visit.id);
      const draft = {
        pendingDaycareVisitId: visit.id,
        ...(result.covered && result.remainingUnits !== undefined
          ? { daycarePackInfo: { remainingUnits: result.remainingUnits, dogName: visit.dog.name } }
          : {}),
        cartItems: [{
          cartId: crypto.randomUUID(),
          sourceType: 'SERVICE',
          pricingType: 'FIXED',
          sourceId: result.serviceId ?? '',
          itemName: 'Daycare 1 day',
          unitPrice: result.price,
          quantity: 1,
          dogId: visit.dog.id,
          dogName: visit.dog.name,
          priceSmall: null,
          priceMedium: null,
          priceLarge: null,
        }],
        selectedClient: {
          id: visit.dog.user.id,
          name: visit.dog.user.name,
          email: visit.dog.user.email,
          phone: visit.dog.user.phone,
          dogs: [{ id: visit.dog.id, name: visit.dog.name, size: visit.dog.size }],
        },
        walkInName: '',
        walkInPhone: '',
        clientMode: 'search',
        paymentMethod: 'CASH',
        notes: `Daycare checkout - ${visit.dog.name}`,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      navigate('/admin/sales');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out');
    } finally {
      setCheckingOut(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError('');
      await admin.daycareDelete(deleteTarget.id);
      setToast(`Removed ${deleteTarget.dog.name} from daycare`);
      await loadVisits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete visit');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Daycare</h1>
        {tab === 'today' && (
          <Badge variant="default" className="text-sm">
            <Sun className="h-3.5 w-3.5 mr-1" />
            {visits.length} checked in
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('today')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'today'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sun className="h-4 w-4 inline mr-1.5" />
          Today
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-4 w-4 inline mr-1.5" />
          History
        </button>
      </div>

      {/* ── TODAY TAB ── */}
      {tab === 'today' && (
        <>
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">{error}</div>
          )}
          {toast && (
            <div className="bg-green-50 text-green-800 border border-green-200 px-4 py-2 rounded-md text-sm flex items-center gap-2">
              <Sun className="h-4 w-4" />
              {toast}
            </div>
          )}

          {/* Search for check-in */}
          <div ref={searchRef} className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search dog or owner to check in..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              className="pl-9"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              </div>
            )}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((dog) => (
                  <button
                    key={dog.id}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between"
                    onClick={() => handleCheckin(dog.id)}
                  >
                    <div>
                      <div className="font-medium">{dog.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Owner: {dog.user.name}
                        {dog.packBalances.length > 0 && (
                          <span className="ml-2 text-amber-700 font-semibold">
                            <Sun className="h-3 w-3 inline mr-0.5" />
                            {dog.packBalances[0].remainingUnits} days
                          </span>
                        )}
                      </div>
                    </div>
                    <LogIn className="h-4 w-4 text-green-600" />
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg p-4 text-sm text-muted-foreground text-center">
                No dogs found
              </div>
            )}
          </div>

          {/* Active visits */}
          {visits.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Sun className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No dogs in daycare right now.</p>
                <p className="text-sm text-muted-foreground mt-1">Search above to check in a dog.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-3 px-4 font-medium">Dog</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium">Owner</th>
                    <th scope="col" className="text-left py-3 px-4 font-medium">Checked In</th>
                    <th scope="col" className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => (
                    <tr key={visit.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{visit.dog.name}</div>
                        <div className="text-sm text-muted-foreground">{visit.dog.size}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{visit.dog.user.name}</div>
                        <div className="text-sm text-muted-foreground">{visit.dog.user.phone || visit.dog.user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{format(new Date(visit.checkInAt), 'h:mm a')}</div>
                        <div className="text-sm text-muted-foreground">{format(new Date(visit.checkInAt), 'MMM d, yyyy')}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(visit)}
                            disabled={checkingOut === visit.id}
                            aria-label={`Delete ${visit.dog.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCheckout(visit)}
                            disabled={checkingOut === visit.id}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            {checkingOut === visit.id ? 'Checking out...' : 'Check out'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
            title="Remove from daycare?"
            description={deleteTarget ? `This will cancel ${deleteTarget.dog.name}'s check-in. No charge will be applied.` : ''}
            confirmLabel="Remove"
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dog or owner..."
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">From</label>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">To</label>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {(filterQ || filterStart || filterEnd) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setFilterQ(''); setFilterStart(''); setFilterEnd(''); }}
              >
                Clear
              </Button>
            )}
          </div>

          {historyError && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">{historyError}</div>
          )}

          {historyLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading"></div>
            </div>
          ) : historyVisits.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No completed visits found.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="text-left py-3 px-4 font-medium">Dog</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium">Owner</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium">Date</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium">Check-in</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium">Check-out</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyVisits.map((visit) => (
                      <tr key={visit.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{visit.dog.name}</div>
                          <div className="text-sm text-muted-foreground">{visit.dog.size}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{visit.dog.user.name}</div>
                          <div className="text-sm text-muted-foreground">{visit.dog.user.phone || visit.dog.user.email}</div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(visit.checkInAt), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(visit.checkInAt), 'h:mm a')}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {visit.checkOutAt ? format(new Date(visit.checkOutAt), 'h:mm a') : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {visit.checkOutAt ? formatDuration(visit.checkInAt, visit.checkOutAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {historyTotal} visit{historyTotal !== 1 ? 's' : ''} total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    disabled={historyPage >= historyTotalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
