import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { CategoryCards } from "@/components/CategoryCards";
import { Deals } from "@/components/Deals";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen relative font-[family-name:var(--font-geist-sans)] selection:bg-veci-primary selection:text-white">
      <Navbar />
      <Hero />
      <CategoryCards />
      <Deals />
      <Features />
      <Footer />
    </main>
  );
}
