import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookings as bookingsApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Calendar } from 'lucide-react';
import type { Booking } from '@/types';
import { format } from 'date-fns';

export default function BookingsPage() {
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setFetchError('');
    try {
      const { bookings } = await bookingsApi.list();
      setBookingsList(bookings);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      await bookingsApi.cancel(cancelTarget);
      await loadBookings();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
    setCancelTarget(null);
  };

  const now = new Date();
  const filteredBookings = bookingsList.filter((b) => {
    if (filter === 'upcoming') {
      return b.status === 'CONFIRMED' && new Date(b.checkIn) >= now;
    }
    if (filter === 'past') {
      return new Date(b.checkOut) < now || b.status === 'CANCELLED';
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Loading"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{fetchError}</p>
        <Button onClick={loadBookings}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">View and manage your bookings</p>
        </div>
        <Link to="/new-booking">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'upcoming', 'past'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {filter === 'all'
                ? "You don't have any bookings yet."
                : `No ${filter} bookings found.`}
            </p>
            <Link to="/new-booking">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Booking
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const isPast = new Date(booking.checkOut) < now;
            const isActive =
              booking.status === 'CONFIRMED' &&
              new Date(booking.checkIn) <= now &&
              new Date(booking.checkOut) >= now;

            return (
              <Card key={booking.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{booking.dog?.name}</h3>
                        <Badge variant={booking.type === 'HOTEL' ? 'default' : 'outline'}>
                          {booking.type}
                        </Badge>
                        {booking.status === 'CANCELLED' && (
                          <Badge variant="destructive">Cancelled</Badge>
                        )}
                        {isActive && <Badge variant="success">Active</Badge>}
                      </div>
                      <p className="text-muted-foreground">
                        {format(new Date(booking.checkIn), 'EEEE, MMMM d, yyyy')}
                        {' - '}
                        {format(new Date(booking.checkOut), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.dog?.breed}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">${booking.totalPrice}</div>
                        <div className="text-sm text-muted-foreground">
                          Booked {format(new Date(booking.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                      {booking.status === 'CONFIRMED' && !isPast && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setCancelTarget(booking.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
    </div>
  );
}
