# ADR 0004: migraciones explícitas y verificables

- Estado: aceptado
- Fecha: 2026-07-28

## Contexto

La API y el middleware de autenticación ejecutaban intentos de `ALTER TABLE` y
`CREATE TABLE` durante solicitudes normales. Los errores se ignoraban y una
bandera general marcaba el esquema como actualizado. Esto podía dejar estados
parciales, aumentar la latencia y ocultar diferencias entre código y base de
datos.

## Decisión

Las solicitudes HTTP no modificarán el esquema. Las migraciones se ejecutarán
desde CLI durante el despliegue, con:

- versión única y ordenada;
- historial en `schema_migrations`;
- checksum inmutable;
- lock de MySQL contra ejecuciones concurrentes;
- código de salida fallido ante cualquier inconsistencia;
- diagnóstico previo y verificación posterior.

`database/ddl.sql` seguirá creando instalaciones nuevas. El runner llevará esas
instalaciones desde el esquema base hasta la versión del código desplegado.

## Consecuencias

Un despliegue que incluya una migración debe ejecutar
`php ops/cpanel/migrate.php --apply` antes de habilitar el nuevo código. La
aplicación ya no intentará reparar silenciosamente una base incompleta.
