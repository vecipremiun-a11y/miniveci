import { foldSearchText } from "./search-text";

/**
 * Slug para URLs a partir de un nombre.
 *
 * Las tildes se quitan y la ñ pasa a n ANTES de reemplazar lo que no es a-z0-9.
 * Hacerlo al revés era el bug: "Estantería" quedaba como `estanter-a` y
 * "Pan de Canapé" como `pan-de-canap-`, y así la tienda terminó con categorías
 * duplicadas (`estanteria` vacía y `estanter-a` con 514 productos).
 */
export function slugify(name: string): string {
    return foldSearchText(name)
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}
