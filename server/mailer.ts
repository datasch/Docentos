/**
 * Correo saliente por SMTP.
 *
 * Sirve con cualquier proveedor que hable SMTP (Gmail, Outlook, el correo del
 * dominio, Brevo, Resend, SES...). Sin SMTP_HOST, `isMailConfigured()` es falso
 * y quien llama decide la alternativa (el webhook de recuperacion).
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config.js';

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(config.SMTP_HOST);
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      // En 587/25 exige STARTTLS cuando hay credenciales: nunca se mandan en claro.
      requireTLS: !config.SMTP_SECURE && Boolean(config.SMTP_USER),
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
      // Un servidor que no responde no debe retener el envio indefinidamente.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Primer nombre sin anotaciones de rol: "Ana Silva (Usuario Público)" -> "Ana". */
function greetingName(name: string): string {
  const clean = name
    .replace(/\s*\([^)]*\)/g, '')
    // "Prof.Giantucchi" -> "Prof. Giantucchi": el tratamiento se separa y se descarta.
    .replace(/\b(prof|profa|dr|dra|ing|lic|mtro|mtra|sr|sra|srta)\.(?=\S)/gi, '$1. ')
    .trim();
  const words = clean.split(/\s+/).filter((word) => !/^(prof|profa|dr|dra|ing|lic|mtro|mtra|sr|sra|srta)\.?$/i.test(word));
  return words[0] || clean || name;
}

export interface PasswordResetMail {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
}

export function buildPasswordResetMail({ name, resetUrl, expiresAt }: Omit<PasswordResetMail, 'to'>) {
  const appName = config.APP_NAME;
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  const firstName = greetingName(name);
  const subject = `Restablece tu contraseña de ${appName}`;

  const text = [
    `Hola, ${firstName}:`,
    '',
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${appName}.`,
    'Abre este enlace para elegir una nueva:',
    '',
    resetUrl,
    '',
    `El enlace caduca en ${minutes} minutos y solo se puede usar una vez.`,
    'Si no lo pediste tú, ignora este correo: tu contraseña no cambia.',
    '',
    `— ${appName}`,
  ].join('\n');

  const safeUrl = escapeHtml(resetUrl);
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#18181b;">${escapeHtml(appName)}<span style="color:#06b6d4;">.</span></p>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b;">Restablece tu contraseña</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hola, ${escapeHtml(firstName)}:</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Pulsa el botón para elegir una nueva.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#7c3aed;">
            <a href="${safeUrl}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Elegir nueva contraseña</a>
          </td></tr></table>
          <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#52525b;">El enlace caduca en ${minutes} minutos y solo se puede usar una vez. Si el botón no funciona, copia esta dirección en tu navegador:</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:#0891b2;">${safeUrl}</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">Si no pediste este cambio, ignora este correo: tu contraseña sigue siendo la misma.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendPasswordResetMail(mail: PasswordResetMail): Promise<void> {
  const { subject, text, html } = buildPasswordResetMail(mail);
  await getTransporter().sendMail({
    // MAIL_FROM admite "correo@dominio" o "Nombre <correo@dominio>".
    from: config.MAIL_FROM.includes('<') ? config.MAIL_FROM : { name: config.APP_NAME, address: config.MAIL_FROM },
    to: mail.to,
    subject,
    text,
    html,
  });
}

/** Comprueba conexion y credenciales sin enviar nada (util al arrancar). */
export async function verifyMailTransport(): Promise<void> {
  await getTransporter().verify();
}
