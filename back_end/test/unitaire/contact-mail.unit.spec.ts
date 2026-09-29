import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/mail/mail.service';
import * as nodemailer from 'nodemailer';

describe('Contact MIME message', () => {
  it('composes the in-memory attachment using the installed Nodemailer without SMTP', async () => {
    const service = new MailService({ get: () => undefined } as unknown as ConfigService);
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const send = jest.spyOn(transport, 'sendMail');
    Object.defineProperty(service, 'transporter', { value: transport });
    await service.sendContactMessage({ category: 'QUESTION', subject: 'Audit local', fromEmail: 'audit@example.invalid', message: 'Message de test', attachments: [{ originalname: 'audit.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4 audit') } as Express.Multer.File] });
    const result = await send.mock.results[0].value;
    const message = result.message.toString();
    expect(message).toContain('application/pdf');
    expect(message).toContain('audit.pdf');
    expect(message).toContain('Reply-To: audit@example.invalid');
  });
});
