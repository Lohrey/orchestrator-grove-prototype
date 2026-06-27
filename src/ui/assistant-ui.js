// src/ui/assistant-ui.js — assistant loadout, prompt preview, semantic router UI,
// action pack editors, and custom pack alias editor.
// v=t_ui_refactor_0627

import {
  ASSISTANT_KNOWLEDGE_PACKS,
  DEFAULT_ASSISTANT_LOADOUT,
  getActionStepChainRows
} from '../data.js?v=t_building_kits_0618';
import {
  buildOllamaRequestBody,
  buildOpenAiCompatibleRequestBody,
  estimateTokenCount,
  normalizeAssistantKnowledgePack,
  normalizeAssistantLoadout,
  normalizeAssistantPackCatalog,
  summarizeAssistantLoadout
} from '../assistant.js?v=t_building_kits_0618';
import { createAssistantSemanticRouter } from '../assistant-router.js?v=t_building_kits_0618';
import { formatSemanticRouteSummary } from '../semantic-router.js?v=t_building_kits_0618';
import { escapeHtml } from '../utils.js?v=20260613-player-tools';
import { formatTokenCount } from './chat-ui.js?v=t_ui_refactor_0627';

export function createAssistantUi({ dom }) {
  const ASSISTANT_LOADOUT_KEY = 'orchestratorGrove.assistantLoadout.v1';
  const CUSTOM_ACTION_PACKS_KEY = 'orchestratorGrove.customActionPacks.v1';

  // Storage helpers (passed via deps so we don't duplicate dom-helpers)
  let customActionPacks = {};
  let assistantLoadout = [];
  let customPackAliasDraft = {};
  let semanticRouteTimer = null;

  const semanticRouter = createAssistantSemanticRouter();

  // ── utility helpers for action packs ──────────────────────────────────

  function splitPackText(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
  }

  function flattenPartAliases(partAliases = {}) {
    return [
      ...((partAliases.step || [])),
      ...Object.values(partAliases.args || {}).flatMap(values => values || [])
    ];
  }

  function actionRowsByOp() {
    return Object.fromEntries(getActionStepChainRows().map(row => [row.op, row]));
  }

  function defaultPackActionAliases(selectedOps = [], source = {}) {
    const rowsByOp = actionRowsByOp();
    return Object.fromEntries(selectedOps.map(op => {
      const sourceAliases = source?.[op];
      const rowAliases = rowsByOp[op]?.aliases || { step: [], args: {} };
      return [op, {
        step: [...(sourceAliases?.step || rowAliases.step || [])],
        args: Object.fromEntries((rowsByOp[op]?.args || []).map(arg => [arg, [...(sourceAliases?.args?.[arg] || rowAliases.args?.[arg] || [])]]))
      }];
    }));
  }

  function readAliasTextValue(value) {
    return [...new Set(splitPackText(value).map(item => item.toLowerCase()))];
  }

  function packIdFromName(name = '') {
    return `custom_${String(name || 'action_pack').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'action_pack'}`;
  }

  // ── persistence ────────────────────────────────────────────────────────

  function readCustomActionPacks(storageGet) {
    const raw = storageGet(CUSTOM_ACTION_PACKS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      return Object.fromEntries(entries
        .map(pack => normalizeAssistantKnowledgePack({ ...pack, custom: true }))
        .filter(pack => pack.id && !ASSISTANT_KNOWLEDGE_PACKS[pack.id])
        .map(pack => [pack.id, pack]));
    } catch {
      return {};
    }
  }

  function getActionPackCatalog() {
    return normalizeAssistantPackCatalog({ ...ASSISTANT_KNOWLEDGE_PACKS, ...customActionPacks });
  }

  function readAssistantLoadout(storageGet) {
    const raw = storageGet(ASSISTANT_LOADOUT_KEY);
    if (!raw) return normalizeAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT, getActionPackCatalog());
    try { return normalizeAssistantLoadout(JSON.parse(raw), getActionPackCatalog()); }
    catch { return normalizeAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT, getActionPackCatalog()); }
  }

  function getAssistantLoadout() {
    return assistantLoadout.slice();
  }

  function persistCustomActionPacks({ storageGet, storageSet, renderKnowledgePackSelector, game, updateSemanticRouterUi }) {
    return (message = 'Custom action packs saved to this browser.') => {
      const ok = storageSet(CUSTOM_ACTION_PACKS_KEY, JSON.stringify(Object.values(customActionPacks)));
      assistantLoadout = normalizeAssistantLoadout(assistantLoadout, getActionPackCatalog());
      storageSet(ASSISTANT_LOADOUT_KEY, JSON.stringify(assistantLoadout));
      renderKnowledgePackSelector(ok ? message : 'Custom action pack changed, but browser storage is unavailable.');
      game?.setManagerKnowledgePackCatalog?.(getActionPackCatalog());
      semanticRouter.syncCatalog(getActionPackCatalog(), getAssistantLoadout()).catch(() => {});
      updateSemanticRouterUi(semanticRouter.getLastRoute?.());
      return customActionPacks;
    };
  }

  // ── semantic routing ────────────────────────────────────────────────────

  function getSemanticRoutingEnabled() {
    return dom.semanticRouting?.checked !== false;
  }

  function getChatDraftText() {
    return String(dom.chatInput?.value || '').trim();
  }

  function getTemplateRoutingEnabled() {
    return dom.templateRouting?.checked === true;
  }

  function renderSemanticRouterPackSelector(selectedPackId = '') {
    if (!dom.semanticRouterPackSelect) return;
    const catalog = getActionPackCatalog();
    const packs = Object.values(catalog);
    const previousValue = dom.semanticRouterPackSelect.value;
    dom.semanticRouterPackSelect.innerHTML = packs.map(pack => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.name || pack.id)}</option>`).join('');
    const route = semanticRouter.getLastRoute?.();
    const nextSelected = selectedPackId || previousValue || route?.bestId || assistantLoadout[0] || '';
    if (nextSelected) dom.semanticRouterPackSelect.value = nextSelected;
  }

  function updateSemanticRouterUi(route = semanticRouter.getLastRoute?.()) {
    if (dom.semanticRouterStatus) {
      if (!getSemanticRoutingEnabled()) {
        dom.semanticRouterStatus.textContent = 'Semantic routing disabled. The assistant uses the full equipped loadout.';
      } else if (!route) {
        dom.semanticRouterStatus.textContent = 'Semantic router idle. Type in chat to route the request before parsing.';
      } else {
        dom.semanticRouterStatus.textContent = formatSemanticRouteSummary(route);
      }
    }
    if (dom.semanticRouterTrainBtn) dom.semanticRouterTrainBtn.disabled = !getSemanticRoutingEnabled();
    renderSemanticRouterPackSelector(route?.bestId || '');
    return route;
  }

  function scheduleSemanticRoutePreview({ updateAssistantPromptPreview }) {
    return () => {
      if (semanticRouteTimer) clearTimeout(semanticRouteTimer);
      if (!getSemanticRoutingEnabled()) {
        updateSemanticRouterUi(semanticRouter.getLastRoute?.());
        return;
      }
      const text = getChatDraftText();
      if (!text) {
        updateSemanticRouterUi(semanticRouter.getLastRoute?.());
        return;
      }
      semanticRouteTimer = setTimeout(async () => {
        try {
          await semanticRouter.route(text, { knowledgePacks: getActionPackCatalog(), loadout: getAssistantLoadout() });
          updateSemanticRouterUi(semanticRouter.getLastRoute?.());
          updateAssistantPromptPreview();
        } catch (error) {
          if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = `Semantic router error: ${error.message}`;
        }
      }, 140);
    };
  }

  async function getRoutedAssistantLoadout(text, { loadout = getAssistantLoadout(), knowledgePacks = getActionPackCatalog() } = {}) {
    if (!getSemanticRoutingEnabled()) return { route: null, loadout };
    try {
      const route = await semanticRouter.route(text, { knowledgePacks, loadout });
      const routedLoadout = route?.useRecommendedLoadout && route?.selectedLoadout?.length ? route.selectedLoadout : loadout;
      updateSemanticRouterUi(route);
      return { route, loadout: routedLoadout };
    } catch (error) {
      if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = `Semantic router failed: ${error.message}`;
      return { route: null, loadout };
    }
  }

  // ── prompt preview ──────────────────────────────────────────────────────

  function getAssistantLoadoutDebug() {
    const catalog = getActionPackCatalog();
    const summary = summarizeAssistantLoadout(assistantLoadout, catalog);
    return {
      selectedPackIds: summary.ids,
      selectedPackNames: summary.names,
      unlockedOps: summary.unlockedOps,
      optionalContext: summary.optionalContext,
      vocabulary: summary.vocabulary,
      concepts: summary.concepts,
      packs: summary.packs
    };
  }

  function updateAssistantPromptPreview({ game, getCurrentLocalAiConfig, getTemplateRoutingEnabled: getTpl, formatAssistantPromptPreview }) {
    return () => {
      if (!dom.assistantPromptPreview) return '';
      if (!game) {
        dom.assistantPromptPreview.textContent = JSON.stringify({ status: 'Prompt preview will appear after the world loads.' }, null, 2);
        return dom.assistantPromptPreview.textContent;
      }
      const requestText = (dom.chatInput?.value || '').trim() || '[current user request will appear here]';
      const { provider, model } = getCurrentLocalAiConfig();
      const knowledgePacks = getActionPackCatalog();
      const lastRoute = semanticRouter.getLastRoute?.();
      const routedLoadout = getSemanticRoutingEnabled() && lastRoute?.requestText === requestText && lastRoute?.useRecommendedLoadout && lastRoute?.selectedLoadout?.length
        ? lastRoute.selectedLoadout
        : getAssistantLoadout();
      const { prompt } = provider === 'tabbyapi'
        ? buildOpenAiCompatibleRequestBody(requestText, game, { model, enableTemplates: getTpl(), loadout: routedLoadout, knowledgePacks, temperature: 0.1 })
        : buildOllamaRequestBody(requestText, game, { model, enableTemplates: getTpl(), loadout: routedLoadout, knowledgePacks });
      if (dom.assistantBasePromptView) dom.assistantBasePromptView.textContent = prompt.systemPrompt;
      if (dom.assistantLoadoutView) dom.assistantLoadoutView.textContent = JSON.stringify(prompt.loadoutKnowledge, null, 2);
      if (dom.assistantPromptTokenSummary) dom.assistantPromptTokenSummary.textContent = formatTokenCount(prompt.finalPromptTokens ?? estimateTokenCount(prompt.finalPrompt || ''));
      const previewText = formatAssistantPromptPreview(prompt);
      dom.assistantPromptPreview.textContent = previewText;
      return previewText;
    };
  }

  function getSelectedKnowledgePackTokenCount(catalog = getActionPackCatalog(), loadout = assistantLoadout) {
    const selectedIds = new Set(loadout);
    return Object.values(catalog || {}).reduce((sum, pack) => sum + (selectedIds.has(pack.id) ? Number(pack.tokenCount || 0) : 0), 0);
  }

  function updateAssistantLoadoutDebug({ game, updateAssistantPromptPreview: updatePreview }) {
    return (message = '') => {
      const debug = getAssistantLoadoutDebug();
      if (dom.assistantLoadoutView && !game) dom.assistantLoadoutView.textContent = JSON.stringify(debug, null, 2);
      updatePreview();
      if (dom.knowledgePackTokenSummary) {
        const selectedTokens = getSelectedKnowledgePackTokenCount(getActionPackCatalog(), debug.selectedPackIds);
        dom.knowledgePackTokenSummary.textContent = `${debug.selectedPackIds.length} selected · ${formatTokenCount(selectedTokens)}`;
      }
      if (dom.knowledgePackStatus) dom.knowledgePackStatus.textContent = message || `${debug.selectedPackIds.length} knowledge/action pack(s) equipped · ${debug.unlockedOps.length} DSL op(s) unlocked.`;
      return debug;
    };
  }

  // ── custom pack alias editor ────────────────────────────────────────────

  function readCustomPackAliasEditor(selectedOps = null) {
    const ops = selectedOps || [...(dom.customPackActionList?.querySelectorAll('[data-action-pack-op]:checked') || [])].map(input => input.dataset.actionPackOp);
    if (!dom.customPackAliasEditor) return defaultPackActionAliases(ops, customPackAliasDraft);
    const defaults = defaultPackActionAliases(ops, customPackAliasDraft);
    return Object.fromEntries(ops.map(op => {
      const card = dom.customPackAliasEditor.querySelector(`[data-action-alias-card="${op}"]`);
      if (!card) return [op, defaults[op]];
      const row = actionRowsByOp()[op];
      return [op, {
        step: readAliasTextValue(card.querySelector('[data-action-alias-step]')?.value || ''),
        args: Object.fromEntries((row?.args || []).map(arg => [arg, readAliasTextValue(card.querySelector(`[data-action-alias-arg="${arg}"]`)?.value || '')]))
      }];
    }));
  }

  function renderCustomPackAliasEditor(selectedOps = [], sourceAliases = {}) {
    if (!dom.customPackAliasEditor) return;
    const rowsByOp = actionRowsByOp();
    const aliasesByOp = defaultPackActionAliases(selectedOps, sourceAliases);
    if (!selectedOps.length) {
      dom.customPackAliasEditor.innerHTML = '<p class="small">Select action steps to review and tweak default alias wording per step part.</p>';
      return;
    }
    dom.customPackAliasEditor.innerHTML = selectedOps.map(op => {
      const row = rowsByOp[op];
      const aliases = aliasesByOp[op] || { step: [], args: {} };
      return `
        <section class="knowledge-pack-card" data-action-alias-card="${escapeHtml(op)}">
          <p class="small"><b>${escapeHtml(row.label)}</b> <code>${escapeHtml(op)}</code></p>
          <label>Action words
            <textarea data-action-alias-step rows="2" placeholder="comma or newline separated">${escapeHtml((aliases.step || []).join('\n'))}</textarea>
          </label>
          ${(row.args || []).map(arg => `
            <label>${escapeHtml(arg)} aliases
              <textarea data-action-alias-arg="${escapeHtml(arg)}" rows="2" placeholder="comma or newline separated">${escapeHtml(((aliases.args || {})[arg] || []).join('\n'))}</textarea>
            </label>
          `).join('')}
        </section>
      `;
    }).join('');
  }

  function renderCustomPackActionSelector(selectedOps = []) {
    if (!dom.customPackActionList) return;
    const selected = new Set(selectedOps);
    const rows = getActionStepChainRows();
    dom.customPackActionList.innerHTML = rows.map(row => `
      <label class="checkline" title="${escapeHtml(row.description || row.promptSignature || row.op)}">
        <input type="checkbox" data-action-pack-op="${escapeHtml(row.op)}" ${selected.has(row.op) ? 'checked' : ''} />
        <span><b>${escapeHtml(row.label)}</b> <code>${escapeHtml(row.op)}</code><br><small>${escapeHtml((row.args || []).length ? `args: ${row.args.join(', ')}` : 'no args')}</small></span>
      </label>
    `).join('');
  }

  function clearCustomPackForm(pack = {}) {
    if (dom.customPackId) dom.customPackId.value = pack.id || '';
    if (dom.customPackName) dom.customPackName.value = pack.name || '';
    if (dom.customPackContextVariables) dom.customPackContextVariables.value = (pack.contextVariables || pack.optionalContext || []).join('\n');
    if (dom.customPackConcepts) dom.customPackConcepts.value = (pack.concepts || []).join('\n');
    if (dom.customPackVocabulary) dom.customPackVocabulary.value = (pack.vocabulary || []).join('\n');
    if (dom.customPackExamples) dom.customPackExamples.value = Array.isArray(pack.examples) ? pack.examples.map(example => typeof example === 'string' ? example : JSON.stringify(example)).join('\n') : '';
    const selectedOps = pack.unlockedOps || [];
    customPackAliasDraft = defaultPackActionAliases(selectedOps, pack.actionPartAliases || {});
    renderCustomPackActionSelector(selectedOps);
    renderCustomPackAliasEditor(selectedOps, customPackAliasDraft);
  }

  function readCustomPackForm() {
    const name = String(dom.customPackName?.value || '').trim();
    const rawId = String(dom.customPackId?.value || '').trim();
    const id = (rawId || packIdFromName(name)).toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
    const unlockedOps = [...(dom.customPackActionList?.querySelectorAll('[data-action-pack-op]:checked') || [])].map(input => input.dataset.actionPackOp);
    const actionPartAliases = readCustomPackAliasEditor(unlockedOps);
    return normalizeAssistantKnowledgePack({
      id,
      name: name || id,
      custom: true,
      unlockedOps,
      actionPartAliases,
      contextVariables: splitPackText(dom.customPackContextVariables?.value || ''),
      concepts: splitPackText(dom.customPackConcepts?.value || ''),
      vocabulary: splitPackText(dom.customPackVocabulary?.value || ''),
      examples: splitPackText(dom.customPackExamples?.value || '')
    });
  }

  function upsertCustomActionPack({ persistFn }) {
    return (input) => {
      const rawId = input.id || packIdFromName(input.name);
      const id = String(rawId || '').toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
      const pack = normalizeAssistantKnowledgePack({ ...input, custom: true, id });
      if (!pack.id) throw new Error('Custom action pack needs an id or name.');
      if (ASSISTANT_KNOWLEDGE_PACKS[pack.id]) throw new Error(`Custom action pack id ${pack.id} conflicts with a built-in pack.`);
      if (!pack.unlockedOps.length) throw new Error('Select at least one valid action step for the custom pack.');
      customActionPacks = { ...customActionPacks, [pack.id]: pack };
      persistFn(`Saved custom action pack ${pack.name}.`);
      return pack;
    };
  }

  function deleteCustomActionPack({ persistFn, clearForm }) {
    return (id) => {
      if (!customActionPacks[id]) return false;
      const { [id]: _removed, ...rest } = customActionPacks;
      customActionPacks = rest;
      assistantLoadout = assistantLoadout.filter(packId => packId !== id);
      persistFn(`Deleted custom action pack ${id}.`);
      clearForm();
      return true;
    };
  }

  // ── knowledge pack selector / action step table ─────────────────────────

  function renderKnowledgePackSelector({ game, updateAssistantLoadoutDebug: updateDebug }) {
    return (message = '') => {
      if (!dom.knowledgePackList) return updateDebug(message);
      if (dom.customPackActionList && !dom.customPackActionList.children.length) {
        renderCustomPackActionSelector();
        renderCustomPackAliasEditor([], {});
      }
      const selected = new Set(assistantLoadout);
      const catalog = getActionPackCatalog();
      if (dom.knowledgePackTokenSummary) {
        const selectedTokens = getSelectedKnowledgePackTokenCount(catalog, assistantLoadout);
        dom.knowledgePackTokenSummary.textContent = `${assistantLoadout.length} selected · ${formatTokenCount(selectedTokens)}`;
      }
      dom.knowledgePackList.innerHTML = Object.values(catalog).map(pack => `
        <article class="knowledge-pack-card" data-knowledge-card="${escapeHtml(pack.id)}">
          <label class="checkline knowledge-pack-title">
            <input type="checkbox" data-knowledge-pack="${escapeHtml(pack.id)}" ${selected.has(pack.id) ? 'checked' : ''} />
            <span><b>${escapeHtml(pack.name)}</b> <code>${escapeHtml(pack.id)}</code> <span class="knowledge-pack-kind">${pack.custom ? 'custom action pack' : 'built-in'}</span> <span class="knowledge-pack-tokens">${escapeHtml(formatTokenCount(pack.tokenCount || 0))}</span></span>
          </label>
          <p class="small"><b>Concepts:</b> ${escapeHtml((pack.concepts || []).join(' · '))}</p>
          <p class="small"><b>Vocabulary:</b> ${escapeHtml((pack.vocabulary || []).join(', '))}</p>
          <p class="small"><b>Context variables:</b> ${escapeHtml((pack.contextVariables || pack.optionalContext || []).join(', ') || 'none')}</p>
          <p class="small"><b>Ops:</b> ${pack.unlockedOps.map(op => `<code>${escapeHtml(op)}</code>`).join(' ')}</p>
          <p class="small"><b>Injected action details:</b> ${(pack.actions || []).map(action => `<code>${escapeHtml(`${action.op} ${action.dslSnippet}`)}</code>`).join(' ')}</p>
          <p class="small"><b>Alias context:</b> ${(pack.actions || []).map(action => `<code>${escapeHtml(`${action.op}: ${(flattenPartAliases(action.partAliases || {})).join(', ') || 'none'}`)}</code>`).join(' ')}</p>
          ${pack.custom ? `<div class="knowledge-pack-actions"><button type="button" data-edit-custom-pack="${escapeHtml(pack.id)}">Edit</button><button type="button" data-delete-custom-pack="${escapeHtml(pack.id)}">Delete</button></div>` : ''}
        </article>
      `).join('');
      return updateDebug(message);
    };
  }

  function inlineList(items = [], empty = 'none') {
    const values = items.filter(Boolean);
    return values.length ? values.map(value => `<code>${escapeHtml(value)}</code>`).join(' ') : `<span class="muted-cell">${escapeHtml(empty)}</span>`;
  }

  function renderActionStepChainTable() {
    if (!dom.actionStepChainTable) return [];
    const rows = getActionStepChainRows();
    dom.actionStepChainTable.innerHTML = `
      <table class="action-step-chain-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>DSL args</th>
            <th>DSL snippet</th>
            <th>Backend</th>
            <th>Packs</th>
            <th>Templates</th>
            <th>Recorder</th>
            <th>UI card</th>
            <th>Aliases</th>
            <th>Prompt signature</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td><b>${escapeHtml(row.label)}</b><code>${escapeHtml(row.op)}</code>${row.notes ? `<small>${escapeHtml(row.notes)}</small>` : ''}</td>
              <td>${inlineList(row.args, 'none')}</td>
              <td><code>${escapeHtml(row.dslSnippet || '')}</code></td>
              <td>${escapeHtml(row.backend)}</td>
              <td>${inlineList(row.packs, 'not exposed')}</td>
              <td>${inlineList(row.templates, 'none')}</td>
              <td>${row.recordable ? '<span class="chain-ok">recordable</span>' : '<span class="muted-cell">not recorded</span>'}</td>
              <td>${escapeHtml(row.uiCard || 'generic DSL card')}</td>
              <td>${inlineList(row.aliasVocabulary || [], 'none')}</td>
              <td><code>${escapeHtml(row.promptSignature || 'not in prompt')}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return rows;
  }

  function persistAssistantLoadout({ storageSet, renderKnowledgePackSelector: renderSelector, game, updateSemanticRouterUi }) {
    return (nextLoadout) => {
      assistantLoadout = normalizeAssistantLoadout(nextLoadout, getActionPackCatalog());
      const ok = storageSet(ASSISTANT_LOADOUT_KEY, JSON.stringify(assistantLoadout));
      renderSelector(ok ? 'Knowledge pack loadout saved to this browser.' : 'Knowledge pack loadout changed, but browser storage is unavailable.');
      game?.setManagerKnowledgePackCatalog?.(getActionPackCatalog());
      semanticRouter.syncCatalog(getActionPackCatalog(), getAssistantLoadout()).catch(() => {});
      updateSemanticRouterUi(semanticRouter.getLastRoute?.());
      return assistantLoadout;
    };
  }

  // ── init: wire up the semantic router state listener ─────────────────────

  function init({ storageGet, storageSet, game, getChatDraftTextFn }) {
    customActionPacks = readCustomActionPacks(storageGet);
    assistantLoadout = readAssistantLoadout(storageGet);
    semanticRouter.onStateChange(state => {
      updateSemanticRouterUi(state?.lastRoute || semanticRouter.getLastRoute?.());
      if (state?.lastRoute?.requestText && state.lastRoute.requestText === (getChatDraftTextFn || getChatDraftText)()) {
        // prompt preview update is handled by caller via scheduleSemanticRoutePreview
      }
    });
  }

  return {
    semanticRouter,
    ASSISTANT_LOADOUT_KEY,
    CUSTOM_ACTION_PACKS_KEY,
    init,
    getActionPackCatalog,
    getAssistantLoadout,
    getAssistantLoadoutDebug,
    getSelectedKnowledgePackTokenCount,
    getSemanticRoutingEnabled,
    getTemplateRoutingEnabled,
    getChatDraftText,
    getRoutedAssistantLoadout,
    renderSemanticRouterPackSelector,
    renderKnowledgePackSelector,
    renderActionStepChainTable,
    renderCustomPackActionSelector,
    renderCustomPackAliasEditor,
    readCustomPackAliasEditor,
    readCustomPackForm,
    clearCustomPackForm,
    upsertCustomActionPack,
    deleteCustomActionPack,
    persistAssistantLoadout,
    persistCustomActionPacks,
    updateSemanticRouterUi,
    updateAssistantPromptPreview,
    updateAssistantLoadoutDebug,
    scheduleSemanticRoutePreview,
    defaultPackActionAliases,
    actionRowsByOp,
    flattenPartAliases,
    get customActionPacks() { return customActionPacks; },
    set customActionPacks(v) { customActionPacks = v; },
    get assistantLoadout() { return assistantLoadout; },
    set assistantLoadout(v) { assistantLoadout = v; },
    get customPackAliasDraft() { return customPackAliasDraft; },
    set customPackAliasDraft(v) { customPackAliasDraft = v; }
  };
}
