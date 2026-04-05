export interface ClaudeModel {
  id: string
  label: string
  description: string
  tier: 'high' | 'balanced' | 'fast'
  isDefault?: boolean
}

// Static fallback — used when the support page cannot be reached.
// The live list is fetched from support.claude.com and cached in localStorage.
export const CLAUDE_MODELS: ClaudeModel[] = [
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Balanced · latest recommended default',
    tier: 'balanced',
    isDefault: true,
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    description: 'Most capable · best quality, slower responses',
    tier: 'high',
  },
  {
    id: 'claude-opus-4-5-20251101',
    label: 'Claude Opus 4.5',
    description: 'Most capable · previous generation',
    tier: 'high',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    description: 'Fastest · may not be available on all plans',
    tier: 'fast',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    label: 'Claude Sonnet 4.5',
    description: 'Balanced · previous generation',
    tier: 'balanced',
  },
]

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6'

export const CLAUDE_MODEL_IDS = CLAUDE_MODELS.map((m) => m.id)
