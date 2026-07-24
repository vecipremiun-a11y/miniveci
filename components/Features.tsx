'use client';

import { ShieldCheck, Truck, Leaf } from 'lucide-react';

const FEATURES = [
    {
        icon: Truck,
        title: 'Envíos rápidos',
        text: 'Iquique y Alto Hospicio, el mismo día en compras antes de las 13:00.',
    },
    {
        icon: ShieldCheck,
        title: 'Paga seguro',
        text: 'Webpay, débito y crédito. Tus datos nunca pasan por nosotros.',
    },
    {
        icon: Leaf,
        title: 'Productos de calidad',
        text: 'Las mejores marcas y stock actualizado en vivo desde la caja.',
    },
];

export function Features() {
    return (
        <section className="py-10 sm:py-14 px-3 sm:px-6 md:px-12">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                    <div
                        key={title}
                        className="feria-card rounded-2xl p-4 sm:p-5 flex items-center gap-4"
                    >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brote rounded-xl flex items-center justify-center text-tallo shrink-0">
                            <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-hoja">{title}</h3>
                            <p className="text-tinta text-xs sm:text-sm mt-0.5 leading-snug">{text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
