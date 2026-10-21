import { describe, expect, it } from "vitest";
import { deliveryFeeFor, findDeliveryZone, parseDeliveryZoneFees } from "../delivery-zones";

const ZONES = [{ comuna: "Alto Hospicio", fee: 3000 }];
const BASE = 1500;

describe("deliveryFeeFor", () => {
    it("Iquique paga la tarifa base y Alto Hospicio la suya", () => {
        expect(deliveryFeeFor(BASE, ZONES, { comuna: "Iquique", city: "Iquique", address: "Sotomayor 1460" })).toBe(1500);
        expect(deliveryFeeFor(BASE, ZONES, { comuna: "Alto Hospicio", city: "Iquique", address: "Calle Italia 58" })).toBe(3000);
    });

    it("no le importan tildes, mayúsculas ni espacios", () => {
        expect(deliveryFeeFor(BASE, ZONES, { comuna: "  ALTO  HOSPICIO " })).toBe(3000);
        expect(deliveryFeeFor(BASE, [{ comuna: "Pozo Almonte", fee: 5000 }], { comuna: "pozo almónte" })).toBe(5000);
    });

    it("la comuna elegida manda sobre el texto de la dirección", () => {
        expect(deliveryFeeFor(BASE, ZONES, { comuna: "Iquique", address: "Pasaje Alto Hospicio 12" })).toBe(1500);
    });

    it("sin comuna (app móvil) reconoce la zona en la ciudad o en la dirección", () => {
        expect(deliveryFeeFor(BASE, ZONES, { city: "Alto Hospicio", address: "Los Aromos 33" })).toBe(3000);
        expect(deliveryFeeFor(BASE, ZONES, { address: "Los Aromos 33, Alto Hospicio, Tarapacá" })).toBe(3000);
        expect(deliveryFeeFor(BASE, ZONES, { address: "Sotomayor 1460, Iquique" })).toBe(1500);
    });

    it("solo calza la palabra completa", () => {
        expect(findDeliveryZone([{ comuna: "Pica", fee: 8000 }], { address: "Picarte 120, Iquique" })).toBeNull();
    });

    it("sin dirección ni zonas va la tarifa base", () => {
        expect(deliveryFeeFor(BASE, ZONES, {})).toBe(1500);
        expect(deliveryFeeFor(BASE, [], { comuna: "Alto Hospicio" })).toBe(1500);
    });
});

describe("parseDeliveryZoneFees", () => {
    it("null cuando nunca se guardó o el JSON está roto", () => {
        expect(parseDeliveryZoneFees(undefined)).toBeNull();
        expect(parseDeliveryZoneFees("{no")).toBeNull();
        expect(parseDeliveryZoneFees('{"comuna":"x"}')).toBeNull();
    });

    it("[] guardado significa sin zonas", () => {
        expect(parseDeliveryZoneFees("[]")).toEqual([]);
    });

    it("descarta entradas inválidas y comunas repetidas", () => {
        const raw = JSON.stringify([
            { comuna: "Alto Hospicio", fee: 3000 },
            { comuna: "alto hospicio", fee: 9999 },
            { comuna: "", fee: 1000 },
            { comuna: "Pica", fee: -5 },
            { comuna: "Huara", fee: 4500.5 },
            { comuna: " Pozo Almonte ", fee: 5000 },
        ]);
        expect(parseDeliveryZoneFees(raw)).toEqual([
            { comuna: "Alto Hospicio", fee: 3000 },
            { comuna: "Pozo Almonte", fee: 5000 },
        ]);
    });
});
