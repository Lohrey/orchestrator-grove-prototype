import { configureOnnxWasmPaths } from './onnx-config.js';

export const DEFAULT_BROWSER_STT_MODEL = 'whisper-tiny.en';

export const BROWSER_STT_MODELS = [
  {
    id: 'whisper-tiny.en',
    label: 'Whisper tiny.en',
    modelId: 'onnx-community/whisper-tiny.en',
    sizeMb: 151,
    languages: ['en'],
    description: 'Small English-only model with the fastest download.'
  },
  {
    id: 'whisper-tiny',
    label: 'Whisper tiny',
    modelId: 'onnx-community/whisper-tiny',
    sizeMb: 152,
    languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh'],
    description: 'Tiny multilingual Whisper for quick local transcription.'
  },
  {
    id: 'whisper-base',
    label: 'Whisper base',
    modelId: 'onnx-community/whisper-base',
    sizeMb: 291,
    languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh'],
    description: 'Bigger local model with better accuracy at higher download cost.'
  },
  {
    id: 'whisper-small',
    label: 'Whisper small',
    modelId: 'onnx-community/whisper-small',
    sizeMb: 967,
    languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh'],
    description: 'Largest browser model in this menu. Best accuracy, slowest download.'
  }
];

function getTransformersPromise() {
  return import('@huggingface/transformers');
}

function normalizeModelId(modelId) {
  return BROWSER_STT_MODELS.find(model => model.id === modelId)?.id || DEFAULT_BROWSER_STT_MODEL;
}

function resolveBackendPreference(preference = 'auto') {
  if (preference === 'webgpu' || preference === 'wasm') return preference;
  return navigator?.gpu ? 'webgpu' : 'wasm';
}

function inferTotalBytes(model, progress) {
  return Number(progress?.total || 0) || Math.max(0, Math.round((model?.sizeMb || 0) * 1024 * 1024));
}

function createEmptyState(modelId = DEFAULT_BROWSER_STT_MODEL) {
  return {
    status: 'idle',
    modelId: normalizeModelId(modelId),
    backend: 'auto',
    message: 'Browser model not loaded yet.',
    progress: 0,
    downloaded: 0,
    total: 0,
    currentFile: '',
    loadTimeMs: 0,
    transcriptionMs: 0,
    error: ''
  };
}

