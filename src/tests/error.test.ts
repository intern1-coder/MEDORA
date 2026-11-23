import request from 'supertest';
import { app } from '../app';
import { HTTP_STATUS } from '../constants/http';

describe('Error and 404 Handling Middleware', () => {
  it('GET /api/v1/non-existent-route - should return structured 404 NOT_FOUND response', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error.message).toContain('Route GET /api/v1/non-existent-route not found');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should include security headers on all responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});
