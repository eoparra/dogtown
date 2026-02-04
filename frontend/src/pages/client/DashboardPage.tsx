import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { dogs as dogsApi, bookings as bookingsApi } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dog, Calendar, Plus, ArrowRight } from 'lucide-react';
import type { Dog as DogType, Booking } from '@/types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [dogsList, setDogsList] = useState<DogType[]>([]);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dogsApi.list(), bookingsApi.list()])
      .then(([dogsRes, bookingsRes]) => {
        setDogsList(dogsRes.dogs);
        setBookingsList(bookingsRes.bookings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const upcomingBookings = bookingsList
    .filter((b) => b.status === 'CONFIRMED' && new Date(b.checkIn) >= new Date())
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground">Manage your dogs and bookings</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dog className="h-5 w-5" />
              My Dogs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{dogsList.length}</div>
            <p className="text-muted-foreground text-sm mb-4">
              {dogsList.length === 0 ? 'No dogs registered yet' : 'Registered dogs'}
            </p>
            <Link to="/dogs">
              <Button variant="outline" size="sm">
                {dogsList.length === 0 ? 'Add Your First Dog' : 'Manage Dogs'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{upcomingBookings.length}</div>
            <p className="text-muted-foreground text-sm mb-4">
              {upcomingBookings.length === 0 ? 'No upcoming bookings' : 'Scheduled visits'}
            </p>
            <Link to="/new-booking">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Booking
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Dogs */}
      {dogsList.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Dogs</CardTitle>
            <Link to="/dogs">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dogsList.slice(0, 3).map((dog) => (
                <div key={dog.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{dog.name}</h3>
                  <p className="text-sm text-muted-foreground">{dog.breed}</p>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{dog.age} years</span>
                    <span>|</span>
                    <span>{dog.weight} kg</span>
                  </div>
                  {!dog.vaccinationInfo && (
                    <Badge variant="warning" className="mt-2">
                      Vaccination info needed
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Bookings</CardTitle>
            <Link to="/bookings">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{booking.dog?.name}</span>
                      <Badge variant={booking.type === 'HOTEL' ? 'default' : 'outline'}>
                        {booking.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${booking.totalPrice}</div>
                    <Badge variant="success">Confirmed</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {dogsList.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Dog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="text-muted-foreground mb-4">
              Add your first dog to start booking hotel stays and daycare
            </p>
            <Link to="/dogs">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your Dog
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
