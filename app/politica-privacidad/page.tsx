import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';

/**
 * Política de Privacidad de MiniVeci (web + app Android).
 *
 * El contenido está escrito a partir de lo que el código hace hoy (web Next.js,
 * API, base de datos y la app Flutter). Si se agrega una funcionalidad que toque
 * datos personales (analytics, ubicación, un proveedor nuevo…), hay que
 * actualizar esta página y la fecha de LAST_UPDATED, y revisar la declaración de
 * "Seguridad de los datos" en Google Play Console.
 *
 * Es una página pública y estática: no depende de sesión.
 */

const LAST_UPDATED = '28 de septiembre de 2026';
const CONTACT_EMAIL = 'cliente@miniveci.cl';
const WHATSAPP_DISPLAY = '+56 9 5189 2258';
const WHATSAPP_URL = 'https://wa.me/56951892258';
const CANONICAL = 'https://www.miniveci.cl/politica-privacidad';

export const metadata: Metadata = {
    title: 'Política de Privacidad | MiniVeci',
    description:
        'Cómo MiniVeci recopila, usa, comparte y protege tus datos personales en su tienda web y en su app Android, y cómo pedir la eliminación de tu cuenta.',
    alternates: { canonical: CANONICAL },
    robots: { index: true, follow: true },
    openGraph: {
        title: 'Política de Privacidad | MiniVeci',
        description: 'Cómo MiniVeci trata tus datos personales en la tienda web y en la app.',
        url: CANONICAL,
        siteName: 'MiniVeci',
        locale: 'es_CL',
        type: 'article',
    },
};

