  getBotProgram(bot) {
    const tpl = PROGRAM_TEMPLATES[bot.program] || PROGRAM_TEMPLATES.idle;
    if (bot.program === 'taught_loop' && bot.taughtLoop?.length) {
      return { ...tpl, repeat: bot.taughtLoopRepeat !== false, steps: clone(bot.taughtLoop), parameters: { source: bot.customTemplateName ? `template: ${bot.customTemplateName}` : 'teach by doing recorder' }, resolvedSteps: clone(bot.taughtLoop) };
    }
    const targetSawbench = bot.targetStructureId ? this.structures.find(s => s.id === bot.targetStructureId) : null;
    const sourceSawbench = bot.sourceStructureId ? this.structures.find(s => s.id === bot.sourceStructureId) : null;
    const targetFactory = bot.targetFactoryId ? this.structures.find(s => s.id === bot.targetFactoryId) : null;
    const targetWorkbench = bot.targetWorkbenchId ? this.structures.find(s => s.id === bot.targetWorkbenchId) : null;
    const sourcePalette = bot.sourcePaletteId ? this.structures.find(s => s.id === bot.sourcePaletteId) : null;
    const zone = this.getBotZone(bot);
    return {
      ...tpl,
      parameters: {
        targetSawbench: targetSawbench ? { id: targetSawbench.ref, name: targetSawbench.name } : null,
        sourceSawbench: sourceSawbench ? { id: sourceSawbench.ref, name: sourceSawbench.name } : null,
        targetFactory: targetFactory ? { id: targetFactory.ref, name: targetFactory.name } : null,
        targetWorkbench: targetWorkbench ? { id: targetWorkbench.ref, name: targetWorkbench.name } : null,
        sourcePalette: sourcePalette ? { id: sourcePalette.ref, name: sourcePalette.name, storageType: sourcePalette.storageType, stored: sourcePalette.stored } : null,
        itemType: bot.pickupItemType || null,
        zone: zone ? { id: zone.id || null, name: this.zoneLabel(zone), kind: zone.kind, rect: zone.kind === 'rect' ? { x: Math.round(zone.x), y: Math.round(zone.y), w: Math.round(zone.w), h: Math.round(zone.h) } : undefined, radius: zone.kind === 'radius' ? { x: Math.round(zone.x || 0), y: Math.round(zone.y || 0), r: Math.round(zone.radius || DEFAULT_RESOURCE_RADIUS) } : undefined } : null
      },
      resolvedSteps: tpl.steps.map(step => this.resolveStepSlots(step, bot))
    };
  },
  resolveStepSlots(step, bot) {
    const zone = this.getBotZone(bot);
    const targetSawbench = bot.targetStructureId ? this.structures.find(s => s.id === bot.targetStructureId) : null;
    const sourceSawbench = bot.sourceStructureId ? this.structures.find(s => s.id === bot.sourceStructureId) : null;
    const targetFactory = bot.targetFactoryId ? this.structures.find(s => s.id === bot.targetFactoryId) : null;
    const targetWorkbench = bot.targetWorkbenchId ? this.structures.find(s => s.id === bot.targetWorkbenchId) : null;
    const sourcePalette = bot.sourcePaletteId ? this.structures.find(s => s.id === bot.sourcePaletteId) : null;
    const out = { ...step };
    for (const [k, v] of Object.entries(out)) {
      if (v === '$zone') out[k] = zone ? this.zoneLabel(zone) : 'anywhere';
      if (v === '$targetSawbench') out[k] = targetSawbench?.name || 'nearest sawbench';
      if (v === '$sourceSawbench') out[k] = sourceSawbench?.name || 'nearest sawbench with planks';
      if (v === '$targetFactory') out[k] = targetFactory?.name || 'nearest factory';
      if (v === '$targetWorkbench') out[k] = targetWorkbench?.name || 'nearest tool bench';
      if (v === '$sourcePalette') out[k] = sourcePalette?.name || 'ground items';
      if (v === '$itemType') out[k] = bot.pickupItemType || 'log';
    }
    return out;
  },
  normalizeUseHeldItemDslStep(raw, priorSteps = []) {
    const rawKind = raw.targetKind ?? raw.targetType ?? raw.useOn ?? raw.resourceKind ?? raw.resourceType ?? raw.resource ?? raw.objectKind ?? raw.object ?? raw.target ?? raw.structureType;
    const kind = String(rawKind || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
      tree: 'chop_tree', trees: 'chop_tree', wood: 'chop_tree', log_source: 'chop_tree',
      hemp: 'chop_hemp', hemp_plant: 'chop_hemp',
      stone: 'mine_stone', rock: 'mine_stone', rocks: 'mine_stone', stone_deposit: 'mine_stone', stone_node: 'mine_stone',
      dirt: 'dig_hole', ground_to_dig: 'dig_hole', dig_spot: 'dig_hole', open_dirt: 'dig_hole',
      hole: 'plant_seed', dug_hole: 'plant_seed', planting_hole: 'plant_seed',
      structure: 'deposit_to_structure', building: 'deposit_to_structure', sawbench: 'deposit_to_structure', workbench: 'deposit_to_structure', factory: 'deposit_to_structure', item_palette: 'deposit_to_structure', palette: 'deposit_to_structure', storage: 'deposit_to_structure',
      ground: 'drop_item', floor: 'drop_item', zone: 'drop_item', drop_zone: 'drop_item'
    };
    const op = aliases[kind];
    if (!op) return { error: 'use_held_item requires targetKind tree/hemp/stone_deposit/dig_spot/dug_hole/structure/ground' };
    const step = { ...raw, op };
    if (op === 'deposit_to_structure' && !step.type && !step.itemType && !step.item && !step.resource) {
      const previousPickup = [...priorSteps].reverse().find(prev => ['pick_up', 'pick_up_from_storage', 'pick_up_specific'].includes(prev.op) && prev.type);
      if (previousPickup?.type) step.type = previousPickup.type;
    }
    return { step };
  },
  validateDslProgram(candidate) {
    const program = candidate?.program || candidate;
    const errors = [];
    const details = [];
    const recordError = (message, detail = null) => {
      errors.push(message);
      if (detail) details.push({ message, ...detail });
    };
    const resolveKnownItemType = rawValue => {
      const type = this.normalizeItemType(rawValue, null);
      return ITEM_TYPES.includes(type) ? type : null;
    };
    const resolveStrictZone = (rawValue, stepIndex, op) => {
      const normalized = this.normalizeZoneSpec(rawValue);
      if (normalized.zoneId || normalized.zoneSpec) return normalized;
      recordError(`Step ${stepIndex}: ${op} references an unknown zone/location`, { code: 'unknown_zone_ref', field: 'zone', stepIndex, value: rawValue });
      return { zoneId: null, zoneSpec: null };
    };
    const steps = Array.isArray(program?.steps) ? program.steps : null;
    if (!steps) return { ok: false, error: 'DSL program must include a steps array' };
    if (!steps.length) errors.push('DSL program needs at least one step');
    if (steps.length > 24) errors.push('DSL program exceeds 24 step limit');
    const hasLegacyLoopStep = steps.at(-1)?.op === 'loop';
    const repeat = typeof program.repeat === 'boolean' ? program.repeat : hasLegacyLoopStep;
    if (typeof program.repeat === 'boolean' && !program.repeat && hasLegacyLoopStep) {
      recordError('program.repeat false conflicts with a final loop step', { code: 'repeat_conflict', field: 'program.repeat', stepIndex: 0, value: false });
    }
    const normalizedSteps = [];
    const requireItemType = new Set(['pick_up', 'pick_up_from_storage', 'pick_up_specific', 'deposit_to_structure', 'deposit_to_player', 'take_from_player', 'deploy_building_kit', 'find_item', 'deliver_to_sawbench', 'deliver_to_workbench', 'deliver_to_factory', 'if_inventory']);
    const zoneOps = new Set(['pick_up', 'drop_item', 'deploy_building_kit', 'find_item', 'find_nearest_tree', 'find_stone_deposit', 'find_hemp', 'find_dig_spot', 'find_dug_hole', 'chop_tree', 'search_tree', 'chop_hemp', 'search_hemp', 'mine_stone', 'dig_hole', 'plant_seed', 'guard_area']);
    for (let index = 0; index < steps.length; index++) {
      let raw = steps[index] || {};
      let op = String(raw.op || '').trim();
      if (op === 'use_held_item') {
        const resolved = this.normalizeUseHeldItemDslStep(raw, normalizedSteps);
        if (resolved.error) { recordError(`Step ${index + 1}: ${resolved.error}`, { code: 'invalid_use_held_item', field: 'targetKind', stepIndex: index + 1, value: raw.targetKind ?? raw.target ?? null }); continue; }
        raw = resolved.step;
        op = String(raw.op || '').trim();
      }
      if (!op || !ALLOWED_OPS.includes(op)) { recordError(`Step ${index + 1}: op ${op || '(missing)'} is not allowed`, { code: 'unknown_op', field: 'op', stepIndex: index + 1, value: op || null }); continue; }
      if (raw.steps || raw.children) recordError(`Step ${index + 1}: nested steps are not allowed`, { code: 'nested_steps_not_allowed', field: 'steps', stepIndex: index + 1 });
      if (op === 'loop') {
        if (index !== steps.length - 1) recordError('loop is only allowed as the final step', { code: 'misplaced_loop', field: 'op', stepIndex: index + 1, value: 'loop' });
        continue;
      }
      const step = { op };
      if (requireItemType.has(op)) {
        const rawType = raw.type || raw.itemType || raw.item || raw.resource;
        if (!rawType) recordError(`Step ${index + 1}: ${op} requires type`, { code: 'missing_item_type', field: 'type', stepIndex: index + 1 });
        else if (op === 'deploy_building_kit') {
          const kitType = this.normalizeBuildingKitItemType(rawType);
          if (!kitType) recordError(`Step ${index + 1}: deploy_building_kit requires a deployable building kit type`, { code: 'unknown_building_kit_type', field: 'type', stepIndex: index + 1, value: rawType });
          else step.type = kitType;
        } else {
          const knownType = resolveKnownItemType(rawType);
          if (!knownType) recordError(`Step ${index + 1}: unknown item type ${JSON.stringify(String(rawType))}`, { code: 'unknown_item_type', field: 'type', stepIndex: index + 1, value: rawType });
          else step.type = knownType;
        }
      }
      if (zoneOps.has(op) && (raw.zone || raw.zoneId || raw.zoneSpec || raw.area)) {
        const normalizedZone = resolveStrictZone(raw.zone || raw.zoneId || raw.zoneSpec || raw.area, index + 1, op);
        if (normalizedZone.zoneId) {
          step.zoneId = normalizedZone.zoneId;
          const zone = this.zones.find(z => z.id === normalizedZone.zoneId);
          if (zone) step.zoneLabel = this.zoneLabel(zone);
        }
        if (normalizedZone.zoneSpec) {
          step.zoneSpec = normalizedZone.zoneSpec;
          step.zoneLabel = this.zoneLabel(normalizedZone.zoneSpec);
        }
      }
      if (op === 'wait') step.seconds = clamp(Number(raw.seconds ?? raw.duration ?? 1), 0.1, 30);
      if (op === 'equip_item') {
        const rawType = raw.type || raw.itemType || raw.item || raw.weapon;
        const type = this.normalizeWeaponItemType(rawType);
        if (!type) recordError(`Step ${index + 1}: equip_item supports only sword, shield, or bow weaponry`, { code: 'unknown_equipment_type', field: 'type', stepIndex: index + 1, value: rawType });
        else step.type = type;
      }
      if (op === 'guard_area') {
        const radiusValue = Number(raw.radius ?? raw.range ?? raw.distance);
        if (Number.isFinite(radiusValue)) step.radius = clamp(radiusValue, 40, MAX_NEARBY_RADIUS);
        if (!step.zoneSpec && !step.zoneId && Number.isFinite(radiusValue)) {
          step.zoneSpec = { kind: 'nearby', radius: step.radius, name: `${Math.round(step.radius)}px nearby around bot` };
          step.zoneLabel = this.zoneLabel(step.zoneSpec);
        }
      }
      if (op === 'patrol_route') {
        const points = this.normalizePatrolPoints(raw.points ?? raw.route ?? raw.checkpoints);
        if (points.length < 2) errors.push(`Step ${index + 1}: patrol_route requires at least two points`);
        else step.points = points;
        step.radius = clamp(Number(raw.radius ?? raw.range ?? raw.distance ?? DEFAULT_NEARBY_RADIUS), 40, MAX_NEARBY_RADIUS);
      }
      if (op === 'craft_smithery') {
        const rawRecipe = raw.recipe || raw.type || raw.item || raw.itemType;
        const recipe = this.normalizeSmitheryRecipe(rawRecipe);
        if (!recipe) recordError(`Step ${index + 1}: craft_smithery supports sword/wooden_sword or shield/wooden_shield`, { code: 'unknown_recipe', field: 'recipe', stepIndex: index + 1, value: rawRecipe });
        else step.recipe = recipe;
      }
      if (op === 'craft_bowmaker') {
        const rawRecipe = raw.recipe || raw.type || raw.item || raw.itemType;
        const recipe = this.normalizeBowmakerRecipe(rawRecipe);
        if (!recipe) recordError(`Step ${index + 1}: craft_bowmaker supports only bow`, { code: 'unknown_recipe', field: 'recipe', stepIndex: index + 1, value: rawRecipe });
        else step.recipe = recipe;
      }
      if (op === 'craft_arrowmaker') {
        const rawRecipe = raw.recipe || raw.type || raw.item || raw.itemType;
        const recipe = this.normalizeArrowmakerRecipe(rawRecipe);
        if (!recipe) recordError(`Step ${index + 1}: craft_arrowmaker supports only arrow_pack`, { code: 'unknown_recipe', field: 'recipe', stepIndex: index + 1, value: rawRecipe });
        else step.recipe = recipe;
      }
      if (op === 'if_inventory') {
        const goto = Number(raw.goto);
        if (!Number.isInteger(goto) || goto < 0 || goto >= steps.length) errors.push(`Step ${index + 1}: if_inventory goto must be a valid zero-based step index`);
        else step.goto = goto;
      }
      if (op === 'assign_template') {
        const botRef = raw.botId ?? raw.bot ?? raw.targetBotId ?? raw.target ?? raw.botName;
        const targetBot = this.resolveBotReference(botRef);
        const templateName = String(raw.templateName || raw.template || raw.name || '').trim();
        if (!targetBot) recordError(`Step ${index + 1}: assign_template requires an existing bot`, { code: 'unknown_bot_ref', field: 'bot', stepIndex: index + 1, value: botRef });
        else Object.assign(step, { botId: targetBot.id, botName: this.botDisplayName?.(targetBot) || targetBot.name || `Bot ${targetBot.id}` });
        if (!templateName) recordError(`Step ${index + 1}: assign_template requires templateName`, { code: 'missing_template_name', field: 'templateName', stepIndex: index + 1 });
        else {
          step.templateName = templateName;
          const template = this.findCustomTemplate(templateName);
          if (!template) recordError(`Step ${index + 1}: template ${templateName} not found`, { code: 'unknown_template_name', field: 'templateName', stepIndex: index + 1, value: templateName });
        }
      }
      if (op === 'rename_bot') {
        const normalizedName = this.normalizeBotDisplayName(raw.name ?? raw.newName ?? raw.displayName ?? raw.label, { minLength: 2, maxLength: 32 });
        if (!normalizedName) errors.push(`Step ${index + 1}: rename_bot requires a 2-32 character name`);
        else step.name = normalizedName;
        const targetRaw = raw.target ?? raw.bot ?? raw.botId ?? raw.targetBotId;
        const selfTarget = targetRaw == null || targetRaw === '' || ['self', 'itself', 'this bot'].includes(String(targetRaw).trim().toLowerCase());
        if (!selfTarget) {
          const targetBot = this.resolveBotReference(targetRaw);
          if (!targetBot) recordError(`Step ${index + 1}: rename_bot target must be an existing bot`, { code: 'unknown_bot_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
          else Object.assign(step, { botId: targetBot.id, target: targetBot.name || `Bot ${targetBot.id}`, targetName: this.botDisplayName?.(targetBot) || targetBot.name || `Bot ${targetBot.id}` });
        }
      }
      if (op === 'promote_to_manager') {
        const targetRaw = raw.target ?? raw.bot ?? raw.botId ?? raw.targetBotId;
        const selfTarget = targetRaw == null || targetRaw === '' || ['self', 'itself', 'this bot'].includes(String(targetRaw).trim().toLowerCase());
        if (!selfTarget) {
          const targetBot = this.resolveBotReference(targetRaw);
          if (!targetBot) recordError(`Step ${index + 1}: promote_to_manager target must be an existing bot`, { code: 'unknown_bot_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
          else Object.assign(step, { botId: targetBot.id, target: targetBot.name || `Bot ${targetBot.id}`, targetName: this.botDisplayName?.(targetBot) || targetBot.name || `Bot ${targetBot.id}` });
        }
        step.knowledgePacks = this.normalizeManagerKnowledgePacks(raw.knowledgePacks ?? raw.packs ?? raw.loadout, DEFAULT_MANAGER_KNOWLEDGE_PACKS);
      }
      if (op === 'delegate_to_manager') {
        const message = this.sanitizeManagerMessage(raw.message ?? raw.text ?? raw.prompt ?? raw.instruction);
        if (!message) recordError(`Step ${index + 1}: delegate_to_manager requires message`, { code: 'missing_message', field: 'message', stepIndex: index + 1 });
        else step.message = message;
        const recipientRaw = raw.recipient ?? raw.manager ?? raw.target ?? raw.bot ?? raw.botId;
        const managerBot = this.resolveBotReference(recipientRaw);
        if (!managerBot) recordError(`Step ${index + 1}: delegate_to_manager recipient must be an existing manager bot`, { code: 'unknown_bot_ref', field: 'recipient', stepIndex: index + 1, value: recipientRaw });
        else if (!this.isManagerBot(managerBot)) recordError(`Step ${index + 1}: delegate_to_manager recipient must be a manager bot`, { code: 'bot_not_manager', field: 'recipient', stepIndex: index + 1, value: recipientRaw });
        else Object.assign(step, { recipient: managerBot.name || `Bot ${managerBot.id}`, recipientBotId: managerBot.id, recipientName: this.botDisplayName?.(managerBot) || managerBot.name || `Bot ${managerBot.id}` });
      }
      if (op === 'follow') {
        const targetRaw = raw.targetRef ?? raw.target ?? raw.follow ?? raw.player ?? raw.bot ?? 'me';
        const placeholder = typeof targetRaw === 'string' && targetRaw.startsWith('$');
        const target = placeholder ? null : this.resolveActorReference(targetRaw);
        if (!placeholder && !target) recordError(`Step ${index + 1}: follow requires an existing target actor`, { code: 'unknown_actor_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
        step.target = String(targetRaw || 'me');
        step.distance = clamp(Number(raw.distance ?? raw.spacing ?? DEFAULT_FOLLOW_DISTANCE), 18, 220);
        if (target) Object.assign(step, { targetRef: target.ref || (target === this.player ? 'player:local' : null), targetName: this.actorLabel(target) });
      }
      if (op === 'attack') {
        const rawType = raw.type ?? raw.monsterType ?? raw.kind ?? null;
        const targetRaw = raw.targetRef ?? raw.target ?? raw.enemy ?? raw.monster ?? raw.targetName ?? null;
        const genericTargetTypes = new Set(['monster', 'monsters', 'enemy', 'enemies', 'hostile', 'hostiles', 'night monster', 'night monsters', 'passive monster', 'passive monsters']);
        const targetText = String(targetRaw || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
        step.type = this.normalizeAttackType(rawType || (genericTargetTypes.has(targetText) ? targetText : 'monster'));
        const radiusValue = Number(raw.radius ?? raw.range ?? raw.distance);
        const zoneInput = raw.zone ?? raw.zoneId ?? raw.zoneSpec ?? raw.area ?? raw.location ?? (Number.isFinite(radiusValue) ? { kind: 'nearby', radius: radiusValue } : null);
        if (zoneInput) {
          const normalizedZone = resolveStrictZone((typeof zoneInput === 'string' && /\bnearby\b/i.test(zoneInput) && Number.isFinite(radiusValue)) ? { kind: 'nearby', radius: radiusValue } : zoneInput, index + 1, op);
          if (normalizedZone.zoneId) {
            step.zoneId = normalizedZone.zoneId;
            const zone = this.zones.find(z => z.id === normalizedZone.zoneId);
            if (zone) step.zoneLabel = this.zoneLabel(zone);
          }
          if (normalizedZone.zoneSpec) {
            step.zoneSpec = normalizedZone.zoneSpec;
            if (step.zoneSpec.kind === 'nearby' && Number.isFinite(radiusValue)) {
              step.zoneSpec.radius = clamp(radiusValue, 40, MAX_NEARBY_RADIUS);
              step.zoneSpec.name = `${Math.round(step.zoneSpec.radius)}px nearby around bot`;
            }
            step.zoneLabel = this.zoneLabel(step.zoneSpec);
          }
        }
        if (Number.isFinite(radiusValue)) step.radius = clamp(radiusValue, 40, MAX_NEARBY_RADIUS);
        if (targetRaw && !genericTargetTypes.has(targetText)) {
          const placeholder = typeof targetRaw === 'string' && targetRaw.startsWith('$');
          const target = placeholder ? null : this.resolveActorReference(targetRaw);
          if (target && this.isHostileTarget(target)) Object.assign(step, { target: String(targetRaw), targetRef: target.ref, targetName: this.actorLabel(target) });
          else if (!placeholder) recordError(`Step ${index + 1}: attack target must resolve to an existing hostile actor`, { code: 'unknown_actor_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
        }
      }
      if (op === 'pick_up_from_storage' || op === 'move_to_structure' || op === 'deposit_to_structure' || op === 'craft_smithery' || op === 'craft_bowmaker' || op === 'craft_arrowmaker' || op === 'disassemble_building_to_kit') {
        const sourceRaw = raw.sourceStructureId ?? raw.sourceId ?? raw.source;
        const targetRaw = raw.structureId ?? raw.targetStructureId ?? raw.targetId ?? raw.target ?? raw.structureName;
        const wantedType = op === 'pick_up_from_storage' ? 'item_palette' : op === 'craft_smithery' ? 'smithery' : op === 'craft_bowmaker' ? 'bowmaker' : op === 'craft_arrowmaker' ? 'arrowmaker' : (raw.structureType || null);
        const lookup = op === 'pick_up_from_storage' ? (sourceRaw ?? targetRaw) : targetRaw;
        const placeholder = typeof lookup === 'string' && lookup.startsWith('$');
        const structureId = placeholder ? null : this.normalizeStructureId(lookup, wantedType) || ((op === 'craft_smithery' || op === 'craft_bowmaker' || op === 'craft_arrowmaker') ? null : this.normalizeStructureId(lookup, null));
        const structure = structureId ? this.structures.find(s => s.id === structureId) : null;
        if (!placeholder && lookup != null && lookup !== '' && !structure) recordError(`Step ${index + 1}: ${op} requires an existing ${wantedType || 'structure'} target/source`, { code: 'unknown_structure_ref', field: op === 'pick_up_from_storage' ? 'source' : 'target', stepIndex: index + 1, value: lookup });
        if (!placeholder && op === 'disassemble_building_to_kit' && !this.canDisassembleStructure(structure)) recordError(`Step ${index + 1}: disassemble_building_to_kit requires a disassemblable building`, { code: 'structure_not_disassemblable', field: 'target', stepIndex: index + 1, value: lookup });
        if (structure) Object.assign(step, { structureId: structure.id, structureName: structure.name, structureType: structure.type, target: structure.name });
        else if (placeholder) Object.assign(step, { target: lookup, structureType: wantedType || raw.structureType || null });
      }
      normalizedSteps.push(step);
    }
    let held = null;
    for (let index = 0; index < normalizedSteps.length; index++) {
      const step = normalizedSteps[index];
      if (step.op === 'loop') break;
      if (step.op === 'pick_up' || step.op === 'pick_up_from_storage' || step.op === 'pick_up_specific' || step.op === 'take_from_player') {
        if (held && held !== step.type) errors.push(`Step ${index + 1}: cannot pick up ${itemLabel(step.type)} while already holding ${itemLabel(held)}`);
        held = step.type;
      }
      if (step.op === 'deposit_to_structure' || step.op === 'deposit_to_player' || step.op === 'deploy_building_kit') {
        if (!held) errors.push(`Step ${index + 1}: ${step.op} requires a prior pick_up step for ${itemLabel(step.type)}`);
        else if (held !== step.type) errors.push(`Step ${index + 1}: holds ${itemLabel(held)} but ${step.op} needs ${itemLabel(step.type)}`);
        held = null;
      }
      if (step.op === 'drop_item') {
        if (!held) errors.push(`Step ${index + 1}: drop_item requires a prior pick_up step for something to drop`);
        held = null;
      }
      if (step.op === 'disassemble_building_to_kit') {
        if (held) errors.push(`Step ${index + 1}: disassemble_building_to_kit needs empty hands, but holds ${itemLabel(held)}`);
        const kitType = buildingKitItemTypeFor(step.structureType);
        if (kitType) held = kitType;
      }
      if (step.op === 'plant_seed') {
        if (held && held !== 'tree_seed') errors.push(`Step ${index + 1}: plant_seed requires tree_seed, not ${itemLabel(held)}`);
        if (held === 'tree_seed') held = null;
      }
    }
    const normalizedProgram = { id: program.id || 'custom_loop', name: program.name || 'Generated DSL Loop', repeat: !!repeat, steps: normalizedSteps };
    return errors.length ? { ok: false, error: errors.join('; '), errors, details, program: normalizedProgram } : { ok: true, program: normalizedProgram, normalizedProgram, details };
  },

  assignCustomDslProgram({ botId, assignee = null, program, reason = '' }) {
    let bot = botId != null ? this.findBot(botId) : null;
    if (!bot && assignee?.strategy === 'any_eligible') {
      bot = this.findAnyEligibleWorkerBot();
      if (!bot) return { ok: false, error: 'No idle standard worker bot is available for assignee any_eligible' };
    }
    if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    if (assignee?.strategy === 'any_eligible') {
      if (!this.isStandardWorkerBot(bot)) return { ok: false, error: `${this.botDisplayName?.(bot) || `Bot ${bot.id}`} is not a standard worker bot` };
      if (!this.isIdleStandardWorkerBot(bot)) return { ok: false, error: `${this.botDisplayName?.(bot) || `Bot ${bot.id}`} is not idle` };
    }
    const checked = this.validateDslProgram(program);
    if (!checked.ok) return { ok: false, error: checked.error, validation: checked };
    bot.paused = false;
    bot.program = 'taught_loop';
    bot.state = 'taught_loop';
    bot.message = reason || `Generated DSL: ${checked.program.name}`;
    bot.customTemplateName = '';
    bot.taughtLoop = clone(checked.program.steps);
    bot.taughtLoopRepeat = checked.program.repeat !== false;
    bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0; bot.runtime = { pc: 0, memory: {}, wait: 0 };
    this.addFloat(`Bot ${bot.id}: generated DSL`, bot.x, bot.y - 22, '#d3a95f');
    this.syncTeachUi?.();
    // Campaign quest 4: bot taught via DSL
    this.onBotProgramAssigned?.(bot);
    return { ok: true, bot, program: checked.program, steps: clone(bot.taughtLoop) };
  },

  assignBotProgram({ botId, program, targetStructureId = null, sourceStructureId = null, sourcePaletteId = null, itemType = null, targetFactoryId = null, targetWorkbenchId = null, zoneId = null, zone = null, reason = '' }) {
    const bot = this.findBot(botId); if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    if (!PROGRAMS.includes(program)) return { ok: false, error: `Program ${program} not allowed` };
    const anyTargetId = this.normalizeStructureId(targetStructureId, null);
    const anyTarget = anyTargetId ? this.structures.find(s => s.id === anyTargetId) : null;
    const sawTarget = this.normalizeStructureId(anyTarget?.type === 'sawbench' ? anyTarget.id : targetStructureId, 'sawbench');
    const sawSource = this.normalizeStructureId(sourceStructureId, 'sawbench');
    const paletteSource = this.normalizeStructureId(sourcePaletteId || (anyTarget?.type === 'item_palette' ? anyTarget.id : null) || (program === 'pickup_item' ? sourceStructureId : null), 'item_palette');
    const factoryTarget = this.normalizeStructureId(targetFactoryId || (anyTarget?.type === 'factory' ? anyTarget.id : null) || (program === 'build_bots' ? targetStructureId : null), 'factory');
    const workbenchTarget = this.normalizeStructureId(targetWorkbenchId || (anyTarget?.type === 'workbench' ? anyTarget.id : null) || (program === 'craft_axes' ? targetStructureId : null), 'workbench');
    const normalizedItemType = this.normalizeItemType(itemType, 'log');
    const normalizedZone = this.normalizeZoneSpec(zone || zoneId);
    const taughtLoop = program === 'taught_loop' ? clone(this.recordedLoop.length ? this.recordedLoop : this.recorder.steps) : null;
    if (program === 'taught_loop' && !taughtLoop.length) return { ok: false, error: 'No recorded loop to assign' };
    bot.paused = false; bot.program = program; bot.state = program; bot.message = reason || `Assigned ${program}`;
    bot.customTemplateName = '';
    bot.taughtLoop = taughtLoop;
    bot.taughtLoopRepeat = true;
    bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0; bot.runtime = { pc: 0, memory: {}, wait: 0 };
    bot.targetStructureId = sawTarget;
    bot.sourceStructureId = sawSource;
    bot.sourcePaletteId = paletteSource;
    bot.pickupItemType = normalizedItemType;
    bot.targetFactoryId = factoryTarget;
    bot.targetWorkbenchId = workbenchTarget;
    bot.zoneId = normalizedZone.zoneId;
    bot.zoneSpec = normalizedZone.zoneSpec;
    const targetLabel = ['haul_planks', 'build_bots'].includes(program) && factoryTarget ? this.structures.find(s => s.id === factoryTarget)?.name : sawTarget ? this.structures.find(s => s.id === sawTarget)?.name : factoryTarget ? this.structures.find(s => s.id === factoryTarget)?.name : workbenchTarget ? this.structures.find(s => s.id === workbenchTarget)?.name : paletteSource ? this.structures.find(s => s.id === paletteSource)?.name : '';
    const sourceLabel = sawSource && sawSource !== sawTarget ? this.structures.find(s => s.id === sawSource)?.name : '';
    const zoneLabel = this.zoneLabel(this.getBotZone(bot));
    this.addFloat(`Bot ${bot.id}: ${program}`, bot.x, bot.y - 22, '#d3a95f');
    // Campaign quest 4: bot taught via built-in program
    this.onBotProgramAssigned?.(bot);
    return { ok: true, bot, targetLabel, sourceLabel, zoneLabel };
  },
