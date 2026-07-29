import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function walk(directory, extension) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (path.includes(`${join(root, '.git')}`)) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path, extension));
    else if (extname(path) === extension) files.push(path);
  }
  return files;
}

test('HTTP requests never run schema mutations', () => {
  const entrypoint = read('api/index.php');
  const middleware = read('core/Middlewares/AuthMiddleware.php');
  assert.doesNotMatch(entrypoint, /Schema::ensure\s*\(/);
  assert.doesNotMatch(middleware, /Schema::ensure\s*\(/);
});

test('all public writes require a persistence identifier', () => {
  const client = read('assets/js/api.js');
  const contracts = [
    ["request('/leads'", "persistedBy: ['id']"],
    ["request('/atribucion/touch'", "persistedBy: ['visitor_uid', 'session_uid']"],
    ["request('/cta/resolver'", "persistedBy: ['click_id']"],
    ["request('/microdiagnostico'", "persistedBy: ['lead_id']"],
    ["request('/formularios'", "persistedBy: ['submission_id']"],
    ["request('/reservas'", "persistedBy: ['booking_id']"],
    ["/desbloquear", "persistedBy: ['capture_id']"],
  ];
  for (const [endpoint, identifier] of contracts) {
    assert.ok(client.includes(endpoint), `No existe el endpoint ${endpoint}`);
    assert.ok(client.includes(identifier), `Falta el contrato ${identifier}`);
  }
});

test('commercial attribution and CTA routes are public but server-resolved', () => {
  const routes = read('api/routes.php');
  const cta = read('core/Controllers/CtaController.php');
  assert.match(routes, /\/campanas\/\{slug\}/);
  assert.match(routes, /\/atribucion\/touch/);
  assert.match(routes, /\/cta\/resolver/);
  assert.doesNotMatch(cta, /input\(['"]destination/);
  assert.match(cta, /isSafeDestination/);
  assert.match(cta, /checkout_not_configured/);
});

test('commercial campaigns use one server-side source of truth', () => {
  const router = read('assets/js/router.js');
  const landing = read('app/views/CommercialLanding.js');
  const config = read('config/commercial.php');
  assert.match(router, /marketing-para-vender-plus-cartagena/);
  assert.match(router, /marketing-para-vender-plus-virtual/);
  assert.match(landing, /api\.campaign\(props\.slug\)/);
  assert.doesNotMatch(landing, /229000|250000|350000|599000/);
  assert.match(config, /mvp_pres_0808/);
  assert.match(config, /mvp_virtual_0818/);
  assert.match(config, /18, 20, 25 y 27 de agosto de 2026/);
});

test('attribution migration connects visitor, session, click, lead and opportunity', () => {
  const migration = read('database/migrations/202607290001_attribution_cta.php');
  for (const table of ['attribution_visitors', 'attribution_sessions', 'attribution_clicks']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  for (const column of ['event_id', 'visitor_uid', 'session_uid', 'click_uid', 'campaign_key', 'offer_key']) {
    assert.ok(migration.includes(`'${column}'`), `Falta ${column} en la migración`);
  }
  assert.match(migration, /uniq_opportunity_lead_campaign/);
});

test('commercial forms never report payment success without a verified payment result', () => {
  const cta = read('app/components/CommercialCta.js');
  assert.doesNotMatch(cta, /pago (aprobado|confirmado)|compra (aprobada|confirmada)/i);
  assert.match(cta, /No confirmaremos una compra hasta recibir la validación del medio de pago/);
  assert.match(cta, /PERSISTENCE|api\.createLead|api\.resolveCta/);
});

test('backend form and resource responses expose persisted record identifiers', () => {
  assert.match(read('core/Controllers/FormController.php'), /'submission_id'\s*=>\s*\$submissionId/);
  assert.match(read('core/Controllers/ResourceController.php'), /'capture_id'\s*=>\s*\$captureId/);
});

test('the existing cron processes both reminders and the notification queue', () => {
  const cron = read('core/Controllers/CronController.php');
  assert.match(cron, /MeetingService::processReminders\s*\(/);
  assert.match(cron, /NotificationService::processQueue\s*\(/);
});

test('the Eventos cleanup preserves the generic notification worker infrastructure', () => {
  const cleanup = read('database/remove_events_experiences.php');
  const notificationBlocks = [...cleanup.matchAll(/'notifications'\s*=>\s*\[([\s\S]*?)\],/g)];
  const notificationColumns = notificationBlocks[0]?.[1] || '';
  const notificationIndexes = notificationBlocks[1]?.[1] || '';
  for (const column of ['dedupe_key', 'available_at', 'claimed_at', 'attempts', 'max_attempts', 'processed_at', 'last_error']) {
    assert.ok(!notificationColumns.includes(`'${column}'`), `El depurador todavía elimina ${column}`);
  }
  for (const index of ['uniq_notification_dedupe', 'idx_notification_queue']) {
    assert.ok(!notificationIndexes.includes(`'${index}'`), `El depurador todavía elimina ${index}`);
  }
});

test('the removed Eventos y Experiencias module has no executable route', () => {
  const routes = read('api/routes.php');
  assert.doesNotMatch(routes, /\/admin\/eventos|\/experiencias|ExperienceController|EventController/i);
});

test('the repository distributes no seeded administrative credentials', () => {
  const seed = read('database/dml.sql');
  const readme = read('README.md');
  const install = read('docs/README-INSTALACION.txt');
  const login = read('admin/app/views/Login.js');

  assert.doesNotMatch(seed, /INSERT\s+INTO\s+users/i);
  assert.doesNotMatch(seed, /password_hash/i);
  for (const source of [readme, install, login]) {
    assert.doesNotMatch(source, /admin@tonnydager\.com/i);
  }
  assert.ok(existsSync(join(root, 'ops', 'cpanel', 'admin-user.php')));
});

test('all relative JavaScript imports resolve to local files', () => {
  const files = [
    ...walk(join(root, 'app'), '.js'),
    ...walk(join(root, 'assets', 'js'), '.js'),
    ...walk(join(root, 'admin'), '.js'),
  ];
  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
  const missing = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1].split(/[?#]/, 1)[0];
      const target = resolve(dirname(file), specifier);
      const candidates = [target, `${target}.js`, join(target, 'index.js')];
      if (!candidates.some((candidate) => existsSync(candidate))) {
        missing.push(`${file.slice(root.length + 1)} -> ${match[1]}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