const SECTIONS = [
    { id: 'introduccion', title: 'Introducción' },
    { id: 'responsable', title: 'Responsable del tratamiento' },
    { id: 'datos', title: 'Datos que recopilamos' },
    { id: 'como-recopilamos', title: 'Cómo recopilamos los datos' },
    { id: 'para-que', title: 'Para qué usamos los datos' },
    { id: 'pedidos', title: 'Pedidos, entregas y pagos' },
    { id: 'cuenta', title: 'Tu cuenta' },
    { id: 'comunicaciones', title: 'Comunicaciones y notificaciones' },
    { id: 'cookies', title: 'Cookies y almacenamiento en tu dispositivo' },
    { id: 'tecnica', title: 'Información técnica y de uso' },
    { id: 'terceros', title: 'Con quién compartimos datos' },
    { id: 'transferencias', title: 'Almacenamiento fuera de Chile' },
    { id: 'seguridad', title: 'Cómo protegemos la información' },
    { id: 'conservacion', title: 'Cuánto tiempo guardamos los datos' },
    { id: 'eliminar-cuenta', title: 'Eliminar tu cuenta y tus datos' },
    { id: 'derechos', title: 'Tus derechos' },
    { id: 'menores', title: 'Menores de edad' },
    { id: 'cambios', title: 'Cambios a esta política' },
    { id: 'contacto', title: 'Contacto' },
];

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-papel text-hoja">
            <div className="h-36 md:h-44" aria-hidden="true" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pb-16">
                {/* Encabezado */}
                <header className="feria-card rounded-3xl p-6 sm:p-10 mb-6 sm:mb-8">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brote border border-lechuga-viva text-tallo text-xs font-bold mb-4">
                        <ShieldCheck className="w-3.5 h-3.5" /> Privacidad
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Política de Privacidad</h1>
                    <p className="mt-3 text-tinta text-sm sm:text-base max-w-3xl leading-relaxed">
                        Esta política explica qué datos personales trata MiniVeci en su tienda web{' '}
                        <a href="https://www.miniveci.cl" className="font-semibold text-tallo underline underline-offset-2">www.miniveci.cl</a>{' '}
                        y en su aplicación para Android, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos,
                        incluida la eliminación de tu cuenta.
                    </p>
                    <p className="mt-4 text-xs font-semibold text-tinta-clara">Última actualización: {LAST_UPDATED}</p>
                </header>

                <div className="grid lg:grid-cols-[260px_1fr] gap-6 lg:gap-8 items-start">
                    {/* Índice */}
                    <nav aria-label="Contenido" className="min-w-0 feria-card rounded-2xl p-5 lg:sticky lg:top-[calc(10rem+var(--promo-h,0px))]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-tallo mb-3">Contenido</p>
                        <ol className="space-y-1.5 text-sm">
                            {SECTIONS.map((s, i) => (
                                <li key={s.id}>
                                    <a href={`#${s.id}`} className="flex gap-2 text-tinta hover:text-hoja hover:underline underline-offset-2">
                                        <span className="tabular-nums text-tinta-clara w-5 shrink-0">{i + 1}.</span>
                                        <span>{s.title}</span>
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    {/* Contenido */}
                    <article className="min-w-0 feria-card rounded-2xl p-5 sm:p-10 space-y-10 text-[15px] leading-relaxed text-tinta">
                        <Section id="introduccion" n={1} title="Introducción">
                            <p>
                                MiniVeci es la tienda online de un minimarket de barrio de Iquique (marca Veci). A través del sitio web
                                y de la app puedes comprar productos, hacer encargos de amasandería, contratar una membresía,
                                participar en sorteos y conversar con nuestro equipo de atención.
                            </p>
                            <p>
                                Para eso necesitamos tratar algunos datos personales. Solo recopilamos los que hacen falta para
                                prestar el servicio. <strong className="text-hoja">No vendemos tus datos personales</strong>, no los
                                usamos para publicidad personalizada y no usamos herramientas de publicidad ni de analítica de terceros
                                (como Google Analytics o píxeles de redes sociales).
                            </p>
                            <p>
                                Tratamos tus datos conforme a la Ley N° 19.628 sobre Protección de la Vida Privada de Chile y a la
                                normativa que la modifique o reemplace.
                            </p>
                        </Section>

                        <Section id="responsable" n={2} title="Responsable del tratamiento">
                            <p>El responsable de tus datos personales es MiniVeci (marca Veci), con domicilio en:</p>
                            <ul className="list-none space-y-1 pl-0">
                                <li><strong className="text-hoja">Dirección:</strong> Sotomayor N°1460-A, Iquique, Región de Tarapacá, Chile</li>
                                <li><strong className="text-hoja">Correo:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="text-tallo font-semibold underline underline-offset-2">{CONTACT_EMAIL}</a></li>
                                <li><strong className="text-hoja">WhatsApp:</strong> <a href={WHATSAPP_URL} className="text-tallo font-semibold underline underline-offset-2">{WHATSAPP_DISPLAY}</a></li>
                            </ul>
                        </Section>

                        <Section id="datos" n={3} title="Datos que recopilamos">
                            <p>Según cómo uses MiniVeci, podemos tratar los siguientes datos:</p>

                            <H3>Datos de cuenta y de contacto</H3>
                            <ul>
                                <li>Nombre y apellido.</li>
                                <li>Correo electrónico.</li>
                                <li>Número de teléfono.</li>
                                <li>RUT, solo si decides entregarlo (es opcional al registrarte y en el checkout).</li>
                                <li>
                                    Contraseña, que guardamos cifrada (con un hash irreversible); nadie de nuestro equipo puede verla.
                                    Si entras con Google no usamos contraseña.
                                </li>
                                <li>Foto de perfil, solo si decides subir una (o la de tu cuenta de Google, si entras con Google).</li>
                            </ul>

                            <H3>Direcciones de entrega</H3>
                            <ul>
                                <li>
                                    Las direcciones que guardas en tu libreta o escribes en un pedido: calle y número, comuna, ciudad e
                                    indicaciones de entrega (por ejemplo, número de departamento).
                                </li>
                            </ul>

                            <H3>Pedidos, encargos, membresía y sorteos</H3>
                            <ul>
                                <li>Productos comprados, cantidades, precios, totales, descuentos y costo de envío.</li>
                                <li>Tipo de entrega (despacho o retiro), fecha y rango horario elegidos, y notas que agregues.</li>
                                <li>Método de pago elegido y estado del pago.</li>
                                <li>
                                    Comprobantes de transferencia bancaria, si pagas por transferencia y subes una imagen del comprobante.
                                </li>
                                <li>Historial y estado de tus pedidos y encargos de amasandería.</li>
                                <li>Datos de tu membresía (plan, fechas, pagos) si la contratas.</li>
                                <li>
                                    Números de sorteos en los que participas y los datos de inscripción que se pidan (nombre, correo,
                                    teléfono, dirección y, en algunos sorteos presenciales, RUT y número de boleta).
                                </li>
                            </ul>

                            <H3>Chat de atención</H3>
                            <ul>
                                <li>
                                    Los mensajes que envías en el chat de soporte y los archivos que adjuntes (imágenes o PDF). Si
                                    escribes sin iniciar sesión, también el nombre que ingreses.
                                </li>
                            </ul>

                            <H3>Datos técnicos</H3>
                            <ul>
                                <li>
                                    En el sitio web: dirección IP, ubicación aproximada derivada de la IP (país, región y ciudad), tipo
                                    de dispositivo, navegador y sistema operativo, páginas visitadas y página de origen. Ver la sección{' '}
                                    <a href="#tecnica" className="text-tallo font-semibold underline underline-offset-2">Información técnica y de uso</a>.
                                </li>
                                <li>
                                    En la app: un identificador para enviarte notificaciones (token de Firebase Cloud Messaging) y la
                                    plataforma del dispositivo (Android).
                                </li>
                            </ul>

                            <H3>Lo que NO recopilamos</H3>
                            <ul>
                                <li>
                                    <strong className="text-hoja">No usamos tu ubicación GPS ni la del dispositivo.</strong> La dirección
                                    de entrega la escribes tú.
                                </li>
                                <li>No accedemos a tu cámara, micrófono, contactos, calendario ni registros de llamadas o SMS.</li>
                                <li>
                                    No recibimos ni guardamos el número completo de tu tarjeta ni su código de seguridad: los pagos con
                                    tarjeta se hacen directamente en Mercado Pago.
                                </li>
                                <li>No recopilamos datos de salud, biométricos ni otros datos sensibles.</li>
                                <li>No usamos analítica, publicidad ni seguimiento de terceros.</li>
                            </ul>
                        </Section>

                        <Section id="como-recopilamos" n={4} title="Cómo recopilamos los datos">
                            <ul>
                                <li>
                                    <strong className="text-hoja">Directamente de ti:</strong> cuando te registras, completas tu perfil,
                                    guardas direcciones, haces un pedido o encargo, te inscribes en un sorteo, subes un comprobante o foto,
                                    o nos escribes por el chat.
                                </li>
                                <li>
                                    <strong className="text-hoja">De Google, si eliges “Continuar con Google”:</strong> recibimos tu nombre,
                                    correo electrónico (verificado por Google), foto de perfil y un identificador de tu cuenta de Google.
                                    No recibimos tu contraseña de Google.
                                </li>
                                <li>
                                    <strong className="text-hoja">De Mercado Pago:</strong> el resultado de tus pagos (aprobado, pendiente
                                    o rechazado) y su identificador, para confirmar el pedido o la membresía.
                                </li>
                                <li>
                                    <strong className="text-hoja">Automáticamente:</strong> los datos técnicos descritos en la sección{' '}
                                    <a href="#tecnica" className="text-tallo font-semibold underline underline-offset-2">Información técnica y de uso</a>.
                                </li>
                                <li>
                                    <strong className="text-hoja">De nuestro local:</strong> si hiciste un encargo de amasandería en el
                                    local físico con tus datos, podemos vincular ese encargo a tu cuenta cuando la creas con los mismos
                                    datos.
                                </li>
                            </ul>
                        </Section>

                        <Section id="para-que" n={5} title="Para qué usamos los datos">
                            <ul>
                                <li>Crear y administrar tu cuenta, y permitirte iniciar sesión.</li>
                                <li>Procesar, preparar, entregar o tener listos para retiro tus pedidos y encargos.</li>
                                <li>Cobrar tus compras y tu membresía, y verificar los pagos por transferencia.</li>
                                <li>Contactarte sobre tu pedido (por ejemplo, para coordinar la entrega o avisarte de un cambio).</li>
                                <li>Enviarte notificaciones sobre el estado de tus pedidos y los mensajes del chat.</li>
                                <li>Responder tus consultas en el chat de atención.</li>
                                <li>Administrar los sorteos y contactar a los ganadores.</li>
                                <li>Aplicar precios y beneficios que te correspondan (por ejemplo, el precio de socio si tienes membresía).</li>
                                <li>
                                    Proteger el servicio: prevenir fraudes y abusos (por ejemplo, limitar intentos de inicio de sesión) y
                                    mantener la seguridad de las cuentas.
                                </li>
                                <li>Entender de forma general cómo se usa el sitio para mejorar la atención (ver sección 10).</li>
                                <li>Cumplir obligaciones legales, tributarias y contables.</li>
                            </ul>
                            <p>No usamos tus datos para tomar decisiones automatizadas con efectos legales sobre ti ni para crear perfiles publicitarios.</p>
                        </Section>

                        <Section id="pedidos" n={6} title="Pedidos, entregas y pagos">
                            <H3>Pedidos y entregas</H3>
                            <p>
                                Para despachar un pedido usamos tu nombre, teléfono, dirección de entrega, indicaciones y el horario
                                que elegiste. Esta información la ve nuestro equipo de preparación y reparto. Hacemos despachos en
                                Iquique y Alto Hospicio.
                            </p>
                            <p>
                                Los pedidos y los datos del cliente (nombre, correo, teléfono, RUT si lo diste y direcciones) se
                                registran también en <strong className="text-hoja">POSVECI</strong>, el sistema de caja e inventario de
                                nuestro local, para preparar el pedido, descontar stock y reconocerte cuando compras en el local.
                            </p>

                            <H3>Pagos</H3>
                            <ul>
                                <li>
                                    <strong className="text-hoja">Mercado Pago:</strong> si pagas con tarjeta o saldo de Mercado Pago, o
                                    contratas la membresía, te redirigimos a Mercado Pago, que procesa el pago bajo su propia política de
                                    privacidad. Le enviamos el detalle de la compra (productos y montos) y tus datos de pagador (nombre,
                                    correo y teléfono). Los datos de tu tarjeta los ingresas directamente en Mercado Pago; nosotros no los recibimos.
                                </li>
                                <li>
                                    <strong className="text-hoja">Transferencia bancaria:</strong> si subes el comprobante, guardamos la
                                    imagen para verificar el pago.
                                </li>
                                <li>
                                    <strong className="text-hoja">Pago contra entrega:</strong> pagas al recibir el pedido; no tratamos
                                    datos de pago en línea.
                                </li>
                            </ul>
                        </Section>

                        <Section id="cuenta" n={7} title="Tu cuenta">
                            <p>
                                Puedes usar la tienda sin cuenta, pero con una cuenta guardas tus direcciones, ves tu historial de
                                pedidos y encargos, gestionas tu membresía y sorteos, y no tienes que volver a escribir tus datos.
                            </p>
                            <p>
                                Desde “Mi cuenta” puedes ver y actualizar tu nombre, teléfono, RUT y foto, y agregar, editar o borrar
                                direcciones. Si hiciste pedidos como invitado con el mismo correo verificado de tu cuenta de Google, los
                                vinculamos a tu cuenta para que aparezcan en tu historial.
                            </p>
                            <p>
                                Puedes eliminar tu cuenta cuando quieras, tú mismo, desde el sitio web o desde la app (ver{' '}
                                <a href="#eliminar-cuenta" className="text-tallo font-semibold underline underline-offset-2">sección 15</a>).
                            </p>
                        </Section>

                        <Section id="comunicaciones" n={8} title="Comunicaciones y notificaciones">
                            <ul>
                                <li>
                                    <strong className="text-hoja">Notificaciones push (app):</strong> si las permites, te avisamos del
                                    estado de tus pedidos y de las respuestas del chat. Para eso Android te pide el permiso de
                                    notificaciones, y guardamos el token de notificaciones de tu dispositivo asociado a tu cuenta. Puedes
                                    desactivarlas cuando quieras en los ajustes de Android.
                                </li>
                                <li>
                                    <strong className="text-hoja">Notificaciones del navegador (web):</strong> si das permiso, el sitio
                                    puede mostrarte avisos de nuevos mensajes del chat mientras lo tienes abierto.
                                </li>
                                <li>
                                    <strong className="text-hoja">WhatsApp y teléfono:</strong> podemos llamarte o escribirte al número que
                                    nos diste para coordinar un pedido. Si tú nos escribes por WhatsApp, esa conversación también se rige
                                    por las condiciones de WhatsApp.
                                </li>
                                <li>No te enviamos publicidad por correo, SMS ni WhatsApp sin tu consentimiento.</li>
                            </ul>
                        </Section>

                        <Section id="cookies" n={9} title="Cookies y almacenamiento en tu dispositivo">
                            <p>
                                Usamos solo cookies y almacenamiento <strong className="text-hoja">necesarios para que el servicio
                                funcione</strong>. No usamos cookies de publicidad ni de analítica de terceros.
                            </p>
                            <ul>
                                <li>
                                    <strong className="text-hoja">Cookies de sesión:</strong> mantienen tu sesión iniciada de forma segura
                                    (duran hasta 7 días o hasta que cierras sesión).
                                </li>
                                <li>
                                    <strong className="text-hoja">Almacenamiento local del navegador:</strong> guarda tu carrito, los datos
                                    de contacto y dirección de tu último checkout (para no pedírtelos de nuevo en ese navegador) y un
                                    identificador anónimo para el chat de atención y las estadísticas de visitas.
                                </li>
                                <li>
                                    <strong className="text-hoja">En la app:</strong> tus credenciales de sesión se guardan cifradas en el
                                    almacenamiento seguro de Android, y tus preferencias en el almacenamiento local de la app.
                                </li>
                            </ul>
                            <p>
                                Puedes borrar las cookies y el almacenamiento local desde la configuración de tu navegador; si lo
                                haces, se cerrará tu sesión y se vaciará tu carrito.
                            </p>
                        </Section>

                        <Section id="tecnica" n={10} title="Información técnica y de uso">
                            <p>
                                Cuando visitas el sitio web registramos, de forma propia y sin herramientas de terceros, datos técnicos
                                básicos de la visita: dirección IP, ubicación aproximada derivada de la IP (país, región, ciudad y zona
                                horaria, tal como la entrega nuestro proveedor de hosting), tipo de dispositivo, navegador, sistema
                                operativo, páginas visitadas, página de origen y la fecha y hora. Si tienes la sesión iniciada, se
                                asocia a tu cuenta.
                            </p>
                            <p>
                                Lo usamos para ver cuántas personas están usando el sitio, atenderlas mejor por el chat y detectar
                                problemas o abusos. Esta ubicación aproximada no es tu ubicación exacta ni proviene del GPS de tu
                                dispositivo. Este registro se borra automáticamente 7 días después de tu última visita.
                            </p>
                            <p>
                                La app no registra estas estadísticas de visitas. Nuestro proveedor de hosting y los servicios de
                                terceros de la sección siguiente pueden registrar datos técnicos como la IP para operar y proteger
                                su servicio.
                            </p>
                        </Section>

                        <Section id="terceros" n={11} title="Con quién compartimos datos">
                            <p>
                                No vendemos ni arrendamos tus datos personales. Solo los compartimos con estos proveedores, en la medida
                                necesaria para prestar el servicio:
                            </p>
                            <div className="overflow-x-auto -mx-1">
                                <table className="w-full text-sm border-collapse min-w-[520px]">
                                    <thead>
                                        <tr className="text-left text-hoja">
                                            <th className="py-2 px-2 border-b border-cerco font-bold">Proveedor</th>
                                            <th className="py-2 px-2 border-b border-cerco font-bold">Para qué</th>
                                            <th className="py-2 px-2 border-b border-cerco font-bold">Datos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="align-top">
                                        <Row name="Mercado Pago" purpose="Procesar pagos con tarjeta y la membresía." data="Nombre, correo y teléfono del pagador; detalle y monto de la compra." />
                                        <Row name="Google (Inicio de sesión)" purpose="Iniciar sesión con tu cuenta de Google, si lo eliges." data="Nombre, correo, foto e identificador de Google." />
                                        <Row name="Google Maps (Places)" purpose="Sugerir direcciones mientras escribes en el sitio web, y mostrar el mapa de nuestro local en Contacto." data="El texto de la dirección que escribes; datos técnicos de tu navegador." />
                                        <Row name="Firebase Cloud Messaging (Google)" purpose="Enviar notificaciones push a la app." data="Token de notificaciones del dispositivo y el contenido del aviso." />
                                        <Row name="Vercel" purpose="Hosting del sitio y de la API; almacenamiento de imágenes y archivos (fotos de perfil, comprobantes, adjuntos del chat)." data="Datos técnicos de la conexión (IP) y los archivos que subes." />
                                        <Row name="Turso" purpose="Base de datos donde se guarda la información de la tienda." data="Los datos de cuenta, direcciones, pedidos y demás descritos en esta política." />
                                        <Row name="POSVECI" purpose="Sistema de caja e inventario de nuestro local." data="Datos del cliente (nombre, correo, teléfono, RUT, direcciones) y de los pedidos." />
                                    </tbody>
                                </table>
                            </div>
                            <p>
                                Cada proveedor trata los datos según sus propias políticas y solo para prestarnos su servicio.
                                También podemos entregar información cuando lo exija la ley o una autoridad competente.
                            </p>
                        </Section>

                        <Section id="transferencias" n={12} title="Almacenamiento fuera de Chile">
                            <p>
                                Algunos de nuestros proveedores (entre ellos Vercel, Turso y Google) almacenan o procesan datos en
                                servidores ubicados fuera de Chile, principalmente en Estados Unidos. Al usar MiniVeci, tus datos pueden
                                transferirse a esos países, siempre para los fines descritos en esta política y con proveedores que
                                aplican medidas de seguridad adecuadas.
                            </p>
                        </Section>

                        <Section id="seguridad" n={13} title="Cómo protegemos la información">
                            <ul>
                                <li>Toda la comunicación con el sitio y la app viaja cifrada mediante HTTPS.</li>
                                <li>Las contraseñas se guardan cifradas con un hash irreversible.</li>
                                <li>En la app, las credenciales de sesión se guardan en el almacenamiento cifrado de Android.</li>
                                <li>
                                    El acceso al panel de administración está restringido por roles, y cada persona del equipo ve solo lo
                                    que necesita para su labor.
                                </li>
                                <li>Limitamos los intentos de inicio de sesión y de registro para prevenir abusos.</li>
                            </ul>
                            <p>
                                Ningún sistema es 100% seguro. Si detectamos una vulneración que afecte tus datos, te informaremos y
                                tomaremos las medidas que correspondan.
                            </p>
                        </Section>

                        <Section id="conservacion" n={14} title="Cuánto tiempo guardamos los datos">
                            <ul>
                                <li>
                                    <strong className="text-hoja">Datos de la cuenta y direcciones:</strong> mientras tu cuenta esté activa
                                    o hasta que pidas eliminarla.
                                </li>
                                <li>
                                    <strong className="text-hoja">Pedidos, pagos y comprobantes:</strong> durante el tiempo que exijan las
                                    obligaciones tributarias y contables aplicables en Chile, y el necesario para atender reclamos o
                                    garantías. Si eliminas tu cuenta, se conservan sin tus datos personales.
                                </li>
                                <li>
                                    <strong className="text-hoja">Mensajes del chat:</strong> mientras sean necesarios para atender tus
                                    consultas y darles seguimiento, o hasta que pidas eliminarlos junto con tu cuenta.
                                </li>
                                <li>
                                    <strong className="text-hoja">Token de notificaciones:</strong> mientras tengas la app instalada con tu
                                    sesión iniciada; se elimina al eliminar tu cuenta.
                                </li>
                                <li>
                                    <strong className="text-hoja">Datos técnicos de visitas:</strong> se borran automáticamente 7 días
                                    después de tu última visita.
                                </li>
                            </ul>
                        </Section>

                        <Section id="eliminar-cuenta" n={15} title="Eliminar tu cuenta y tus datos">
                            <div className="rounded-2xl bg-brote border border-lechuga-viva p-5 sm:p-6 text-hoja">
                                <p className="font-bold text-base">Cómo eliminar tu cuenta de MiniVeci</p>
                                <p className="mt-2 text-sm">
                                    Es la misma cuenta en la tienda web y en la app MiniVeci para Android. Puedes eliminarla tú mismo,
                                    en cualquier momento:
                                </p>
                                <ul className="mt-3 space-y-2 text-sm list-disc pl-5">
                                    <li>
                                        <strong>En la app:</strong> Mi cuenta → <strong>Eliminar mi cuenta</strong>, escribe ELIMINAR
                                        para confirmar.
                                    </li>
                                    <li>
                                        <strong>En el sitio web:</strong> inicia sesión y entra a{' '}
                                        <Link href="/cuenta/ajustes" className="font-bold underline underline-offset-2">Mi cuenta → Ajustes</Link>{' '}
                                        → <strong>Eliminar mi cuenta</strong>.
                                    </li>
                                    <li>
                                        <strong>Si no puedes entrar a tu cuenta:</strong> escríbenos a{' '}
                                        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Eliminar mi cuenta MiniVeci')}`} className="font-bold underline underline-offset-2">{CONTACT_EMAIL}</a>{' '}
                                        con el asunto “Eliminar mi cuenta MiniVeci”, desde el correo de tu cuenta, o por WhatsApp al{' '}
                                        <a href={WHATSAPP_URL} className="font-bold underline underline-offset-2">{WHATSAPP_DISPLAY}</a>.
                                        Podemos pedirte confirmar que eres el titular, y la eliminaremos dentro de un plazo máximo de 30 días.
                                    </li>
                                </ul>
                                <p className="mt-3 text-sm">
                                    Si tienes un pedido o encargo en curso, podrás eliminar la cuenta cuando se entregue o se cancele.
                                    Si tienes una membresía activa, primero debes cancelarla para que Mercado Pago no te siga cobrando.
                                </p>
                            </div>
                            <H3>Qué se elimina de inmediato</H3>
                            <ul>
                                <li>Tu cuenta y tu perfil (nombre, correo, teléfono, RUT y foto).</li>
                                <li>Tus direcciones guardadas.</li>
                                <li>Los tokens de notificaciones y las sesiones abiertas en la app.</li>
                                <li>Tus conversaciones del chat de atención y sus archivos adjuntos.</li>
                                <li>Tus registros de visitas al sitio.</li>
                                <li>
                                    En el sistema de caja del local (POSVECI): tu nombre y tus direcciones. Tu correo, teléfono y RUT
                                    se borran de ese sistema dentro de un plazo máximo de 30 días.
                                </li>
                            </ul>
                            <H3>Qué se conserva, sin tus datos personales</H3>
                            <p>
                                Los registros de tus pedidos, encargos y pagos (productos, montos y fechas) se conservan por
                                obligaciones tributarias y contables, pero se les quita tu nombre, correo, teléfono, RUT y dirección.
                                Lo mismo ocurre con tus números en sorteos ya realizados. Los pagos procesados por Mercado Pago quedan
                                además registrados en Mercado Pago según su propia política.
                            </p>
                            <p>
                                También puedes borrar solo algunos datos (por ejemplo, una dirección o tu foto) sin eliminar tu
                                cuenta, desde “Mi cuenta”, o pedírnoslo por correo.
                            </p>
                        </Section>

                        <Section id="derechos" n={16} title="Tus derechos">
                            <p>Como titular de tus datos puedes, en cualquier momento y sin costo:</p>
                            <ul>
                                <li><strong className="text-hoja">Acceder</strong> a los datos personales que tenemos sobre ti.</li>
                                <li><strong className="text-hoja">Rectificar</strong> los que estén incorrectos o incompletos.</li>
                                <li><strong className="text-hoja">Eliminar</strong> tus datos o tu cuenta (ver sección 15).</li>
                                <li><strong className="text-hoja">Oponerte</strong> a un tratamiento o pedir que lo limitemos.</li>
                                <li><strong className="text-hoja">Pedir una copia</strong> de tus datos en un formato de uso común.</li>
                                <li><strong className="text-hoja">Retirar tu consentimiento</strong>, por ejemplo desactivando las notificaciones.</li>
                            </ul>
                            <p>
                                Para ejercerlos escríbenos a{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="text-tallo font-semibold underline underline-offset-2">{CONTACT_EMAIL}</a>.
                                Te responderemos dentro de los plazos que establece la ley. Si no quedas conforme con nuestra respuesta,
                                puedes recurrir a la autoridad competente en materia de protección de datos personales en Chile.
                            </p>
                        </Section>

                        <Section id="menores" n={17} title="Menores de edad">
                            <p>
                                MiniVeci está dirigido a personas mayores de 18 años. No recopilamos a sabiendas datos de menores de
                                edad. Si eres padre, madre o tutor y crees que un menor nos entregó sus datos, escríbenos y los
                                eliminaremos.
                            </p>
                        </Section>

                        <Section id="cambios" n={18} title="Cambios a esta política">
                            <p>
                                Podemos actualizar esta política cuando cambien nuestros servicios o la ley. Publicaremos la nueva
                                versión en esta misma página con su fecha de actualización y, si los cambios son importantes, te
                                avisaremos por el sitio o la app.
                            </p>
                        </Section>

                        <Section id="contacto" n={19} title="Contacto">
                            <p>Si tienes preguntas sobre esta política o sobre tus datos, contáctanos:</p>
                            <ul className="list-none space-y-1 pl-0">
                                <li><strong className="text-hoja">Correo:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="text-tallo font-semibold underline underline-offset-2">{CONTACT_EMAIL}</a></li>
                                <li><strong className="text-hoja">WhatsApp:</strong> <a href={WHATSAPP_URL} className="text-tallo font-semibold underline underline-offset-2">{WHATSAPP_DISPLAY}</a></li>
                                <li><strong className="text-hoja">Dirección:</strong> Sotomayor N°1460-A, Iquique, Chile</li>
                                <li><strong className="text-hoja">Formulario:</strong> <Link href="/contacto" className="text-tallo font-semibold underline underline-offset-2">página de Contacto</Link></li>
                            </ul>
                            <p className="text-xs text-tinta-clara pt-2">Última actualización: {LAST_UPDATED}</p>
                        </Section>
                    </article>
                </div>
            </div>

            <Footer />
        </main>
    );
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-[calc(11rem+var(--promo-h,0px))] space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-hoja tracking-tight">
                <span className="text-tallo mr-1.5">{n}.</span>{title}
            </h2>
            {children}
        </section>
    );
}

function H3({ children }: { children: ReactNode }) {
    return <h3 className="text-base font-bold text-hoja pt-2">{children}</h3>;
}

function Row({ name, purpose, data }: { name: string; purpose: string; data: string }) {
    return (
        <tr>
            <td className="py-2.5 px-2 border-b border-cerco-suave font-semibold text-hoja whitespace-nowrap">{name}</td>
            <td className="py-2.5 px-2 border-b border-cerco-suave">{purpose}</td>
            <td className="py-2.5 px-2 border-b border-cerco-suave">{data}</td>
        </tr>
    );
}
