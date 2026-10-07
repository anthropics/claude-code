import Hero from "@/components/Hero";
import About from "@/components/About";
import Spaces from "@/components/Spaces";
import Menu from "@/components/Menu";
import Reservations from "@/components/Reservations";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <Spaces />
      <Menu />
      <Reservations />
      <Contact />
    </>
  );
}
