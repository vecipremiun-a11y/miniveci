import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = { ...NOINDEX_METADATA, title: 'Iniciar sesión' };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
