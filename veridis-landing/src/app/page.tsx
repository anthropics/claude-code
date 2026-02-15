import {
  Navigation,
  Hero,
  LogoCloud,
  CodeDemo,
  Features,
  HowItWorks,
  Stats,
  Pricing,
  Testimonials,
  CTA,
  Footer,
} from "@/components/sections";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <LogoCloud />
        <Features />
        <HowItWorks />
        <CodeDemo />
        <Stats />
        <Pricing />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
