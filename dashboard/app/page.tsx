import { Hero } from '@/components/landing/Hero';
import { SocialProof } from '@/components/landing/SocialProof';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Pricing } from '@/components/landing/Pricing';
import { Comparison } from '@/components/landing/Comparison';
import { FAQ } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="bg-[#0F172A]">
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Pricing />
      <Comparison />
      <FAQ />
      <Footer />
    </div>
  );
}
