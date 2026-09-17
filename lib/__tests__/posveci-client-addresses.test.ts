import { describe, it, expect } from "vitest";
import { buildClientAddresses, type AddressBookRow } from "../posveci-publisher";

const CUSTOMER_ID = "cus_123";

const NO_LEGACY = { address: null, comuna: null, city: null, addressNotes: null };

function row(overrides: Partial<AddressBookRow> & { id: string }): AddressBookRow {
    return {
        label: "Casa",
        address: "Videla 1430",
        comuna: "La Cisterna",
        city: "Santiago",
        addressNotes: null,
        isDefault: false,
        ...overrides,
    };
}

describe("buildClientAddresses", () => {
    it("manda la libreta completa, no solo la principal", () => {
        const { addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", isDefault: true }),
            row({ id: "a2", label: "Trabajo", address: "Moneda 920", comuna: "Santiago" }),
        ], NO_LEGACY);

        expect(addresses?.map((a) => a.external_address_id)).toEqual(["a1", "a2"]);
    });

    it("usa la predeterminada de la libreta como address de una línea", () => {
        const { address, addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", address: "Moneda 920", comuna: "Santiago" }),
            row({ id: "a2", isDefault: true }),
        ], NO_LEGACY);

        expect(address).toBe("Videla 1430, La Cisterna");
        expect(addresses?.find((a) => a.is_default)?.external_address_id).toBe("a2");
    });

    it("mapea label/comuna/ciudad/notes con los nombres que espera POSVECI", () => {
        const { addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", isDefault: true, addressNotes: "Portón negro" }),
        ], NO_LEGACY);

        expect(addresses?.[0]).toEqual({
            external_address_id: "a1",
            label: "Casa",
            address: "Videla 1430",
            comuna: "La Cisterna",
            ciudad: "Santiago",
            notes: "Portón negro",
            is_default: true,
        });
    });

    it("si ninguna está marcada, la primera es la principal", () => {
        const { address, addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", address: "Moneda 920", comuna: "Santiago" }),
            row({ id: "a2" }),
        ], NO_LEGACY);

        expect(address).toBe("Moneda 920, Santiago");
        expect(addresses?.map((a) => a.is_default)).toEqual([true, false]);
    });

    it("marca exactamente una principal aunque la libreta traiga varias", () => {
        const { addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", isDefault: true }),
            row({ id: "a2", isDefault: true }),
        ], NO_LEGACY);

        expect(addresses?.filter((a) => a.is_default)).toHaveLength(1);
    });

    it("sin libreta pero con dirección legacy, manda esa sola como principal", () => {
        const { address, addresses } = buildClientAddresses(CUSTOMER_ID, [], {
            address: "Videla 1430",
            comuna: "La Cisterna",
            city: "Santiago",
            addressNotes: "Portón negro",
        });

        expect(address).toBe("Videla 1430, La Cisterna");
        expect(addresses).toEqual([{
            external_address_id: `legacy:${CUSTOMER_ID}`,
            label: "Casa",
            address: "Videla 1430",
            comuna: "La Cisterna",
            ciudad: "Santiago",
            notes: "Portón negro",
            is_default: true,
        }]);
    });

    it("sin libreta y sin legacy, omite addresses (≠ lista vacía)", () => {
        const result = buildClientAddresses(CUSTOMER_ID, [], NO_LEGACY);

        expect(result.address).toBeNull();
        expect(result.addresses).toBeUndefined();
        expect("addresses" in result).toBe(false);
    });

    it("trata los strings en blanco como ausentes", () => {
        const { addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", isDefault: true, label: "  ", comuna: "  ", city: "", addressNotes: "   " }),
        ], NO_LEGACY);

        expect(addresses?.[0]).toMatchObject({
            label: "Casa",
            comuna: null,
            ciudad: null,
            notes: null,
        });
    });

    it("la dirección de una línea omite la comuna cuando no hay", () => {
        const { address } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", isDefault: true, comuna: null }),
        ], NO_LEGACY);

        expect(address).toBe("Videla 1430");
    });

    it("la libreta gana sobre la dirección legacy del perfil", () => {
        const { address, addresses } = buildClientAddresses(CUSTOMER_ID, [
            row({ id: "a1", isDefault: true, address: "Moneda 920", comuna: "Santiago" }),
        ], { address: "Videla 1430", comuna: "La Cisterna", city: "Santiago", addressNotes: null });

        expect(address).toBe("Moneda 920, Santiago");
        expect(addresses).toHaveLength(1);
        expect(addresses?.[0].external_address_id).toBe("a1");
    });
});
