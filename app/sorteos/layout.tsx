import type { Metadata } from 'next';
import { BRAND_NAME, TITLE_TEMPLATE } from '@/lib/seo';

// Sin canonical: lo heredarían /sorteos/[slug] y /sorteos/temporada.
export const metadata: Metadata = {
    title: { default: 'Sorteos', template: TITLE_TEMPLATE },
    description: `Participa en los sorteos de ${BRAND_NAME} en Iquique.`,
};

export default function SorteosLayout({ children }: { children: React.ReactNode }) {
    return children;
}
