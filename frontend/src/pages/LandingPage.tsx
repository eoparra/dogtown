import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from './landing/Navbar';
import HeroSection from './landing/HeroSection';
import ServicesSection from './landing/ServicesSection';
import AboutSection from './landing/AboutSection';
import FeaturesSection from './landing/FeaturesSection';
import TestimonialsSection from './landing/TestimonialsSection';
import ContactSection from './landing/ContactSection';
import Footer from './landing/Footer';
import LoginModal from './landing/LoginModal';

export default function LandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setLoginOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="font-body text-dogtown-brown">
      <Navbar onLoginClick={() => setLoginOpen(true)} />
      <HeroSection />
      <ServicesSection />
      <AboutSection />
      <FeaturesSection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
