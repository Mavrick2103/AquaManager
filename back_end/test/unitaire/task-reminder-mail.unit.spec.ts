import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/mail/mail.service';

describe('Task reminder email', () => {
  it('escapes user content, provides text and links, and uses Paris time', async () => {
    const service = new MailService(new ConfigService({ APP_URL: 'https://example.com' }));
    const send = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({});
    await service.sendTaskReminder('test@example.com', '<script>name</script>', [{
      title: '<img src=x>', aquariumName: 'A & B', dueAt: new Date('2026-09-25T10:00:00Z'),
    }]);
    const message = send.mock.calls[0][0] as any;
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toContain('<img src=x>');
    expect(message.html).toContain('&lt;img src=x&gt;');
    expect(message.html).toContain('A &amp; B');
    expect(message.text).toContain('12:00');
    expect(message.html).toContain('https://example.com/calendar');
    expect(message.html).toContain('https://example.com/profile');
    send.mockRestore();
  });
});
