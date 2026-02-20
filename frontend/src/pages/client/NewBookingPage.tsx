import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dogs as dogsApi, bookings as bookingsApi } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, AlertCircle, CheckCircle, Dog } from 'lucide-react';
import type { Dog as DogType, HotelPriceDetails, DaycarePriceDetails } from '@/types';
import { format, addDays } from 'date-fns';

export default function NewBookingPage() {
  const navigate = useNavigate();
  const [dogsList, setDogsList] = useState<DogType[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedDogId, setSelectedDogId] = useState('');
  const [bookingType, setBookingType] = useState<'HOTEL' | 'DAYCARE'>('HOTEL');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  // Validation state
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; unavailableDates: string[] } | null>(null);
  const [priceDetails, setPriceDetails] = useState<{ totalPrice: number; details: HotelPriceDetails | DaycarePriceDetails } | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [fetchError, setFetchError] = useState('');

  const loadDogs = () => {
    setLoading(true);
    setFetchError('');
    dogsApi.list()
      .then(({ dogs }) => setDogsList(dogs))
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load dogs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDogs();
  }, []);

  const selectedDog = dogsList.find((d) => d.id === selectedDogId);
  const dogHasVaccination = selectedDog?.vaccinationInfo && selectedDog.vaccinationInfo.trim() !== '';

  const checkAvailabilityAndPrice = async () => {
    if (!checkIn || !checkOut) return;

    setChecking(true);
    setError('');
    setAvailability(null);
    setPriceDetails(null);

    try {
      const [availRes, priceRes] = await Promise.all([
        bookingsApi.checkAvailability({ type: bookingType, checkIn, checkOut }),
        bookingsApi.calculatePrice({ type: bookingType, checkIn, checkOut }),
      ]);

      setAvailability(availRes);
      setPriceDetails(priceRes as { totalPrice: number; details: HotelPriceDetails | DaycarePriceDetails });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check availability');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (checkIn && checkOut && new Date(checkIn) < new Date(checkOut)) {
      checkAvailabilityAndPrice();
    }
  }, [checkIn, checkOut, bookingType]);

  const handleSubmit = async () => {
    if (!selectedDogId || !checkIn || !checkOut) return;

    setSubmitting(true);
    setError('');

    try {
      await bookingsApi.create({
        dogId: selectedDogId,
        type: bookingType,
        checkIn,
        checkOut,
      });
      navigate('/bookings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
      setSubmitting(false);
    }
  };

  const minDate = format(new Date(), 'yyyy-MM-dd');
  const minCheckOut = checkIn ? format(addDays(new Date(checkIn), 1), 'yyyy-MM-dd') : minDate;

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
        <Button onClick={loadDogs}>Retry</Button>
      </div>
    );
  }

  // No dogs registered
  if (dogsList.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="text-center py-12">
          <CardContent>
            <Dog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Dogs Registered</h2>
            <p className="text-muted-foreground mb-4">
              You need to add a dog before you can make a booking.
            </p>
            <Link to="/dogs">
              <Button>Add Your First Dog</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Booking</h1>
        <p className="text-muted-foreground">Book a hotel stay or daycare for your dog</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Select Dog & Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
              1
            </span>
            Select Dog & Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            id="dog"
            label="Select Dog"
            value={selectedDogId}
            onChange={(e) => setSelectedDogId(e.target.value)}
            options={[
              { value: '', label: 'Choose a dog...' },
              ...dogsList.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.breed})${d.vaccinationInfo ? '' : ' - No vaccination info'}`,
              })),
            ]}
          />

          {selectedDog && !dogHasVaccination && (
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Vaccination information required</p>
                <p className="text-sm">Please update {selectedDog.name}'s vaccination information before booking.</p>
                <Link to="/dogs" className="text-sm underline mt-1 inline-block">
                  Update dog info
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setBookingType('HOTEL')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                bookingType === 'HOTEL'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h3 className="font-semibold">Hotel Stay</h3>
              <p className="text-sm text-muted-foreground">Overnight boarding</p>
            </button>
            <button
              type="button"
              onClick={() => setBookingType('DAYCARE')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                bookingType === 'DAYCARE'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h3 className="font-semibold">Daycare</h3>
              <p className="text-sm text-muted-foreground">Daily care service</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Select Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
              2
            </span>
            Select Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              id="checkIn"
              type="date"
              label="Check-in Date"
              min={minDate}
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (checkOut && new Date(e.target.value) >= new Date(checkOut)) {
                  setCheckOut('');
                }
              }}
            />
            <Input
              id="checkOut"
              type="date"
              label="Check-out Date"
              min={minCheckOut}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              disabled={!checkIn}
            />
          </div>

          {checking && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Checking availability...
            </div>
          )}

          {availability && !checking && (
            <div
              className={`p-4 rounded-lg flex items-start gap-2 ${
                availability.available ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {availability.available ? (
                <>
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Available!</p>
                    <p className="text-sm">These dates are open for booking.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Not available</p>
                    <p className="text-sm">
                      Unavailable dates: {availability.unavailableDates.join(', ')}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Review & Confirm */}
      {priceDetails && availability?.available && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                3
              </span>
              Review & Confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dog</span>
                <span className="font-medium">{selectedDog?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <Badge>{bookingType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dates</span>
                <span>
                  {format(new Date(checkIn), 'MMM d')} - {format(new Date(checkOut), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {bookingType === 'HOTEL' ? 'Nights' : 'Days'}
                </span>
                <span>
                  {bookingType === 'HOTEL'
                    ? (priceDetails.details as HotelPriceDetails).numberOfNights
                    : (priceDetails.details as DaycarePriceDetails).numberOfDays}
                </span>
              </div>
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${priceDetails.totalPrice}</span>
              </div>
            </div>

            {/* Price breakdown for hotel */}
            {bookingType === 'HOTEL' && 'breakdown' in priceDetails.details && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View price breakdown
                </summary>
                <div className="mt-2 border rounded-lg p-3 space-y-1">
                  {(priceDetails.details as HotelPriceDetails).breakdown.map((item) => (
                    <div key={item.date} className="flex justify-between text-muted-foreground">
                      <span>
                        {format(new Date(item.date), 'MMM d')}
                        {item.rateType !== 'REGULAR' && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {item.rateType}
                          </Badge>
                        )}
                      </span>
                      <span>${item.price}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!dogHasVaccination || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Creating Booking...' : 'Confirm Booking'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
