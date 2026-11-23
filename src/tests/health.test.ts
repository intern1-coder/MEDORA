import request from 'supertest';
import { app } from '../app';
import { HTTP_STATUS } from '../constants/http';

describe('Health Check API (/api/v1/health & /health)', () => {
  it('GET /health - root health endpoint should return 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('message', 'Medora API Service Operational');
  });

  it('GET /api/v1/health - should return structured health envelope with 200 OK', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'ok');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('version', '0.1.0');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/health?checkDb=false - should not fail query validation', async () => {
    const res = await request(app).get('/api/v1/health?checkDb=false');
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBeUndefined();
  });

  it('GET /api/v1/health?checkDb=invalid - should return 400 Bad Request with validation errors', async () => {
    const res = await request(app).get('/api/v1/health?checkDb=invalid');
    expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
