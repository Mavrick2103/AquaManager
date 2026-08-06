export type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';

export interface AdminMetricsDto {
  generatedAt: string;
  range: MetricsRange;

  users: {
    total: number;
    admins: number;

    newInRange: number | null;       // null si User.createdAt n'existe pas
    activeInRange: number;

    latest: Array<{
      id: number;
      fullName: string;
      email: string;
      role: 'USER' | 'ADMIN' | 'EDITOR';
      lastActivityAt: string | Date | null;
    }>;
    note?: string;
  };

  aquariums: {
    total: number;
    createdInRange: number;
  };

  tasks: {
    total: number;
    createdInRange: number;
    doneTotal: number;
    doneInRange: number;
  };

  measurements: {
    total: number;
    createdInRange: number;
  };
}
