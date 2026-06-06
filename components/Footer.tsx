import { Download, Smartphone, Settings, CheckCircle2 } from 'lucide-react';

export function Footer() {
    return (
        <footer className="w-full py-8 px-4 sm:px-12 bg-white/40 backdrop-blur-md border-t border-white/50">
            <div className="max-w-7xl mx-auto">

                {/* App download band */}
                <div className="rounded-3xl bg-gradient-to-br from-veci-primary/10 via-white/40 to-veci-secondary/10 border border-white/60 p-5 sm:p-8 grid md:grid-cols-2 gap-6 items-center">

                    {/* Left: pitch + download */}
                    <div className="text-center md:text-left">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-3">
                            <Smartphone className="w-3.5 h-3.5" /> Solo Android por ahora
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">Lleva MiniVeci en tu celular</h3>
                        <p className="text-sm text-slate-500 mt-1.5 mb-4 max-w-md mx-auto md:mx-0">
                            Descarga nuestra app y haz tus pedidos más rápido, con tus direcciones y datos siempre a mano.
                        </p>
                        <a
                            href="/miniveci.apk"
                            download
                            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-veci-primary to-veci-secondary text-white px-6 py-3.5 rounded-full font-extrabold shadow-lg shadow-veci-primary/25 hover:shadow-xl hover:shadow-veci-primary/40 hover:scale-[1.03] active:scale-[0.98] transition-all"
                        >
                            <Download className="w-5 h-5" />
                            Descargar app (APK)
                        </a>
                        <p className="text-[11px] text-slate-400 mt-2.5">
                            Compatible con Android · iOS próximamente
                        </p>
                    </div>

                    {/* Right: installation steps */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white p-5 sm:p-6">
                        <p className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-veci-primary" /> Cómo instalar en 3 pasos
                        </p>
                        <ol className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-veci-primary/10 text-veci-primary text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                                <p className="text-sm text-slate-600">Toca <strong>“Descargar app (APK)”</strong> y espera a que termine la descarga.</p>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-veci-primary/10 text-veci-primary text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                                <p className="text-sm text-slate-600">Abre el archivo descargado. Si te lo pide, permite <strong>“Instalar apps desconocidas”</strong> para tu navegador.</p>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-veci-primary/10 text-veci-primary text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                                <p className="text-sm text-slate-600">Toca <strong>“Instalar”</strong>, abre MiniVeci y ¡listo!</p>
                            </li>
                        </ol>
                        <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            Descarga segura. Permitir “apps desconocidas” es el paso normal para instalar un APK fuera de Play Store.
                        </p>
                    </div>
                </div>

                {/* Bottom row: socials + copyright */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">f</div>
                        <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center">📷</div>
                        <div className="w-8 h-8 rounded-full bg-sky-400 text-white flex items-center justify-center">🐦</div>
                        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">💬</div>
                    </div>
                    <div className="text-xs text-slate-400">
                        MiniVeci © 2026 - Todos los derechos reservados.
                    </div>
                </div>
            </div>
        </footer>
    );
}
