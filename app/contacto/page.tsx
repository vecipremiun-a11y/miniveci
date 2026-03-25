'use client';

import { MapPin, Phone, Mail, Clock, Send, MessageCircle, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Footer } from '@/components/Footer';

export default function ContactoPage() {
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [sent, setSent] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = encodeURIComponent(`Hola MiniVeci! Soy ${formData.name}.\n\nAsunto: ${formData.subject}\n\n${formData.message}\n\nCorreo: ${formData.email}`);
        window.open(`https://wa.me/56951892258?text=${text}`, '_blank');
        setSent(true);
        setTimeout(() => setSent(false), 4000);
    };

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">
            {/* Spacer */}
            <div className="h-36 md:h-44" />

            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-extrabold px-5 py-2.5 mb-6 shadow-lg shadow-purple-200/50">
                        <Sparkles className="w-4 h-4" />
                        Estamos para ti
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-veci-dark leading-tight">
                        Contáctanos
                    </h1>
                    <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                        ¿Tienes preguntas, sugerencias o necesitas ayuda? Estamos disponibles para ti todos los días. ¡Escríbenos!
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
                    {/* Location Card */}
                    <div className="group rounded-3xl border border-white bg-white/60 backdrop-blur-md p-6 shadow-lg shadow-purple-100/30 hover:shadow-xl hover:shadow-purple-200/40 transition-all hover:-translate-y-1">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center mb-4 shadow-md shadow-rose-200/50 group-hover:scale-110 transition-transform">
                            <MapPin className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-lg mb-1">Dirección</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">Sotomayor N°1460-A, Iquique</p>
                    </div>

                    {/* WhatsApp Card */}
                    <a
                        href="https://wa.me/56951892258"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-3xl border border-white bg-white/60 backdrop-blur-md p-6 shadow-lg shadow-green-100/30 hover:shadow-xl hover:shadow-green-200/40 transition-all hover:-translate-y-1 cursor-pointer"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-4 shadow-md shadow-green-200/50 group-hover:scale-110 transition-transform">
                            <Phone className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-lg mb-1">WhatsApp</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">+56 9 5189 2258</p>
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-green-600">
                            Escríbenos <ChevronRight className="w-3 h-3" />
                        </span>
                    </a>

                    {/* Email Card */}
                    <a
                        href="mailto:Cliente@miniveci.cl"
                        className="group rounded-3xl border border-white bg-white/60 backdrop-blur-md p-6 shadow-lg shadow-blue-100/30 hover:shadow-xl hover:shadow-blue-200/40 transition-all hover:-translate-y-1 cursor-pointer"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-4 shadow-md shadow-blue-200/50 group-hover:scale-110 transition-transform">
                            <Mail className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-lg mb-1">Correo</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">Cliente@miniveci.cl</p>
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-blue-600">
                            Enviar correo <ChevronRight className="w-3 h-3" />
                        </span>
                    </a>

                    {/* Schedule Card */}
                    <div className="group rounded-3xl border border-white bg-white/60 backdrop-blur-md p-6 shadow-lg shadow-amber-100/30 hover:shadow-xl hover:shadow-amber-200/40 transition-all hover:-translate-y-1">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-md shadow-amber-200/50 group-hover:scale-110 transition-transform">
                            <Clock className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-lg mb-1">Horario</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">7:00 AM - 11:00 PM</p>
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-amber-600">
                            Los 365 días del año
                        </span>
                    </div>
                </div>

                {/* Main Content: Form + Map */}
                <div className="grid lg:grid-cols-5 gap-8">
                    {/* Contact Form */}
                    <div className="lg:col-span-3 rounded-3xl border border-white bg-white/70 backdrop-blur-md p-8 md:p-10 shadow-xl shadow-violet-200/20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
                                <Send className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-800">Envíanos un mensaje</h2>
                                <p className="text-sm text-slate-400">Te respondemos por WhatsApp al instante</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Tu nombre"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 bg-white/80 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">Correo electrónico</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="tu@correo.com"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 bg-white/80 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Asunto</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="¿En qué te podemos ayudar?"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 bg-white/80 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Mensaje</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Escribe tu mensaje aquí..."
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 bg-white/80 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none transition-all resize-none"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold py-3.5 px-8 rounded-full shadow-lg hover:shadow-xl hover:shadow-purple-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    Enviar por WhatsApp
                                </button>
                                {sent && (
                                    <span className="text-sm font-bold text-green-600 animate-pulse">
                                        ✓ Redirigiendo a WhatsApp...
                                    </span>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Map + Info Sidebar */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Map */}
                        <div className="rounded-3xl overflow-hidden border border-white shadow-xl shadow-slate-200/30 flex-1 min-h-[300px]">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3631.5!2d-70.1525!3d-20.2133!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9152efe021d3c9b3%3A0x0!2sSotomayor%201460%2C%20Iquique!5e0!3m2!1ses!2scl!4v1"
                                width="100%"
                                height="100%"
                                style={{ border: 0, minHeight: '300px' }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Ubicación MiniVeci"
                            />
                        </div>

                        {/* WhatsApp CTA */}
                        <a
                            href="https://wa.me/56951892258"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-3xl bg-gradient-to-r from-green-400 to-emerald-500 p-6 text-white shadow-lg shadow-green-200/40 hover:shadow-xl hover:shadow-green-300/50 transition-all hover:-translate-y-0.5 flex items-center gap-4"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                                <MessageCircle className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold">¿Necesitas ayuda rápida?</h3>
                                <p className="text-sm text-white/80 font-medium">Chatea con nosotros por WhatsApp ahora</p>
                            </div>
                            <ChevronRight className="w-6 h-6 ml-auto shrink-0" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="mt-20">
                <Footer />
            </div>
        </main>
    );
}
