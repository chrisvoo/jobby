'use client'

import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { ResumeData } from '@/lib/types'

interface Props {
  value: ResumeData
  onChange: (r: ResumeData) => void
}

export function ResumeEditor({ value, onChange }: Props) {
  const [newSkill, setNewSkill] = useState('')
  const [newCert, setNewCert] = useState('')

  function set<K extends keyof ResumeData>(field: K, val: ResumeData[K]) {
    onChange({ ...value, [field]: val })
  }

  function updateExp(ei: number, patch: Partial<ResumeData['experience'][0]>) {
    onChange({
      ...value,
      experience: value.experience.map((e, i) => i === ei ? { ...e, ...patch } : e),
    })
  }

  function setBullet(ei: number, bi: number, text: string) {
    updateExp(ei, { bullets: value.experience[ei].bullets.map((b, j) => j === bi ? text : b) })
  }

  function removeBullet(ei: number, bi: number) {
    updateExp(ei, { bullets: value.experience[ei].bullets.filter((_, j) => j !== bi) })
  }

  function addBullet(ei: number) {
    updateExp(ei, { bullets: [...value.experience[ei].bullets, ''] })
  }

  function updateEdu(i: number, patch: Partial<ResumeData['education'][0]>) {
    onChange({
      ...value,
      education: value.education.map((e, j) => j === i ? { ...e, ...patch } : e),
    })
  }

  function addSkill() {
    if (!newSkill.trim()) return
    set('skills', [...value.skills, newSkill.trim()])
    setNewSkill('')
  }

  function removeSkill(i: number) {
    set('skills', value.skills.filter((_, j) => j !== i))
  }

  function addCert() {
    if (!newCert.trim()) return
    set('certifications', [...(value.certifications ?? []), newCert.trim()])
    setNewCert('')
  }

  function removeCert(i: number) {
    set('certifications', (value.certifications ?? []).filter((_, j) => j !== i))
  }

  const certs = value.certifications ?? []

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">

      {/* Contact */}
      <div className="p-5 space-y-3">
        <h3 className={sectionLabel}>Contact</h3>
        <input
          className={inputCls}
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Full Name"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputCls} value={value.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
          <input className={inputCls} value={value.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="Phone" />
          <input className={inputCls} value={value.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="Location" />
          <input className={inputCls} value={value.linkedin ?? ''} onChange={(e) => set('linkedin', e.target.value)} placeholder="LinkedIn" />
          <input className={`${inputCls} col-span-2`} value={value.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="Website (optional)" />
        </div>
      </div>

      {/* Summary */}
      {value.summary !== undefined && (
        <div className="p-5 space-y-3">
          <h3 className={sectionLabel}>Summary</h3>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            value={value.summary}
            onChange={(e) => set('summary', e.target.value)}
          />
        </div>
      )}

      {/* Experience */}
      {value.experience.length > 0 && (
        <div className="p-5 space-y-4">
          <h3 className={sectionLabel}>Experience</h3>
          {value.experience.map((exp, ei) => (
            <div key={ei} className="border border-zinc-700 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input className={inputCls} value={exp.company} onChange={(e) => updateExp(ei, { company: e.target.value })} placeholder="Company" />
                <input className={inputCls} value={exp.role} onChange={(e) => updateExp(ei, { role: e.target.value })} placeholder="Role" />
                <input className={inputCls} value={exp.dates} onChange={(e) => updateExp(ei, { dates: e.target.value })} placeholder="Dates" />
              </div>
              {exp.location !== undefined && (
                <input className={inputCls} value={exp.location ?? ''} onChange={(e) => updateExp(ei, { location: e.target.value })} placeholder="Location (optional)" />
              )}
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 font-medium">Bullets</p>
                {exp.bullets.map((b, bi) => (
                  <div key={bi} className="flex gap-2 items-start">
                    <textarea
                      className={`${inputCls} resize-none flex-1`}
                      rows={2}
                      value={b}
                      onChange={(e) => setBullet(ei, bi, e.target.value)}
                    />
                    <button
                      onClick={() => removeBullet(ei, bi)}
                      className="mt-2 p-1.5 rounded text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addBullet(ei)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add bullet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {value.education.length > 0 && (
        <div className="p-5 space-y-4">
          <h3 className={sectionLabel}>Education</h3>
          {value.education.map((edu, i) => (
            <div key={i} className="border border-zinc-700 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input className={inputCls} value={edu.institution} onChange={(e) => updateEdu(i, { institution: e.target.value })} placeholder="Institution" />
                <input className={inputCls} value={edu.degree} onChange={(e) => updateEdu(i, { degree: e.target.value })} placeholder="Degree" />
                <input className={inputCls} value={edu.dates} onChange={(e) => updateEdu(i, { dates: e.target.value })} placeholder="Dates" />
              </div>
              <input className={inputCls} value={edu.details ?? ''} onChange={(e) => updateEdu(i, { details: e.target.value || undefined })} placeholder="Details (optional)" />
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {value.skills.length > 0 && (
        <div className="p-5 space-y-3">
          <h3 className={sectionLabel}>Skills</h3>
          <div className="flex flex-wrap gap-2">
            {value.skills.map((skill, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-200">
                {skill}
                <button onClick={() => removeSkill(i)} className="text-zinc-500 hover:text-red-400 transition-colors leading-none ml-0.5">×</button>
              </span>
            ))}
            <input
              className="bg-transparent border border-dashed border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 w-32"
              placeholder="Add skill…"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addSkill()
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Certifications */}
      {certs.length > 0 && (
        <div className="p-5 space-y-3">
          <h3 className={sectionLabel}>Certifications</h3>
          <div className="flex flex-wrap gap-2">
            {certs.map((cert, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-200">
                {cert}
                <button onClick={() => removeCert(i)} className="text-zinc-500 hover:text-red-400 transition-colors leading-none ml-0.5">×</button>
              </span>
            ))}
            <input
              className="bg-transparent border border-dashed border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 w-44"
              placeholder="Add certification…"
              value={newCert}
              onChange={(e) => setNewCert(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addCert()
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const sectionLabel = 'text-xs font-semibold text-zinc-400 uppercase tracking-wide'

const inputCls =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors w-full'
