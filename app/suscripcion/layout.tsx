import { BRAND_NAME, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'Suscripción',
    description: `Hazte miembro de ${BRAND_NAME}: descuentos en tus compras, productos especiales y sorteos exclusivos para miembros.`,
    path: '/suscripcion',
});

export default function SuscripcionLayout({ children }: { children: React.ReactNode }) {
    return children;
}
