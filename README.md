## Bot WhatsApp con Twilio + Google Sheets

Este proyecto recibe y envía mensajes de WhatsApp por Twilio.
Cada mensaje entrante se guarda en una hoja de Google Sheets.

## Requisitos

1. Cuenta de Twilio con WhatsApp Sandbox (o número de WhatsApp aprobado).
2. Proyecto de Google Cloud con Service Account.
3. Google Sheet compartida con el correo del Service Account como Editor.
4. Node.js LTS (recomendado Node 22; evita Node 25 para este proyecto).

## Variables de entorno

Crea un archivo `.env` con este contenido:

```env
PORT=3000

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
GOOGLE_SHEET_TAB=Mensajes
GOOGLE_SERVICE_ACCOUNT_EMAIL=mi-service-account@mi-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

Notas:
- `TWILIO_WHATSAPP_NUMBER` debe incluir el prefijo `whatsapp:`.
- `GOOGLE_PRIVATE_KEY` debe ir en una sola línea con `\\n`.
- Si falta configuración de Twilio, los envíos se hacen en modo mock.
- Si falta configuración de Sheets, el bot responde pero no guarda mensajes.

## Instalación

```bash
npm install
```

## Ejecutar

```bash
npm start
```

## Endpoints

### 1) Health

`GET /` o `GET /webhook`

### 2) Webhook de Twilio (entrantes)

`POST /webhook`

Twilio enviará los mensajes entrantes a este endpoint.

### 3) Envío manual

`POST /send`

Body JSON:

```json
{
	"to": "+573001234567",
	"body": "Hola desde mi bot"
}
```

El backend envía el mensaje usando Twilio.

## Configurar Twilio Sandbox

1. En Twilio Console entra a WhatsApp Sandbox.
2. Copia el número sandbox y el código de unión.
3. En tu WhatsApp, envía el código al número sandbox para vincular tu celular.
4. Configura el webhook "When a message comes in" apuntando a:

`https://TU_DOMINIO/webhook`

Si estás en local, usa un túnel (por ejemplo ngrok):

```bash
ngrok http 3000
```

Y pega la URL pública de ngrok + `/webhook` en Twilio.

## Estructura de columnas en Google Sheets

La pestaña definida en `GOOGLE_SHEET_TAB` tendrá estas columnas:

- `timestamp`
- `direction`
- `from`
- `to`
- `body`
- `mediaUrl`
- `twilioMessageSid`
- `rawPayload`

## Despliegue

Puedes desplegar en Railway usando las mismas variables de entorno.
No olvides actualizar en Twilio el webhook con el dominio final del deploy.

