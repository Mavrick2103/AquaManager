import { IsNull } from 'typeorm';
import { AiService } from '../../src/ai/ai.service';
import { TaskStatus, TaskType } from '../../src/tasks/task.entity';

jest.mock('openai', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({
  responses: { create: jest.fn() },
})) }));

describe('AI aquarium context', () => {
  let service: AiService;
  let tasks: any;
  let measurements: any;
  let aquariums: any;
  let create: jest.Mock;
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-only';
    tasks = { find: jest.fn().mockResolvedValue([{
      title: 'Changement d’eau', description: 'Entretien réalisé', type: TaskType.WATER_CHANGE,
      dueAt: new Date('2026-01-01'), status: TaskStatus.PENDING, isRepeat: true,
      completedOccurrences: ['2026-01-01T10:00:00.000Z'],
    }]) };
    measurements = { find: jest.fn().mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({
      measuredAt: `releve-${i + 1}`, ph: 7,
    }))) };
    aquariums = { findOne: jest.fn().mockResolvedValue({ id: 9, name: 'Bac de test' }) };
    const usage = { count: jest.fn().mockResolvedValue(0), create: jest.fn(x => x), save: jest.fn() };
    service = new AiService(usage as any, aquariums, measurements,
      { getEffectivePlan: jest.fn().mockResolvedValue('PREMIUM') } as any, tasks);
    create = (service as any).openai.responses.create;
    create.mockResolvedValue({ output_text: '{"analysis":"Bilan","suggestedTasks":[]}' });
    jest.spyOn(service as any, 'getRelevantCrevettilusProducts').mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it.each(['text', 'photo'])('includes expanded measurements and scoped task history for %s', async mode => {
    if (mode === 'text') await service.analyzeAquarium(4, 9, { question: 'Fais un bilan' });
    else await service.analyzeAquariumPhoto(4, 9,
      { buffer: Buffer.from('test'), mimetype: 'image/png' } as any, {} as any);
    expect(measurements.find).toHaveBeenCalledWith(expect.objectContaining({ where: { aquariumId: 9 }, take: 30 }));
    expect(tasks.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user: { id: 4 }, aquarium: { id: 9, archivedAt: IsNull() }, dueAt: expect.anything() }),
      take: 50, loadEagerRelations: false,
    }));
    const input = JSON.stringify(create.mock.calls[0][0].input);
    expect(input).toContain('releve-30');
    expect(input).toContain('Changement d’eau');
    expect(input).toContain('2026-01-01T10:00:00.000Z');
    expect(input).toContain('PENDING');
    expect(input).toContain('le statut du modèle ne vaut pas pour toute la série');
  });

  it('does not read context or call AI for an aquarium the user does not own', async () => {
    aquariums.findOne.mockResolvedValue(null);
    await expect(service.analyzeAquarium(4, 9, {} as any)).rejects.toThrow('Aquarium introuvable');
    expect(aquariums.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9, user: { id: 4 }, archivedAt: IsNull() } }));
    expect(tasks.find).not.toHaveBeenCalled();
    expect(measurements.find).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('handles an empty history explicitly', async () => {
    tasks.find.mockResolvedValue([]);
    measurements.find.mockResolvedValue([]);
    await service.analyzeAquarium(4, 9, {} as any);
    expect(create.mock.calls[0][0].input).toContain('Aucune tâche passée enregistrée');
    expect(create.mock.calls[0][0].input).toContain('Aucune mesure récente disponible');
  });
});
