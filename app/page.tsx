import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferCarousel } from "@/components/OfferCarousel";
import { ProductShowcase } from "@/components/ProductShowcase";
import { FreshCarousel } from "@/components/FreshCarousel";
import { BakeryCarousel } from "@/components/BakeryCarousel";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen relative bg-white text-hoja font-[family-name:var(--font-geist-sans)] selection:bg-lechuga selection:text-hoja">
      <BannerCarousel />
      <OfferCarousel />
      <ProductShowcase />
      <FreshCarousel />
      <BakeryCarousel />
      <Features />
      <Footer />
    </main>
  );
}
