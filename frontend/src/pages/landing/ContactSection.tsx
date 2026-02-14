import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const contactItems = [
  {
    icon: MapPin,
    label: 'Dirección',
    value: 'Puerto Yavaros 40, Miramar, 45060 Zapopan, Jalisco, México',
    href: 'https://maps.google.com/?q=Puerto+Yavaros+40,+Miramar,+45060+Zapopan,+Jalisco',
  },
  {
    icon: Phone,
    label: 'Teléfono / WhatsApp',
    value: '+52 1 33 1387 2136',
    href: 'tel:+5213313872136',
  },
  {
    icon: Mail,
    label: 'Correo',
    value: 'dogtowngdl@gmail.com',
    href: 'mailto:dogtowngdl@gmail.com',
  },
  {
    icon: Clock,
    label: 'Horario',
    value: 'Lun – Sáb: 8:00 AM – 8:00 PM\nDom: 8:00 AM – 7:00 PM',
  },
];

export default function ContactSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="contact" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-dogtown-brown">
            Contáctanos
          </h2>
          <p className="mt-4 text-lg text-dogtown-brown/60 max-w-2xl mx-auto">
            Visítanos o comunícate con nosotros. Estamos listos para cuidar a tu mejor amigo.
          </p>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12"
        >
          {/* Contact details */}
          <div className={`space-y-6 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}>
            {contactItems.map((item) => (
              <div key={item.label} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-dogtown-orange/10 flex items-center justify-center">
                  <item.icon className="h-6 w-6 text-dogtown-orange" />
                </div>
                <div>
                  <p className="font-heading font-bold text-dogtown-brown">
                    {item.label}
                  </p>
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-dogtown-brown/60 hover:text-dogtown-orange transition-colors whitespace-pre-line"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-dogtown-brown/60 whitespace-pre-line">
                      {item.value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Google Maps embed */}
          <div className={`transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}>
            <div className="rounded-2xl overflow-hidden shadow-lg h-80 lg:h-full min-h-[320px]">
              <iframe
                title="DogTown Hotel & Spa ubicación"
                src="https://maps.google.com/maps?q=Dogtown+Hotel+Spa+Puerto+Yavaros+40+Miramar+Zapopan+Jalisco+Mexico&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
