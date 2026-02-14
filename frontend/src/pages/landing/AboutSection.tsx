import { Dog, Heart, Shield, TreePine } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export default function AboutSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="about" className="py-20 sm:py-28 bg-dogtown-warm-gray">
      <div
        ref={ref}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text */}
          <div className={`transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-dogtown-brown leading-tight">
              DogTown existe porque
              <span className="text-dogtown-orange"> amamos a los perros</span>
            </h2>
            <p className="mt-6 text-lg text-dogtown-brown/60 leading-relaxed">
              Somos más que un hotel para perros. Somos un segundo hogar donde cada perro recibe
              atención personalizada, cariño y cuidado profesional de un equipo comprometido.
            </p>
            <p className="mt-4 text-lg text-dogtown-brown/60 leading-relaxed">
              Con más de 1 hectárea de instalaciones en Zapopan, Jalisco, ofrecemos el espacio,
              la seguridad y el cariño que tu perro necesita para ser feliz. Estamos en constante
              aprendizaje y capacitación para brindarte la mejor opción en hospedaje y guardería canina.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-6">
              {[
                { value: '1+ ha', label: 'De espacio verde' },
                { value: '60+', label: 'Perros de capacidad' },
                { value: '24/7', label: 'Supervisión profesional' },
                { value: '4.8★', label: 'Calificación promedio' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-heading font-extrabold text-2xl sm:text-3xl text-dogtown-orange">
                    {stat.value}
                  </p>
                  <p className="text-sm text-dogtown-brown/50 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative visual */}
          <div className={`transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}>
            <div className="relative aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-dogtown-orange/20 via-dogtown-cream to-dogtown-warm-gray" />
              <div className="absolute inset-4 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center">
                <div className="relative">
                  <Dog className="h-32 w-32 text-dogtown-orange/30" strokeWidth={1} />
                  <Heart className="absolute -top-4 -right-4 h-10 w-10 text-dogtown-orange/40 animate-float" />
                  <Shield className="absolute -bottom-2 -left-6 h-10 w-10 text-dogtown-orange/30 animate-float-slow" />
                  <TreePine className="absolute -top-2 -left-8 h-8 w-8 text-dogtown-orange/25 animate-float-slower" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
