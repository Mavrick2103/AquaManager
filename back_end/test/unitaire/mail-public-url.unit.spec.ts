import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/mail/mail.service';

describe('Public email links', () => {
  it.each([undefined, '', 'http://localhost:4200', 'https://localhost:4200',
    'https://127.0.0.1', 'https://[::1]', 'invalid-url'])
  ('uses the public site in production when APP_URL is %s', async (appUrl) => {
    const service = new MailService(new ConfigService({ NODE_ENV: 'production', APP_URL: appUrl }));
    const send = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({});
    await service.sendMeasurementReminder('test@example.test', 'Camille');
    expect((send.mock.calls[0][0] as any).html).toContain('href="https://aquamanager.fr/aquariums"');
  });

  it('keeps a configured HTTPS site and normalizes its trailing slash', async () => {
    const service = new MailService(new ConfigService({ NODE_ENV: 'production', APP_URL: ' https://www.aquamanager.fr/ ' }));
    const send = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({});
    await service.sendResetPassword('test@example.test', 'Camille', 'test-token');
    expect((send.mock.calls[0][0] as any).html).toContain('https://www.aquamanager.fr/auth/reset-password?token=test-token');
  });

  it('allows localhost for development', async () => {
    const service = new MailService(new ConfigService({ NODE_ENV: 'development', APP_URL: 'http://localhost:4200' }));
    const send = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({});
    await service.sendMeasurementReminder('test@example.test', 'Camille');
    expect((send.mock.calls[0][0] as any).html).toContain('href="http://localhost:4200/aquariums"');
  });
});
