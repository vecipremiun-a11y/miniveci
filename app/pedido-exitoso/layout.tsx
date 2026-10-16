import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = { ...NOINDEX_METADATA, title: 'Pedido recibido' };

export default function PedidoExitosoLayout({ children }: { children: React.ReactNode }) {
    return children;
}
