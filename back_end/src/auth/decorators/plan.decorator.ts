import { SetMetadata } from '@nestjs/common';

export const PLAN_KEY = 'plan';

export type SubscriptionPlan = 'CLASSIC' | 'PREMIUM' | 'PRO';

/**
 * Bloque l'accès si l'utilisateur n'a pas au moins ce plan.
 * Exemple: @PlanRequired('PREMIUM')
 */
export const PlanRequired = (plan: SubscriptionPlan) => SetMetadata(PLAN_KEY, plan);
