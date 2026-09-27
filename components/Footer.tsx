import Link from 'next/link';
import { Download, Smartphone, Settings, CheckCircle2, MapPin, Clock, Truck } from 'lucide-react';

const TIENDA_LINKS = [
    { href: '/productos', label: 'Tienda' },
    { href: '/amasanderia', label: 'Amasandería' },
    { href: '/suscripcion', label: 'Suscripción' },
    { href: '/sorteos', label: 'Sorteos' },
    { href: '/contacto', label: 'Contacto' },
];

const CUENTA_LINKS = [
    { href: '/cuenta', label: 'Mi cuenta' },
    { href: '/cuenta/pedidos', label: 'Mis pedidos' },
    { href: '/cuenta/direcciones', label: 'Mis direcciones' },
    { href: '/cuenta/favoritos', label: 'Favoritos' },
];

export function Footer() {
    return (
        <footer className="w-full">

            {/* Descarga de la app */}
            <div className="px-4 sm:px-12 py-8">
                <div className="max-w-7xl mx-auto rounded-3xl bg-brote border border-lechuga-viva p-5 sm:p-8 grid md:grid-cols-2 gap-6 items-center">

                    <div className="text-center md:text-left">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-cerco text-tallo text-xs font-bold mb-3">
                            <Smartphone className="w-3.5 h-3.5" /> Solo Android por ahora
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-hoja">Lleva MiniVeci en tu celular</h3>
                        <p className="text-sm text-tinta mt-1.5 mb-4 max-w-md mx-auto md:mx-0">
                            Descarga nuestra app y haz tus pedidos más rápido, con tus direcciones y datos siempre a mano.
                        </p>
                        <a
                            href="/miniveci.apk"
                            download
                            className="inline-flex items-center justify-center gap-2 bg-lechuga hover:bg-lechuga-viva text-hoja px-6 py-3.5 rounded-full font-extrabold shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                            <Download className="w-5 h-5" strokeWidth={2.5} />
                            Descargar app (APK)
                        </a>
                        <p className="text-[11px] text-tinta-clara mt-2.5">
                            Compatible con Android · iOS próximamente
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-cerco p-5 sm:p-6">
                        <p className="font-bold text-hoja mb-4 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-tallo" /> Cómo instalar en 3 pasos
                        </p>
                        <ol className="space-y-3">
                            {[
                                <>Toca <strong>“Descargar app (APK)”</strong> y espera a que termine la descarga.</>,
                                <>Abre el archivo descargado. Si te lo pide, permite <strong>“Instalar apps desconocidas”</strong> para tu navegador.</>,
                                <>Toca <strong>“Instalar”</strong>, abre MiniVeci y ¡listo!</>,
                            ].map((text, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-lechuga text-hoja text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm text-tinta">{text}</p>
                                </li>
                            ))}
                        </ol>
                        <p className="text-[11px] text-tinta-clara mt-4 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-tallo flex-shrink-0" />
                            Descarga segura. Permitir “apps desconocidas” es el paso normal para instalar un APK fuera de Play Store.
                        </p>
                    </div>
                </div>
            </div>

            {/* Pie verde lechuga */}
            <div className="bg-lechuga text-hoja">
                <div className="h-[6px] bg-tallo" />

                <div className="max-w-7xl mx-auto px-4 sm:px-12 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">

                    <div>
                        <div className="flex items-center gap-2.5 mb-4">
                            <img src="/logo%20veci.png" alt="" className="w-11 h-11 object-contain rounded-lg bg-white p-0.5" />
                            <span className="text-lg font-extrabold tracking-tight">MiniVeci</span>
                        </div>
                        <p className="text-sm text-hoja font-medium leading-relaxed">
                            Tu minimarket de barrio, ahora también online. Abarrotes, amasandería y verdura fresca.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-hoja mb-3">Comprar</h4>
                        <ul className="space-y-2">
                            {TIENDA_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-sm text-hoja font-semibold hover:underline transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-hoja mb-3">Mi cuenta</h4>
                        <ul className="space-y-2">
                            {CUENTA_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-sm text-hoja font-semibold hover:underline transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-hoja mb-3">El local</h4>
                        <ul className="space-y-3 text-sm text-hoja font-semibold">
                            <li className="flex items-start gap-2.5">
                                <MapPin className="w-4 h-4 text-hoja shrink-0 mt-0.5" strokeWidth={2.4} />
                                Sotomayor N°1460-A, Iquique
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Clock className="w-4 h-4 text-hoja shrink-0 mt-0.5" strokeWidth={2.4} />
                                7:00 a 23:00 hrs, los 365 días
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Truck className="w-4 h-4 text-hoja shrink-0 mt-0.5" strokeWidth={2.4} />
                                Envíos en Iquique y Alto Hospicio
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-hoja/15">
                    <div className="max-w-7xl mx-auto px-4 sm:px-12 py-4 text-xs text-hoja font-semibold flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                        <span>MiniVeci © 2026 · Todos los derechos reservados.</span>
                        <Link href="/politica-privacidad" className="underline underline-offset-2 hover:no-underline">
                            Política de Privacidad
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
