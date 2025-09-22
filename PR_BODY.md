**Qué hace**
- Restaura ChatPanel.tsx, MessageList.tsx, ChatWindow.tsx y app/(app)/mensajes/_components/ChatListItem.tsx a la última versión previa al 2025-09-20 00:00.

**Motivación**
- Volver al comportamiento estable: popup con openOfferSignal, mensaje-resumen inmediato y acciones Aceptar/Rechazar del lado profesional.

**Alcance**
- Solo UI de chat/ofertas. No toca APIs ni schema.

**Checklist**
- [ ] npm run typecheck
- [ ] npm run build
- [ ] requests/[id] → “Contratar” abre el popup
- [ ] Al crear oferta: aparece mensaje-resumen inmediato en el chat
- [ ] En el lado del profesional: Aceptar/Rechazar actualiza el estado
- [ ] Sin “tarjetón” nuevo; diseño previo
