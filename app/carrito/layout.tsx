import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = { ...NOINDEX_METADATA, title: 'Carrito' };

export default function CarritoLayout({ children }: { children: React.ReactNode }) {
    return children;
}
