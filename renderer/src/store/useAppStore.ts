import { create } from 'zustand'

export type StyleType = 
  | 'motivational' 
  | 'confident' 
  | 'accomplishment' 
  | 'networking' 
  | 'creative' 
  | 'standard' 
  | 'analytical' 
  | 'custom'

export interface PositionParseResult {
  position_title: string
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  key_skills: string[]
  required_experience: string | null
  industry: string | null
  position_summary: string
  language_detected: 'en' | 'de'
  session_id: string
}

export interface QAResult {
  has_errors: boolean
  corrected_text: string
  issues_found: string[]
  qa_score: number
}

export type SkillType = 'chat' | 'cover_letter' | 'translate' | 'analyze'

interface AppState {
  // Navigation & Session
  activeScreen: 'landing' | 'analyzing' | 'setup' | 'generating' | 'review' | 'settings' | 'merge' | 'translator'
  selectedSkill: SkillType
  sidebarOpen: boolean
  
  // Data State
  positionText: string
  positionData: PositionParseResult | null
  language: 'en' | 'de'
  selectedResumeId: string | null
  selectedTemplateId: string | null
  selectedStyleType: StyleType
  customLetterText: string
  sessionId: string | null
  generatedText: string
  qaResult: QAResult | null
  
  // App Config & Health
  sidecarHealthy: boolean
  checkingHealth: boolean

  // Actions
  setScreen: (screen: AppState['activeScreen']) => void
  setSelectedSkill: (skill: SkillType) => void
  setSidebarOpen: (open: boolean) => void
  setPositionText: (text: string) => void
  setPositionData: (data: PositionParseResult | null) => void
  setLanguage: (lang: 'en' | 'de') => void
  setSelectedResumeId: (id: string | null) => void
  setSelectedTemplateId: (id: string | null) => void
  setSelectedStyleType: (style: StyleType) => void
  setCustomLetterText: (text: string) => void
  setSessionId: (id: string | null) => void
  setGeneratedText: (text: string | ((prev: string) => string)) => void
  setQaResult: (result: QAResult | null) => void
  setSidecarHealthy: (healthy: boolean) => void
  setCheckingHealth: (checking: boolean) => void
  resetStore: () => void
}

const initialState = {
  activeScreen: 'landing' as const,
  selectedSkill: 'chat' as SkillType,
  sidebarOpen: true,
  positionText: '',
  positionData: null,
  language: 'en' as const,
  selectedResumeId: null,
  selectedTemplateId: null,
  selectedStyleType: 'standard' as const,
  customLetterText: '',
  sessionId: null,
  generatedText: '',
  qaResult: null,
  sidecarHealthy: false,
  checkingHealth: true,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setScreen: (screen) => set({ activeScreen: screen }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setPositionText: (text) => set({ positionText: text }),
  setPositionData: (data) => set({ positionData: data }),
  setLanguage: (lang) => set({ language: lang }),
  setSelectedResumeId: (id) => set({ selectedResumeId: id }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setSelectedStyleType: (style) => set({ selectedStyleType: style }),
  setCustomLetterText: (text) => set({ customLetterText: text }),
  setSessionId: (id) => set({ sessionId: id }),
  setGeneratedText: (text) => set((state) => ({
    generatedText: typeof text === 'function' ? text(state.generatedText) : text
  })),
  setQaResult: (result) => set({ qaResult: result }),
  setSidecarHealthy: (healthy) => set({ sidecarHealthy: healthy }),
  setCheckingHealth: (checking) => set({ checkingHealth: checking }),
  
  resetStore: () => set((state) => ({
    ...initialState,
    sidecarHealthy: state.sidecarHealthy, // retain connection status
    checkingHealth: false,
  })),
}))
