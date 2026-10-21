import type { AiProviderKind } from '../../../services/ai-provider-config.service'

export type AiProviderPreset = {
  id: string
  label: string
  hint: string
  kind: AiProviderKind
  baseUrl: string
  /**
   * Modelos sugeridos. NO se rellenan en el formulario: solo se usan para
   * poner primero (con la etiqueta "Recomendado") el que corresponda cuando
   * el proveedor devuelva su lista real de modelos.
   */
  recommendedText?: string
  recommendedVision?: string
  /** Dónde sacar la API key. */
  keyUrl?: string
}

/**
 * Atajos para no escribir a mano la URL de los proveedores más comunes.
 * Cualquier API con formato OpenAI (`/chat/completions`) funciona con
 * "Personalizado", así que la plataforma no depende de esta lista.
 */
export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'groq',
    label: 'Groq',
    hint: 'Rápido y con plan gratuito.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    recommendedText: 'openai/gpt-oss-120b',
    recommendedVision: 'qwen/qwen3.8-27b',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'GPT, con visión integrada.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    recommendedText: 'gpt-4.1-mini',
    recommendedVision: 'gpt-4.1-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Una sola key para cientos de modelos.',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    recommendedText: 'openai/gpt-4.1-mini',
    recommendedVision: 'openai/gpt-4.1-mini',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    hint: 'Google AI Studio.',
    kind: 'gemini',
    baseUrl: '',
    recommendedText: 'gemini-3.6-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'custom',
    label: 'Personalizado',
    hint: 'Cualquier API compatible con OpenAI (Ollama, Mistral, DeepSeek…).',
    kind: 'openai-compatible',
    baseUrl: '',
  },
]

export const KIND_LABEL: Record<AiProviderKind, string> = {
  'openai-compatible': 'Compatible con OpenAI',
  gemini: 'Google Gemini',
}
