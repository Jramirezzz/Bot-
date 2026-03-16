require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// ─────────────────────────────────────────────
// Configuración - variables de entorno
// ─────────────────────────────────────────────
const PORT             = process.env.PORT || 3000;
const IS_TEST          = process.env.NODE_ENV === 'test';
const ACCOUNT_SID      = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN       = process.env.TWILIO_AUTH_TOKEN;
// Número de Twilio WhatsApp Sandbox: 'whatsapp:+14155238886'
const FROM_NUMBER      = process.env.TWILIO_WHATSAPP_NUMBER;
const SHEET_ID         = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB_NAME   = process.env.GOOGLE_SHEET_TAB || 'Mensajes';
const GOOGLE_EMAIL     = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

if (!IS_TEST && (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER)) {
  console.warn(
    '⚠️  Faltan variables de entorno de Twilio ' +
    '(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER). ' +
    'Los envíos usarán modo mock hasta que las configures.'
  );
}

if (!IS_TEST && (!SHEET_ID || !GOOGLE_EMAIL || !GOOGLE_PRIVATE_KEY)) {
  console.warn(
    '⚠️  Faltan variables de entorno de Google Sheets ' +
    '(GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY). ' +
    'Los mensajes se procesarán, pero no se guardarán en Sheets.'
  );
}

const twilioClientFactory = IS_TEST ? null : require('twilio');
const client = (!IS_TEST && ACCOUNT_SID && AUTH_TOKEN) ? twilioClientFactory(ACCOUNT_SID, AUTH_TOKEN) : null;
const hasSheetConfig = !IS_TEST && Boolean(SHEET_ID && GOOGLE_EMAIL && GOOGLE_PRIVATE_KEY);
let messagesSheet = null;

const SHEET_HEADERS = [
  'timestamp',
  'direction',
  'from',
  'to',
  'body',
  'mediaUrl',
  'twilioMessageSid',
  'rawPayload',
];

// ─────────────────────────────────────────────
// Helper: enviar mensaje de texto por WhatsApp
// ─────────────────────────────────────────────
async function sendText(to, body) {
  if (!client || !FROM_NUMBER) {
    console.log(`[MOCK SEND] to=${to} | body=${body}`);
    return;
  }
  await client.messages.create({
    from: FROM_NUMBER,         // 'whatsapp:+14155238886' (sandbox) o tu número aprobado
    to: `whatsapp:${to}`,      // Twilio necesita el prefijo whatsapp:
    body,
  });
}

function getPrivateKey() {
  return GOOGLE_PRIVATE_KEY ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;
}

async function initializeSheet() {
  if (messagesSheet || !hasSheetConfig) return messagesSheet;

  const privateKey = getPrivateKey();
  const auth = new JWT({
    email: GOOGLE_EMAIL,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();

  messagesSheet = doc.sheetsByTitle[SHEET_TAB_NAME];

  if (!messagesSheet) {
    messagesSheet = await doc.addSheet({
      title: SHEET_TAB_NAME,
      headerValues: SHEET_HEADERS,
    });
  } else {
    // Si la pestaña ya existe pero no tiene encabezados, los definimos.
    let hasHeaders = false;
    try {
      await messagesSheet.loadHeaderRow();
      hasHeaders = Array.isArray(messagesSheet.headerValues) && messagesSheet.headerValues.length > 0;
    } catch (error) {
      hasHeaders = false;
    }

    if (!hasHeaders) {
      await messagesSheet.setHeaderRow(SHEET_HEADERS);
    }
  }

  return messagesSheet;
}

async function saveInboundMessage(payload) {
  if (!hasSheetConfig) return;

  const sheet = await initializeSheet();
  if (!sheet) return;

  await sheet.addRow({
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    from: payload.From || '',
    to: payload.To || '',
    body: payload.Body || '',
    mediaUrl: payload.MediaUrl0 || '',
    twilioMessageSid: payload.MessageSid || payload.SmsMessageSid || '',
    rawPayload: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────
// App Express
// ─────────────────────────────────────────────
const app = express();
// Twilio envía el payload como application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// GET  /webhook  - health check (también útil para verificar que el servidor está up)
app.get('/webhook', (req, res) => {
  res.send('CaliAndo Bot - Webhook Twilio activo ✅');
});

app.get('/', (req, res) => {
  res.send('CaliAndo Bot activo ✅ Usa /webhook para Twilio.');
});

// POST /send - enviar un mensaje manualmente
app.post('/send', async (req, res) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({
        ok: false,
        error: 'Debes enviar { to, body } en formato JSON.',
      });
    }

    await sendText(to, body);
    return res.status(200).json({ ok: true, message: 'Mensaje enviado.' });
  } catch (error) {
    console.error('❌ Error en /send:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo enviar el mensaje.' });
  }
});

// POST /webhook  - Twilio envía aquí los mensajes entrantes
app.post('/webhook', async (req, res) => {
  try {
    // Twilio envía el número con prefijo: 'whatsapp:+573001234567'
    const from    = req.body.From;   // ej. 'whatsapp:+573001234567'
    const to      = req.body.To;     // tu número de Twilio
    const incoming = req.body.Body;  // texto del mensaje
    const mediaUrl = req.body.MediaUrl0; // adjunto (si lo hay)

    console.log('📩 Mensaje recibido:', { from, to, incoming, mediaUrl });

    if (!incoming && !mediaUrl) {
      // Sin contenido, responder OK para que Twilio no reintente
      return res.sendStatus(200);
    }

    try {
      await saveInboundMessage(req.body);
    } catch (sheetError) {
      // No rompemos el webhook por un fallo de persistencia
      console.error('⚠️ No se pudo guardar en Google Sheets:', sheetError.message);
    }

    // Número limpio (sin prefijo 'whatsapp:') para sendText
    const fromNumber = from.replace('whatsapp:', '');

    if (mediaUrl) {
      // Mensaje con adjunto (imagen, audio, etc.)
      await sendText(fromNumber, '📎 Recibí tu archivo. Por ahora sólo proceso texto.');
    } else {
      // Respuesta simple: eco del mensaje recibido
      // 👉 Aquí irá tu lógica de negocio más adelante
      await sendText(fromNumber, `Echo: ${incoming}`);
    }

    // Twilio espera un 200 vacío (o TwiML), con 200 es suficiente
    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en /webhook:', err);
    return res.sendStatus(500);
  }
});

function startServer() {
  return app.listen(PORT, async () => {
    console.log(`🚀 CaliAndo Bot escuchando en puerto ${PORT}`);

    if (hasSheetConfig) {
      try {
        await initializeSheet();
        console.log(`📄 Google Sheet conectada: pestaña "${SHEET_TAB_NAME}" lista.`);
      } catch (error) {
        console.error('⚠️ No se pudo inicializar Google Sheets al arrancar:', error.message);
      }
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
