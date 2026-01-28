import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { readFile, unlink } from 'fs/promises';

type ContactCategory = 'BUG' | 'QUESTION' | 'SUGGESTION' | 'AUTRE';

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
    const secure =
      String(this.config.get<string>('SMTP_SECURE') ?? 'true').toLowerCase() === 'true';

    const user = this.config.get<string>('SMTP_USER') ?? '';
    const rawPass = this.config.get<string>('SMTP_PASS') ?? '';
    const pass = rawPass.replace(/\s+/g, ''); // ✅ supprime espaces/retours

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
  }

  private from(): string {
    // ✅ l'expéditeur affiché
    return this.config.get<string>('EMAIL_FROM') ?? 'AquaManager <aquamanager.contact@gmail.com>';
  }

  // ============================================================
  // ✅ EMAIL : Vérification de compte
  // ============================================================
  async sendVerifyEmail(to: string, fullName: string, token: string): Promise<void> {
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

  // ============================================================
  // ✅ EMAIL : Mot de passe oublié
  // ============================================================
  async sendResetPassword(to: string, fullName: string, token: string): Promise<void> {
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

  // ============================================================
  // ✅ EMAIL : Formulaire de contact (avec pièces jointes)
  // ============================================================
  async sendContactMessage(params: {
    category: ContactCategory;
    subject: string;
    fromEmail: string;
    message: string;
    attachments?: Express.Multer.File[];
  }): Promise<void> {
    const to = this.config.get<string>('CONTACT_TO_EMAIL') ?? 'aquamanager.contact@gmail.com';

    const label =
      params.category === 'BUG'
        ? 'Bug'
        : params.category === 'QUESTION'
        ? 'Question'
        : params.category === 'SUGGESTION'
        ? "Suggestion d'amélioration"
        : 'Autre';

    const subject = `[AquaManager Contact] ${label} — ${params.subject}`;

    const text =
`Catégorie: ${label}
Email utilisateur: ${params.fromEmail}

Message:
${params.message}
`;

    const files = params.attachments ?? [];

    // ✅ Convertit les fichiers uploadés en pièces jointes Nodemailer
    const attachments = await Promise.all(
      files.map(async (f) => {
        const content = await readFile(f.path);
        return {
          filename: f.originalname,
          content,
          contentType: f.mimetype,
        };
      })
    );

    try {
      await this.transporter.sendMail({
        from: this.from(),
        to,                          // ✅ ton email de réception
        replyTo: params.fromEmail,   // ✅ tu réponds au user directement
        subject,
        text,
        attachments,
      });

      this.logger.log(`Contact email sent from ${params.fromEmail} (${label})`);
    } finally {
      // ✅ Nettoyage des fichiers temporaires (même si erreur)
      await Promise.allSettled(files.map((f) => unlink(f.path)));
    }
  }

  private escape(s: string): string {
    return (s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[c] as string));
  }
}
