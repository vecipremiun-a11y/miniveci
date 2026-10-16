import { BRAND_NAME, pageMetadata } from '@/lib/seo';

// La ficha de cada producto (/productos/[slug]) define su propia metadata.
export const metadata = pageMetadata({
    title: 'Productos y ofertas',
    description: `Compra online en ${BRAND_NAME}: abarrotes, bebidas, pan amasado y verdura fresca, con ofertas de la semana y delivery a Iquique y Alto Hospicio.`,
    path: '/productos',
});

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
    return children;
}
