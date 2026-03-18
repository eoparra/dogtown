import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { admin } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Dog, Calendar, Home, Users, Settings, LogOut, DollarSign, Clock, Menu, X, Package, ChevronDown } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // handled in useAuth
    }
    navigate('/');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/dogs', label: 'My Dogs', icon: Dog },
    { path: '/bookings', label: 'My Bookings', icon: Calendar },
    { path: '/new-booking', label: 'New Booking', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/dashboard" className="flex items-center gap-2 font-bold text-xl text-primary">
                <Dog className="h-6 w-6" />
                DogTown
              </Link>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      location.pathname === item.path
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden border-t bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                    location.pathname === item.path
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md w-full"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

export function AdminLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);

  const configPaths = ['/admin/rates', '/admin/capacity', '/admin/periods'];
  const inventoryPaths = ['/admin/inventory/products', '/admin/inventory/services'];
  const isOnConfigPage = configPaths.includes(location.pathname);
  const isOnInventoryPage = inventoryPaths.includes(location.pathname);

  useEffect(() => {
    admin.getLowStockCount()
      .then(({ count }) => setLowStockCount(count))
      .catch(() => {});
  }, [location.pathname]);

  // Auto-expand when on a config sub-page, collapse when navigating away
  useEffect(() => {
    setConfigOpen(isOnConfigPage);
  }, [location.pathname]);

  // Close inventory dropdown when navigating away from inventory
  useEffect(() => {
    if (!isOnInventoryPage) setInventoryOpen(false);
  }, [location.pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
      }
      if (inventoryRef.current && !inventoryRef.current.contains(e.target as Node)) {
        setInventoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // handled in useAuth
    }
    navigate('/');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: Home },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/dogs', label: 'Dogs', icon: Dog },
    { path: '/admin/bookings', label: 'Bookings', icon: Calendar },
  ];

  const inventoryItems = [
    { path: '/admin/inventory/products', label: 'Products' },
    { path: '/admin/inventory/services', label: 'Services' },
  ];

  const configItems = [
    { path: '/admin/rates', label: 'Rates', icon: DollarSign },
    { path: '/admin/capacity', label: 'Capacity', icon: Settings },
    { path: '/admin/periods', label: 'Special Periods', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/admin" className="flex items-center gap-2 font-bold text-xl">
                <Dog className="h-6 w-6" />
                DogTown Admin
              </Link>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2 sm:items-center">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      location.pathname === item.path
                        ? 'bg-white/20'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {'badge' in item && item.badge !== undefined && (
                      <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                        {item.badge as React.ReactNode}
                      </span>
                    )}
                  </Link>
                ))}

                {/* Inventory dropdown */}
                <div ref={inventoryRef} className="relative">
                  <button
                    onClick={() => setInventoryOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isOnInventoryPage
                        ? 'bg-white/20'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                    aria-expanded={inventoryOpen}
                    aria-haspopup="true"
                  >
                    <Package className="h-4 w-4" />
                    Inventory
                    {lowStockCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                        {lowStockCount}
                      </span>
                    )}
                    <ChevronDown className={`h-3 w-3 transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {inventoryOpen && (
                    <div className="absolute left-0 top-full mt-1 w-40 rounded-md bg-gray-800 shadow-lg ring-1 ring-white/10 z-50">
                      <div className="py-1">
                        {inventoryItems.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setInventoryOpen(false)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                              location.pathname === item.path
                                ? 'bg-white/20 text-white'
                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Config dropdown */}
                <div ref={configRef} className="relative">
                  <button
                    onClick={() => setConfigOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isOnConfigPage
                        ? 'bg-white/20'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                    aria-expanded={configOpen}
                    aria-haspopup="true"
                  >
                    <Settings className="h-4 w-4" />
                    Config
                    <ChevronDown className={`h-3 w-3 transition-transform ${configOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {configOpen && (
                    <div className="absolute left-0 top-full mt-1 w-44 rounded-md bg-gray-800 shadow-lg ring-1 ring-white/10 z-50">
                      <div className="py-1">
                        {configItems.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                              location.pathname === item.path
                                ? 'bg-white/20 text-white'
                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300 hidden sm:block">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/10 hidden sm:inline-flex">
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-white/10">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                    location.pathname === item.path
                      ? 'bg-white/20'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {'badge' in item && item.badge !== undefined && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                      {item.badge as React.ReactNode}
                    </span>
                  )}
                </Link>
              ))}

              {/* Inventory section — always expanded in mobile */}
              <div className="pt-1">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <Package className="h-3.5 w-3.5" />
                  Inventory
                  {lowStockCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                      {lowStockCount}
                    </span>
                  )}
                </div>
                {inventoryItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 pl-7 pr-3 py-2 text-sm font-medium rounded-md ${
                      location.pathname === item.path
                        ? 'bg-white/20 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* Config section — always expanded in mobile */}
              <div className="pt-1">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <Settings className="h-3.5 w-3.5" />
                  Config
                </div>
                {configItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 pl-7 pr-3 py-2 text-sm font-medium rounded-md ${
                      location.pathname === item.path
                        ? 'bg-white/20 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>

              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 rounded-md w-full"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
