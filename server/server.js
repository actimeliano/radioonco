import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const STATIC_ROOT = path.resolve('/workspace/cf-radio-oncologia-b2b');
const DATA_DIR = path.join(__dirname, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.jsonl');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
});
app.use('/api/', limiter);

app.use(express.static(STATIC_ROOT));
app.get('/', (req, res) => {
  res.redirect('/website/');
});

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  subject: z.string().min(2).max(160),
  message: z.string().min(10).max(5000),
  organization: z.string().optional().nullable(),
});

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendContactEmail(payload) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'no_transporter' };
  const to = process.env.CONTACT_TO || process.env.SMTP_USER;
  const from = process.env.CONTACT_FROM || process.env.SMTP_USER;
  if (!to) return { sent: false, reason: 'no_recipient' };
  const subject = `[Contato] ${payload.subject}`;
  const text = `Nome: ${payload.name}\nEmail: ${payload.email}\nAssunto: ${payload.subject}\n\nMensagem:\n${payload.message}`;
  await transporter.sendMail({ from, to, subject, text });
  return { sent: true };
}

function persistMessage(payload, meta) {
  const record = { type: 'contact', receivedAt: new Date().toISOString(), ip: meta.ip, userAgent: meta.ua, payload };
  fs.appendFileSync(MESSAGES_FILE, JSON.stringify(record) + '\n', { encoding: 'utf8' });
}

app.post('/api/contact', async (req, res) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_input', details: parsed.error.flatten() });
    }
    const data = parsed.data;
    if (data.organization && data.organization.trim() !== '') {
      return res.status(204).send();
    }

    persistMessage({ name: data.name, email: data.email, subject: data.subject, message: data.message }, {
      ip: req.ip,
      ua: req.headers['user-agent'] || '',
    });

    let emailed = { sent: false };
    try {
      emailed = await sendContactEmail(data);
    } catch (e) {
      // fall through; stored on disk already
    }

    return res.status(200).json({ ok: true, emailed: emailed.sent });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});

