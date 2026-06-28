// src/ui/chat-ui.js — chat message helpers and AI log formatting.
// v=ui_fix_boot_0628

import { estimateTokenCount, formatOllamaFinalPrompt } from '../assistant.js?v=t_building_kits_0618';

export function createChatUi({ dom, parseJsonPreview, stringifyLog }) {
  function addChat(kind, html) {
    const d = document.createElement('div');
    const labels = { user: 'You', assistant: 'Orchestrator', system: 'System', error: 'Error' };
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    d.className = `message ${kind}`;
    d.innerHTML = `<div class="message-meta"><span>${labels[kind] || kind}</span><time>${time}</time></div><div class="message-body">${html}</div>`;
    dom.chatLog.appendChild(d);
    dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
  }

  function formatTokenCount(tokens = 0) {
    const count = Math.max(0, Number(tokens) || 0);
    return `~${count.toLocaleString()} tokens`;
  }

  function formatAssistantPromptPreview(prompt) {
    return JSON.stringify({
      systemPrompt: parseJsonPreview(prompt.systemPrompt),
      userPrompt: parseJsonPreview(prompt.userPrompt),
      messages: (prompt.messages || []).map(message => ({
        role: message.role,
        content: parseJsonPreview(message.content)
      })),
      tokenCounts: {
        systemPrompt: prompt.systemPromptTokens ?? estimateTokenCount(prompt.systemPrompt || ''),
        userPrompt: prompt.userPromptTokens ?? estimateTokenCount(prompt.userPrompt || ''),
        messages: prompt.messagesTokenCount ?? estimateTokenCount(formatOllamaFinalPrompt(prompt.messages || [])),
        finalPrompt: prompt.finalPromptTokens ?? estimateTokenCount(prompt.finalPrompt || formatOllamaFinalPrompt(prompt.messages || []))
      },
      loadoutKnowledge: prompt.loadoutKnowledge,
      equippedPacks: prompt.equippedPacks,
      unlockedOps: prompt.unlockedOps,
      knowledge: prompt.knowledge
    }, null, 2);
  }

  function sentFinalPrompt(sent) {
    return sent?.finalPrompt || (sent?.body?.messages ? formatOllamaFinalPrompt(sent.body.messages) : 'Not available.');
  }

  function responseRawText(returned) {
    if (!returned) return '';
    if (returned.rawResponse !== undefined) return returned.rawResponse;
    if (returned.content !== undefined) return returned.content;
    if (returned.rawHttpBody !== undefined) return returned.rawHttpBody;
    return stringifyLog(returned);
  }

  function parsedOrError(returned) {
    if (!returned) return 'No returned data.';
    if (returned.parsed !== undefined) return returned.parsed;
    return { error: returned.error || returned.parseError || 'No parsed JSON.', parseError: returned.parseError || null, validationErrors: returned.validationErrors || null };
  }

  function logChatAi({ mode, sent, returned }) {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { time: stamp, mode, sent, returned };
    console.info('[Orchestrator chat AI]', entry);
    if (!dom.aiLog) return;
    const block = `[${stamp}] ${mode}\nRequest:\n${stringifyLog(sent?.request || sent?.body || sent)}\nFinal prompt:\n${sentFinalPrompt(sent)}\nLLM answer:\n${responseRawText(returned) || '(no raw LLM answer; mock parser result below)'}\nParsed JSON / error:\n${stringifyLog(parsedOrError(returned))}\n\n`;
    const previous = dom.aiLog.textContent === 'No chat requests yet.' ? '' : (dom.aiLog.textContent || '');
    dom.aiLog.textContent = `${block}${previous}`.slice(0, 100000);
  }

  return {
    addChat,
    formatTokenCount,
    formatAssistantPromptPreview,
    logChatAi,
    responseRawText,
    parsedOrError,
    sentFinalPrompt
  };
}
