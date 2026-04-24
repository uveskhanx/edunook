import { DbService, Profile } from './db-service';

export interface SubscriptionStatus {
  isActive: boolean;
  daysRemaining: number;
  isExpiringSoon: boolean;
}

export const SubscriptionGuard = {
  /**
   * Checks the user's subscription status, handles expiration, and sends notifications.
   * This should be called on app load or when the profile is fetched.
   */
  async checkAndSync(profile: Profile): Promise<Profile> {
    if (!profile.subscription || profile.subscription.planId === 'none' || profile.subscription.planId === 'spark') {
      return profile;
    }

    const now = new Date();
    const expiresAt = new Date(profile.subscription.expiresAt || '');

    // 1. Handle Expiration
    if (now >= expiresAt) {
      const updatedProfile: Profile = {
        ...profile,
        subscription: {
          planId: 'none',
          billingCycle: 'monthly',
          status: 'expired',
          subscribedAt: '',
          expiresAt: ''
        }
      };

      await DbService.updateProfile(profile.uid, updatedProfile);

      // Notify user of expiration
      await DbService.createNotification(profile.uid, {
        type: 'system',
        fromUid: 'system',
        text: `Your ${profile.subscription.planId} subscription has expired. Renew now to keep your benefits!`,
        createdAt: now.toISOString(),
        seen: false
      });

      return updatedProfile;
    }

    // 2. Handle Notifications
    const diffTime = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const cycle = profile.subscription.billingCycle || 'monthly';
    const lastNotified = profile.subscription.lastNotifiedDaysRemaining || 999;

    let shouldNotify = false;
    let message = "";

    // Thresholds
    const thresholds = cycle === 'monthly'
      ? [4, 2, 1]
      : [30, 20, 4, 2, 1];

    // Find the highest threshold that is >= daysRemaining but was not yet notified
    for (const t of thresholds) {
      if (daysRemaining <= t && lastNotified > t) {
        shouldNotify = true;
        message = `Your ${profile.subscription.planId} plan expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}. Renew now to lock in your current price!`;
        break;
      }
    }

    if (shouldNotify) {
      // Send notification
      await DbService.createNotification(profile.uid, {
        type: 'system',
        fromUid: 'system',
        text: message,
        createdAt: now.toISOString(),
        seen: false
      });

      // Update last notified to prevent duplicate pings for the same threshold
      const updatedProfile = {
        ...profile,
        subscription: {
          ...profile.subscription,
          lastNotifiedDaysRemaining: daysRemaining
        }
      };
      await DbService.updateProfile(profile.uid, updatedProfile);
      return updatedProfile;
    }

    return profile;
  },

  /**
   * Calculates expiration based on cycle
   */
  getExpirationDate(cycle: 'monthly' | 'yearly'): string {
    const d = new Date();
    if (cycle === 'monthly') {
      d.setDate(d.getDate() + 31);
    } else {
      d.setDate(d.getDate() + 366);
    }
    return d.toISOString();
  }
};
