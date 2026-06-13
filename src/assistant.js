import { PROGRAMS, PROGRAM_TEMPLATES, formatDslActionWiki } from './data.js?v=20260613-player-tools';

export function defaultOllamaEndpoint() {
  if (location.hostname === 'docs.pau1.cloud') return '/ollama-proxy';
  return 'http://127.0.0.1:11434';
}

const OLLAMA_MODEL_PREFERENCES = [
  'gemma4:12b',
  'gemma4:latest',
  'gemma4-26b-a4b-local:latest',
  'gemma4-26b-a4b-local',
  'bonsai8b-q1:latest',
  'bonsai8b-q1',
  'llama3:latest',
  'llama3',
  'llama3.2-vision:latest',
  'llama3.2-vision:11b-instruct-q8_0',
  'qwen2.5:0.5b'
];

function isRunnableChatModel(name) {
  return !/^bge-m3(?::|$)/.test(name);
}

export function preferredOllamaModel(names) {
  const available = (names || []).filter(Boolean);
  return OLLAMA_MODEL_PREFERENCES.map(preferred => available.find(name => name === preferred)).find(Boolean)
    || available.find(name => /^gemma4(?::|-)/.test(name))
    || available.find(isRunnableChatModel)
    || available[0]
    || '';
}

export function normalizeProgram(text) {
  const s = String(text || '').toLowerCase().replace(/[_-]/g, ' ');
  const plankHaul = /haul|carry|move|bring|transport/.test(s) && /plank|board/.test(s);
  const toSawbench = /\b(?:to|into|onto)\s+(?:the\s+)?saw\s*bench\b/.test(s);
  if (/plant|sow|replant/.test(s) || (/seed|tree seed/.test(s) && /hole|holes/.test(s))) return 'plant_trees';
  if (/dig|hole|holes|shovel/.test(s)) return 'dig_holes';
  if (/mine|quarry|pickaxe/.test(s) && /stone|rock/.test(s)) return 'mine_stone';
  if (/pick\s*up|pickup|collect|grab|take/.test(s) && /(log|wood|plank|board|pole|stick|stone|rock|seed|axe|pickaxe)/.test(s)) return 'pickup_item';
  if (/axe|tool bench|workbench|crude tool|craft tool/.test(s)) return 'craft_axes';
  if (/pole|poles/.test(s)) return 'make_poles';
  if (/build|new bot|produce bot|assemble/.test(s)) return 'build_bots';
  if (/chop|cut|tree|wood|fell/.test(s) && !/haul|carry|move|bring|transport/.test(s)) return 'chop_wood';
  if (plankHaul && toSawbench) return 'make_poles';
  if (/haul|carry|move|bring|transport/.test(s) && /plank|board/.test(s)) return 'haul_planks';
  if (/plank|saw\b|process|board/.test(s) && !/haul|carry|move|bring|transport/.test(s)) return 'make_planks';
  if (/haul|carry|move|bring|transport/.test(s) && /log|wood/.test(s)) return 'haul_logs';
  if (/chop|cut|tree|wood|fell/.test(s)) return 'chop_wood';
  if (/idle|stop|park/.test(s)) return 'idle';
  return null;
}

function zoneArgsFromText(lower, game) {
  const rectZone = game.parseRectangleZoneMention?.(lower);
  if (rectZone) return { zone: rectZone };
  const explicitZone = game.findZoneMention?.(lower);
  if (explicitZone) return { zoneId: explicitZone.id };
  const radiusZone = game.parseRadiusZoneMention?.(lower);
  if (radiusZone) return { zone: radiusZone };
  return {};
}

