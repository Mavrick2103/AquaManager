import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    // ✅ En test : on n'envoie rien, on évite toute config SMTP
    if (process.env.NODE_ENV === 'test') {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    const host = this.config.get<string>('SMTP_HOST') ?? 'smtp.gmail.com';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
    const secure = String(this.config.get<string>('SMTP_SECURE') ?? 'true').toLowerCase() === 'true';

    const user = this.config.get<string>('SMTP_USER') ?? '';
    const rawPass = this.config.get<string>('SMTP_PASS') ?? '';
    const pass = rawPass.replace(/\s+/g, '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private appUrl() {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
  }

  private from() {
    return this.config.get<string>('EMAIL_FROM') ?? 'AquaManager <aquamanager.contact@gmail.com>';
  }

  async sendVerifyEmail(to: string, fullName: string, token: string) {
    const url = `${this.appUrl()}/auth/verification-email?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from(),
      to,
      subject: 'AquaManager — Vérifie ton e-mail',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Validation de ton e-mail</h2>
          <p>Salut ${this.escape(fullName)},</p>
          <p>Pour activer ton compte AquaManager, clique sur le bouton :</p>
          <p>
            <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#2e7d32;color:#fff;text-decoration:none">
              Vérifier mon e-mail
            </a>
          </p>
          <p style="color:#555">Si tu n’es pas à l’origine de cette demande, ignore ce message.</p>
        </div>
      `,
    });

    this.logger.log(`Verify email sent to ${to}`);
  }

  async sendResetPassword(to: string, fullName: string, token: string) {
    const url = `${this.appUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from(),
      to,
      subject: 'AquaManager — Réinitialisation du mot de passe',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Réinitialisation du mot de passe</h2>
          <p>Salut ${this.escape(fullName)},</p>
          <p>Pour choisir un nouveau mot de passe, clique :</p>
          <p>
            <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#1565c0;color:#fff;text-decoration:none">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color:#555">Si tu n’as rien demandé, ignore ce message.</p>
        </div>
      `,
    });

    this.logger.log(`Reset password email sent to ${to}`);
  }

  private escape(s: string) {
    return (s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[c] as string));
  }
}
