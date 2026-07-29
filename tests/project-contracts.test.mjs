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
