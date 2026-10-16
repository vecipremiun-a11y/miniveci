import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { BRAND_NAME, DEFAULT_OG_IMAGE } from '@/lib/seo';

/**
 * Imagen que aparece al compartir el sitio por WhatsApp, Facebook, etc., y la
 * que Google puede usar junto al resultado. Se genera una vez en el build.
 */
export const alt = DEFAULT_OG_IMAGE.alt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
    const logo = await readFile(join(process.cwd(), 'public', 'logo veci.png'));
    const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#edf7dc',
                    borderBottom: '18px solid #4b7a2b',
                    padding: '0 64px',
                    gap: 44,
                }}
            >
                {/* El PNG del logo trae fondo blanco: se presenta como una tarjeta.
                    ImageResponse solo entiende <img>, no next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={logoSrc}
                    width={440}
                    height={440}
                    alt=""
                    style={{ borderRadius: 40, boxShadow: '0 12px 32px rgba(22, 49, 28, 0.16)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', color: '#16311c' }}>
                    <div style={{ fontSize: 66, lineHeight: 1.05 }}>{BRAND_NAME}</div>
                    <div style={{ fontSize: 34, marginTop: 16, color: '#4b7a2b' }}>Tu almacén de barrio en Iquique</div>
                    <div style={{ fontSize: 26, marginTop: 32, color: '#5b6b57' }}>Abarrotes · Amasandería · Verdura fresca</div>
                    <div style={{ fontSize: 26, marginTop: 8, color: '#5b6b57' }}>Delivery a Iquique y Alto Hospicio</div>
                    <div
                        style={{
                            display: 'flex',
                            marginTop: 36,
                            fontSize: 26,
                            color: '#16311c',
                            background: '#a9dc4c',
                            borderRadius: 999,
                            padding: '12px 30px',
                            alignSelf: 'flex-start',
                        }}
                    >
                        www.miniveci.cl
                    </div>
                </div>
            </div>
        ),
        size,
    );
}
