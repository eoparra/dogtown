import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dog, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { label: 'Servicios', href: '#services' },
  { label: 'Nosotros', href: '#about' },
  { label: 'Contacto', href: '#contact' },
];

interface NavbarProps {
  onLoginClick: () => void;
}

export default function Navbar({ onLoginClick }: NavbarProps) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const ctaLink = user?.role === 'ADMIN' ? '/admin' : '/dashboard';
  const ctaLabel = user ? 'Ir al Dashboard' : 'Iniciar Sesión';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-md'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#" className="flex items-center gap-2">
            <div className={`p-2 rounded-xl transition-colors ${
              scrolled ? 'bg-dogtown-orange/10' : 'bg-white/20'
            }`}>
              <Dog className="h-6 w-6 text-dogtown-orange" />
            </div>
            <span className="font-heading font-extrabold text-xl text-dogtown-brown">
              DogTown
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-heading font-semibold text-sm tracking-wide text-dogtown-brown/70 transition-colors hover:text-dogtown-orange"
              >
                {link.label}
              </a>
            ))}
            {user ? (
              <Link
                to={ctaLink}
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-dogtown-orange text-white font-heading font-bold text-sm hover:bg-dogtown-orange-dark transition-colors shadow-lg shadow-dogtown-orange/25"
              >
                {ctaLabel}
              </Link>
            ) : (
              <button
                onClick={onLoginClick}
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-dogtown-orange text-white font-heading font-bold text-sm hover:bg-dogtown-orange-dark transition-colors shadow-lg shadow-dogtown-orange/25"
              >
                {ctaLabel}
              </button>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-dogtown-orange/10 transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-6 w-6 text-dogtown-brown" />
            ) : (
              <Menu className="h-6 w-6 text-dogtown-brown" />
            )}
          </button>
        </div>
      </div>

      <div
        className={`md:hidden transition-all duration-300 overflow-hidden ${
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        } bg-white/95 backdrop-blur-sm border-t border-gray-100`}
      >
        <div className="px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block font-heading font-semibold text-dogtown-brown/70 hover:text-dogtown-orange py-2 transition-colors"
            >
              {link.label}
            </a>
          ))}
          {user ? (
            <Link
              to={ctaLink}
              onClick={() => setMobileOpen(false)}
              className="block text-center px-5 py-3 rounded-full bg-dogtown-orange text-white font-heading font-bold text-sm hover:bg-dogtown-orange-dark transition-colors"
            >
              {ctaLabel}
            </Link>
          ) : (
            <button
              onClick={() => { setMobileOpen(false); onLoginClick(); }}
              className="block w-full text-center px-5 py-3 rounded-full bg-dogtown-orange text-white font-heading font-bold text-sm hover:bg-dogtown-orange-dark transition-colors"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
