import { TaskReminderService } from '../../src/settings/task-reminder.service';
import { Settings } from '../../src/settings/settings.entity';
import { RepeatMode, TaskStatus } from '../../src/tasks/task.entity';

describe('Task reminders', () => {
  let service: TaskReminderService;
  let settings: any;
  let settingsRepo: any;
  let taskRepo: any;
  let runner: any;
  let mail: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T07:00:00Z'));
    settings = { id: 2, lastTaskReminderDate: null, user: { id: 7, email: 'test@example.com', fullName: 'Test' } };
    settingsRepo = {
      find: jest.fn().mockResolvedValue([settings]),
      findOne: jest.fn().mockImplementation(async () => settings),
      update: jest.fn().mockImplementation(async (_id, patch) => Object.assign(settings, patch)),
    };
    taskRepo = { find: jest.fn().mockResolvedValue([
      { id: 1, title: 'Changer l’eau', dueAt: new Date('2026-09-25T09:00:00Z'), status: TaskStatus.PENDING, aquarium: { name: 'Bac A' } },
      { id: 2, title: 'Terminé', dueAt: new Date('2026-09-25T09:00:00Z'), status: TaskStatus.DONE, aquarium: { name: 'Bac A' } },
      { id: 3, title: 'Taille', dueAt: new Date('2026-09-01T12:00:00Z'), isRepeat: true, repeatMode: RepeatMode.DAILY, aquarium: { name: 'Bac B' } },
    ]) };
    runner = {
      connect: jest.fn(), release: jest.fn(), query: jest.fn().mockResolvedValue([{ acquired: 1 }]),
      manager: { getRepository: (entity) => entity === Settings ? settingsRepo : taskRepo },
    };
    mail = { sendTaskReminder: jest.fn().mockResolvedValue(undefined) };
    service = new TaskReminderService({ createQueryRunner: () => runner } as any, mail);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('groups unfinished tasks from multiple aquariums and persists one digest per day', async () => {
    await service.sendDailyTaskReminders();
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder).toHaveBeenCalledTimes(1);
    expect(mail.sendTaskReminder.mock.calls[0][2].map((t) => t.title)).toEqual(['Changer l’eau', 'Taille']);
    expect(settingsRepo.update).toHaveBeenCalledWith(2, { lastTaskReminderDate: '2026-09-25' });
    expect(taskRepo.find.mock.calls[0][0].where).toEqual({ user: { id: 7 }, aquarium: { user: { id: 7 } } });
  });

  it('requires all preferences and verified email, and rechecks consent before sending', async () => {
    settingsRepo.findOne.mockResolvedValue(null);
    await service.sendDailyTaskReminders();
    expect(settingsRepo.find.mock.calls[0][0].where).toMatchObject({
      notificationsEnabled: true, emailNotifications: true, taskReminders: true,
      user: { emailVerifiedAt: expect.anything() },
    });
    expect(mail.sendTaskReminder).not.toHaveBeenCalled();
  });

  it('does not send before 9am Paris', async () => {
    jest.setSystemTime(new Date('2026-09-25T06:59:00Z'));
    await service.sendDailyTaskReminders();
    expect(runner.connect).not.toHaveBeenCalled();
  });

  it('does not consume the day when there are no pending tasks', async () => {
    taskRepo.find.mockResolvedValue([]);
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder).not.toHaveBeenCalled();
    expect(settingsRepo.update).not.toHaveBeenCalled();
  });

  it('retries after SMTP failure without marking the failed day as sent', async () => {
    mail.sendTaskReminder.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await service.sendDailyTaskReminders();
    expect(settingsRepo.update).not.toHaveBeenCalled();
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder).toHaveBeenCalledTimes(2);
    expect(settings.lastTaskReminderDate).toBe('2026-09-25');
    expect(runner.release).toHaveBeenCalledTimes(2);
  });

  it('skips a run when another API instance owns the MySQL lock', async () => {
    runner.query.mockResolvedValue([{ acquired: 0 }]);
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('releases the lock after a database error and allows a subsequent run', async () => {
    settingsRepo.find.mockRejectedValueOnce(new Error('database unavailable'));
    await service.sendDailyTaskReminders();
    expect(runner.query).toHaveBeenCalledWith("SELECT RELEASE_LOCK('aquamanager:task-reminders')");
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder).toHaveBeenCalledTimes(1);
  });

  it('does not resend after restart, but sends a new digest on the following day', async () => {
    settings.lastTaskReminderDate = '2026-09-25';
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-09-26T07:00:00Z'));
    await service.sendDailyTaskReminders();
    expect(mail.sendTaskReminder.mock.calls[0][2].map((t) => t.title)).toEqual(['Taille']);
  });
});
