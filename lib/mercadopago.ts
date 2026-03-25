import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
    console.warn('⚠ MERCADOPAGO_ACCESS_TOKEN no configurado. Los pagos con Mercado Pago no funcionarán.');
}

const client = new MercadoPagoConfig({
    accessToken: accessToken || '',
});

export const mpPreference = new Preference(client);
export const mpPayment = new Payment(client);
export { client as mpClient };
