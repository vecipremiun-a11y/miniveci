import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferCarousel } from "@/components/OfferCarousel";
import { ProductShowcase } from "@/components/ProductShowcase";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen relative font-[family-name:var(--font-geist-sans)] selection:bg-veci-primary selection:text-white">
      <BannerCarousel />
      <OfferCarousel />
      <ProductShowcase />
      <Features />
      <Footer />
    </main>
  );
}
