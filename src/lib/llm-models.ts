export interface LLMModel {
  id: string
  label: string
  description: string
  tier: 'high' | 'balanced' | 'fast'
  isDefault?: boolean
}

// Static fallback — used when the Groq /v1/models API cannot be reached.
// The live list is fetched from the Groq API and cached in localStorage.
export const LLM_MODELS: LLMModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile',
    description: 'Balanced · best writing quality, recommended default',
    tier: 'balanced',
    isDefault: true,
  },
  {
    id: 'qwen-qwq-32b',
    label: 'Qwen QwQ 32B',
    description: 'Balanced · strong JSON adherence, good alternative',
    tier: 'balanced',
  },
  {
    id: 'llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout 17B',
    description: 'Fast · lightweight, good for structured extraction',
    tier: 'fast',
  },
  {
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    description: 'Fastest · best for simple extraction tasks',
    tier: 'fast',
  },
]

export const DEFAULT_LLM_MODEL = 'llama-3.3-70b-versatile'

export const LLM_MODEL_IDS = LLM_MODELS.map((m) => m.id)
