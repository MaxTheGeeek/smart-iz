import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/useAppStore'
import { 
  User, FileText, Layout, Key, Save, Trash2, 
  Upload, HelpCircle, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff 
} from 'lucide-react'

// Base URL matching main Electron preload / backend connection
const API_BASE = 'http://localhost:8765/api'

export default function SettingsScreen() {
  const queryClient = useQueryClient()
  const { setScreen } = useAppStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'resumes' | 'templates' | 'apiKeys'>('profile')

  // Toast indicator state
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ==================== React Query Endpoints ====================

  // 1. Profile Query & Mutation
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/profile`)
      if (!res.ok) throw new Error('Failed to load profile')
      return res.json()
    }
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const res = await fetch(`${API_BASE}/settings/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })
      if (!res.ok) throw new Error('Failed to update profile')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      showToast('Profile saved successfully!')
    },
    onError: (err: any) => {
      showToast(err.message || 'Error saving profile', 'error')
    }
  })

  // 2. LLM Config Query & Mutation
  const { data: llmConfig, isLoading: isLlmLoading } = useQuery({
    queryKey: ['llmConfig'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings/llm-config`)
      if (!res.ok) throw new Error('Failed to load LLM config')
      return res.json()
    }
  })

  const updateLlmMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const res = await fetch(`${API_BASE}/settings/llm-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })
      if (!res.ok) throw new Error('Failed to update LLM Config')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmConfig'] })
      showToast('API Keys saved successfully!')
    },
    onError: (err: any) => {
      showToast(err.message || 'Error saving keys', 'error')
    }
  })

  // 3. Resumes Queries & Mutations
  const { data: resumes = [], isLoading: isResumesLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/resumes`)
      if (!res.ok) throw new Error('Failed to load resumes')
      return res.json()
    }
  })

  const deleteResumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/resumes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete resume')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] })
      showToast('Resume deleted successfully.')
    },
    onError: (err: any) => {
      showToast(err.message || 'Error deleting resume', 'error')
    }
  })

  // 4. Templates Queries & Mutations
  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/templates`)
      if (!res.ok) throw new Error('Failed to load templates')
      return res.json()
    }
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      showToast('Template deleted successfully.')
    },
    onError: (err: any) => {
      showToast(err.message || 'Error deleting template', 'error')
    }
  })

  // ==================== Local Component States ====================
  
  // Profile Forms
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    linkedin: '',
    github: '',
    portfolio: ''
  })

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        linkedin: profile.linkedin || '',
        github: profile.github || '',
        portfolio: profile.portfolio || ''
      })
    }
  }, [profile])

  // LLM Forms
  const [llmForm, setLlmForm] = useState({
    openrouter_key: '',
    groq_key: '',
    preferred_model: 'google/gemini-2.0-flash-exp:free'
  })

  const [showKeys, setShowKeys] = useState<{ openrouter: boolean; groq: boolean }>({
    openrouter: false,
    groq: false
  })

  useEffect(() => {
    if (llmConfig) {
      setLlmForm({
        openrouter_key: llmConfig.openrouter_key || '',
        groq_key: llmConfig.groq_key || '',
        preferred_model: llmConfig.preferred_model || 'google/gemini-2.0-flash-exp:free'
      })
    }
  }, [llmConfig])

  // Upload Management
  const [resumeUpload, setResumeUpload] = useState<{ name: string; file: File | null }>({ name: '', file: null })
  const [isResumeUploading, setIsResumeUploading] = useState(false)

  const [templateUpload, setTemplateUpload] = useState<{ name: string; file: File | null }>({ name: '', file: null })
  const [isTemplateUploading, setIsTemplateUploading] = useState(false)

  // API Tester States
  const [connectionTest, setConnectionTest] = useState<{ provider: string; status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    provider: '',
    status: 'idle',
    message: ''
  })

  // ==================== Actions ====================

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(profileForm)
  }

  const handleLlmSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateLlmMutation.mutate(llmForm)
  }

  const handleResumeUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resumeUpload.file || !resumeUpload.name.trim()) return
    
    setIsResumeUploading(true)
    const formData = new FormData()
    formData.append('name', resumeUpload.name)
    formData.append('file', resumeUpload.file)

    try {
      const res = await fetch(`${API_BASE}/resumes`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Failed to upload resume')
      }
      showToast('Resume uploaded and parsed successfully!')
      setResumeUpload({ name: '', file: null })
      queryClient.invalidateQueries({ queryKey: ['resumes'] })
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsResumeUploading(false)
    }
  }

  const handleTemplateUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateUpload.file || !templateUpload.name.trim()) return
    
    setIsTemplateUploading(true)
    const formData = new FormData()
    formData.append('name', templateUpload.name)
    formData.append('file', templateUpload.file)

    try {
      const res = await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Failed to upload template')
      }
      showToast('Template uploaded, specs calculated and visual thumbnail ready!')
      setTemplateUpload({ name: '', file: null })
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsTemplateUploading(false)
    }
  }

  const handleTestConnection = async (provider: 'openrouter' | 'groq') => {
    const key = provider === 'openrouter' ? llmForm.openrouter_key : llmForm.groq_key
    if (!key.trim()) {
      showToast(`Please enter a key for ${provider === 'openrouter' ? 'OpenRouter' : 'Groq'} first.`, 'error')
      return
    }

    setConnectionTest({ provider, status: 'testing', message: 'Verifying keys against secure servers...' })
    
    try {
      const res = await fetch(`${API_BASE}/settings/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key })
      })
      
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setConnectionTest({ provider, status: 'success', message: data.message })
      } else {
        setConnectionTest({ provider, status: 'error', message: data.message || 'Key validation failed.' })
      }
    } catch (e: any) {
      setConnectionTest({ provider, status: 'error', message: `Server error: ${e.message}` })
    }
  }

  return (
    <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 animate-bounce transition-all duration-300 ${
          toast.type === 'success' ? 'bg-forest-soft border-badge-forest-border text-forest' :
          toast.type === 'error' ? 'bg-burgundy-soft border-badge-burgundy-border text-burgundy' :
          'bg-surface-2 border-line text-ink-2'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-forest" /> : <AlertCircle className="w-5 h-5 text-burgundy" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Screen Title */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif italic text-ink">
            Settings & Control Panel
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage your applicant profile, upload resumes, add styling templates, and set up your LLM credentials.
          </p>
        </div>
        
        <button
          onClick={() => setScreen('landing')}
          className="btn text-xs font-semibold bg-surface border border-line hover:bg-surface-2 transition duration-150"
        >
          ← Back to Workspace
        </button>
      </div>

      {/* Horizontal Tabs Navigation */}
      <div className="flex border-b border-line pb-1 gap-1 select-none overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all duration-150 ${
            activeTab === 'profile'
              ? 'border-burgundy text-burgundy font-bold'
              : 'border-transparent text-muted hover:text-ink hover:border-line'
          }`}
        >
          <User className="w-4 h-4" />
          Applicant Profile
        </button>
        
        <button
          onClick={() => setActiveTab('resumes')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all duration-150 ${
            activeTab === 'resumes'
              ? 'border-burgundy text-burgundy font-bold'
              : 'border-transparent text-muted hover:text-ink hover:border-line'
          }`}
        >
          <FileText className="w-4 h-4" />
          My Resumes ({resumes.length})
        </button>
        
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all duration-150 ${
            activeTab === 'templates'
              ? 'border-burgundy text-burgundy font-bold'
              : 'border-transparent text-muted hover:text-ink hover:border-line'
          }`}
        >
          <Layout className="w-4 h-4" />
          PDF Templates ({templates.length})
        </button>
        
        <button
          onClick={() => setActiveTab('apiKeys')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all duration-150 ${
            activeTab === 'apiKeys'
              ? 'border-burgundy text-burgundy font-bold'
              : 'border-transparent text-muted hover:text-ink hover:border-line'
          }`}
        >
          <Key className="w-4 h-4" />
          API Keys & LLMs
        </button>
      </div>

      {/* Settings Content Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 md:p-8 shadow-sm w-full">
          
          {/* 1. Applicant Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-6">
              <div className="border-b border-line pb-4 select-none">
                <h2 className="text-lg font-serif italic text-ink flex items-center gap-2">
                  <User className="w-5 h-5 text-burgundy" />
                  Applicant Profile Info
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  This contact information will automatically populate headers, address blocks, and signatures in generated PDFs.
                </p>
              </div>

              {isProfileLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-surface-2 rounded-xl w-3/4"></div>
                  <div className="h-10 bg-surface-2 rounded-xl w-1/2"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      placeholder="e.g. Max Mustermann"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Contact Email</label>
                    <input
                      type="email"
                      required
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="e.g. max@example.com"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Phone Number</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="e.g. +49 123 4567890"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">LinkedIn Profile URL</label>
                    <input
                      type="text"
                      value={profileForm.linkedin}
                      onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                      placeholder="e.g. linkedin.com/in/username"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">GitHub Profile URL</label>
                    <input
                      type="text"
                      value={profileForm.github}
                      onChange={(e) => setProfileForm({ ...profileForm, github: e.target.value })}
                      placeholder="e.g. github.com/username"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Portfolio Website</label>
                    <input
                      type="text"
                      value={profileForm.portfolio}
                      onChange={(e) => setProfileForm({ ...profileForm, portfolio: e.target.value })}
                      placeholder="e.g. maxdev.io"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150"
                    />
                  </div>

                  <div className="flex flex-col space-y-2 md:col-span-2">
                    <label className="text-xs font-semibold text-ink-2">Home Address</label>
                    <textarea
                      rows={3}
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      placeholder="e.g. Musterstraße 12, 12345 Berlin"
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface-2 text-ink focus:ring-2 focus:ring-burgundy outline-none text-sm transition duration-150 resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-line pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="btn primary flex items-center gap-2 shadow-md transition duration-150 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {/* 2. My Resumes */}
          {activeTab === 'resumes' && (
            <div className="space-y-8">
              <div className="border-b border-line pb-4 select-none">
                <h2 className="text-lg font-serif italic text-ink flex items-center gap-2">
                  <FileText className="w-5 h-5 text-burgundy" />
                  Resume Repository
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Upload multiple resumes tailored for different career tracks. They will be fully analyzed on ingestion.
                </p>
              </div>

              {/* Upload Form */}
              <form onSubmit={handleResumeUpload} className="p-5 border border-line border-dashed rounded-2xl flex flex-col space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted font-bold select-none">Upload New Resume</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Resume Reference Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NodeJS CV, General CV"
                      value={resumeUpload.name}
                      onChange={(e) => setResumeUpload({ ...resumeUpload, name: e.target.value })}
                      className="px-4 py-2.5 border border-line bg-surface-2 text-ink rounded-xl text-sm focus:ring-2 focus:ring-burgundy outline-none"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Select File (.pdf, .docx, .txt)</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setResumeUpload({ ...resumeUpload, file: e.target.files?.[0] || null })}
                      className="text-sm text-ink-2 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-line file:text-xs file:font-semibold file:bg-surface-2 file:text-ink hover:file:opacity-90 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isResumeUploading || !resumeUpload.file || !resumeUpload.name.trim()}
                    className="btn primary text-xs shadow-md flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {isResumeUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Uploading & Parsing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Ingest Resume
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* List resumes */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted font-bold select-none">Ingested Resumes</h3>
                
                {isResumesLoading ? (
                  <div className="h-12 bg-surface-2 rounded-xl animate-pulse"></div>
                ) : resumes.length === 0 ? (
                  <div className="p-8 text-center text-sm border border-line rounded-2xl text-muted">
                    No resumes uploaded yet. Ingest a resume above to start writing cover letters!
                  </div>
                ) : (
                  <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-surface-2/40">
                    {resumes.map((res: any) => (
                      <div key={res.id} className="p-4 flex items-center justify-between hover:bg-surface-2/80 transition duration-150">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-burgundy-soft border border-badge-burgundy-border flex items-center justify-center text-burgundy font-bold text-xs">
                            {res.file_type.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-ink">{res.name}</div>
                            <div className="text-xs text-muted">{res.file_name} • Ingested {new Date(res.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${res.name}"?`)) {
                              deleteResumeMutation.mutate(res.id)
                            }
                          }}
                          disabled={deleteResumeMutation.isPending}
                          className="p-2 hover:bg-burgundy-soft/50 text-burgundy border border-line rounded-xl transition duration-150 disabled:opacity-50"
                          title="Delete Resume"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. PDF Templates */}
          {activeTab === 'templates' && (
            <div className="space-y-8">
              <div className="border-b border-line pb-4 select-none">
                <h2 className="text-lg font-serif italic text-ink flex items-center gap-2">
                  <Layout className="w-5 h-5 text-burgundy" />
                  PDF Template Library
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Upload PDF styles or cover letter mock layouts. The backend automatically maps text overlays and builds page bounds.
                </p>
              </div>

              {/* Upload Form */}
              <form onSubmit={handleTemplateUpload} className="p-5 border border-line border-dashed rounded-2xl flex flex-col space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted font-bold select-none">Upload PDF Template Layout</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Template Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Modern Swiss, Professional Teal"
                      value={templateUpload.name}
                      onChange={(e) => setTemplateUpload({ ...templateUpload, name: e.target.value })}
                      className="px-4 py-2.5 border border-line bg-surface-2 text-ink rounded-xl text-sm focus:ring-2 focus:ring-burgundy outline-none"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Select PDF Layout File (.pdf only)</label>
                    <input
                      type="file"
                      required
                      accept=".pdf"
                      onChange={(e) => setTemplateUpload({ ...templateUpload, file: e.target.files?.[0] || null })}
                      className="text-sm text-ink-2 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-line file:text-xs file:font-semibold file:bg-surface-2 file:text-ink hover:file:opacity-90 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isTemplateUploading || !templateUpload.file || !templateUpload.name.trim()}
                    className="btn primary text-xs shadow-md flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {isTemplateUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Building Layout Spec...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Ingest Template
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Grid Templates */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted font-bold select-none">Ingested templates</h3>
                
                {isTemplatesLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
                    <div className="h-44 bg-surface-2 rounded-2xl"></div>
                    <div className="h-44 bg-surface-2 rounded-2xl"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-8 text-center text-sm border border-line rounded-2xl text-muted">
                    No custom templates uploaded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {templates.map((tpl: any) => (
                      <div key={tpl.id} className="group relative border border-line bg-surface-2/40 rounded-2xl p-3 flex flex-col space-y-3 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        
                        {/* Thumbnail View */}
                        <div className="aspect-[3/4] w-full bg-surface-2 rounded-xl overflow-hidden relative border border-line flex items-center justify-center">
                          {tpl.thumbnail_path ? (
                            <img
                              src={`${API_BASE}/templates/${tpl.id}/thumbnail`}
                              alt={tpl.name}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted select-none">
                              <Layout className="w-8 h-8 opacity-40 text-burgundy" />
                              <span className="text-[10px] uppercase font-bold tracking-widest text-muted">PDF SPEC READY</span>
                            </div>
                          )}

                          {/* Delete Overlay button */}
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete template "${tpl.name}"?`)) {
                                deleteTemplateMutation.mutate(tpl.id)
                              }
                            }}
                            disabled={deleteTemplateMutation.isPending}
                            className="absolute top-2.5 right-2.5 p-2 bg-surface/90 hover:bg-burgundy-soft/80 hover:text-burgundy text-ink rounded-xl shadow-md border border-line transition duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Info details */}
                        <div className="px-1 text-center select-none">
                          <div className="font-bold text-xs text-ink group-hover:text-burgundy transition duration-150 truncate">
                            {tpl.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. API Keys & LLM Config */}
          {activeTab === 'apiKeys' && (
            <form onSubmit={handleLlmSave} className="space-y-6">
              <div className="border-b border-line pb-4 select-none">
                <h2 className="text-lg font-serif italic text-ink flex items-center gap-2">
                  <Key className="w-5 h-5 text-burgundy" />
                  Universal LLM Gateway & API Credentials
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Set up your custom API tokens for universal completion. Your keys are handled locally and never routed outside standard gateway endpoints.
                </p>
              </div>

              {isLlmLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-surface-2 rounded-xl w-3/4"></div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Preferred Model */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-semibold text-ink-2">Primary AI Generation Model</label>
                    <select
                      value={llmForm.preferred_model}
                      onChange={(e) => setLlmForm({ ...llmForm, preferred_model: e.target.value })}
                      className="px-4 py-2.5 border border-line bg-surface-2 text-ink rounded-xl text-sm focus:ring-2 focus:ring-burgundy outline-none transition"
                    >
                      <option value="google/gemini-2.0-flash-exp:free">Google Gemini 2.0 Flash (Free exp) — Highly Recommended</option>
                      <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B Instruct (Free) — Excellent Quality</option>
                      <option value="deepseek/deepseek-chat-v3-0324:free">DeepSeek Chat V3 (Free) — Fast & Structured</option>
                      <option value="groq/llama-3.3-70b-versatile">Groq Llama 3.3 70B (Requires Groq Key)</option>
                      <option value="mistralai/mistral-7b-instruct:free">Mistral 7B Instruct (Free) — Compact & Rapid</option>
                    </select>
                  </div>

                  {/* OpenRouter Key */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center select-none">
                      <label className="text-xs font-semibold text-ink-2">OpenRouter API Key (Supports free models)</label>
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[10px] text-burgundy font-bold hover:underline">
                        Get Key (OpenRouter.ai)
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showKeys.openrouter ? 'text' : 'password'}
                        value={llmForm.openrouter_key}
                        onChange={(e) => setLlmForm({ ...llmForm, openrouter_key: e.target.value })}
                        placeholder="sk-or-v1-..."
                        className="w-full pl-4 pr-24 py-2.5 border border-line bg-surface-2 text-ink rounded-xl text-sm font-mono focus:ring-2 focus:ring-burgundy outline-none"
                      />
                      <div className="absolute right-2.5 top-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowKeys({ ...showKeys, openrouter: !showKeys.openrouter })}
                          className="p-1.5 hover:bg-surface text-ink-2 rounded-lg transition"
                        >
                          {showKeys.openrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestConnection('openrouter')}
                          className="px-2.5 py-1 bg-surface hover:bg-surface-2 text-ink font-bold text-[10px] rounded-lg border border-line transition"
                        >
                          Test
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Groq Key */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center select-none">
                      <label className="text-xs font-semibold text-ink-2">Groq API Key (High-speed fallback)</label>
                      <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[10px] text-burgundy font-bold hover:underline">
                        Get Key (Groq.com)
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showKeys.groq ? 'text' : 'password'}
                        value={llmForm.groq_key}
                        onChange={(e) => setLlmForm({ ...llmForm, groq_key: e.target.value })}
                        placeholder="gsk_..."
                        className="w-full pl-4 pr-24 py-2.5 border border-line bg-surface-2 text-ink rounded-xl text-sm font-mono focus:ring-2 focus:ring-burgundy outline-none"
                      />
                      <div className="absolute right-2.5 top-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowKeys({ ...showKeys, groq: !showKeys.groq })}
                          className="p-1.5 hover:bg-surface text-ink-2 rounded-lg transition"
                        >
                          {showKeys.groq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestConnection('groq')}
                          className="px-2.5 py-1 bg-surface hover:bg-surface-2 text-ink font-bold text-[10px] rounded-lg border border-line transition"
                        >
                          Test
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Connection Test Output Panel */}
                  {connectionTest.status !== 'idle' && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                      connectionTest.status === 'testing' ? 'bg-surface border-line text-ink-2' :
                      connectionTest.status === 'success' ? 'bg-forest-soft border-badge-forest-border text-forest' :
                      'bg-burgundy-soft border-badge-burgundy-border text-burgundy'
                    }`}>
                      {connectionTest.status === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-muted" />}
                      {connectionTest.status === 'success' && <CheckCircle2 className="w-4 h-4 text-forest" />}
                      {connectionTest.status === 'error' && <AlertCircle className="w-4 h-4 text-burgundy" />}
                      <span>{connectionTest.message}</span>
                    </div>
                  )}

                  {/* Model Priority Callout */}
                  <div className="p-4 rounded-xl border border-line bg-surface-2/40 text-xs text-ink-2 flex items-start gap-2.5 leading-relaxed">
                    <HelpCircle className="w-4 h-4 text-burgundy shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-burgundy">Automatic Fallback Active:</span> Smartiz runs a seamless fallback chain starting from Gemini Flash, to Llama 3.3, and then DeepSeek. If any rate limit or API error is hit during streaming, the app immediately transitions to the next available model in the sequence without interruption or data loss.
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-line pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={updateLlmMutation.isPending}
                  className="btn primary flex items-center gap-2 shadow-md transition duration-150 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateLlmMutation.isPending ? 'Saving...' : 'Save API Credentials'}
                </button>
              </div>
            </form>
          )}

      </div>
    </div>
  )
}
