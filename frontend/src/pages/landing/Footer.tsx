import { Link } from 'react-router-dom';
import { Dog, Instagram, Facebook, ChevronUp } from 'lucide-react';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-dogtown-brown text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-dogtown-orange/20">
                <Dog className="h-6 w-6 text-dogtown-orange" />
              </div>
              <span className="font-heading font-extrabold text-xl">DogTown</span>
            </div>
            <p className="text-white/50 leading-relaxed">
              Hotel & Spa para perros en Zapopan, Jalisco.
              Porque amamos a los perros tanto como tú.
            </p>
            <p className="mt-4 text-sm text-dogtown-orange font-heading font-semibold">
              ¡El mejor lugar para tu perro!
            </p>
          </div>

          <div>
            <h4 className="font-heading font-bold text-lg mb-4">Navegación</h4>
            <ul className="space-y-3">
              {[
                { label: 'Servicios', href: '#services' },
                { label: 'Nosotros', href: '#about' },
                { label: 'Contacto', href: '#contact' },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/50 hover:text-dogtown-orange transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/login"
                  className="text-white/50 hover:text-dogtown-orange transition-colors"
                >
                  Iniciar Sesión
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="text-white/50 hover:text-dogtown-orange transition-colors"
                >
                  Registrarse
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-lg mb-4">Síguenos</h4>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/dogtownhotel/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center hover:bg-dogtown-orange transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.facebook.com/dogtowngdl/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center hover:bg-dogtown-orange transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
            <div className="mt-8">
              <p className="text-white/50 text-sm">Teléfono / WhatsApp</p>
              <a
                href="tel:+5213313872136"
                className="text-white hover:text-dogtown-orange transition-colors font-heading font-semibold"
              >
                +52 1 33 1387 2136
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} DogTown Hotel & Spa. Todos los derechos reservados.
          </p>
          <button
            onClick={scrollToTop}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-dogtown-orange transition-colors"
            aria-label="Volver arriba"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
