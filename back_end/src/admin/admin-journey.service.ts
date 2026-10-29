import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Historical records only: createdAt means an actual saved action, not a backdated measurement.
export const JOURNEY_SNAPSHOT = `
WITH actions AS (
  SELECT a.userId, m.createdAt AS at FROM water_measurements m JOIN aquariums a ON a.id = m.aquariumId
  UNION ALL SELECT userId, createdAt FROM tasks
  UNION ALL SELECT userId, createdAt FROM feature_usage_events WHERE feature = 'ASSISTANT_OPEN' AND userId IS NOT NULL
), first_actions AS (SELECT userId, MIN(at) AS firstActionAt FROM actions WHERE at <= ? GROUP BY userId),
snapshot AS (
  SELECT u.id, u.fullName, u.createdAt, u.lastActivityAt, f.firstActionAt,
    EXISTS(SELECT 1 FROM aquariums a WHERE a.userId = u.id AND a.createdAt <= ?) AS aquarium,
    EXISTS(SELECT 1 FROM water_measurements m JOIN aquariums a ON a.id = m.aquariumId WHERE a.userId = u.id AND m.createdAt <= ?) AS measurement,
    EXISTS(SELECT 1 FROM tasks t WHERE t.userId = u.id AND t.createdAt <= ?) AS task,
    EXISTS(SELECT 1 FROM feature_usage_events e WHERE e.userId = u.id AND e.feature = 'ASSISTANT_OPEN' AND e.createdAt <= ?) AS solutions,
    EXISTS(SELECT 1 FROM actions x WHERE x.userId = u.id AND x.at >= DATE_ADD(f.firstActionAt, INTERVAL 7 DAY) AND x.at < DATE_ADD(f.firstActionAt, INTERVAL 14 DAY) AND x.at <= ?) AS returned,
    (f.firstActionAt <= DATE_SUB(?, INTERVAL 14 DAY)) AS returnEligible,
    EXISTS(SELECT 1 FROM paypal_subscriptions s WHERE s.userId = u.id AND s.environment = 'live' AND s.createdAt <= ?) AS checkout,
    EXISTS(SELECT 1 FROM paypal_payments p JOIN paypal_subscriptions s ON s.id = p.subscriptionKey WHERE s.userId = u.id AND s.environment = 'live' AND p.reversed = 0 AND p.paidAt IS NOT NULL AND p.paidAt <= ?) AS paid
  FROM users u LEFT JOIN first_actions f ON f.userId = u.id
  WHERE u.role = 'USER' AND u.createdAt <= ? AND (? IS NULL OR u.createdAt >= ?)
)`;

export function journeyStage(row: any): string {
  if (Number(row.paid)) return 'Paiement confirmé';
  if (Number(row.checkout)) return 'Paiement commencé, non confirmé';
  if (Number(row.returned)) return 'Revenu au suivi';
  if (row.firstActionAt) return 'Suivi commencé';
  if (Number(row.aquarium)) return 'Aquarium sans suivi';
  return 'Aucun aquarium';
}

@Injectable()
export class AdminJourneyService {
  constructor(private readonly db: DataSource) {}

  async report(query: { days?: string; page?: string; stage?: string }) {
    const now = new Date();
    const days = query.days === 'all' ? null : ['30', '90', '365'].includes(query.days ?? '') ? Number(query.days) : 90;
    const from = days === null ? null : new Date(now.getTime() - days * 86400000);
    const params = [...Array(10).fill(now), from, from];
    const aggregates = `COUNT(*) AS registered, COALESCE(SUM(aquarium),0) AS aquarium,
      COALESCE(SUM(firstActionAt IS NOT NULL),0) AS activated,
      COALESCE(SUM(measurement),0) AS measurement, COALESCE(SUM(task),0) AS task,
      COALESCE(SUM(solutions),0) AS solutions, COALESCE(SUM(returnEligible),0) AS returnEligible,
      COALESCE(SUM(returnEligible AND returned),0) AS returned,
      COALESCE(SUM(checkout),0) AS checkout, COALESCE(SUM(paid),0) AS paid`;
    const conditions: Record<string, string> = {
      no_aquarium: 'aquarium = 0',
      no_action: 'aquarium = 1 AND firstActionAt IS NULL',
      no_return: 'returnEligible = 1 AND returned = 0',
      unpaid: 'checkout = 1 AND paid = 0',
    };
    const condition = conditions[query.stage ?? ''] ?? '1=1';
    const normalize = (row: any) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === 'month' ? value : Number(value ?? 0)]));
    // No fallback to zero: an unavailable source must surface as an error.
    const [totalRows, cohorts, countRows] = await Promise.all([
      this.db.query(`${JOURNEY_SNAPSHOT} SELECT ${aggregates} FROM snapshot`, params),
      this.db.query(`${JOURNEY_SNAPSHOT} SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, ${aggregates} FROM snapshot GROUP BY month ORDER BY month DESC`, params),
      this.db.query(`${JOURNEY_SNAPSHOT} SELECT COUNT(*) AS total FROM snapshot WHERE ${condition}`, params),
    ]);
    const total = Number(countRows[0].total);
    const requestedPage = Math.max(1, Math.min(100000, Number.parseInt(query.page ?? '1', 10) || 1));
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 20)));
    const items = await this.db.query(`${JOURNEY_SNAPSHOT} SELECT * FROM snapshot WHERE ${condition} ORDER BY createdAt DESC, id DESC LIMIT 20 OFFSET ?`, [...params, (page - 1) * 20]);
    return { generatedAt: now.toISOString(), days: days ?? 'all', totals: normalize(totalRows[0]),
      cohorts: cohorts.map(normalize), total, page, pageSize: 20,
      items: items.map(row => ({ ...row, stage: journeyStage(row) })) };
  }
}
