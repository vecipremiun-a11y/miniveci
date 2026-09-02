/**
 * Identificador del visitante anónimo, compartido por el widget de chat y el
 * tracker de presencia. Vive en localStorage y es el mismo UUID en ambos, así
 * que "quién está en línea" y "quién escribió" son la misma persona.
 *
 * Solo cliente: en el servidor devuelve "".
 */

export const CHAT_GUEST_ID_KEY = "miniveci_chat_guest_id";

export function getGuestId(): string {
    if (typeof window === "undefined") return "";
    try {
        let id = localStorage.getItem(CHAT_GUEST_ID_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(CHAT_GUEST_ID_KEY, id);
        }
        return id;
    } catch {
        // Modo incógnito con storage bloqueado: sin id persistente no hay
        // presencia, pero la página no se rompe.
        return "";
    }
}

/**
 * Evento de ventana con el que el tracker de presencia le avisa al widget de
 * chat que soporte escribió primero. Los dos son hermanos en el layout y no
 * comparten estado; esto evita montar un store global por un solo dato.
 */
export const INCOMING_CHAT_EVENT = 'miniveci:chat-incoming';

export interface IncomingChatDetail {
    conversationId: string;
    unread: number;
}
