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

  async sendMeasurementReminder(to: string, fullName: string): Promise<void> {
    const url = `${this.appUrl()}/aquariums`;
    await this.transporter.sendMail({
      from: this.from(),
      to,
      subject: 'AquaManager — Il est temps de relever les paramètres de ton aquarium',
      html: `
        <div style="max-width:600px;margin:auto;padding:28px;font-family:Arial,sans-serif;color:#243c3d;line-height:1.55">
          <div style="padding:24px;border:1px solid #dcebea;border-radius:18px;background:#f7fbfb">
            <h2 style="margin:0 0 12px;color:#087f8c">Un petit contrôle de ton aquarium ?</h2>
            <p>Bonjour ${this.escape(fullName)},</p>
            <p>Aucune nouvelle mesure n’a été enregistrée depuis au moins deux semaines.</p>
            <p>Un relevé régulier du pH, de la température et des autres paramètres utiles permet de repérer plus tôt les variations du bac.</p>
            <p style="margin:22px 0">
              <a href="${url}" style="display:inline-block;padding:11px 16px;border-radius:11px;background:#087f8c;color:#fff;font-weight:bold;text-decoration:none">
                Ajouter une nouvelle mesure
              </a>
            </p>
            <p style="margin-bottom:0;color:#667c7b;font-size:13px">Tu reçois ce message parce que tu as accepté les notifications automatiques par email dans AquaManager. Tu peux modifier ce choix depuis ton profil.</p>
          </div>
        </div>
      `,
    });
    this.logger.log(`Measurement reminder sent to ${to}`);
  }

  async sendAdminMessage(params: {
    to: string;
    fullName: string;
    subject: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
  }): Promise<void> {
    const paragraphs = params.message
      .split(/\r?\n\r?\n/)
      .map((paragraph) => `<p style="margin:0 0 14px">${this.escape(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
    const action = params.actionUrl
      ? `<p style="margin:24px 0"><a href="${this.escape(params.actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:11px;background:#087f8c;color:#fff;font-weight:bold;text-decoration:none">${this.escape(params.actionLabel || 'Découvrir')}</a></p>`
      : '';
    await this.transporter.sendMail({
      from: this.from(),
      to: params.to,
      subject: params.subject,
      text: `Bonjour ${params.fullName},\n\n${params.message}${params.actionUrl ? `\n\n${params.actionUrl}` : ''}`,
      html: `<div style="max-width:620px;margin:auto;padding:28px;font-family:Arial,sans-serif;color:#243c3d;line-height:1.6"><div style="padding:28px;border:1px solid #dcebea;border-radius:18px;background:#fff"><div style="margin-bottom:22px;color:#087f8c;font-size:20px;font-weight:bold">AquaManager</div><p>Bonjour ${this.escape(params.fullName)},</p>${paragraphs}${action}<p style="margin-top:26px;color:#708281;font-size:12px">Message envoyé par l’équipe AquaManager.</p></div></div>`,
    });
    this.logger.log(`Admin email sent to user ${params.to}`);
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
