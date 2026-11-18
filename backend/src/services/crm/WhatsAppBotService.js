import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import P from 'pino';
import QRCode from 'qrcode-terminal';
import { EventEmitter } from 'events';

class WhatsAppBotService extends EventEmitter {
    constructor() {
        super();
        this.sock = null;
        this.status = 'desconectado'; // desconectado | conectando | qr | conectado
        this.qrCode = null;
        this.authDir = './whatsapp-auth';
    }

    async conectar() {
        if (this.status === 'conectado' || this.status === 'conectando') return;

        this.status = 'conectando';
        this.emit('status', this.status);

        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

        this.sock = makeWASocket({
            auth: state,
            logger: P({ level: 'silent' }),
            printQRInTerminal: false,
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
            if (qr) {
                this.status = 'qr';
                this.qrCode = qr;
                QRCode.generate(qr, { small: true });
                this.emit('qr', qr);
                this.emit('status', this.status);
            }

            if (connection === 'open') {
                this.status = 'conectado';
                this.qrCode = null;
                this.emit('status', this.status);
                console.log('✅ WhatsApp conectado');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                this.status = 'desconectado';
                this.emit('status', this.status);
                if (shouldReconnect) {
                    setTimeout(() => this.conectar(), 3000);
                }
            }
        });
    }

    desconectar() {
        if (this.sock) {
            this.sock.logout();
            this.sock = null;
        }
        this.status = 'desconectado';
        this.qrCode = null;
        this.emit('status', this.status);
    }

    async enviarMensagem(telefone, mensagem) {
        if (this.status !== 'conectado') throw new Error('WhatsApp não está conectado');

        const numero = telefone.replace(/\D/g, '');
        const jid = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`;

        await this.sock.sendMessage(jid, { text: mensagem });
        return true;
    }

    async enviarParaProspects(prospects, scriptConteudo, delayMs = 3000) {
        const resultados = [];

        for (const prospect of prospects) {
            if (!prospect.phone) {
                resultados.push({ id: prospect.id, nome: prospect.company_name, status: 'sem_telefone' });
                continue;
            }

            try {
                await this.enviarMensagem(prospect.phone, scriptConteudo);
                resultados.push({ id: prospect.id, nome: prospect.company_name, status: 'enviado' });
                await new Promise(r => setTimeout(r, delayMs));
            } catch (err) {
                resultados.push({ id: prospect.id, nome: prospect.company_name, status: 'erro', erro: err.message });
            }
        }

        return resultados;
    }

    getStatus() {
        return { status: this.status, qrCode: this.qrCode };
    }
}

export default new WhatsAppBotService();
