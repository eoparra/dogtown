import { Star, Quote } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const testimonials = [
  {
    name: 'María García',
    dog: 'Max, Golden Retriever',
    text: 'Mi perro ama DogTown. El personal es increíble y siempre está feliz cuando lo recojo. Las fotos diarias que comparten son un detalle hermoso. ¡Lo mejor de Guadalajara!',
    rating: 5,
  },
  {
    name: 'Carlos Rodríguez',
    dog: 'Luna, French Bulldog',
    text: 'Excelente servicio. Las instalaciones son amplias y limpias. Luna siempre regresa contenta y cansada de jugar. El personal es muy atento y profesional.',
    rating: 5,
  },
  {
    name: 'Ana Martínez',
    dog: 'Rocky, Labrador',
    text: 'Confío completamente en DogTown. La seguridad y el cariño con que tratan a Rocky me da total tranquilidad. Las puertas dobles y los grupos por tamaño son un gran plus.',
    rating: 5,
  },
];

export default function TestimonialsSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-20 sm:py-28 bg-dogtown-warm-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-dogtown-brown">
            Lo que dicen nuestros clientes
          </h2>
          <p className="mt-4 text-lg text-dogtown-brown/60 max-w-2xl mx-auto">
            La confianza de nuestros clientes es nuestro mayor orgullo.
          </p>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, i) => (
            <div
              key={testimonial.name}
              className={`relative bg-white rounded-2xl p-8 shadow-sm border-l-4 border-dogtown-orange transition-all duration-500 ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: isVisible ? `${i * 150}ms` : '0ms',
              }}
            >
              <Quote className="h-8 w-8 text-dogtown-orange/20 mb-4" />
              <p className="text-dogtown-brown/70 leading-relaxed italic">
                "{testimonial.text}"
              </p>
              <div className="mt-6 flex items-center gap-1">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-dogtown-orange text-dogtown-orange" />
                ))}
              </div>
              <div className="mt-3">
                <p className="font-heading font-bold text-dogtown-brown">
                  {testimonial.name}
                </p>
                <p className="text-sm text-dogtown-brown/50">
                  {testimonial.dog}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
