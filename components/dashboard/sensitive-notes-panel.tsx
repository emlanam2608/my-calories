import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { SensitiveNotes } from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';

export function SensitiveNotesPanel({ available, initialNotes, locale, onSave, saving }: { available: boolean; initialNotes: SensitiveNotes; locale: Locale; onSave: (notes: SensitiveNotes) => void; saving: boolean }) {
  const c = getCopy(locale); const [notes, setNotes] = useState<SensitiveNotes>(initialNotes);
  const field = (label: string, value: string, update: (value: string) => void) => <label className="block space-y-1.5 text-sm font-semibold text-slate-800"><span>{label}</span><Textarea maxLength={2_000} value={value} onChange={(event) => update(event.target.value)} className="min-h-20 bg-white font-normal" /></label>;
  return <Card className="mt-6 border-none shadow-sm"><CardHeader><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">{c.sensitiveNotes.eyebrow}</p><CardTitle>{c.sensitiveNotes.title}</CardTitle><CardDescription>{c.sensitiveNotes.description}</CardDescription></CardHeader><CardContent>{available ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(notes); }}>{field(c.sensitiveNotes.medication, notes.medicationNote, (value) => setNotes((current) => ({ ...current, medicationNote: value })))}{field(c.sensitiveNotes.clinician, notes.clinicianNote, (value) => setNotes((current) => ({ ...current, clinicianNote: value })))}{field(c.sensitiveNotes.symptoms, notes.symptomNote, (value) => setNotes((current) => ({ ...current, symptomNote: value })))}<Button type="submit" disabled={saving} className="w-full bg-emerald-800 hover:bg-emerald-900"><ShieldCheck /> {saving ? c.common.saving : c.sensitiveNotes.save}</Button></form> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{c.sensitiveNotes.unavailable}</p>}</CardContent></Card>;
}
