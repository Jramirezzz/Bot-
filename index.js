require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');

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
const onboardingState = new Map();

const SHEET_HEADERS = [
  'name',
  'phone',
  'whatsappFrom',
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
  const doc = new GoogleSpreadsheet(SHEET_ID);

  // Autenticar con la cuenta de servicio usando client_email y private_key
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_EMAIL,
    private_key: privateKey,
  });

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
    } else {
      const currentHeaders = Array.isArray(messagesSheet.headerValues) ? messagesSheet.headerValues : [];
      const missingHeaders = SHEET_HEADERS.filter((header) => !currentHeaders.includes(header));

      if (missingHeaders.length > 0) {
        await messagesSheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
      }
    }
  }

  return messagesSheet;
}

async function saveContactMessage(payload, name, phone) {
  if (!hasSheetConfig) return;

  const sheet = await initializeSheet();
  if (!sheet) return;

  await sheet.addRow({
    name,
    phone,
    whatsappFrom: payload.From || '',
    rawPayload: JSON.stringify(payload),
  });
}

function sanitizeName(input) {
  return (input || '').trim().replace(/\s+/g, ' ');
}

function sanitizePhone(input) {
  return (input || '').trim();
}

function isValidPhone(input) {
  const cleaned = (input || '').replace(/[^\d+]/g, '');
  const digitsOnly = cleaned.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

// Intentar extraer teléfono y nombre desde una sola línea.
// Ejemplos válidos: "Juan Perez 573001234567" o "Juan Perez +57 3001234567" o "3001234567 Juan"
function extractPhoneAndName(text) {
  if (!text) return { name: null, phone: null };
  const cleaned = text.replace(/[,;|]/g, ' ');
  // Buscar secuencia de dígitos con posible + al inicio y espacios
  const phoneMatch = cleaned.match(/(\+?\d[\d \-]{6,}\d)/);
  if (!phoneMatch) return { name: null, phone: null };
  const phoneRaw = phoneMatch[0];
  const namePart = (cleaned.replace(phoneRaw, '') || '').trim();
  const phone = phoneRaw.replace(/[^\d+]/g, '');
  const name = namePart ? sanitizeName(namePart) : null;
  return { name, phone };
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
      return res.status(200).end();
    }

    // Validar y limpiar 'From'
    if (!from) {
      console.warn('Mensaje entrante sin campo From, ignorando.');
      return res.status(200).end();
    }

    // Número limpio (sin prefijo 'whatsapp:') para sendText
    const fromNumber = String(from).replace(/^whatsapp:/i, '');

    const state = onboardingState.get(fromNumber);

    // Mensaje de bienvenida / entrada pedido por el usuario
    const WELCOME_MSG = '¡Hola! Gracias por comunicarte con la oficina de Reclamaciones Soat.¿Tuviste un accidente de tránsito? Estas en el lugar indicado.\n\nAquí te ayudamos a reclamar lo que te corresponde. Danos tu nombre y celular, nosotros nos contactaremos.';

    if (mediaUrl) {
      // Mensaje con adjunto (imagen, audio, etc.)
      await sendText(fromNumber, '📎 Recibí tu archivo. Por ahora sólo proceso texto.');
      return res.status(200).end();
    }

    if (!state) {
      // Intentar parsear nombre+tel en una sola línea
      const parsed = extractPhoneAndName(incoming);
      if (parsed.name && parsed.phone && isValidPhone(parsed.phone)) {
        try {
          await saveContactMessage(req.body, parsed.name, parsed.phone);
        } catch (sheetError) {
          console.error('⚠️ No se pudo guardar en Google Sheets:', sheetError.message);
        }
        await sendText(fromNumber, `Gracias ${parsed.name}, recibí tu número ${parsed.phone}. Te contactaremos pronto.`);
        return res.status(200).end();
      }

      onboardingState.set(fromNumber, { step: 'awaiting_name' });
      await sendText(fromNumber, WELCOME_MSG);
      return res.status(200).end();
    }

    if (state && state.step === 'awaiting_name') {
      // El usuario puede enviar nombre + teléfono en una sola línea
      const parsed = extractPhoneAndName(incoming);
      if (parsed.name && parsed.phone && isValidPhone(parsed.phone)) {
        try {
          await saveContactMessage(req.body, parsed.name, parsed.phone);
        } catch (sheetError) {
          console.error('⚠️ No se pudo guardar en Google Sheets:', sheetError.message);
        }
        onboardingState.delete(fromNumber);
        await sendText(fromNumber, `Gracias ${parsed.name}, recibí tu número ${parsed.phone}. Te contactaremos pronto.`);
        return res.status(200).end();
      }

      const name = sanitizeName(incoming);
      if (!name) {
        await sendText(fromNumber, 'No alcancé a leer tu nombre. Escríbelo de nuevo, por favor.');
        return res.status(200).end();
      }

      onboardingState.set(fromNumber, {
        step: 'awaiting_phone',
        name,
      });

      await sendText(fromNumber, `Gracias, ${name}. Ahora envíame tu número de celular (con indicativo de país si aplica).`);
      return res.status(200).end();
    }

    if (state && state.step === 'awaiting_phone') {
      const phone = sanitizePhone(incoming);

      if (!isValidPhone(phone)) {
        await sendText(fromNumber, 'Ese número no parece válido. Intenta de nuevo con solo números y, si quieres, con + al inicio.');
        return res.status(200).end();
      }

      try {
        await saveContactMessage(req.body, state.name, phone);
      } catch (sheetError) {
        // No rompemos el webhook por un fallo de persistencia
        console.error('⚠️ No se pudo guardar en Google Sheets:', sheetError.message);
      }

      onboardingState.delete(fromNumber);
      await sendText(fromNumber, 'Muchas gracias, te contactaremos lo antes posibles.');
      return res.status(200).end();
    }

    onboardingState.delete(fromNumber);
    await sendText(fromNumber, 'Reiniciemos el proceso. Compárteme tu nombre completo, por favor.');

    // Twilio espera un 200 vacío (o TwiML), con 200 es suficiente
    return res.status(200).end();
  } catch (err) {
    console.error('❌ Error en /webhook:', err);
    return res.status(500).end();
  }
});

app.listen(PORT, () => console.log(`🚀 CaliAndo Bot escuchando en puerto ${PORT}`));
