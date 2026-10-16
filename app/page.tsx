import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferCarousel } from "@/components/OfferCarousel";
import { ProductShowcase } from "@/components/ProductShowcase";
import { FreshCarousel } from "@/components/FreshCarousel";
import { BakeryCarousel } from "@/components/BakeryCarousel";
import { Features } from "@/components/Features";
import { AboutStore } from "@/components/AboutStore";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { BRAND_NAME, HOME_DESCRIPTION, HOME_TITLE, pageMetadata, storeJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  path: "/",
});

export default function Home() {
  return (
    <main className="min-h-screen relative bg-white text-hoja font-[family-name:var(--font-geist-sans)] selection:bg-lechuga selection:text-hoja">
      <JsonLd data={[storeJsonLd(), websiteJsonLd()]} />
      {/* La portada abre con el carrusel de banners, que no tiene texto propio. */}
      <h1 className="sr-only">{BRAND_NAME}: almacén de barrio en Iquique con delivery a Iquique y Alto Hospicio</h1>
      <BannerCarousel />
      <OfferCarousel />
      <ProductShowcase />
      <FreshCarousel />
      <BakeryCarousel />
      <Features />
      <AboutStore />
      <Footer />
    </main>
  );
}
