import { create } from 'zustand'

export interface TranslatorChapter {
  id: string
  document_id: string
  chapter_index: number
  title: string
  page_start: number
  page_end: number
  page_count: number
}

interface TranslatorState {
  // Document context
  docId: string | null
  fileName: string | null
  totalPages: number
  targetLanguage: string
  isRtl: boolean

  // Chapters & reading context
  chapters: TranslatorChapter[]
  currentChapterIdx: number
  currentPageIdx: number // 0-based within the current chapter
  cacheStatus: boolean[] // array of booleans indicating page cache hits

  // Content buffers
  originalText: string
  translatedText: string
  isTranslating: boolean
  isParsing: boolean
  statusMessage: string

  // Actions
  setDocContext: (ctx: { docId: string; fileName: string; totalPages: number; targetLanguage: string; isRtl: boolean }) => void
  setChapters: (chapters: TranslatorChapter[]) => void
  setCurrentChapterIdx: (idx: number) => void
  setCurrentPageIdx: (idx: number) => void
  setCacheStatus: (status: boolean[]) => void
  setOriginalText: (text: string) => void
  setTranslatedText: (text: string | ((prev: string) => string)) => void
  setIsTranslating: (translating: boolean) => void
  setIsParsing: (parsing: boolean) => void
  setStatusMessage: (msg: string) => void
  resetTranslator: () => void
}

const initialState = {
  docId: null,
  fileName: null,
  totalPages: 0,
  targetLanguage: 'fa',
  isRtl: true,
  chapters: [],
  currentChapterIdx: 0,
  currentPageIdx: 0,
  cacheStatus: [],
  originalText: '',
  translatedText: '',
  isTranslating: false,
  isParsing: false,
  statusMessage: '',
}

export const useTranslatorStore = create<TranslatorState>((set) => ({
  ...initialState,

  setDocContext: (ctx) => set({
    docId: ctx.docId,
    fileName: ctx.fileName,
    totalPages: ctx.totalPages,
    targetLanguage: ctx.targetLanguage,
    isRtl: ctx.isRtl,
  }),
  setChapters: (chapters) => set({ chapters }),
  setCurrentChapterIdx: (idx) => set({ currentChapterIdx: idx, currentPageIdx: 0, originalText: '', translatedText: '' }),
  setCurrentPageIdx: (idx) => set({ currentPageIdx: idx, originalText: '', translatedText: '' }),
  setCacheStatus: (status) => set({ cacheStatus: status }),
  setOriginalText: (text) => set({ originalText: text }),
  setTranslatedText: (text) => set((state) => ({
    translatedText: typeof text === 'function' ? text(state.translatedText) : text
  })),
  setIsTranslating: (translating) => set({ isTranslating: translating }),
  setIsParsing: (parsing) => set({ isParsing: parsing }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  resetTranslator: () => set(initialState),
}))
