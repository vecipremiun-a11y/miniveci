/**
 * Datos estructurados (schema.org) para Google.
 *
 * Se escapa `<` porque el JSON va dentro de un <script>: un nombre de producto
 * con "</script>" cerraría la etiqueta y permitiría inyectar HTML.
 */
export function JsonLd({ data }: { data: object | object[] }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
        />
    );
}
