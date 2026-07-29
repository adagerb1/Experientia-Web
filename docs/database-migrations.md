# Migraciones de base de datos

El sitio y el portal administrativo no modifican el esquema durante solicitudes
HTTP. Toda modificación estructural se ejecuta desde la terminal de cPanel y
queda registrada en `schema_migrations`.

## Despliegue

Desde la raíz de la aplicación:

```bash
php ops/cpanel/migrate.php
```

El comando anterior solo muestra el estado. Para aplicar las pendientes:

```bash
php ops/cpanel/migrate.php --apply
```

También puede usarse:

```bash
bash ops/cpanel/run-migrations.sh
```

## Reglas

- Cada archivo de `database/migrations` tiene una versión única y ordenable.
- Una migración aplicada no se edita: cualquier ajuste se crea como una nueva.
- El runner valida el checksum y bloquea ejecuciones concurrentes.
- Los errores detienen el despliegue con código de salida distinto de cero.
- `database/ddl.sql` sigue siendo la fuente para una instalación nueva; después
  deben ejecutarse las migraciones.
- Antes de una migración destructiva se exige respaldo y un script de reversión
  específico. El runner no intenta reversiones destructivas automáticas.

La primera migración no modifica tablas funcionales. Certifica que el esquema
estable requerido por sitio, CRM, agenda, conectores y conversaciones existe.
