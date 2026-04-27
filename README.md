## Bot WhatsApp con Twilio + Google Sheets

Este proyecto es un bot de WhatsApp para la oficina de reclamaciones **Reclamaciones SOAT**. Recibe mensajes de clientes, extrae su nombre y teléfono, y guarda la información en Google Sheets.

### Características
- ✅ Recibe mensajes de WhatsApp vía Twilio
- ✅ Envía mensaje de bienvenida automático
- ✅ Extrae nombre y teléfono de un único mensaje ("Juan Perez 573001234567")
- ✅ Valida números telefónicos colombianos
- ✅ Guarda contactos en Google Sheets
- ✅ Manejo de errores y logging estructurado

### Estado del Proyecto
**✅ FUNCIONANDO**: Twilio webhook y lógica de bot operacional  
**🔧 EN CONFIGURACIÓN**: Google Sheets requiere credenciales de Service Account  

## Requisitos

1. **Twilio** - Cuenta con WhatsApp Sandbox o número aprobado
2. **Google Cloud** - Proyecto con Google Sheets API y Service Account
3. **Node.js** - LTS 18+ (probado con Node 24)
4. **Git** - Para despliegue automático

## Configuración Rápida

### 1. Clonar y instalar
```bash
git clone https://github.com/Jramirezzz/Bot-.git
cd Bot-
npm install
```

### 2. Crear `.env`
```env
PORT=3000

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Google Sheets
GOOGLE_SHEET_ID=16MZYRLJ6XWncv34KV2C03vH3V32nO43ad68CezIohz0
GOOGLE_SERVICE_ACCOUNT_EMAIL=mi-sa@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Configurar Google Sheets
Ver **[GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md)** para instrucciones detalladas.

### 4. Ejecutar
```bash
npm start
# Bot ejecutándose en http://localhost:3000
```

## Despliegue

El proyecto está configurado para **auto-deploy en Render**:
1. Push a `origin/master`
2. Render auto-compila y deploya
3. Webhook disponible en: `https://bot-8qmd.onrender.com/webhook`

Para actualizar credenciales en Render:
1. Dashboard → tu servicio → Environment
2. Agregar/actualizar `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`
3. Servicio se reinicia automáticamente

## Flujo de Conversación

```
Cliente envía:  "Juan Esteban 3177043737"
                        ↓
Bot recibe & parsea
                        ↓
Extrae: name="Juan Esteban", phone="3177043737"
                        ↓
Valida formato telefónico (4-15 dígitos)
                        ↓
Guarda en Google Sheets → fila con timestamp, nombre, teléfono
                        ↓
Bot responde: "Gracias Juan Esteban, hemos recibido tu solicitud..."
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/webhook` | Webhook de Twilio (mensajes entrantes) |
| `POST` | `/send` | Enviar mensaje manual |

### Ejemplo: Envío Manual
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "whatsapp:+573001234567",
    "body": "Hola, esto es un mensaje de prueba"
  }'
```

## Estructura de Datos en Google Sheets

La hoja `Messages` contiene:

| Columna | Tipo | Ejemplo |
|---------|------|---------|
| `timestamp` | ISO datetime | `2024-01-15T10:30:45.123Z` |
| `name` | Text | `Juan Esteban Ramirez` |
| `phone` | Text | `3177043737` |
| `whatsappFrom` | WhatsApp ID | `whatsapp:+573177043737` |
| `rawPayload` | JSON | `{"From":"...","Body":"..."}` |

## Troubleshooting

### Bot no responde
- Verificar webhook en Twilio Dashboard
- Verificar logs en Render: Dashboard → Logs
- Probar: `curl https://bot-8qmd.onrender.com/webhook`

### Google Sheets no actualiza
- Confirmar credenciales en Render Environment
- Ejecutar: `node test-sheets-auth.js`
- Ver [FIX_SUMMARY.md](./FIX_SUMMARY.md) para diagnóstico

### Mensajes no llegan
- Verificar TWILIO_WHATSAPP_NUMBER incluye prefijo `whatsapp:`
- Confirmar está vinculado el celular al Sandbox
- Revisar número en formato: `whatsapp:+{codigopais}{numero}`

## Documentación Adicional

- **[GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md)** - Obtener credenciales de Google Cloud
- **[FIX_SUMMARY.md](./FIX_SUMMARY.md)** - Resumen de la solución de autenticación
- **[VERIFICATION_CHECKLIST.md](./VERIFICATION_CHECKLIST.md)** - Lista de verificación pre-producción

## Logs Útiles

Ejemplo de logs esperados en Render:

```
GET / 200 2ms
POST /webhook 200 145ms
initializeSheet: starting for SHEET_ID=16MZYRLJ6XWncv34KV2C03vH3V32nO43ad68CezIohz0
initializeSheet: access token obtained
initializeSheet: loaded doc title=Reclamaciones Bot
initializeSheet: sheet ready, title=Messages
saveContactMessage: row added to sheet, id?=2
```

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Ejecutar con logs
npm start

# Probar webhook localmente (usa ngrok)
ngrok http 3000
# Luego agregar https://xxxxx.ngrok.io/webhook en Twilio

# Test de autenticación Google Sheets
node test-sheets-auth.js
```

## Stack Técnico

- **Node.js** 24.15.0
- **Express.js** 5.1.0  
- **Twilio SDK** 5.12.2
- **google-spreadsheet** 4.1.4
- **google-auth-library** 9.15.1

## Licencia

ISC

