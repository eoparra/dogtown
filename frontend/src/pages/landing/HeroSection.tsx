import { Link } from 'react-router-dom';
import { Dog, Heart, Bone, Sparkles, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function HeroSection() {
  const { user } = useAuth();

  const primaryLink = user ? '/new-booking' : '/register';
  const primaryLabel = user ? 'Nueva Reserva' : 'Reservar Ahora';

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-dogtown-cream via-white to-orange-50">
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-dogtown-orange/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-dogtown-orange/5 rounded-full blur-3xl" />

      <div className="absolute top-32 right-[15%] hidden lg:block animate-float-slow">
        <Dog className="h-16 w-16 text-dogtown-orange/15" />
      </div>
      <div className="absolute top-[45%] right-[10%] hidden lg:block animate-float">
        <Heart className="h-10 w-10 text-dogtown-orange/15" />
      </div>
      <div className="absolute bottom-[25%] right-[20%] hidden lg:block animate-float-slower">
        <Bone className="h-12 w-12 text-dogtown-orange/10" />
      </div>
      <div className="absolute top-[30%] right-[30%] hidden lg:block animate-float">
        <Sparkles className="h-8 w-8 text-dogtown-orange/10" />
      </div>

      <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 hidden xl:block">
        <Dog className="h-[400px] w-[400px] text-dogtown-orange/[0.04]" strokeWidth={0.5} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white shadow-md mb-8 animate-fade-in">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-dogtown-orange text-dogtown-orange" />
              ))}
            </div>
            <span className="text-sm font-semibold text-dogtown-brown/70 ml-1">
              4.8 estrellas
            </span>
          </div>

          <h1 className="font-heading font-extrabold text-5xl sm:text-6xl lg:text-7xl text-dogtown-brown leading-tight animate-fade-in-up">
            DogTown
            <br />
            <span className="text-dogtown-orange">Hotel & Spa</span>
          </h1>

          <p className="mt-4 font-heading font-semibold text-xl sm:text-2xl text-dogtown-orange/80 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            ¡El mejor lugar para tu perro!
          </p>

          <p className="mt-6 text-lg text-dogtown-brown/60 leading-relaxed max-w-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Más de 1 hectárea de espacio, capacidad para 60+ perros y cuidado profesional las 24 horas.
            Hotel, guardería, estética y transporte en Zapopan, Jalisco.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link
              to={primaryLink}
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-dogtown-orange text-white font-heading font-bold text-lg hover:bg-dogtown-orange-dark transition-all shadow-lg shadow-dogtown-orange/30 hover:shadow-xl hover:shadow-dogtown-orange/30 hover:-translate-y-0.5"
            >
              {primaryLabel}
            </Link>
            <a
              href="#about"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-dogtown-orange/30 text-dogtown-orange font-heading font-bold text-lg hover:bg-dogtown-orange/5 transition-all"
            >
              Conócenos
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
