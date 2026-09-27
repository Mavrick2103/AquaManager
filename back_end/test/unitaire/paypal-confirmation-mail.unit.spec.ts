import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/mail/mail.service';

describe('Premium payment confirmation email', () => {
  it('renders an escaped confirmation with the period, reference and explicit Sandbox label', async () => {
    const service = new MailService(new ConfigService({ APP_URL: 'https://aquamanager.example' }));
    const sendMail = jest.fn().mockResolvedValue({});
    (service as any).transporter = { sendMail };
    await service.sendPremiumPaymentConfirmation('buyer@example.test', '<img src=x>', 'SALE123', new Date('2026-10-27T12:00:00Z'), true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('buyer@example.test');
    expect(mail.subject).toContain('[TEST]');
    expect(mail.html).toContain('&lt;img src=x&gt;');
    expect(mail.html).not.toContain('<img src=x>');
    expect(mail.text).toContain('27/10/2026');
    expect(mail.text).toContain('SALE123');
    expect(mail.text).toContain('3,99 EUR');
    expect(mail.text).toContain('https://aquamanager.example/profile');
    expect(mail.text).toContain('aucun argent réel');
  });
});
