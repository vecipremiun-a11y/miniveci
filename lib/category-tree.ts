// Árbol de categorías: categoría → subcategoría → categoría hija, tal como lo
// maneja POSVECI. Sin dependencias de servidor para que lo usen la API y la web.
//
// Reglas de defensa (los datos vienen de otro sistema y no siempre son sanos):
// una hija cuyo padre no existe igual aparece, y un ciclo padre→hija→padre no
// puede colgar el navegador ni hacer desaparecer categorías.

export interface FlatCategory {
    id: string;
    name: string;
    parentId: string | null;
    sortOrder?: number | null;
}

export type TreeCategory<T extends FlatCategory> = T & {
    /** 0 = primer nivel, 1 = subcategoría, 2 = hija de la subcategoría… */
    level: number;
    /** Nombres desde la raíz hasta esta categoría */
    path: string[];
};

/** Padre válido: existe, y no es la categoría misma. Si no, se trata como raíz. */
function effectiveParentId(category: FlatCategory, byId: Map<string, FlatCategory>): string | null {
    const parentId = category.parentId;
    if (!parentId || parentId === category.id || !byId.has(parentId)) return null;
    return parentId;
}

function childrenByParent<T extends FlatCategory>(categories: T[]): Map<string | null, T[]> {
    const byId = new Map<string, T>(categories.map((c) => [c.id, c]));
    const children = new Map<string | null, T[]>();
    for (const category of categories) {
        const parentId = effectiveParentId(category, byId);
        const siblings = children.get(parentId);
        if (siblings) siblings.push(category);
        else children.set(parentId, [category]);
    }
    for (const siblings of children.values()) {
        siblings.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "es"));
    }
    return children;
}

/**
 * Ordena las categorías como se leen en un árbol: cada una seguida de sus hijas,
 * con el nivel para poder sangrarlas. Nunca pierde ni repite una categoría.
 */
export function orderAsTree<T extends FlatCategory>(categories: T[]): TreeCategory<T>[] {
    if (!Array.isArray(categories) || categories.length === 0) return [];

    const children = childrenByParent(categories);
    const ordered: TreeCategory<T>[] = [];
    const placed = new Set<string>();

    const walk = (parentId: string | null, level: number, path: string[]) => {
        for (const category of children.get(parentId) ?? []) {
            if (placed.has(category.id)) continue; // corta ciclos
            placed.add(category.id);
            const nextPath = [...path, category.name];
            ordered.push({ ...category, level, path: nextPath });
            walk(category.id, level + 1, nextPath);
        }
    };
    walk(null, 0, []);

    // Un ciclo padre→hija→padre deja categorías sin raíz desde donde llegar:
    // se muestran al primer nivel antes que hacerlas desaparecer del listado.
    for (const category of categories) {
        if (!placed.has(category.id)) {
            placed.add(category.id);
            ordered.push({ ...category, level: 0, path: [category.name] });
        }
    }

    return ordered;
}

/** Ids de la rama completa: la categoría más todas sus descendientes. */
export function branchIds(categories: FlatCategory[], rootId: string): string[] {
    const children = childrenByParent(categories);
    const ids: string[] = [];
    const seen = new Set<string>();
    const pending = [rootId];

    while (pending.length > 0) {
        const id = pending.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        for (const child of children.get(id) ?? []) pending.push(child.id);
    }

    return ids;
}

/**
 * Conteo por rama: lo propio más lo de las descendientes, que es lo que el
 * usuario espera al elegir "Amasandería" y ver también Panes y Empanadas.
 * Son pocas categorías (decenas), así que recorrer la rama de cada una alcanza.
 */
export function branchCounts(categories: FlatCategory[], ownCounts: Record<string, number>): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const category of categories) {
        totals[category.id] = branchIds(categories, category.id)
            .reduce((total, id) => total + (ownCounts[id] ?? 0), 0);
    }
    return totals;
}
