import type { EffectiveSafetyContext, SafetyDecisionDomain } from './contracts';

export function recommendationBlockedResponse(
  context: EffectiveSafetyContext,
  domain: SafetyDecisionDomain,
) {
  const decision = context.decisions[domain];
  return Response.json({
    error: 'Exercise guidance is paused by the effective safety context.',
    errorCode: 'exercise_recommendation_blocked',
    domain,
    contextVersion: context.contextVersion,
    reasons: decision.reasons,
  }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
}
