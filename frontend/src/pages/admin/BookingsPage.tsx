import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Trash2, X as XIcon } from 'lucide-react';
import type { Booking } from '@/types';
import { format } from 'date-fns';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter, setFilter] = useState<{ status?: string; type?: string; upcoming?: boolean }>({});
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, [filter]);

  const loadBookings = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { bookings } = await admin.getBookings(filter);
      setBookings(bookings);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      await admin.updateBooking(cancelTarget, { status: 'CANCELLED' });
      await loadBookings();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
    setCancelTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await admin.deleteBooking(deleteTarget);
      await loadBookings();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete booking');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bookings Management</h1>
        <p className="text-muted-foreground">View and manage all bookings</p>
      </div>

      {fetchError && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm flex items-center justify-between">
          <span>{fetchError}</span>
          <Button variant="outline" size="sm" onClick={loadBookings}>Retry</Button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <Select
              id="status"
              label="Status"
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
            <Select
              id="type"
              label="Type"
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
              options={[
                { value: '', label: 'All Types' },
                { value: 'HOTEL', label: 'Hotel' },
                { value: 'DAYCARE', label: 'Daycare' },
              ]}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="upcoming"
                checked={filter.upcoming || false}
                onChange={(e) => setFilter({ ...filter, upcoming: e.target.checked || undefined })}
                className="rounded"
              />
              <label htmlFor="upcoming" className="text-sm">
                Upcoming only
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading"></div>
        </div>
      ) : bookings.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">No bookings found matching your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th scope="col" className="text-left py-3 px-4 font-medium">Dog</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Owner</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Type</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Dates</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Price</th>
                <th scope="col" className="text-left py-3 px-4 font-medium">Status</th>
                <th scope="col" className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium">{booking.dog?.name}</div>
                    <div className="text-sm text-muted-foreground">{booking.dog?.breed}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{booking.dog?.user?.name}</div>
                    <div className="text-sm text-muted-foreground">{booking.dog?.user?.email}</div>
                    {booking.dog?.user?.phone && (
                      <div className="text-sm text-muted-foreground">{booking.dog.user.phone}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={booking.type === 'HOTEL' ? 'default' : 'outline'}>
                      {booking.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div>{format(new Date(booking.checkIn), 'MMM d, yyyy')}</div>
                    <div className="text-sm text-muted-foreground">
                      to {format(new Date(booking.checkOut), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold">${booking.totalPrice}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={booking.status === 'CONFIRMED' ? 'success' : 'destructive'}
                    >
                      {booking.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      {booking.status === 'CONFIRMED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelTarget(booking.id)}
                          aria-label="Cancel booking"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(booking.id)}
                        aria-label="Delete booking"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
        title="Cancel Booking"
        description="Are you sure you want to cancel this booking?"
        confirmLabel="Cancel Booking"
        variant="destructive"
        onConfirm={handleCancelConfirm}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Booking"
        description="Are you sure you want to permanently delete this booking?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