function itemTypeFromText(lower, game) {
  const candidates = ['crude pickaxe', 'pickaxe', 'crude axe', 'axe', 'tree seeds', 'tree seed', 'seeds', 'seed', 'planks', 'plank', 'boards', 'board', 'logs', 'log', 'wood', 'poles', 'pole', 'sticks', 'stick', 'stones', 'stone', 'rocks', 'rock'];
  const found = candidates.find(word => new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`).test(lower));
  return game.normalizeItemType?.(found === 'wood' ? 'log' : found, 'log') || 'log';
}

function sourcePaletteFromText(lower, game) {
  return game.findStructureMention?.(lower, 'item_palette') || (/palette|storage/.test(lower) ? game.structures?.find(s => s.type === 'item_palette') : null);
}

function assignmentArgsForText({ botId, program, lower, game, reason }) {
  const sawbench = game.findStructureMention?.(lower, 'sawbench');
  const factory = game.findStructureMention?.(lower, 'factory');
  const workbench = game.findStructureMention?.(lower, 'workbench');
  const palette = sourcePaletteFromText(lower, game);
  const args = { botId, program, reason, ...zoneArgsFromText(lower, game) };
  if (program === 'pickup_item') {
    args.itemType = itemTypeFromText(lower, game);
    if (palette) args.sourcePaletteId = palette.id;
  }
  if (['haul_logs', 'make_planks', 'make_poles'].includes(program) && sawbench) args.targetStructureId = sawbench.id;
  if (['haul_planks', 'build_bots'].includes(program)) {
    if (sawbench) args.sourceStructureId = sawbench.id;
    if (factory) args.targetFactoryId = factory.id;
  }
  if (program === 'craft_axes' && workbench) args.targetWorkbenchId = workbench.id;
  if (program === 'build_bots' && factory) args.targetFactoryId = factory.id;
  return args;
}

export function parseAssistantRequest(text, game, { enableTemplates = false } = {}) {
  if (!enableTemplates) {
    return { help: true, source: 'mock', meta: 'Workflow template routing is disabled in Settings.' };
  }
  const lower = text.toLowerCase();
  const calls = [];
  if (/all\s+bots?.*(idle|stop|park)/.test(lower)) {
    for (const bot of game.bots) calls.push({ name: 'assignBotProgram', arguments: { botId: bot.id, program: 'idle', reason: 'All bots idle' } });
    return { calls, source: 'mock' };
  }
  const botMatches = [...lower.matchAll(/bot\s*(\d+)/g)].map(m => Number(m[1])).filter(Boolean);
  const program = normalizeProgram(lower);
  if (botMatches.length && program) {
    for (const botId of botMatches) calls.push({ name: 'assignBotProgram', arguments: assignmentArgsForText({ botId, program, lower, game, reason: 'Parsed command with slots' }) });
    return { calls, source: 'mock' };
  }
  if (/idle bot|free bot|assign/.test(lower) && program) {
    const bot = game.bots.find(b => b.program === 'idle') || game.bots[0];
    if (bot) calls.push({ name: 'assignBotProgram', arguments: assignmentArgsForText({ botId: bot.id, program, lower, game, reason: 'Assigned idle bot with slots' }) });
  }
  return calls.length ? { calls, source: 'mock' } : { help: true, source: 'mock' };
}

function compactTemplateInfo() {
  return Object.fromEntries(Object.entries(PROGRAM_TEMPLATES).map(([id, tpl]) => [id, Object.keys(tpl.slots || {})]));
}

function compactGameState(game, { includeTemplates = false } = {}) {
  return {
    bots: game.bots.map(b => ({ id: b.id, ref: b.ref, program: b.program, targetStructureId: b.targetStructureId, sourceStructureId: b.sourceStructureId, sourcePaletteId: b.sourcePaletteId, itemType: b.pickupItemType, targetFactoryId: b.targetFactoryId, targetWorkbenchId: b.targetWorkbenchId, zoneId: b.zoneId })),
    objects: game.getObjectRegistry ? game.getObjectRegistry() : [],
    structures: game.structures.map(s => ({ id: s.id, ref: s.ref, name: s.name, type: s.type, logs: s.logs || 0, planks: s.planks || 0, poles: s.poles || 0, sticks: s.sticks || 0, stones: s.stones || 0, tree_seeds: s.tree_seeds || 0 })),
    zones: game.zones.map(z => ({ id: z.id, name: z.name, kind: z.kind, rect: z.kind === 'rect' ? { x: Math.round(z.x), y: Math.round(z.y), w: Math.round(z.w), h: Math.round(z.h) } : undefined })),
    programs: PROGRAMS,
    ...(includeTemplates ? { templates: compactTemplateInfo() } : {})
  };
}

function parseJsonObject(text) {
  if (typeof text === 'object' && text) return text;
  const clean = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(clean); } catch (_) {
    const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('model returned invalid JSON');
  }
}

function parseArgs(raw) {
  const args = typeof raw.arguments === 'string' ? parseJsonObject(raw.arguments) : (raw.arguments || raw.args || raw.function?.arguments || {});
  return typeof args === 'string' ? parseJsonObject(args) : args;
}

export function validateToolCalls(rawCalls, game) {
  if (!Array.isArray(rawCalls)) throw new Error('tool_calls must be an array');
  const valid = [];
  for (const raw of rawCalls.slice(0, 10)) {
    const name = raw.name || raw.function?.name;
    const args = parseArgs(raw);
    if (name !== 'assignBotProgram') continue;
    const botId = Number(args.botId || String(args.bot || '').replace(/^bot:/, ''));
    if (!game.bots.some(b => b.id === botId)) continue;
    let program = PROGRAMS.includes(args.program) ? args.program : normalizeProgram(args.program || args.template || args.intent);
    if (!program) continue;

    const rawTarget = args.targetStructureId || args.targetSawbench || args.target;
    const anyTargetId = game.normalizeStructureId?.(rawTarget, null) || null;
    const anyTarget = anyTargetId ? game.structures.find(s => s.id === anyTargetId) : null;
    let targetStructureId = game.normalizeStructureId?.(args.targetSawbench || (anyTarget?.type === 'sawbench' ? anyTarget.id : rawTarget), 'sawbench') || null;
    let sourceStructureId = game.normalizeStructureId?.(args.sourceStructureId || args.sourceSawbench || args.source, 'sawbench') || null;
    const sourcePaletteId = game.normalizeStructureId?.(args.sourcePaletteId || args.sourcePalette || args.storage || args.palette || (anyTarget?.type === 'item_palette' ? anyTarget.id : null) || (program === 'pickup_item' ? args.source : null), 'item_palette') || null;
    const itemType = game.normalizeItemType?.(args.itemType || args.type || args.item || args.resource, 'log') || 'log';
    let targetFactoryId = game.normalizeStructureId?.(args.targetFactoryId || args.targetFactory || (anyTarget?.type === 'factory' ? anyTarget.id : null), 'factory') || null;
    const targetWorkbenchId = game.normalizeStructureId?.(args.targetWorkbenchId || args.targetWorkbench || args.workbench || (anyTarget?.type === 'workbench' ? anyTarget.id : null), 'workbench') || null;
    const zoneInput = args.zone || args.zoneId || args.searchZone || args.area;
    const normalizedZone = game.normalizeZoneSpec?.(zoneInput) || { zoneId: null, zoneSpec: null };
    if (program === 'haul_planks' && targetStructureId && !targetFactoryId) {
      program = 'make_poles';
      if (sourceStructureId === targetStructureId) sourceStructureId = null;
    }
    if (program === 'haul_planks' && targetStructureId && targetFactoryId && !sourceStructureId) {
      sourceStructureId = targetStructureId;
      targetStructureId = null;
    }

    valid.push({
      name,
      arguments: {
        botId,
        program,
        targetStructureId,
        sourceStructureId,
        sourcePaletteId,
        itemType,
        targetFactoryId,
        targetWorkbenchId,
        zoneId: normalizedZone.zoneId,
        zone: normalizedZone.zoneSpec,
        reason: args.reason || 'Model tool call with validated slots'
      }
    });
  }
  if (!valid.length && rawCalls.length) throw new Error('no valid tool calls');
  return valid;
}

export async function refreshOllamaModels({ endpointInput, modelSelect, statusEl }) {
  const endpoint = endpointInput.value.trim().replace(/\/$/, '') || defaultOllamaEndpoint();
  statusEl.textContent = `Loading models from ${endpoint}/api/tags …`;
  const res = await fetch(`${endpoint}/api/tags`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const names = (data.models || []).map(m => m.name).filter(n => !/^gemma3/.test(n)).sort();
  modelSelect.innerHTML = names.length ? '' : '<option value="">No models found</option>';
  for (const name of names) { const o = document.createElement('option'); o.value = name; o.textContent = name; modelSelect.appendChild(o); }
  const preferred = preferredOllamaModel(names);
  if (preferred) modelSelect.value = preferred;
  statusEl.textContent = names.length ? `Loaded ${names.length} Ollama model(s). Selected ${preferred}.` : 'No models found.';
  return names;
}

export async function parseWithOllama(text, game, { endpoint, model, enableTemplates = false }) {
  if (!model) {
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true }) : { help: true, source: 'ollama', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? 'No model selected; workflow template fallback.' : 'No model selected; workflow template fallback disabled.', debug: { sent: { endpoint, model, text, enableTemplates }, returned: 'No model selected.' } };
  }
  const started = performance.now();
  const url = `${endpoint}/api/chat`;
  let requestBody = null;
  let returned = null;
  try {
    const templateGuidance = enableTemplates ? 'Legacy workflow template routing is enabled; you may use the named Programs as workflow templates when they match the request.' : 'Legacy workflow template routing is disabled; do not rely on keyword template matching. Interpret the user request directly into the most appropriate DSL program/tool-call arguments.';
    const schema = `You are a strict game tool-call router. Output only one compact JSON object, no markdown, no prose.
Shape: {"tool_calls":[{"name":"assignBotProgram","arguments":{"botId":2,"program":"make_planks","targetStructureId":3}}]}.
${templateGuidance}
Programs: ${PROGRAMS.join(', ')}.
Use numeric IDs from Game.objects: make_poles uses targetStructureId=sawbench destination; haul_planks uses sourceStructureId=sawbench source and targetFactoryId=factory destination; sourcePaletteId=item_palette storage source; targetWorkbenchId=tool bench; zoneId=drawn zone; itemType=log/plank/pole/stick/stone/tree_seed/crude_axe/crude_pickaxe/crude_shovel.
For inserted coordinates like rect(x:100,y:200,w:80,h:60), output zone:{"kind":"rect","x":100,"y":200,"w":80,"h":60}.
For "small area around sawbench 2" output zone:{"kind":"radius","centerStructureId":<sawbench numericId>,"radius":95}.

DSL Action Wiki for creating/understanding JSON loop step sequences:
${formatDslActionWiki()}`;
    requestBody = {
      model, stream: false, format: 'json', think: false,
      messages: [
        { role: 'system', content: schema },
        { role: 'user', content: `Game: ${JSON.stringify(compactGameState(game, { includeTemplates: enableTemplates }))}\nRequest: ${text}` }
      ],
      options: { temperature: 0, num_predict: 180, num_ctx: 4096 }
    };
    console.info('[Orchestrator chat AI] sent to Ollama', { url, body: requestBody });
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    if (!res.ok) {
      returned = { status: res.status, statusText: res.statusText, body: await res.text().catch(() => '') };
      throw new Error(`${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    returned = { response: data, content };
    const json = parseJsonObject(content);
    const calls = validateToolCalls(json.tool_calls || json.calls || [], game);
    returned = { ...returned, parsed: json, validCalls: calls };
    console.info('[Orchestrator chat AI] returned from Ollama', returned);
    return { calls, source: 'ollama', meta: `Ollama ${model}: ${Math.round(performance.now() - started)}ms, valid calls=${calls.length}`, debug: { sent: { url, body: requestBody }, returned } };
  } catch (e) {
    returned = returned || { error: e.message };
    console.warn('[Orchestrator chat AI] Ollama failed/fell back', { sent: { url, body: requestBody }, returned });
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true }) : { help: true, source: 'ollama', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? `Ollama failed: ${e.message}; workflow template fallback.` : `Ollama failed: ${e.message}; workflow template fallback disabled.`, debug: { sent: { url, body: requestBody }, returned } };
  }
}