export function createBrowserSttController({ defaultModelId = DEFAULT_BROWSER_STT_MODEL } = {}) {
  let selectedModelId = normalizeModelId(defaultModelId);
  let currentSession = null;
  let currentState = createEmptyState(selectedModelId);
  let loadPromise = null;
  const listeners = new Set();

  const emit = () => {
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot);
  };

  const setState = patch => {
    currentState = { ...currentState, ...patch };
    emit();
    return currentState;
  };

  function getModel(modelId = selectedModelId) {
    return BROWSER_STT_MODELS.find(model => model.id === normalizeModelId(modelId)) || BROWSER_STT_MODELS[0];
  }

  function getState() {
    return {
      ...currentState,
      modelId: selectedModelId,
      model: getModel(selectedModelId)
    };
  }

  function onStateChange(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setSelectedModel(modelId) {
    selectedModelId = normalizeModelId(modelId);
    const model = getModel(selectedModelId);
    currentState = {
      ...createEmptyState(selectedModelId),
      backend: currentState.backend || 'auto',
      message: currentSession?.modelId === selectedModelId
        ? `${model.label} is loaded.`
        : `${model.label} is ready to download.`
    };
    emit();
    return getState();
  }

  function describeModel(modelId = selectedModelId) {
    const model = getModel(modelId);
    return `${model.label} (${model.sizeMb} MB)`;
  }

  function hasLoadedModel(modelId = selectedModelId) {
    return currentSession?.modelId === normalizeModelId(modelId);
  }

  function unload(modelId = selectedModelId) {
    const normalized = normalizeModelId(modelId);
    if (currentSession?.dispose && currentSession.modelId === normalized) {
      try {
        currentSession.dispose();
      } catch {
        // ignore dispose errors
      }
    }
    if (currentSession?.modelId === normalized) currentSession = null;
    currentState = {
      ...createEmptyState(normalized),
      backend: 'auto',
      message: `${getModel(normalized).label} unloaded.`
    };
    emit();
    return getState();
  }

  async function loadModel(modelId = selectedModelId, { backend = 'auto', onProgress } = {}) {
    const normalized = normalizeModelId(modelId);
    selectedModelId = normalized;
    const model = getModel(normalized);
    if (currentSession?.modelId === normalized) {
      setState({
        status: 'ready',
        backend: currentSession.backend,
        message: `${model.label} is already loaded on ${currentSession.backend.toUpperCase()}.`,
        loadTimeMs: currentSession.loadTimeMs || currentState.loadTimeMs || 0
      });
      return currentSession;
    }

    if (loadPromise && currentState.modelId === normalized) return loadPromise;

    const started = performance.now();
    const backendPreference = resolveBackendPreference(backend);
    const devices = backendPreference === 'webgpu' ? ['webgpu', 'wasm'] : [backendPreference];
    const transformers = await getTransformersPromise();
    configureOnnxWasmPaths(transformers.env);

    setState({
      status: 'downloading',
      backend: backendPreference,
      modelId: normalized,
      progress: 0,
      downloaded: 0,
      total: 0,
      currentFile: '',
      message: `Downloading ${model.label}...`,
      error: ''
    });

    const runLoad = async () => {
      let lastError = null;
      for (const device of devices) {
        try {
          setState({
            status: 'downloading',
            backend: device,
            message: `Downloading ${model.label} for ${device.toUpperCase()}...`
          });

          const progressCallback = progress => {
            if (progress?.status !== 'progress') return;
            const total = inferTotalBytes(model, progress);
            const downloaded = Number(progress?.loaded || 0);
            const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : currentState.progress;
            const currentFile = progress?.file || currentState.currentFile || '';
            const nextState = {
              status: 'downloading',
              backend: device,
              modelId: normalized,
              progress: percent,
              downloaded,
              total,
              currentFile,
              message: currentFile
                ? `Downloading ${model.label}: ${currentFile}`
                : `Downloading ${model.label}...`
            };
            currentState = { ...currentState, ...nextState };
            emit();
            onProgress?.({
              ...nextState,
              model
            });
          };

          const pipeline = await transformers.pipeline('automatic-speech-recognition', model.modelId, {
            device,
            dtype: device === 'webgpu' ? 'q4f16' : 'q8',
            progress_callback: progressCallback
          });

          currentSession = {
            modelId: normalized,
            backend: device,
            pipeline,
            loadTimeMs: Math.round(performance.now() - started),
            dispose: () => {
              try {
                pipeline?.dispose?.();
              } catch {
                // ignore dispose errors
              }
            }
          };

          setState({
            status: 'ready',
            backend: device,
            progress: 100,
            downloaded: currentState.downloaded || currentState.total || 0,
            total: currentState.total || 0,
            currentFile: '',
            loadTimeMs: currentSession.loadTimeMs,
            message: `${model.label} loaded on ${device.toUpperCase()}.`,
            error: ''
          });

          return currentSession;
        } catch (error) {
          lastError = error;
        }
      }

      const message = lastError instanceof Error ? lastError.message : 'Failed to load browser model';
      setState({
        status: 'error',
        backend: backendPreference,
        message,
        error: message
      });
      throw new Error(message);
    };

    loadPromise = runLoad();
    try {
      return await loadPromise;
    } finally {
      loadPromise = null;
    }
  }

  function concatAudio(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const audio = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }
    return audio;
  }

  async function transcribe(audio, sampleRate = 16000, { modelId = selectedModelId, backend = 'auto' } = {}) {
    const normalized = normalizeModelId(modelId);
    const model = getModel(normalized);
    const session = await loadModel(normalized, { backend });
    const started = performance.now();
    setState({
      status: 'processing',
      modelId: normalized,
      backend: session.backend,
      message: `Transcribing with ${model.label}...`,
      error: ''
    });

    const result = await session.pipeline(audio, {
      sampling_rate: sampleRate,
      return_timestamps: true,
      max_new_tokens: 1024
    });

    const transcriptionMs = Math.round(performance.now() - started);
    setState({
      status: 'ready',
      modelId: normalized,
      backend: session.backend,
      transcriptionMs,
      message: `${model.label} is ready.`
    });

    return {
      text: result?.text || '',
      chunks: result?.chunks || [],
      metrics: {
        totalMs: transcriptionMs,
        backend: session.backend,
        loadTimeMs: session.loadTimeMs || 0
      }
    };
  }

  return {
    getCatalog: () => BROWSER_STT_MODELS.map(model => ({ ...model })),
    getModel,
    getState,
    getSelectedModel: () => selectedModelId,
    setSelectedModel,
    describeModel,
    hasLoadedModel,
    onStateChange,
    loadModel,
    transcribe,
    unload,
    concatAudio
  };
}
