import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import P from 'pino';
import QRCodeLib from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = path.resolve(__dirname, '../../../../../whatsapp-session');

let sock = null;
let currentQR = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'

function limparSessao() {
    try {
        if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        }
    } catch {}
}

async function conectar() {
    connectionStatus = 'connecting';
    currentQR = null;

    if (!fs.existsSync(SESSION_PATH)) {
        fs.mkdirSync(SESSION_PATH, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['LucroMais', 'Chrome', '1.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = await QRCodeLib.toDataURL(qr);
            connectionStatus = 'connecting';
        }

        if (connection === 'open') {
            currentQR = null;
            connectionStatus = 'connected';
            console.log('✅ WhatsApp conectado!');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const loggedOut = statusCode === DisconnectReason.loggedOut;

            sock = null;
            currentQR = null;
            connectionStatus = 'disconnected';

            if (loggedOut) {
                // Usuário deslogou pelo celular — limpa sessão para novo QR
                limparSessao();
                console.log('📵 WhatsApp deslogado. Sessão removida.');
            } else {
                console.log(`🔄 Conexão encerrada (código ${statusCode}). Reconectando em 5s...`);
                setTimeout(conectar, 5000);
            }
        }
    });
}

export function getStatus() {
    return { status: connectionStatus, qr: currentQR };
}

export async function iniciarConexao() {
    if (connectionStatus === 'connected') return;
    if (connectionStatus === 'connecting' && sock) return;
    await conectar();
}

export async function desconectar() {
    if (sock) {
        try { await sock.logout(); } catch {}
        sock = null;
    }
    limparSessao();
    connectionStatus = 'disconnected';
    currentQR = null;
    console.log('🔌 WhatsApp desconectado manualmente. Sessão removida.');
}

export async function enviarMensagensLote(prospects, mensagens) {
    if (connectionStatus !== 'connected' || !sock) {
        throw new Error('WhatsApp não está conectado');
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const resultados = [];

    for (let i = 0; i < prospects.length; i++) {
        const prospect = prospects[i];

        if (!prospect.phone) {
            resultados.push({ empresa: prospect.company_name, status: 'sem_telefone' });
            continue;
        }

        // Verifica conexão antes de cada envio
        if (connectionStatus !== 'connected' || !sock) {
            // Marca este e todos os restantes como desconectado
            for (let j = i; j < prospects.length; j++) {
                if (prospects[j].phone) {
                    resultados.push({ empresa: prospects[j].company_name, status: 'erro', erro: 'WhatsApp desconectado durante o envio' });
                }
            }
            break;
        }

        // Mensagem aleatória com variáveis substituídas
        const template = mensagens[Math.floor(Math.random() * mensagens.length)];
        const msg = template
            .replace(/\{empresa\}/gi, prospect.company_name ?? '')
            .replace(/\{cidade\}/gi, prospect.city ?? '');

        const phone = prospect.phone.replace(/\D/g, '');
        const jid = phone.startsWith('55') ? `${phone}@s.whatsapp.net` : `55${phone}@s.whatsapp.net`;

        try {
            // Verifica se o número tem WhatsApp antes de enviar
            const [result] = await sock.onWhatsApp(jid);
            if (!result?.exists) {
                resultados.push({ empresa: prospect.company_name, status: 'sem_whatsapp' });
                console.log(`⚠️ ${prospect.company_name} não tem WhatsApp`);
                continue;
            }
            await sock.sendMessage(jid, { text: msg });
            resultados.push({ empresa: prospect.company_name, status: 'enviado' });
            console.log(`✉️ Mensagem enviada para ${prospect.company_name}`);
        } catch (err) {
            resultados.push({ empresa: prospect.company_name, status: 'erro', erro: err.message });
        }

        // Pausa humanizada entre envios (15-35 segundos) — evita bloqueio do WhatsApp
        if (i < prospects.length - 1) {
            await delay(15000 + Math.random() * 20000);
        }
    }

    return resultados;
}
