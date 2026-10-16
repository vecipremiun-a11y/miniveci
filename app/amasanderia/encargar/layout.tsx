import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

// Formulario del encargo: la página que se posiciona es /amasanderia.
export const metadata: Metadata = {
    ...NOINDEX_METADATA,
    title: 'Encargar a la amasandería',
    alternates: {},
};

export default function EncargarLayout({ children }: { children: React.ReactNode }) {
    return children;
}
