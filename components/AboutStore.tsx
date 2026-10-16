import { MapPin, Clock, MessageCircle } from 'lucide-react';
import { BRAND_NAME, STORE, STORE_MAPS_URL } from '@/lib/seo';

/**
 * Presentación del local en la portada. Además de orientar al cliente, es el
 * texto que le dice a Google qué es "Minimarket Veci" y dónde está: el resto
 * de la portada son carruseles que se cargan en el navegador.
 */
export function AboutStore() {
    return (
        <section aria-labelledby="sobre-veci" className="px-3 sm:px-6 md:px-12 pb-6 sm:pb-10">
            <div className="max-w-7xl mx-auto rounded-3xl border border-cerco bg-white p-5 sm:p-8 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
                <div>
                    <h2 id="sobre-veci" className="text-xl sm:text-2xl font-extrabold text-hoja">
                        {BRAND_NAME}, tu almacén de barrio en Iquique
                    </h2>
                    <p className="text-sm sm:text-base text-tinta mt-2 leading-relaxed">
                        En <strong className="text-hoja">{BRAND_NAME}</strong> (MiniVeci) encuentras abarrotes, bebidas,
                        pan amasado de nuestra amasandería y verdura fresca. Pásate por el local o pide online y te lo
                        llevamos a tu casa en Iquique y Alto Hospicio.
                    </p>
                </div>

                <address className="not-italic space-y-3 text-sm text-hoja font-semibold">
                    <a
                        href={STORE_MAPS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2.5 hover:underline"
                    >
                        <MapPin className="w-4 h-4 text-tallo shrink-0 mt-0.5" strokeWidth={2.4} />
                        {STORE.streetAddress}, {STORE.city}
                    </a>
                    <p className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-tallo shrink-0 mt-0.5" strokeWidth={2.4} />
                        Abierto de 7:00 a 23:00, todos los días
                    </p>
                    <a
                        href={`https://wa.me/${STORE.phone.replace('+', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2.5 hover:underline"
                    >
                        <MessageCircle className="w-4 h-4 text-tallo shrink-0 mt-0.5" strokeWidth={2.4} />
                        WhatsApp {STORE.phoneDisplay}
                    </a>
                </address>
            </div>
        </section>
    );
}
