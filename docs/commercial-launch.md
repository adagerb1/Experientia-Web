# Campañas comerciales: atribución, CTA y lanzamiento

## Alcance

Esta versión incorpora una capacidad transversal. No restaura el módulo retirado
de Eventos y Experiencias.

- Atribución first-touch y last-touch.
- IDs propios de visitante, sesión, evento y clic.
- Persistencia de `utm_*`, `fbclid`, `gclid`, `ttclid`, `msclkid`, referente,
  creatividad, afiliado y variante.
- CTA resuelto por servidor, sin aceptar destinos desde el navegador.
- Captura de contacto antes de checkout o WhatsApp para conectar la intención
  con leads y oportunidades del CRM.
- Una oportunidad por lead y campaña, sin sobrescribir otras oportunidades.
- Fallback controlado: checkout configurado → WhatsApp configurado → lead
  guardado y seguimiento humano.
- Rate limiting para campañas, atribución, CTA y leads comerciales.
- Dos landings mobile-first basadas en una sola fuente de contenido y precios.

## URLs públicas

- `/marketing-para-vender-plus-cartagena`
- `/marketing-para-vender-plus-virtual`

## Configuración obligatoria de checkout

Configurar únicamente las variables que correspondan a medios de pago reales y
probados. Las URLs deben ser HTTPS.

```dotenv
MVP_PRESENCIAL_CHECKOUT_URL=
MVP_PRESENCIAL_RESERVA_URL=
MVP_VIRTUAL_GENERAL_COP_CHECKOUT_URL=
MVP_VIRTUAL_GENERAL_USD_CHECKOUT_URL=
MVP_VIRTUAL_PREMIUM_COP_CHECKOUT_URL=
MVP_VIRTUAL_PREMIUM_USD_CHECKOUT_URL=
```

Si una URL no está configurada, el motor intenta abrir el número público del
conector WhatsApp. Si tampoco existe, confirma únicamente que el interés quedó
guardado; nunca simula una compra.

## Despliegue

1. Respaldar archivos y base de datos.
2. Desplegar el commit aprobado.
3. Revisar el estado de migraciones:

   ```bash
   php ops/cpanel/migrate.php
   ```

4. Aplicar las migraciones:

   ```bash
   php ops/cpanel/migrate.php --apply
   ```

5. Configurar las URLs reales de checkout.
6. Confirmar el número público de WhatsApp en el conector o en Configuración.
7. Limpiar caché del navegador/CDN y abrir cada URL en una ventana privada.

## Prueba de lanzamiento

Ejecutar en móvil real con Wi-Fi y red móvil:

1. Abrir cada landing con UTMs, `fbclid` de prueba y `page_variant=qa`.
2. Confirmar que fechas, precios y moneda coinciden con la oferta aprobada.
3. Probar hero, CTA intermedio, planes y CTA sticky.
4. Validar nombre, correo, WhatsApp, país y consentimiento.
5. Confirmar que un error de API conserva los datos y permite reintentar.
6. Confirmar que el lead aparece en CRM con campaña y oferta.
7. Confirmar que el clic queda asociado al lead y a una oportunidad independiente.
8. Probar checkout aprobado, rechazado y abandonado.
9. Verificar que la redirección lleva el código `ref`, campaña, oferta y moneda.
10. Confirmar que la analítica muestra visitas, CTA, leads y checkout.

## Bloqueos de go-live

No abrir tráfico pago si ocurre cualquiera de estas condiciones:

- La migración no aparece aplicada.
- La landing y el checkout muestran precios o monedas diferentes.
- El botón de pago cae en el fallback porque la URL real no fue configurada.
- WhatsApp no tiene un número público válido.
- Un formulario muestra éxito sin `lead_id`.
- Un checkout confirma compra sin webhook o validación del proveedor.
- No están publicados términos, privacidad y condiciones de reserva/retracto.
- No se ha ejecutado al menos una compra real de bajo valor o transacción de
  prueba aceptada por la pasarela.

## Decisiones de contenido

- Presencial: 8 de agosto de 2026, 8:30 a. m.–6:00 p. m., Academia Conversa.
- Virtual: 18, 20, 25 y 27 de agosto de 2026, 7:00–9:00 p. m. Colombia.
- Las clínicas y el sprint Premium no se publican como beneficio hasta que
  agenda, responsable, duración y capacidad estén aprobados.
- No se publican testimonios inventados ni métricas sin soporte.
- La urgencia depende de fecha, precio o capacidad real; no de contadores falsos.
