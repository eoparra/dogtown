import { Clock, Shield, Users, TreePine, Award, Heart } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const features = [
  {
    icon: Clock,
    title: 'Cuidado 24 Horas',
    description: 'Personal capacitado supervisando día y noche para la tranquilidad de tu familia.',
  },
  {
    icon: Shield,
    title: 'Doble Seguridad',
    description: 'Puertas dobles de seguridad en todas las áreas. Tu perro siempre protegido.',
  },
  {
    icon: Users,
    title: 'Grupos por Tamaño',
    description: 'Perros agrupados por tamaño para juego seguro y socialización adecuada.',
  },
  {
    icon: TreePine,
    title: 'Amplio Espacio',
    description: 'Más de 1 hectárea de áreas verdes y recreativas para correr y explorar.',
  },
  {
    icon: Award,
    title: 'Cuidado Profesional',
    description: 'Equipo entrenado en comportamiento canino y primeros auxilios.',
  },
  {
    icon: Heart,
    title: 'Amor y Dedicación',
    description: 'Comprometidos con el bienestar y la felicidad de cada perro que nos visita.',
  },
];

export default function FeaturesSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-dogtown-brown">
            ¿Por qué elegir DogTown?
          </h2>
          <p className="mt-4 text-lg text-dogtown-brown/60 max-w-2xl mx-auto">
            La seguridad, el espacio y el cariño que tu perro merece. Esto es lo que nos hace diferentes.
          </p>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`flex gap-5 p-6 rounded-2xl hover:bg-dogtown-warm-gray transition-all duration-500 ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: isVisible ? `${i * 80}ms` : '0ms',
              }}
            >
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-dogtown-orange/10 flex items-center justify-center">
                <feature.icon className="h-7 w-7 text-dogtown-orange" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-dogtown-brown mb-1">
                  {feature.title}
                </h3>
                <p className="text-dogtown-brown/55 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
