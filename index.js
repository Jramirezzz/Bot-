require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

// ─────────────────────────────────────────────
// Configuración - variables de entorno
// ─────────────────────────────────────────────
const PORT             = process.env.PORT || 3000;
const ACCOUNT_SID      = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN       = process.env.TWILIO_AUTH_TOKEN;
// Número de Twilio WhatsApp Sandbox: 'whatsapp:+14155238886'
const FROM_NUMBER      = process.env.TWILIO_WHATSAPP_NUMBER;

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
  console.warn(
    '⚠️  Faltan variables de entorno de Twilio ' +
    '(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER). ' +
    'Los envíos usarán modo mock hasta que las configures.'
  );
}

const client = (ACCOUNT_SID && AUTH_TOKEN) ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

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

    // Número limpio (sin prefijo 'whatsapp:') para sendText
    const fromNumber = from.replace('whatsapp:', '');

    // Mensaje de bienvenida / entrada pedido por el usuario
    const WELCOME_MSG = '¡Hola! Gracias por comunicarte con la oficina de Reclamaciones Soat.¿Tuviste un accidente de tránsito? Estas en el lugar indicado.\n\nAquí te ayudamos a reclamar lo que te corresponde. Danos tu nombre y celular, nosotros nos contactaremos.';

    if (mediaUrl) {
      // Mensaje con adjunto (imagen, audio, etc.)
      await sendText(fromNumber, '📎 Recibí tu archivo. Por ahora sólo proceso texto.');
    } else if (!incoming || incoming.trim().length === 0) {
      // Si no hay texto, enviar la bienvenida
      await sendText(fromNumber, WELCOME_MSG);
    } else {
      // Si hay texto, por ahora respondemos con la bienvenida solo en primer mensaje
      // Para simplificar, si el usuario escribe "hola" o similares enviaremos la bienvenida
      const low = incoming.trim().toLowerCase();
      const greetings = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello'];
      if (greetings.includes(low)) {
        await sendText(fromNumber, WELCOME_MSG);
      } else {
        // Respuesta simple: eco del mensaje recibido (puedes cambiar la lógica aquí)
        await sendText(fromNumber, `Echo: ${incoming}`);
      }
    }

    // Twilio espera un 200 vacío (o TwiML), con 200 es suficiente
    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error en /webhook:', err);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => console.log(`Bot escuchando en puerto ${PORT}`));
