import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = { ...NOINDEX_METADATA, title: 'Pago' };

export default function PagoAppLayout({ children }: { children: React.ReactNode }) {
    return children;
}
