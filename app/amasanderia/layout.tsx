import { BakeryCartProvider } from "@/components/bakery-cart/BakeryCartProvider";
import { BakeryCartButton } from "@/components/bakery-cart/BakeryCartButton";
import { BRAND_NAME, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
    title: "Amasandería: pan amasado y encargos",
    description: `Encarga pan amasado, sándwiches y más en la amasandería de ${BRAND_NAME}, Iquique. Retiro en el local o delivery a Iquique y Alto Hospicio.`,
    path: "/amasanderia",
});

export default function AmasanderiaLayout({ children }: { children: React.ReactNode }) {
    return (
        <BakeryCartProvider>
            {children}
            <BakeryCartButton />
        </BakeryCartProvider>
    );
}
