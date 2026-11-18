import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EmailService = {
    async send({ to, subject, body }) {
        if (!to)      throw new Error('Destinatário (to) não informado');
        if (!subject) throw new Error('Assunto não informado');

        if (!resend) {
            console.warn('[Email] RESEND_API_KEY não configurada; e-mail não enviado.');
            return { enviado: false, motivo: 'RESEND_API_KEY ausente' };
        }
        const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html: `<div style="font-family:sans-serif;line-height:1.6">${body}</div>`,
        });

        if (error) throw new Error(`Resend: ${error.message}`);
        return { enviado: true };
    }
};

export default EmailService;
