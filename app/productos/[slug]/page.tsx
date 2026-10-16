import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { getProductSeo } from '@/lib/product-seo';
import { BRAND_NAME, formatClp, pageMetadata, productBreadcrumbJsonLd, productJsonLd, truncateText } from '@/lib/seo';
import ProductDetailClient from './ProductDetailClient';

/**
 * La ficha se sigue armando en el cliente (precio y stock en vivo); este
 * envoltorio de servidor solo agrega lo que Google necesita sin ejecutar
 * JavaScript: título, descripción, imagen para compartir, datos estructurados
 * y un 404 real cuando el producto no existe o no está publicado.
 *
 * Se regenera cada 10 minutos, así que el precio del JSON-LD puede ir unos
 * minutos atrás del que se ve en pantalla.
 */
export const revalidate = 600;

// Son miles de productos: ninguno se prerenderiza en el build. Devolver una
// lista vacía (en vez de no exportar la función) hace que cada ficha se genere
// en su primera visita y quede en caché, en lugar de consultar la base en
// cada request.
export function generateStaticParams() {
    return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const path = `/productos/${slug}`;
    const result = await getProductSeo(slug);

    if (result.status === 'not-found') return { title: 'Producto no encontrado', robots: { index: false } };
    if (result.status === 'error') {
        return pageMetadata({ title: 'Producto', description: `Compra online en ${BRAND_NAME}, Iquique.`, path });
    }

    const { product, seoTitle, seoDescription } = result;
    const description =
        seoDescription ||
        `${product.name} a ${formatClp(product.price)} en ${BRAND_NAME}, Iquique. Pide online con delivery a Iquique y Alto Hospicio.`;
    const image = product.images[0];

    return pageMetadata({
        title: seoTitle || product.name,
        description: truncateText(description, 160),
        path,
        images: image ? [{ url: image.url, alt: image.alt }] : undefined,
    });
}

export default async function ProductPage({ params }: Props) {
    const { slug } = await params;
    const result = await getProductSeo(slug);
    if (result.status === 'not-found') notFound();

    return (
        <>
            {result.status === 'found' && result.product.price > 0 && (
                <JsonLd data={[productJsonLd(result.product), productBreadcrumbJsonLd(result.product)]} />
            )}
            <ProductDetailClient />
        </>
    );
}
