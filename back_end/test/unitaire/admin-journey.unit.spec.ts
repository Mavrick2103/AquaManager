import { AdminJourneyService, journeyStage } from '../../src/admin/admin-journey.service';
describe('Admin journey', () => {
  it('never turns unavailable historical data into an empty report', async () => {
    const service = new AdminJourneyService({ query: jest.fn().mockRejectedValue(new Error('unavailable')) } as any);
    await expect(service.report({})).rejects.toThrow('unavailable');
  });
  it('uses whitelisted filters and bounded pages', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ registered: '0' }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }]).mockResolvedValueOnce([]);
    const result = await new AdminJourneyService({ query } as any).report({ stage: "' OR 1=1 --", days: 'bad', page: '999999999' });
    expect(result.page).toBe(1);
    expect(result.days).toBe(90);
    expect(query.mock.calls[2][0]).toContain('WHERE 1=1');
    expect(query.mock.calls[3][1].at(-1)).toBe(0);
  });
  it('distinguishes paid access from unconfirmed checkout and initial setup', () => {
    expect(journeyStage({ paid: '0', checkout: '1' })).toBe('Paiement commencé, non confirmé');
    expect(journeyStage({ paid: '1', checkout: '1' })).toBe('Paiement confirmé');
    expect(journeyStage({ aquarium: '1' })).toBe('Aquarium sans suivi');
    expect(journeyStage({})).toBe('Aucun aquarium');
  });
});
