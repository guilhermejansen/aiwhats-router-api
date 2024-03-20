// app.test.js
const request = require('supertest');
const app = require('./app');

describe('Teste de Endpoint de Saúde', () => {
  it('GET /health - Deve retornar OK', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('OK');
  });
});
