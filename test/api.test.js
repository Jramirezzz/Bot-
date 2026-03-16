const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const { app } = require('../index');

test('GET / responde health del bot', async () => {
  const response = await request(app).get('/');

  assert.equal(response.status, 200);
  assert.match(response.text, /CaliAndo Bot activo/i);
});

test('GET /webhook responde health de Twilio webhook', async () => {
  const response = await request(app).get('/webhook');

  assert.equal(response.status, 200);
  assert.match(response.text, /Webhook Twilio activo/i);
});

test('POST /send valida body requerido', async () => {
  const response = await request(app)
    .post('/send')
    .send({ to: '+573001234567' })
    .set('Content-Type', 'application/json');

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
});

test('POST /send responde ok con payload valido en modo mock', async () => {
  const response = await request(app)
    .post('/send')
    .send({ to: '+573001234567', body: 'Hola test' })
    .set('Content-Type', 'application/json');

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

test('POST /webhook procesa mensaje entrante y responde 200', async () => {
  const response = await request(app)
    .post('/webhook')
    .type('form')
    .send({
      From: 'whatsapp:+573001234567',
      To: 'whatsapp:+14155238886',
      Body: 'Mensaje de prueba',
    });

  assert.equal(response.status, 200);
});
