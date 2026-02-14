import { Bed, Sun, Scissors, Truck, ShoppingBag } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const services = [
  {
    icon: Bed,
    title: 'Hotel',
    description: 'Estancia nocturna con supervisión 24/7, grupos por tamaño y doble puerta de seguridad. Tu perro descansa seguro y feliz.',
  },
  {
    icon: Sun,
    title: 'Guardería',
    description: 'Cuidado diurno con actividades, socialización y juego supervisado. Perfecto para días de trabajo.',
  },
  {
    icon: Scissors,
    title: 'Estética y Spa',
    description: 'Baño, corte, cepillado y tratamientos de spa. Tu perro regresa limpio, relajado y guapísimo.',
  },
  {
    icon: Truck,
    title: 'Transporte',
    description: 'Servicio de recolección y entrega a domicilio para tu comodidad. Sin preocupaciones.',
  },
  {
    icon: ShoppingBag,
    title: 'Tienda',
    description: 'Productos premium, alimentos de calidad y accesorios seleccionados para tu mascota.',
  },
];

export default function ServicesSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="services" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-dogtown-brown">
            Nuestros Servicios
          </h2>
          <p className="mt-4 text-lg text-dogtown-brown/60 max-w-2xl mx-auto">
            Todo lo que tu perro necesita en un solo lugar. Cuidado integral con los más altos estándares.
          </p>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {services.map((service, i) => (
            <div
              key={service.title}
              className={`group p-8 rounded-2xl bg-white border border-gray-100 hover:border-dogtown-orange/20 shadow-sm hover:shadow-xl transition-all duration-300 ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: isVisible ? `${i * 100}ms` : '0ms',
                transitionProperty: 'opacity, transform, box-shadow, border-color',
                transitionDuration: '500ms',
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-dogtown-orange/10 flex items-center justify-center mb-6 group-hover:bg-dogtown-orange transition-colors duration-300">
                <service.icon className="h-8 w-8 text-dogtown-orange group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="font-heading font-bold text-xl text-dogtown-brown mb-3">
                {service.title}
              </h3>
              <p className="text-dogtown-brown/60 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
