export interface InfrastructureHealth {
  generatedAt?: string;
  mysql: 'ok' | 'error';
  disk: {
    status: 'ok' | 'warning' | 'critical' | 'unknown';
    freeBytes: number | null;
    totalBytes: number | null;
    usedPercent: number | null;
  };
  backup: {
    status: 'ok' | 'warning' | 'critical' | 'unknown';
    lastAt: string | null;
    ageHours: number | null;
  };
  uptimeSeconds: number;
  memoryBytes: number;
}
export interface AdminOverview {
  generatedAt: string;
  users: {
    total: number;
    newInRange: number | null;
    activeInRange: number;
    recentRegistrations: Array<{
      id: number;
      fullName: string;
      email: string;
      createdAt: string;
      emailVerifiedAt: string | null;
      subscriptionPlan: string;
      subscriptionStatus: string;
      subscriptionEndsAt: string | null;
    }>;
  };
  subscriptions: {
    totalActive: number;
    premiumActive: number;
    proActive: number;
    expiringSoon: number;
  };
  attention: { unverifiedUsers: number; inactiveUsers: number; overdueTasks: number };
  moderation: {
    pendingArticles: number;
    pendingFishCards: number;
    pendingPlantCards: number;
    totalPending: number;
  };
  aquariums: { total: number; createdInRange: number };
  measurements: { total: number; createdInRange: number };
  tasks: { total: number; createdInRange: number };
  operations: {
    infrastructure: InfrastructureHealth;
    alerts: {
      trackingAvailable: boolean;
      apiErrors: number;
      stripeFailures: number;
      paypalFailures: number;
      emailFailures: number;
    };
  };
  featureUsage: Record<string, { events: number; users: number; available?: boolean }>;
}
