import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = { ...NOINDEX_METADATA, title: 'Finalizar compra' };

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
    return children;
}
