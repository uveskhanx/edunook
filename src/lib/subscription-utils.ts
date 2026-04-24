export type SubscriptionTier = 'elite' | 'edge' | 'spark' | 'none';

export const SUBSCRIPTION_DISCOUNTS: Record<SubscriptionTier | string, number> = {
  elite: 0.34, // 34% Off
  edge: 0.16,  // 16% Off
  spark: 0,
  none: 0
};

/**
 * Calculates the discounted price based on the user's subscription tier.
 */
export function calculateDiscountedPrice(originalPrice: number, planId?: string | null): number {
  if (originalPrice === 0) return 0;
  const discount = SUBSCRIPTION_DISCOUNTS[planId as SubscriptionTier] || 0;
  return Math.floor(originalPrice * (1 - discount));
}

/**
 * Returns the discount percentage as a display string (e.g. "50%")
 */
export function getDiscountLabel(planId?: string | null): string | null {
  const discount = SUBSCRIPTION_DISCOUNTS[planId as SubscriptionTier] || 0;
  if (discount === 0) return null;
  return `${Math.round(discount * 100)}%`;
}

/**
 * Checks if a user has any premium tier
 */
export function isPremium(planId?: string | null): boolean {
  return planId === 'elite' || planId === 'edge';
}
