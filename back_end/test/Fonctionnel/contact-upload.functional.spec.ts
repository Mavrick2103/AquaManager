import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ContactController } from '../../src/contact/contact.controller';
import { MailService } from '../../src/mail/mail.service';

describe('Contact attachments', () => {
  let app: INestApplication;
  const mail = { sendContactMessage: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])], controllers: [ContactController], providers: [{ provide: MailService, useValue: mail }] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => mail.sendContactMessage.mockReset());
  const send = (subject: string) => request(app.getHttpServer()).post('/contact')
    .field('category', 'QUESTION').field('subject', subject)
    .field('fromEmail', 'audit@example.invalid').field('message', 'Question de test suffisamment longue.');
  it('accepts an attachment without depending on a temporary disk directory', async () => {
    await send('Question').attach('attachments', Buffer.from('%PDF-1.4 audit'), { filename: 'audit.pdf', contentType: 'application/pdf' }).expect(201);
    const attachment = mail.sendContactMessage.mock.calls[0][0].attachments[0];
    expect(Buffer.isBuffer(attachment.buffer)).toBe(true);
    expect(attachment.path).toBeUndefined();
  });
  it('does not send invalid forms or unsupported attachments', async () => {
    await send('x').attach('attachments', Buffer.from('%PDF-1.4'), { filename: 'audit.pdf', contentType: 'application/pdf' }).expect(400);
    await send('Question').attach('attachments', Buffer.from('script'), { filename: 'audit.js', contentType: 'text/javascript' }).expect(400);
    expect(mail.sendContactMessage).not.toHaveBeenCalled();
  });
});
