import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('the AlexIA migration separates profiles, channels, knowledge, campaigns, triggers and attachments', () => {
  const migration = read('database/migrations/202608010001_alexia_commercial_orchestration.php');
  const ddl = read('database/ddl.sql');
  for (const table of ['alexia_profiles', 'alexia_channel_bindings', 'commercial_knowledge_sources',
    'commercial_campaigns', 'commercial_triggers', 'agent_attachments']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /internal_analyst/);
  assert.match(migration, /document_extensions/);
  assert.match(migration, /FOREIGN KEY \(message_id\) REFERENCES agent_messages/);
});

test('commercial AlexIA is constrained by approved knowledge and off-topic policy', () => {
  const agent = read('core/Services/CommercialAgentService.php');
  const config = read('core/Services/AlexiaConfigurationService.php');
  assert.match(agent, /AlexiaConfigurationService::context/);
  assert.match(agent, /LÍMITE TEMÁTICO/);
  assert.match(agent, /off_topic_message/);
  assert.match(agent, /jamás la inventes/);
  assert.match(agent, /datos no confiables/);
  assert.match(config, /commercial_knowledge_sources/);
  assert.match(config, /status.*published/);
  assert.match(config, /consultation_types/);
  assert.match(config, /FROM faqs WHERE published=1/);
});

test('campaign context can be resolved from keywords, prefill or referral without hardcoded frontend destinations', () => {
  const service = read('core/Services/AlexiaConfigurationService.php');
  const campaign = read('core/Services/CommercialCampaignService.php');
  const cta = read('core/Controllers/CtaController.php');
  assert.match(service, /\['keyword', 'prefill', 'referral'\]/);
  assert.match(campaign, /commercial_campaigns/);
  assert.match(campaign, /landing_mode/);
  assert.match(campaign, /whatsapp_number/);
  assert.match(cta, /campaign\['routing'\]\['whatsapp_number'\]/);
  assert.match(cta, /campaign\['routing'\]\['prefill_text'\]/);
  assert.match(cta, /isSafeDestination/);
  assert.match(service, /attribution_clicks WHERE LOWER\(click_uid\)/);
});

test('a Wompi event checkout and webhook preserve click, campaign, offer and verified purchase state', () => {
  const payment = read('core/Services/PaymentService.php');
  const controller = read('core/Controllers/PaymentController.php');
  const migration = read('database/migrations/202608010001_alexia_commercial_orchestration.php');
  assert.match(payment, /commercialCheckout/);
  assert.match(payment, /signature:integrity/);
  assert.match(payment, /'click_uid' => \$click\['click_uid'\]/);
  for (const column of ['campaign_key', 'offer_key', 'click_uid']) assert.ok(migration.includes(`'${column}'`));
  assert.match(controller, /applyCommercialStatus/);
  assert.match(controller, /INSERT IGNORE INTO tracking_events/);
  assert.match(controller, /PipelineService::advanceCampaign/);
});

test('WhatsApp and Telegram media are policy-gated, size-limited and auditable', () => {
  const media = read('core/Services/MediaIngestionService.php');
  const bot = read('core/Controllers/BotController.php');
  const agent = read('core/Services/CommercialAgentService.php');
  assert.match(media, /max_file_bytes/);
  assert.match(media, /document_extensions/);
  assert.match(media, /processing_status/);
  assert.match(media, /AiService::transcribe/);
  assert.match(bot, /MediaIngestionService::whatsapp/);
  assert.match(bot, /MediaIngestionService::telegram/);
  assert.match(agent, /recordAttachment/);
  assert.match(agent, /agent_attachments/);
  assert.match(read('core/Services/WhatsAppService.php'), /CURLOPT_FOLLOWLOCATION => false/);
  assert.match(read('core/Services/TelegramService.php'), /CURLOPT_XFERINFOFUNCTION/);
});

test('audio transcription remains server-side and enforces the 25 MB API limit', () => {
  const ai = read('core/Services/AiService.php');
  assert.match(ai, /\/v1\/audio\/transcriptions/);
  assert.match(ai, /25 \* 1024 \* 1024/);
  assert.match(ai, /CURLFile/);
  assert.doesNotMatch(read('admin/app/views/AlexiaConfig.js'), /api_key|access_token|app_secret/);
});

test('the admin exposes functional AlexIA and campaign configuration routes', () => {
  const routes = read('api/routes.php');
  const api = read('admin/app/api.js');
  const admin = read('admin/app/admin.js');
  for (const route of ['/admin/alexia-config', '/admin/campanas']) assert.ok(routes.includes(route));
  assert.match(api, /saveAlexiaProfile/);
  assert.match(api, /saveAlexiaBinding/);
  assert.match(api, /saveAlexiaKnowledge/);
  assert.match(api, /saveAlexiaTrigger/);
  assert.match(api, /saveCommercialCampaign/);
  assert.match(admin, /AlexIA Comercial/);
  assert.match(admin, /Campañas y eventos/);
});

test('human takeover still prevents automatic and forced replies', () => {
  const agent = read('core/Services/CommercialAgentService.php');
  const takeover = agent.indexOf("if (!empty($thread['human_takeover']))");
  const forced = agent.indexOf("if (!empty($meta['forced_reply']))");
  assert.ok(takeover > 0 && forced > takeover, 'El control humano debe evaluarse antes de cualquier respuesta automática');
});

test('pausing a configured profile or channel really stops automatic execution', () => {
  const config = read('core/Services/AlexiaConfigurationService.php');
  const agent = read('core/Services/CommercialAgentService.php');
  const bot = read('core/Controllers/BotController.php');
  assert.match(config, /SELECT \* FROM alexia_profiles WHERE profile_key=:k'/);
  assert.match(config, /SELECT \* FROM alexia_channel_bindings WHERE channel=:c AND endpoint_key=:e'/);
  assert.match(agent, /profile_inactive/);
  assert.match(bot, /canal pausado/);
  assert.ok(bot.indexOf('validSignature') < bot.lastIndexOf("canal pausado"), 'WhatsApp valida la firma aun cuando el canal está pausado');
});

test('campaigns assigned to a human acknowledge once and activate takeover', () => {
  const campaign = read('core/Services/CommercialCampaignService.php');
  const agent = read('core/Services/CommercialAgentService.php');
  assert.match(campaign, /\['alexia', 'human'\]/);
  assert.match(agent, /\['campaign'\]\['routing'\]\['attendant'\]/);
  assert.match(agent, /'human_takeover' => 1/);
  assert.match(agent, /'handoff' => true/);
});
