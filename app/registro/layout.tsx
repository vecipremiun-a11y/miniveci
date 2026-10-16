import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = { ...NOINDEX_METADATA, title: 'Crear cuenta' };

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
    return children;
}
