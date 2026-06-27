export const WORKBENCH_TOOL_RECIPES = ['crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer'];
export const DEFAULT_WORKBENCH_RECIPE = 'crude_axe';
export const SMITHERY_RECIPES = ['wooden_sword', 'wooden_shield'];
export const DEFAULT_SMITHERY_RECIPE = 'wooden_sword';

export function workbenchRecipe(s) {
  return WORKBENCH_TOOL_RECIPES.includes(s?.workbenchRecipe) ? s.workbenchRecipe : DEFAULT_WORKBENCH_RECIPE;
}

export function smitheryRecipe(s) {
  return SMITHERY_RECIPES.includes(s?.smitheryRecipe) ? s.smitheryRecipe : DEFAULT_SMITHERY_RECIPE;
}

export function assemblerRecipe(s, buildingKitItemTypes, defaultAssemblerRecipe) {
  return buildingKitItemTypes.includes(s?.assemblerRecipe) ? s.assemblerRecipe : defaultAssemblerRecipe;
}

export function smitheryInputFor(recipe) {
  return recipe === 'wooden_shield' ? 'plank' : 'stick';
}

export function productionInputNeeds(s, { BOW_RECIPE, FACTORY_BOT_RECIPE, ASSEMBLER_KIT_RECIPE, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE }) {
  if (!s) return null;
  if (s.type === 'sawbench') return { log: 1, plank: 1 };
  if (s.type === 'workbench') return { stick: 1, stone: 1 };
  if (s.type === 'smithery') return { [smitheryInputFor(smitheryRecipe(s))]: 1 };
  if (s.type === 'bowmaker') return { ...BOW_RECIPE };
  if (s.type === 'arrowmaker') return { stick: 1, stone: 1 };
  if (s.type === 'factory') return { ...FACTORY_BOT_RECIPE };
  if (s.type === 'assembler') {
    const recipe = assemblerRecipe(s, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE);
    return recipe ? { ...ASSEMBLER_KIT_RECIPE } : null;
  }
  return null;
}

export function productionInputCount(s, type) {
  if (!s || !type) return 0;
  if (s.type === 'sawbench') return type === 'log' ? (s.logs || 0) : type === 'plank' ? (s.planks || 0) : 0;
  if (s.type === 'workbench') return type === 'stick' ? (s.sticks || 0) : type === 'stone' ? (s.stones || 0) : 0;
  if (s.type === 'smithery') return type === smitheryInputFor(smitheryRecipe(s)) ? (s[`${type}s`] ?? s[type] ?? 0) : 0;
  if (s.type === 'bowmaker') return (s[`${type}s`] ?? s[type] ?? 0);
  if (s.type === 'arrowmaker') return type === 'stick' ? (s.sticks || 0) : type === 'stone' ? (s.stones || 0) : 0;
  if (s.type === 'factory' || s.type === 'assembler') return (s[`${type}s`] ?? s[type] ?? 0);
  return 0;
}

