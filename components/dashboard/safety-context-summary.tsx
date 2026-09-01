import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EffectiveSafetyContext, SafetyReasonCode } from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';

export function SafetyContextSummary({ context, locale }: { context: EffectiveSafetyContext | null; locale: Locale }) {
  if (!context) return null;
  const c = getCopy(locale).safetyContext;
  const entries = [
    ['workout_plan', c.workoutPlan],
    ['workout_progression', c.workoutProgression],
    ['coach_exercise', c.coachExercise],
  ] as const;
  const reasonLabels = c.reasons as Record<SafetyReasonCode, string>;
  return (
    <Card className="mb-6 border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-700" />{c.title}</CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([domain, label]) => {
          const decision = context.decisions[domain];
          const statusLabel = decision.status === 'allowed' ? c.allowed : decision.status === 'blocked' ? c.blocked : c.allowedWithModifications;
          return <section key={domain} className={`rounded-xl border p-4 ${decision.status === 'blocked' ? 'border-amber-200 bg-amber-50' : decision.status === 'allowed_with_modifications' ? 'border-sky-200 bg-sky-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <h3 className="flex items-center justify-between gap-3 font-semibold"><span>{label}</span><span className="text-xs uppercase tracking-wide">{statusLabel}</span></h3>
            {decision.reasons.length ? <ul className="mt-2 space-y-1 text-sm leading-5">{decision.reasons.map((reason) => <li key={reason.code} className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{reasonLabels[reason.code]}</span></li>)}</ul> : <p className="mt-2 text-sm">{c.noReasons}</p>}
          </section>;
        })}
      </CardContent>
    </Card>
  );
}
