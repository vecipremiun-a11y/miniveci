import { BakeryCartProvider } from "@/components/bakery-cart/BakeryCartProvider";
import { BakeryCartButton } from "@/components/bakery-cart/BakeryCartButton";

export const metadata = {
    title: "Amasandería | MiniVeci",
    description: "Encarga panes, sándwiches y más para retiro o delivery.",
};

export default function AmasanderiaLayout({ children }: { children: React.ReactNode }) {
    return (
        <BakeryCartProvider>
            {children}
            <BakeryCartButton />
        </BakeryCartProvider>
    );
}
