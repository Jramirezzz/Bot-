require('dotenv').config();
const express = require('express');
const axios = require('axios');

// Versión simplificada: solo recibir mensajes y enviar respuestas.
// Elimina lógica de IA, bases de datos y manejo de sesiones.

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WHATSAPP_TKN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'verify_token_example';

if (!WHATSAPP_TKN || !PHONE_ID) {
  console.warn('Advertencia: WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no están definidos. Envíos a la API de WhatsApp fallarán si se intenta usar en producción.');
}

function sendText(to, text) {
  // Envía un mensaje por la API de WhatsApp (Graph API). Si no está configurada, hace un log y resuelve.
  if (!WHATSAPP_TKN || !PHONE_ID) {
    console.log(`[MOCK SEND] to=${to} text=${text}`);
    return Promise.resolve({ data: { mock: true } });
  }

  return axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    { messaging_product: 'whatsapp', to, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TKN}` } }
  );
}

// Endpoint para verificación de webhook (GET) y recepción de mensajes (POST)
app.get('/webhook', (req, res) => {
  // Soporta el challenge de verificación de Facebook/WhatsApp
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.send('CaliAndo - Webhook activo');
});

app.post('/webhook', async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const type = msg.type;

    console.log('Mensaje recibido:', { from, type, raw: msg });

    // Solo manejamos mensajes de texto en esta plantilla
    if (type === 'text' && msg.text && msg.text.body) {
      const incoming = msg.text.body;
      // Respuesta simple: eco
      const reply = `Echo: ${incoming}`;
      await sendText(from, reply);
    } else {
      // Mensaje no-texto: respuesta genérica
      await sendText(from, 'Recibí tu mensaje. En esta versión sólo manejo texto.');
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Error en /webhook:', err);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => console.log(`Servidor simplificado escuchando en puerto ${PORT}`));