export function installProductionSystem(Game, deps) {
  const {
    ASSEMBLER_KIT_RECIPE,
    BOW_RECIPE,
    BUILDING_KIT_ITEM_TYPES,
    BUILDING_TYPES,
    DEFAULT_ASSEMBLER_RECIPE,
    FACTORY_BOT_RECIPE,
    itemLabel,
    rand
  } = deps;

  const productionInputDeps = { ASSEMBLER_KIT_RECIPE, BOW_RECIPE, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE, FACTORY_BOT_RECIPE };
  const PRODUCTION_DEFAULTS = {
    sawbench: { log: 1.2, plank: 1.0 },
    workbench: { crude_axe: 1.1, crude_pickaxe: 1.1, crude_shovel: 1.1, crude_hammer: 1.1 },
    smithery: { wooden_sword: 1.0, wooden_shield: 1.0 },
    bowmaker: { bow: 5.5 },
    arrowmaker: { arrow_pack: 3.0 },
    factory: { basic_bot: 1.5 },
    assembler: Object.fromEntries(BUILDING_KIT_ITEM_TYPES.map(type => [type, 1.4]))
  };

  Object.assign(Game.prototype, {
    productionDuration(s, recipe) { return BUILDING_TYPES[s.type]?.processingDurations?.[recipe] ?? PRODUCTION_DEFAULTS[s.type]?.[recipe] ?? 1; },
    isStructureProcessing(s) { return !!s?.processing && s.processing.remaining > 0; },
    setWorkbenchRecipe(s, recipe) {
      if (!s || s.type !== 'workbench' || !WORKBENCH_TOOL_RECIPES.includes(recipe)) return false;
      if (this.isStructureProcessing(s)) { this.addFloat(`${s.name} is processing; output stays ${itemLabel(workbenchRecipe(s))}`, s.x, s.y - 35, '#c7b683'); return false; }
      s.workbenchRecipe = recipe;
      this.addFloat(`${s.name}: produce ${itemLabel(recipe)}`, s.x, s.y - 35, '#d3a95f');
      this.emitSound('switch', { cooldownKey: `recipe:${s.id}`, minGapMs: 100 });
      return true;
    },
    setSmitheryRecipe(s, recipe) {
      if (!s || s.type !== 'smithery' || !SMITHERY_RECIPES.includes(recipe)) return false;
      if (this.isStructureProcessing(s)) { this.addFloat(`${s.name} is processing; output stays ${itemLabel(smitheryRecipe(s))}`, s.x, s.y - 35, '#c7b683'); return false; }
      s.smitheryRecipe = recipe;
      this.addFloat(`${s.name}: produce ${itemLabel(recipe)}`, s.x, s.y - 35, '#d3a95f');
      this.emitSound('switch', { cooldownKey: `recipe:${s.id}`, minGapMs: 100 });
      return true;
    },
    setAssemblerRecipe(s, recipe) {
      const kitType = this.normalizeBuildingKitItemType(recipe);
      if (!s || s.type !== 'assembler' || !kitType) return false;
      if (this.isStructureProcessing(s)) { this.addFloat(`${s.name} is processing; output stays ${itemLabel(assemblerRecipe(s, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE))}`, s.x, s.y - 35, '#c7b683'); return false; }
      s.assemblerRecipe = kitType;
      this.addFloat(`${s.name}: assemble ${itemLabel(kitType)}`, s.x, s.y - 35, '#d3a95f');
      this.emitSound('switch', { cooldownKey: `recipe:${s.id}`, minGapMs: 100 });
      return true;
    },
    switchSmitheryRecipe(s) {
      const next = smitheryRecipe(s) === 'wooden_sword' ? 'wooden_shield' : 'wooden_sword';
      return this.setSmitheryRecipe(s, next);
    },
    structureReadyJob(s) {
      if (!s || this.isStructureProcessing(s)) return null;
      if (s.type === 'sawbench') {
        if (s.logs > 0) return { recipe: 'log', label: 'sawing log' };
        if (s.planks > 0) return { recipe: 'plank', label: 'shaping pole' };
      }
      if (s.type === 'workbench' && s.sticks >= 1 && s.stones >= 1) { const recipe = workbenchRecipe(s); return { recipe, label: `crafting ${itemLabel(recipe)}` }; }
      if (s.type === 'smithery') {
        const recipe = smitheryRecipe(s);
        const input = smitheryInputFor(recipe);
        const key = input === 'stick' ? 'sticks' : 'planks';
        if ((s[key] || 0) > 0) return { recipe, label: `crafting ${itemLabel(recipe)}` };
      }
      if (s.type === 'arrowmaker' && s.sticks >= 1 && s.stones >= 1) return { recipe: 'arrow_pack', label: 'fletching arrow pack' };
      if (s.type === 'bowmaker' && Object.entries(BOW_RECIPE).every(([type, cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost)) return { recipe: 'bow', label: 'binding bow' };
      if (s.type === 'factory' && Object.entries(FACTORY_BOT_RECIPE).every(([type, cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost)) return { recipe: 'basic_bot', label: 'assembling bot' };
      if (s.type === 'assembler' && Object.entries(ASSEMBLER_KIT_RECIPE).every(([type, cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost)) {
        const recipe = assemblerRecipe(s, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE);
        return { recipe, label: `assembling ${itemLabel(recipe)}` };
      }
      return null;
    },
    consumeStructureInputs(s, recipe) {
      if (s.type === 'sawbench' && recipe === 'log') { s.logs--; return true; }
      if (s.type === 'sawbench' && recipe === 'plank') { s.planks--; return true; }
      if (s.type === 'workbench' && WORKBENCH_TOOL_RECIPES.includes(recipe)) { s.sticks--; s.stones--; return true; }
      if (s.type === 'smithery' && SMITHERY_RECIPES.includes(recipe)) { const input = smitheryInputFor(recipe); const key = input === 'stick' ? 'sticks' : 'planks'; s[key]--; return true; }
      if (s.type === 'arrowmaker' && recipe === 'arrow_pack') { s.sticks--; s.stones--; return true; }
      if (s.type === 'bowmaker' && recipe === 'bow') { for (const [type, cost] of Object.entries(BOW_RECIPE)) { const key = `${type}s` in s ? `${type}s` : type; s[key] -= cost; } return true; }
      if (s.type === 'factory' && recipe === 'basic_bot') { for (const [type, cost] of Object.entries(FACTORY_BOT_RECIPE)) { const key = `${type}s` in s ? `${type}s` : type; s[key] -= cost; } return true; }
      if (s.type === 'assembler' && BUILDING_KIT_ITEM_TYPES.includes(recipe)) { for (const [type, cost] of Object.entries(ASSEMBLER_KIT_RECIPE)) { const key = `${type}s` in s ? `${type}s` : type; s[key] -= cost; } return true; }
      return false;
    },
    occupyProductionWorker(worker, s) {
      if (!worker || !s?.processing) return;
      if (worker.kind === 'player') {
        this.player.target = { action: 'structure_processing', structureId: s.id, x: s.x, y: s.y, started: true, remaining: s.processing.remaining, total: s.processing.total, processLabel: s.processing.label };
        return;
      }
      const bot = worker.bot || worker;
      if (bot) { bot.productionJob = { structureId: s.id }; bot.target = s; bot.timer = 0; bot.message = `Working at ${s.name}: ${s.processing.label}.`; }
    },
    updateBotProductionBusy(bot) {
      if (!bot.productionJob) return false;
      const s = this.structures.find(st => st.id === bot.productionJob.structureId);
      if (this.isStructureProcessing(s)) { bot.state = 'producing'; bot.message = `Busy at ${s.name}: ${s.processing.label} (${Math.max(0, s.processing.remaining).toFixed(1)}s left).`; return true; }
      bot.productionJob = null;
      return false;
    },
    startStructureProcessing(s, recipe, label, worker = null) {
      s.processing = { recipe, label, remaining: this.productionDuration(s, recipe), total: this.productionDuration(s, recipe) };
      this.addFloat(`${s.name}: ${label}`, s.x, s.y - 35, '#c7b683');
      this.emitSound('craft_start', { cooldownKey: `craft:${s.id}`, minGapMs: 220 });
      this.occupyProductionWorker(worker, s);
    },
    maybeStartStructureProcessing(s, worker = null) {
      const job = this.structureReadyJob(s);
      if (!job) return false;
      this.consumeStructureInputs(s, job.recipe);
      this.startStructureProcessing(s, job.recipe, job.label, worker);
      return true;
    },
    finishStructureProcessing(s, job) {
      this.emitSound('craft_done', { cooldownKey: `craft-done:${s.id}`, minGapMs: 180 });
      if (s.type === 'sawbench' && job.recipe === 'log') { this.dropProducedItem(s, 'plank', 2); this.addFloat('+2 planks dropped', s.x, s.y - 35, '#d3a95f'); return; }
      if (s.type === 'sawbench' && job.recipe === 'plank') { this.dropProducedItem(s, 'pole', 2); this.addFloat('+2 wood poles dropped', s.x, s.y - 35, '#c7b683'); return; }
      if (s.type === 'workbench' && WORKBENCH_TOOL_RECIPES.includes(job.recipe)) {
        const key = job.recipe === 'crude_pickaxe' ? 'pickaxes' : job.recipe === 'crude_shovel' ? 'shovels' : job.recipe === 'crude_hammer' ? 'hammers' : 'axes';
        s[key]++;
        this.dropProducedItem(s, job.recipe, 1);
        this.addFloat(`+ ${itemLabel(job.recipe)} dropped`, s.x, s.y - 35, '#d3a95f');
        return;
      }
      if (s.type === 'smithery' && SMITHERY_RECIPES.includes(job.recipe)) {
        const key = job.recipe === 'wooden_shield' ? 'shields' : 'swords';
        s[key]++;
        this.dropProducedItem(s, job.recipe, 1);
        this.addFloat(`+ ${itemLabel(job.recipe)} dropped`, s.x, s.y - 35, '#d3a95f');
        return;
      }
      if (s.type === 'arrowmaker' && job.recipe === 'arrow_pack') { s.arrow_packs++; this.dropProducedItem(s, 'arrow_pack', 1); this.addFloat('+ arrow pack dropped', s.x, s.y - 35, '#d3a95f'); return; }
      if (s.type === 'bowmaker' && job.recipe === 'bow') { s.bows++; this.dropProducedItem(s, 'bow', 1); this.addFloat('+ bow dropped', s.x, s.y - 35, '#d3a95f'); return; }
      if (s.type === 'factory' && job.recipe === 'basic_bot') { const nb = this.createBot(s.x + rand(-30, 30), s.y + 72, 'idle'); if (nb) this.addChat?.('assistant', `Factory created Basic Bot ${nb.id}.`); return; }
      if (s.type === 'assembler' && BUILDING_KIT_ITEM_TYPES.includes(job.recipe)) { this.dropProducedItem(s, job.recipe, 1); this.addFloat(`+ ${itemLabel(job.recipe)} dropped`, s.x, s.y - 35, '#d3a95f'); }
    },
    updateProductionStructures(dt) {
      for (const s of this.structures) {
        if (!['sawbench', 'workbench', 'factory', 'smithery', 'bowmaker', 'arrowmaker', 'assembler'].includes(s.type)) continue;
        if (this.isStructureProcessing(s)) {
          s.processing.remaining -= dt;
          if (s.processing.remaining <= 0) {
            const job = s.processing;
            s.processing = null;
            this.finishStructureProcessing(s, job);
          }
        } else {
          this.maybeStartStructureProcessing(s);
        }
      }
    },
    executeCraftSmitheryStep(bot, step, dt) {
      const recipe = this.normalizeSmitheryRecipe(step.recipe);
      const s = this.nearestStructure('smithery', bot.x, bot.y, step.structureId);
      return this.executeCraftAtProduction(bot, step, dt, s, recipe, 'smithery');
    },
    executeCraftBowmakerStep(bot, step, dt) {
      const recipe = this.normalizeBowmakerRecipe(step.recipe);
      const s = this.nearestStructure('bowmaker', bot.x, bot.y, step.structureId);
      return this.executeCraftAtProduction(bot, step, dt, s, recipe, 'bowmaker');
    },
    executeCraftArrowmakerStep(bot, step, dt) {
      const recipe = this.normalizeArrowmakerRecipe(step.recipe);
      const s = this.nearestStructure('arrowmaker', bot.x, bot.y, step.structureId);
      return this.executeCraftAtProduction(bot, step, dt, s, recipe, 'arrowmaker');
    },
    executeCraftAtProduction(bot, step, dt, s, recipe, structureType) {
      if (!s || !recipe) { bot.message = `No ${structureType} recipe target available.`; return false; }
      if (s.type === 'smithery' && smitheryRecipe(s) !== recipe && !this.setSmitheryRecipe(s, recipe)) { bot.message = `${s.name} is busy with ${itemLabel(smitheryRecipe(s))}.`; return false; }
      const ready = this.structureReadyJob(s)?.recipe === recipe || this.isStructureProcessing(s);
      if (ready) {
        if (!this.moveBotTo(bot, s, dt, 34)) { bot.message = `Going to craft ${itemLabel(recipe)} at ${s.name}.`; return false; }
        this.maybeStartStructureProcessing(s, { bot });
        bot.message = this.isStructureProcessing(s) ? `${s.name} is ${s.processing.label}.` : `${s.name} completed ${itemLabel(recipe)}.`;
        return true;
      }
      const needs = productionInputNeeds(s, productionInputDeps) || {};
      if (bot.inventory) {
        if (!needs[bot.inventory.type]) { bot.message = `Holding ${itemLabel(bot.inventory.type)}; ${s.name} needs ${Object.keys(needs).map(itemLabel).join(' + ')}.`; return false; }
        if (!this.moveBotTo(bot, s, dt, 34)) { bot.message = `Supplying ${itemLabel(bot.inventory.type)} to ${s.name}.`; return false; }
        if (!this.depositHeldItemToStructure(s, bot.inventory.type, { worker: { bot } })) { bot.message = this.isStructureProcessing(s) ? `${s.name} is processing; waiting.` : `${s.name} cannot take ${itemLabel(bot.inventory.type)}.`; return false; }
        bot.inventory = null;
        bot.message = this.isStructureProcessing(s) ? `Delivered material and started ${s.processing.label}.` : `Delivered material to ${s.name}.`;
        return this.isStructureProcessing(s);
      }
      const missing = Object.entries(needs).find(([type, cost]) => productionInputCount(s, type) < cost)?.[0];
      if (!missing) { bot.message = `${s.name} is ready for ${itemLabel(recipe)}.`; return false; }
      return this.takeLooseItem(bot, missing, dt);
    },
    programHaulLogs(bot, dt) {
      const zone = this.getBotZone(bot);
      if (bot.inventory?.type === 'log') {
        const s = this.nearestStructure('sawbench', bot.x, bot.y, bot.targetStructureId);
        if (!s) return bot.message = 'No sawbench.';
        if (!this.moveBotTo(bot, s, dt, 32)) return bot.message = `Delivering log to ${s.name}.`;
        this.depositToSawbench(s, 'log', { worker: { bot } });
        bot.inventory = null;
        bot.message = this.isStructureProcessing(s) ? `Delivered log and started ${s.processing.label} at ${s.name}.` : `Delivered log to ${s.name}.`;
        return;
      }
      let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && this.objectInZone(i, zone, bot)) : null;
      if (!item) {
        item = this.findItemFor(bot, 'log');
        if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; }
      }
      if (!item) return bot.message = `Waiting for loose logs in ${this.zoneLabel(zone)}.`;
      if (!this.moveBotTo(bot, item, dt, 12)) return bot.message = `Picking up log in ${this.zoneLabel(zone)}.`;
      this.pickItem(bot, item);
    },
    programMakePlanks(bot, dt) {
      const s = this.nearestStructure('sawbench', bot.x, bot.y, bot.targetStructureId);
      if (!s) return bot.message = 'No sawbench.';
      if (!this.moveBotTo(bot, s, dt, 34)) return bot.message = `Going to ${s.name}.`;
      if (this.isStructureProcessing(s)) return bot.message = `${s.name} is processing ${s.processing.label}.`;
      if (s.logs <= 0) return bot.message = `${s.name} needs logs.`;
      this.maybeStartStructureProcessing(s, { bot });
      bot.message = this.isStructureProcessing(s) ? `Started sawing logs at ${s.name}.` : `${s.name} needs logs.`;
    },
    programMakePoles(bot, dt) {
      const s = this.nearestStructure('sawbench', bot.x, bot.y, bot.targetStructureId);
      if (!s) return bot.message = 'No sawbench.';
      if (!bot.inventory) { this.takePlankSource(bot, dt); return; }
      if (bot.inventory.type !== 'plank') return bot.message = `Holding ${itemLabel(bot.inventory.type)}; needs plank for ${s.name}.`;
      if (!this.moveBotTo(bot, s, dt, 34)) return bot.message = `Putting plank into ${s.name}.`;
      if (!this.depositToSawbench(s, 'plank', { worker: { bot } })) { bot.message = this.isStructureProcessing(s) ? `${s.name} is processing; waiting to add plank.` : `${s.name} cannot take plank.`; return; }
      bot.inventory = null;
      bot.message = this.isStructureProcessing(s) ? `Delivered plank and started ${s.processing.label} at ${s.name}.` : `Delivered plank to ${s.name} for pole production.`;
    },
    takePlankSource(bot, dt) {
      const explicitSource = Boolean(bot.sourceStructureId);
      const sourceId = bot.sourceStructureId || bot.targetStructureId;
      const saw = sourceId ? this.nearestStructure('sawbench', bot.x, bot.y, sourceId) : null;
      if (saw && this.takeLooseItemNearStructure(bot, 'plank', dt, saw)) return true;
      if (saw && explicitSource) return false;
      return this.takeLooseItem(bot, 'plank', dt);
    },
    takePoleSource(bot, dt) {
      const explicitSource = Boolean(bot.sourceStructureId);
      const sourceId = bot.sourceStructureId || bot.targetStructureId;
      const saw = sourceId ? this.nearestStructure('sawbench', bot.x, bot.y, sourceId) : null;
      if (saw && this.takeLooseItemNearStructure(bot, 'pole', dt, saw)) return true;
      if (saw && explicitSource) return false;
      return this.takeLooseItem(bot, 'pole', dt);
    },
    takeLogSource(bot, dt) {
      const saw = bot.sourceStructureId ? this.nearestStructure('sawbench', bot.x, bot.y, bot.sourceStructureId) : null;
      if (saw) return this.takeLooseItemNearStructure(bot, 'log', dt, saw);
      return this.takeLooseItem(bot, 'log', dt);
    },
    takeFactoryResource(bot, type, dt) {
      if (type === 'log') return this.takeLogSource(bot, dt);
      if (type === 'plank') return this.takePlankSource(bot, dt);
      if (type === 'pole') return this.takePoleSource(bot, dt);
      return this.takeLooseItem(bot, type, dt);
    },
    programHaulPlanks(bot, dt) {
      if (!bot.inventory) { this.takePlankSource(bot, dt); return; }
      const f = this.nearestStructure('factory', bot.x, bot.y, bot.targetFactoryId);
      if (!f) return bot.message = 'No factory.';
      if (!this.moveBotTo(bot, f, dt, 36)) return bot.message = `Delivering plank to ${f.name}.`;
      if (!this.depositHeldItemToStructure(f, bot.inventory.type, { worker: { bot } })) { bot.message = this.isStructureProcessing(f) ? `${f.name} is processing; waiting to add ${itemLabel(bot.inventory.type)}.` : `${f.name} cannot take ${itemLabel(bot.inventory.type)}.`; return; }
      bot.inventory = null;
      bot.message = this.isStructureProcessing(f) ? `Delivered plank and started ${f.processing.label} at ${f.name}.` : `Delivered plank to ${f.name}.`;
    },
    programCraftAxes(bot, dt) {
      const w = this.nearestStructure('workbench', bot.x, bot.y, bot.targetWorkbenchId);
      if (!w) return bot.message = 'No crude tool bench.';
      if (bot.inventory?.type === 'stick' || bot.inventory?.type === 'stone') {
        if (!this.moveBotTo(bot, w, dt, 34)) return bot.message = `Supplying ${itemLabel(bot.inventory.type)} to ${w.name}.`;
        if (!this.depositHeldItemToStructure(w, bot.inventory.type, { worker: { bot } })) { bot.message = this.isStructureProcessing(w) ? `${w.name} is processing; waiting to add ${itemLabel(bot.inventory.type)}.` : `${w.name} cannot take ${itemLabel(bot.inventory.type)}.`; return; }
        bot.inventory = null;
        bot.message = this.isStructureProcessing(w) ? `Delivered material and started ${w.processing.label} at ${w.name}.` : `Delivered material to ${w.name}.`;
        return;
      }
      if (this.isStructureProcessing(w) || (w.sticks >= 1 && w.stones >= 1)) {
        if (!this.moveBotTo(bot, w, dt, 34)) return bot.message = `Going to craft at ${w.name}.`;
        this.maybeStartStructureProcessing(w, { bot });
        bot.message = this.isStructureProcessing(w) ? `${w.name} is crafting ${w.processing.label}.` : `${w.name} needs materials.`;
        return;
      }
      const needed = w.sticks < 1 ? 'stick' : 'stone';
      this.takeLooseItem(bot, needed, dt);
    },
    programBuildBots(bot, dt) {
      const f = this.nearestStructure('factory', bot.x, bot.y, bot.targetFactoryId);
      if (!f) return bot.message = 'No factory.';
      const ready = Object.entries(FACTORY_BOT_RECIPE).every(([type, cost]) => (f[`${type}s`] ?? f[type] ?? 0) >= cost);
      if (ready || this.isStructureProcessing(f)) {
        if (!this.moveBotTo(bot, f, dt, 38)) return bot.message = `Assembling bot at ${f.name}.`;
        this.maybeStartStructureProcessing(f, { bot });
        bot.message = this.isStructureProcessing(f) ? `${f.name} is assembling a bot.` : `${f.name} needs materials.`;
        return;
      }
      if (bot.inventory && FACTORY_BOT_RECIPE[bot.inventory.type]) {
        if (!this.moveBotTo(bot, f, dt, 36)) return bot.message = `Supplying ${itemLabel(bot.inventory.type)} to ${f.name}.`;
        if (!this.depositHeldItemToStructure(f, bot.inventory.type, { worker: { bot } })) { bot.message = this.isStructureProcessing(f) ? `${f.name} is processing; waiting to add ${itemLabel(bot.inventory.type)}.` : `${f.name} cannot take ${itemLabel(bot.inventory.type)}.`; return; }
        bot.inventory = null;
        return;
      }
      const missing = Object.entries(FACTORY_BOT_RECIPE).find(([type, cost]) => (f[`${type}s`] ?? f[type] ?? 0) < cost)?.[0];
      if (missing) this.takeFactoryResource(bot, missing, dt);
    }
  });
}
