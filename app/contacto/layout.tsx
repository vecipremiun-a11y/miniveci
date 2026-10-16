import { BRAND_NAME, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'Contacto y ubicación',
    description: `Escríbenos por WhatsApp o visítanos en Sotomayor 1460-A, Iquique. ${BRAND_NAME} abre de 7:00 a 23:00 todos los días.`,
    path: '/contacto',
});

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
    return children;
}
