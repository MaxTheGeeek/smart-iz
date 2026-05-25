import React, { useState, useRef } from 'react'
import { Icon, ModelPill } from '../components/SharedUI'

interface UploadedFileSlot {
  id: string
  file: File
  name: string
  size: string
}

export default function MergeScreen() {
  const [slots, setSlots] = useState<UploadedFileSlot[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  // Truncate filename in the middle: e.g. "my_extremely_long_resume_file_2026.pdf" -> "my_extreme...2026.pdf"
  const truncateMiddle = (name: string, maxLen = 38) => {
    if (name.length <= maxLen) return name
    const extIdx = name.lastIndexOf('.')
    const ext = extIdx !== -1 ? name.substring(extIdx) : ''
    const base = extIdx !== -1 ? name.substring(0, extIdx) : name
    const charsToShow = maxLen - ext.length - 3
    if (charsToShow <= 0) return name
    const frontChars = Math.ceil(charsToShow / 2)
    const backChars = Math.floor(charsToShow / 2)
    return base.substring(0, frontChars) + '...' + base.substring(base.length - backChars) + ext
  }

  const addFiles = (filesList: FileList) => {
    setErrorMsg(null)
    const newSlots = [...slots]
    
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i]
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Only PDF documents are supported for combination.')
        continue
      }
      
      if (newSlots.length >= 5) {
        setErrorMsg('Maximum of 5 documents can be combined at once.')
        break
      }

      newSlots.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: formatBytes(file.size)
      })
    }

    setSlots(newSlots)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
  }

  const removeSlot = (id: string) => {
    setSlots(slots.filter(s => s.id !== id))
    setErrorMsg(null)
  }

  const moveSlot = (idx: number, dir: 'up' | 'down') => {
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1
    if (nextIdx < 0 || nextIdx >= slots.length) return

    const newSlots = [...slots]
    const temp = newSlots[idx]
    newSlots[idx] = newSlots[nextIdx]
    newSlots[nextIdx] = temp
    setSlots(newSlots)
  }

  const moveSlotElement = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    const newSlots = [...slots]
    const [removed] = newSlots.splice(fromIdx, 1)
    newSlots.splice(toIdx, 0, removed)
    setSlots(newSlots)
    setDraggedIdx(toIdx)
  }

  const handleCombine = async () => {
    if (slots.length < 2) {
      setErrorMsg('Please upload at least 2 PDF documents to combine.')
      return
    }

    setIsMerging(true)
    setErrorMsg(null)

    const formData = new FormData()
    slots.forEach(slot => {
      formData.append('files', slot.file)
    })

    try {
      const res = await fetch('http://127.0.0.1:8765/api/merge', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = 'combined_application.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error(e)
      setErrorMsg(e.message || 'Failed to combine documents. Verify that the files are valid.')
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="convo flex-1 flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* Head */}
      <div className="convo-head">
        <h2>Visual PDF <em>Combiner.</em></h2>
        <div className="meta">
          <span>Arrange cover letter, resume, and certificates into a single compiled document</span>
        </div>
      </div>

      {/* Full-width flow layout */}
      <div className="flex-1 flex flex-col gap-6 py-4 max-w-3xl w-full mx-auto overflow-y-auto">
        
        {/* Compact Drop Bar */}
        <div
          className={`border border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 select-none flex items-center justify-center gap-3 ${
            isDragging ? 'border-burgundy bg-burgundy-soft/20 scale-[1.01]' : 'border-line hover:border-ink-2 bg-surface-2'
          }`}
          style={{ height: '60px' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon.Layers s={18} className="text-muted" />
          <span className="text-xs text-ink font-medium">
            {isDragging ? 'Drop your PDF files here...' : 'Drag-and-drop cover letter, resume, or recommendation PDFs or '}
            <span className="text-burgundy underline hover:text-burgundy-hover font-semibold">Browse computer</span>
          </span>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf"
            multiple
            onChange={handleFileChange}
          />
        </div>

        {/* Assembly Pipeline and Reorderable Slots */}
        <div className="space-y-3">
          <div className="flex items-center justify-between select-none">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted">
              Assembly pipeline slots
            </h4>
            <span 
              className="text-xs font-mono font-bold px-2 py-0.5 rounded"
              style={{
                background: slots.length === 5 ? 'var(--amber-soft)' : 'var(--surface-2)',
                color: slots.length === 5 ? 'var(--amber)' : 'var(--muted)',
                transition: 'all 0.15s ease'
              }}
            >
              {slots.length}/5 Slots
            </span>
          </div>
          
          {slots.length > 0 ? (
            <div className="space-y-2">
              {slots.map((slot, idx) => (
                <div
                  key={slot.id}
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (draggedIdx !== null && draggedIdx !== idx) {
                      moveSlotElement(draggedIdx, idx)
                    }
                  }}
                  onDragEnd={() => setDraggedIdx(null)}
                  className={`flex items-center justify-between p-3.5 bg-surface border border-line rounded-xl shadow-sm relative overflow-hidden transition-all duration-150 ${
                    draggedIdx === idx ? 'opacity-40 border-dashed border-burgundy scale-[0.99]' : 'hover:border-ink-2'
                  }`}
                >
                  {/* Color-coded index accent strip */}
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-burgundy" style={{ opacity: 0.15 * (idx + 1) }} />
                  
                  <div className="flex items-center gap-3 min-w-0 pl-1">
                    {/* Drag Handle */}
                    <span 
                      className="text-muted cursor-grab active:cursor-grabbing text-sm font-semibold select-none pr-1 hover:text-ink"
                      style={{ fontFamily: 'monospace' }}
                      title="Drag to reorder"
                    >
                      ⠿
                    </span>
                    
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-ink truncate pr-8" title={slot.name}>
                        {truncateMiddle(slot.name)}
                      </div>
                      <div className="text-xs text-muted font-mono">{slot.size}</div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 select-none">
                    <button
                      className="icon-btn w-6.5 h-6.5 rounded hover:bg-surface-2 flex items-center justify-center border border-line text-xs font-semibold"
                      disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); moveSlot(idx, 'up'); }}
                    >
                      ▲
                    </button>
                    <button
                      className="icon-btn w-6.5 h-6.5 rounded hover:bg-surface-2 flex items-center justify-center border border-line text-xs font-semibold"
                      disabled={idx === slots.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveSlot(idx, 'down'); }}
                    >
                      ▼
                    </button>
                    <button
                      className="icon-btn w-6.5 h-6.5 rounded hover:bg-burgundy-soft/50 text-burgundy flex items-center justify-center border border-line ml-1"
                      onClick={(e) => { e.stopPropagation(); removeSlot(slot.id); }}
                    >
                      <Icon.Trash s={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted italic bg-surface-2 border border-line-soft rounded-2xl select-none">
              Slots empty. Drag cover letter PDF over to start.
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-burgundy-soft border border-badge-burgundy-border text-burgundy text-xs rounded-xl select-none text-center">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Compact Rules Card */}
        <div className="p-4 bg-surface border border-line rounded-2xl text-xs text-muted space-y-2 select-none">
          <h5 className="font-semibold text-ink uppercase tracking-wider font-mono text-[10px]">Combiner Rules</h5>
          <ul className="list-disc pl-4 space-y-1">
            <li>Requires exactly 2 to 5 standard PDF documents</li>
            <li>Compiles sequentially matching the assembly pipeline order</li>
            <li>Retains embedded vector text layers perfectly for premium PDF exports</li>
          </ul>
        </div>

      </div>

      {/* Foot */}
      <div className="convo-foot border-t border-line-soft pt-4 flex items-center justify-between select-none">
        <ModelPill name="pyPDF Layer Merger" latency="instant assembler" />
        <button
          className="btn primary flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-md text-sm font-semibold"
          disabled={slots.length < 2 || isMerging}
          onClick={handleCombine}
        >
          {isMerging ? (
            <>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '1.5px solid var(--line)',
                borderTopColor: 'var(--paper)',
                animation: 'spin 1s linear infinite'
              }} />
              <span>Merging sheets...</span>
            </>
          ) : (
            <>
              <Icon.Merge s={13} />
              <span>Combine & Save PDF</span>
            </>
          )}
        </button>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
