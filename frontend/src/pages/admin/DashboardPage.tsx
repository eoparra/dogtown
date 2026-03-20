import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Users, Dog, Calendar, ArrowRight, LogIn, LogOut, Sun } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalDogs: number;
  upcomingBookings: number;
  todayCheckins: number;
  todayCheckouts: number;
  dogsInDaycare: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = () => {
    setLoading(true);
    setError('');
    admin.getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" role="status" aria-label="Loading"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{error}</p>
        <button onClick={loadStats} className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800">Retry</button>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Clients',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      link: '/admin/users',
      color: 'bg-blue-500',
    },
    {
      label: 'Total Dogs',
      value: stats?.totalDogs ?? 0,
      icon: Dog,
      link: '/admin/dogs',
      color: 'bg-green-500',
    },
    {
      label: 'Upcoming Bookings',
      value: stats?.upcomingBookings ?? 0,
      icon: Calendar,
      link: '/admin/bookings',
      color: 'bg-purple-500',
    },
    {
      label: 'Dogs in Daycare',
      value: stats?.dogsInDaycare ?? 0,
      icon: Sun,
      link: '/admin/daycare',
      color: 'bg-amber-500',
    },
    {
      label: "Today's Check-ins",
      value: stats?.todayCheckins ?? 0,
      icon: LogIn,
      link: '/admin/bookings',
      color: 'bg-orange-500',
    },
    {
      label: "Today's Check-outs",
      value: stats?.todayCheckouts ?? 0,
      icon: LogOut,
      link: '/admin/bookings',
      color: 'bg-red-500',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your dog hotel operations</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Link key={stat.label} to={stat.link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className={`${stat.color} p-2 rounded-lg`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to="/admin/bookings"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span>View All Bookings</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/admin/rates"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span>Manage Rates</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/admin/capacity"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span>Update Capacity</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/admin/periods"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <span>Special Periods</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">API Status</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                  Connected
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
