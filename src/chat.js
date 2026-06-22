export function createChatController({
  chatInput,
  chatForm,
  micButton,
  asrStatus,
  quickCommands,
  getAsrMode = () => 'zipformer_whisper',
  getBrowserSttModel = () => 'whisper-tiny.en',
  browserStt = null,
  onSubmit
}) {
  let lastSelection = { start: 0, end: 0 };
  let transcriptDraft = null;
  let ignoreRemember = false;
  const FASTER_WHISPER_MODE = 'faster_whisper';
  const BROWSER_WHISPER_MODE = 'browser_whisper';
  const asr = {
    ws: null,
    stream: null,
    ctx: null,
    source: null,
    node: null,
    gain: null,
    mediaRecorder: null,
    chunks: [],
    browserChunks: [],
    browserModelId: '',
    recording: false,
    sessionId: 0,
    segment: 0,
    lastPartial: '',
    boundary: '',
    stopTimer: null
  };
  let voiceTargetInput = chatInput;

  const getInput = () => voiceTargetInput || chatInput;
  const isTypingTarget = t => ['input', 'textarea', 'select'].includes(t?.tagName?.toLowerCase()) || t?.isContentEditable;
  const isFasterWhisperMode = () => getAsrMode() === FASTER_WHISPER_MODE;
  const isBrowserWhisperMode = () => getAsrMode() === BROWSER_WHISPER_MODE;
  const getBrowserModelInfo = () => {
    const modelId = browserStt?.getSelectedModel?.() || getBrowserSttModel();
    return browserStt?.getModel?.(modelId) || { id: modelId, label: modelId, sizeMb: 0 };
  };
  const modeText = () => {
    if (getAsrMode() === 'whisper_direct') {
      return {
        connecting: 'Connecting to Sherpa Whisper direct...',
        ready: 'Listening with Whisper direct... stop mic to commit final transcript.',
        listening: 'Listening... final text appears when stopped.',
        committed: 'Committed Whisper direct transcript.'
      };
    }
    if (isFasterWhisperMode()) {
      return {
        connecting: 'Preparing browser recording for faster-whisper...',
        ready: 'Recording for faster-whisper... stop mic to upload and transcribe.',
        listening: 'Recording... final text appears after upload.',
        committed: 'Committed faster-whisper transcript.'
      };
    }
    if (isBrowserWhisperMode()) {
      const model = getBrowserModelInfo();
      return {
        connecting: `Loading ${model.label} in your browser...`,
        ready: `Listening locally with ${model.label}... stop mic to transcribe.`,
        listening: `Listening locally with ${model.label}...`,
        committed: `Committed ${model.label} browser transcript.`
      };
    }
    return {
      connecting: 'Connecting to Sherpa Zipformer + Whisper ASR...',
      ready: 'Listening live... speak, click variables, continue.',
      listening: 'Listening...',
      committed: 'Committed speech segment.'
    };
  };
  const getSelection = () => {
    const input = getInput();
    return { start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length };
  };
  function remember() { if (!ignoreRemember) lastSelection = getSelection(); }
  function setValueCaret(value, caret) { const input = getInput(); input.value = value; input.focus(); ignoreRemember = true; input.setSelectionRange(caret, caret); lastSelection = { start: caret, end: caret }; setTimeout(() => { ignoreRemember = false; }, 0); }
  function replaceRange(start, end, text) { const input = getInput(); const value = input.value.slice(0, start) + text + input.value.slice(end); const caret = start + text.length; setValueCaret(value, caret); input.dispatchEvent(new Event('input', { bubbles: true })); return { start, end: caret }; }
  function insertAtCursor(text, { replaceSelection = true } = {}) { const input = getInput(); const s = document.activeElement === input ? getSelection() : lastSelection; const prefix = s.start > 0 && !/\s$/.test(input.value.slice(0, s.start)) && !/^\s|[.,!?;:}]/.test(text) ? ' ' : ''; return replaceRange(s.start, replaceSelection ? s.end : s.start, prefix + text); }
  function resetDraft(clear = false) { transcriptDraft = null; if (clear) { asr.lastPartial = ''; asr.boundary = ''; } }
  function markBoundary() { if (!asr.recording) return; if (transcriptDraft) { transcriptDraft = null; asr.boundary = asr.lastPartial || asr.boundary; } }
  function deltaAfterBoundary(text) { const b = asr.boundary; if (!b) return text; const t = text.toLowerCase(), bb = b.toLowerCase(); if (t.startsWith(bb)) return text.slice(b.length).trimStart(); let i = 0; while (i < Math.min(t.length, bb.length) && t[i] === bb[i]) i++; return i ? text.slice(i).trimStart() : text; }
  function normalizeFinal(text) { const t = String(text || '').trim(); return t ? `${t} ` : ''; }
  function applyTranscript(text, isFinal = false, segment = 0) {
    if (!text) return;
    if (segment !== asr.segment) { asr.segment = segment; resetDraft(true); }
    asr.lastPartial = text;
    const next = isFinal ? normalizeFinal(deltaAfterBoundary(text)) : deltaAfterBoundary(text);
    if (!next) { if (isFinal) resetDraft(true); return; }
    const input = getInput();
    const base = transcriptDraft || (document.activeElement === input ? getSelection() : lastSelection);
    const nextRange = replaceRange(base.start, base.end, next);
    if (isFinal) { asr.segment = segment + 1; resetDraft(true); } else transcriptDraft = nextRange;
  }

  function setStatus(text, err = false) { if (!asrStatus) return; asrStatus.textContent = text || ''; asrStatus.classList.toggle('is-error', Boolean(err)); }
  function setRecording(v) { asr.recording = v; micButton?.classList.toggle('is-recording', v); micButton?.setAttribute('aria-pressed', String(v)); if (micButton) { micButton.textContent = v ? '■' : '🎙'; micButton.title = v ? 'Stop voice input' : 'Start voice input'; } }
  function apiLocal() { return ['127.0.0.1', 'localhost'].includes(location.hostname) && location.port && location.port !== '8096'; }
  function wsUrl() {
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = apiLocal() ? 'ws://127.0.0.1:8096/asr/ws' : `${scheme}//${location.host}/asr/ws`;
    return `${base}?mode=${encodeURIComponent(getAsrMode())}`;
  }
  function transcribeUrl() {
    const base = apiLocal() ? 'http://127.0.0.1:8096/asr/transcribe' : `${location.origin}/asr/transcribe`;
    return `${base}?mode=${encodeURIComponent(FASTER_WHISPER_MODE)}`;
  }
  function preferredAudioMime() {
    if (!window.MediaRecorder) return '';
    const choices = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return choices.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }
  function audioExtension(type) { if (/ogg/.test(type)) return 'ogg'; if (/mp4|mpeg/.test(type)) return 'm4a'; if (/wav/.test(type)) return 'wav'; return 'webm'; }

  async function captureNode(audioContext, ws, sessionId, onChunk = null) {
    if (audioContext.audioWorklet && window.AudioWorkletNode) {
      const code = `class PcmCaptureProcessor extends AudioWorkletProcessor{process(inputs){const input=inputs[0]&&inputs[0][0];if(!input)return true;const ratio=sampleRate/16000;const out=new Float32Array(Math.max(1,Math.floor(input.length/ratio)));for(let i=0;i<out.length;i++){const s=Math.floor(i*ratio),e=Math.min(input.length,Math.floor((i+1)*ratio));let sum=0,c=0;for(let j=s;j<e;j++){sum+=input[j];c++}out[i]=c?sum/c:0}this.port.postMessage(out,[out.buffer]);return true}};registerProcessor('pcm-capture-processor',PcmCaptureProcessor);`;
      const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      try { await audioContext.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      const node = new AudioWorkletNode(audioContext, 'pcm-capture-processor');
      node.port.onmessage = e => {
        if (sessionId !== asr.sessionId || !asr.recording) return;
        const chunk = e.data instanceof Float32Array ? e.data : new Float32Array(e.data);
        if (ws?.readyState === WebSocket.OPEN) ws.send(chunk.buffer);
        else onChunk?.(chunk);
      };
      return node;
    }
    throw new Error('AudioWorklet unavailable in this browser');
  }

  function parseAsr(raw) { try { const d = JSON.parse(raw); return { type: d.type || (d.final ? 'final' : 'partial'), text: d.text || d.transcript || d.partial || '', final: Boolean(d.final || d.isFinal || d.type === 'final'), segment: Number(d.segment || 0), message: d.message || '', mode: d.mode || '', supportsPartials: d.supportsPartials !== false }; } catch { return null; } }
  function cleanup() {
    if (asr.stopTimer) clearTimeout(asr.stopTimer);
    asr.stopTimer = null;
    asr.node?.disconnect();
    asr.source?.disconnect();
    asr.gain?.disconnect();
    if (asr.ctx && asr.ctx.state !== 'closed') asr.ctx.close().catch(() => {});
    if (asr.ws?.readyState === WebSocket.OPEN) {
      try { asr.ws.close(); } catch {}
    }
    if (asr.mediaRecorder && asr.mediaRecorder.state !== 'inactive') {
      try { asr.mediaRecorder.stop(); } catch {}
    }
    asr.stream?.getTracks().forEach(t => t.stop());
    Object.assign(asr, { ws: null, stream: null, ctx: null, source: null, node: null, gain: null, mediaRecorder: null, chunks: [], browserChunks: [], browserModelId: '' });
    setRecording(false);
  }

  async function sendRecordedAudio(blob) {
    const form = new FormData();
    const type = blob.type || 'audio/webm';
    form.append('file', blob, `voice.${audioExtension(type)}`);
    const res = await fetch(transcribeUrl(), { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    return data.text || data.transcript || '';
  }

  async function startRecordedVoice() {
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('Voice input needs browser microphone support.', true);
    if (!window.MediaRecorder) return setStatus('faster-whisper mode needs browser MediaRecorder support.', true);
    remember(); resetDraft(true); const sessionId = ++asr.sessionId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = preferredAudioMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      asr.chunks = [];
      recorder.ondataavailable = e => { if (e.data?.size) asr.chunks.push(e.data); };
      recorder.onerror = e => { if (sessionId === asr.sessionId) { setStatus(`Recording error: ${e.error?.message || 'MediaRecorder failed'}`, true); cleanup(); } };
      recorder.onstop = async () => {
        if (sessionId !== asr.sessionId) return;
        const chunks = asr.chunks.slice();
        const type = recorder.mimeType || mimeType || 'audio/webm';
        asr.stream?.getTracks().forEach(t => t.stop());
        setRecording(false);
        try {
          const blob = new Blob(chunks, { type });
          if (!blob.size) throw new Error('No recorded audio captured');
          setStatus('Uploading recording to faster-whisper...');
          const text = await sendRecordedAudio(blob);
          if (text) { applyTranscript(text, true, asr.segment); setStatus(modeText().committed); }
          else setStatus('faster-whisper returned no speech.', true);
        } catch (e) {
          setStatus(`faster-whisper unavailable: ${e.message}`, true);
        } finally {
          if (sessionId === asr.sessionId) cleanup();
        }
      };
      Object.assign(asr, { stream, mediaRecorder: recorder, chunks: [] });
      recorder.start();
      setRecording(true); setStatus(modeText().ready);
    } catch (e) { if (sessionId === asr.sessionId) { setStatus(`Mic/recording unavailable: ${e.message}`, true); cleanup(); } }
  }

  async function startBrowserVoice() {
    if (!browserStt?.loadModel || !browserStt?.transcribe) return setStatus('Browser STT is not wired up yet.', true);
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('Voice input needs browser microphone support.', true);
    if (!window.AudioWorkletNode) return setStatus('Browser STT needs AudioWorklet support.', true);
    remember(); resetDraft(true); const sessionId = ++asr.sessionId;
    const modelId = browserStt.getSelectedModel?.() || getBrowserSttModel();
    const model = browserStt.getModel?.(modelId) || { id: modelId, label: modelId, sizeMb: 0 };
    try {
      setStatus(`Loading ${model.label} in your browser...`);
      await browserStt.loadModel(modelId, {
        backend: 'auto',
        onProgress: progress => {
          if (sessionId !== asr.sessionId) return;
          const pct = Number(progress?.progress || 0);
          const file = progress?.currentFile ? ` ${progress.currentFile}` : '';
          setStatus(`Downloading ${model.label}... ${pct}%${file}`);
        }
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaStreamSource(stream);
      const chunks = [];
      const node = await captureNode(ctx, null, sessionId, chunk => chunks.push(chunk));
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(node);
      node.connect(gain);
      gain.connect(ctx.destination);
      Object.assign(asr, { stream, ctx, source, node, gain, browserChunks: chunks, browserModelId: modelId });
      setRecording(true);
      setStatus(modeText().ready);
    } catch (e) {
      if (sessionId === asr.sessionId) {
        setStatus(`Browser STT unavailable: ${e.message}`, true);
        cleanup();
      }
    }
  }

  async function stopBrowserVoice() {
    const sessionId = asr.sessionId;
    const modelId = asr.browserModelId || browserStt?.getSelectedModel?.() || getBrowserSttModel();
    const model = browserStt?.getModel?.(modelId) || { id: modelId, label: modelId };
    setRecording(false);
    setStatus(`Transcribing with ${model.label} locally...`);
    const chunks = asr.browserChunks.slice();
    asr.stream?.getTracks().forEach(t => t.stop());
    try {
      const audio = browserStt?.concatAudio?.(chunks) || (() => {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const pcm = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          pcm.set(chunk, offset);
          offset += chunk.length;
        }
        return pcm;
      })();
      if (!audio.length) throw new Error('No recorded audio captured');
      const result = await browserStt.transcribe(audio, 16000, { modelId, backend: 'auto' });
      const text = result.text || '';
      if (text) { applyTranscript(text, true, asr.segment); setStatus(modeText().committed); }
      else setStatus('Browser model returned no speech.', true);
    } catch (e) {
      setStatus(`Browser STT unavailable: ${e.message}`, true);
    } finally {
      if (sessionId === asr.sessionId) cleanup();
    }
  }

  async function startVoice() {
    if (isFasterWhisperMode()) return startRecordedVoice();
    if (isBrowserWhisperMode()) return startBrowserVoice();
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('Voice input needs browser microphone support.', true);
    remember(); resetDraft(true); const sessionId = ++asr.sessionId;
    try {
      const copy = modeText();
      const ws = new WebSocket(wsUrl()); asr.ws = ws; ws.binaryType = 'arraybuffer'; setStatus(copy.connecting);
      ws.onmessage = e => { if (sessionId !== asr.sessionId) return; const m = parseAsr(e.data); if (!m) return; const liveCopy = modeText(); if (m.type === 'ready') return setStatus(m.mode === 'whisper_direct' || m.mode === FASTER_WHISPER_MODE || m.supportsPartials === false ? liveCopy.ready : liveCopy.ready); if (m.type === 'error') return setStatus(`ASR error: ${m.message}`, true); if (m.type === 'closed') { cleanup(); return setStatus('Voice stopped. Transcript committed.'); } if (m.text) { applyTranscript(m.text, m.final, m.segment); setStatus(m.final ? liveCopy.committed : liveCopy.listening); } };
      ws.onerror = () => { if (sessionId === asr.sessionId) { setStatus('ASR WebSocket error.', true); cleanup(); } };
      ws.onclose = () => { if (sessionId === asr.sessionId) cleanup(); };
      await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext; const ctx = new AudioContextClass(); const source = ctx.createMediaStreamSource(stream); const node = await captureNode(ctx, ws, sessionId); const gain = ctx.createGain(); gain.gain.value = 0; source.connect(node); node.connect(gain); gain.connect(ctx.destination); Object.assign(asr, { stream, ctx, source, node, gain }); setRecording(true); setStatus(modeText().ready);
    } catch (e) { if (sessionId === asr.sessionId) { setStatus(`Mic/ASR unavailable: ${e.message}`, true); cleanup(); } }
  }

  async function stopVoice() {
    if (asr.mediaRecorder) {
      setRecording(false);
      setStatus('Finalizing faster-whisper recording...');
      try { if (asr.mediaRecorder.state !== 'inactive') asr.mediaRecorder.stop(); else cleanup(); } catch { cleanup(); }
      return;
    }
    if (asr.browserModelId || asr.browserChunks.length) {
      await stopBrowserVoice();
      return;
    }
    const ws = asr.ws, sessionId = asr.sessionId;
    setRecording(false);
    setStatus('Finalizing speech...');
    asr.stream?.getTracks().forEach(t => t.stop());
    if (ws?.readyState === WebSocket.OPEN) {
      try { ws.send('Done'); } catch {}
      asr.stopTimer = setTimeout(() => { if (sessionId === asr.sessionId) cleanup(); }, 2500);
    } else cleanup();
    resetDraft(false);
  }
  function toggleVoice() { asr.recording ? stopVoice() : startVoice(); }
  function setVoiceTargetInput(input) { voiceTargetInput = input || chatInput; remember(); }
  function clearVoiceTargetInput() { voiceTargetInput = chatInput; remember(); }

  ['click', 'keyup', 'input', 'select', 'focus', 'mouseup'].forEach(type => chatInput.addEventListener(type, () => { if (['click', 'keyup', 'mouseup'].includes(type)) markBoundary(); remember(); }));
  document.addEventListener('selectionchange', () => { if (document.activeElement === chatInput) remember(); });
  micButton?.addEventListener('mousedown', e => { e.preventDefault(); remember(); });
  micButton?.addEventListener('click', toggleVoice);
  chatForm.addEventListener('submit', e => { e.preventDefault(); resetDraft(true); const text = chatInput.value.trim(); if (!text) return; chatInput.value = ''; remember(); onSubmit(text); });
  quickCommands?.addEventListener('mousedown', e => { if (e.target.closest('button')) { e.preventDefault(); markBoundary(); remember(); } });
  quickCommands?.addEventListener('click', e => { const btn = e.target.closest('button[data-command],button[data-insert]'); if (!btn) return; markBoundary(); if (btn.dataset.insert) { insertAtCursor(btn.dataset.insert); asr.boundary = asr.lastPartial || asr.boundary; return; } chatInput.value = btn.dataset.command; chatInput.focus(); chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length); remember(); });

  return { isTypingTarget, insertAtCursor, applyTranscript, markBoundary, getSelection, wsUrl, transcribeUrl, asr, startVoice, stopVoice, toggleVoice, isRecording: () => asr.recording, setVoiceTargetInput, clearVoiceTargetInput };
}
