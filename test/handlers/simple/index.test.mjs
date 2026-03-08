import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Set process.env BEFORE dynamic import
process.env.CORS_ORIGIN = 'https://example.com';

// Mock Math.random to control randomness
const originalRandom = Math.random;

const { handler } = await import('../../../handlers/simple/index.mjs');

// Helper to parse response body
const body = (r) => JSON.parse(r.body);

// Helper to create test event
const makeEvent = (overrides = {}) => ({
    body: null,
    pathParameters: {},
    queryStringParameters: {},
    headers: {},
    ...overrides,
});

describe('simple handler', () => {
    beforeEach(() => {
        Math.random = originalRandom;
    });

    it('should return 200 when random determines success', async () => {
        // Force success (random returns 0.9, Math.floor(0.9 * 2) = 1)
        Math.random = jest.fn(() => 0.9);

        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(200);
    });

    it('should return 500 when random determines failure', async () => {
        // Force failure (random returns 0.1, Math.floor(0.1 * 2) = 0)
        Math.random = jest.fn(() => 0.1);

        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(500);
    });

    it('should include success flag matching statusCode (200)', async () => {
        Math.random = jest.fn(() => 0.9);

        const result = await handler(makeEvent());
        const responseBody = body(result);
        expect(responseBody.success).toBe(true);
    });

    it('should include success flag matching statusCode (500)', async () => {
        Math.random = jest.fn(() => 0.1);

        const result = await handler(makeEvent());
        const responseBody = body(result);
        expect(responseBody.success).toBe(false);
    });

    it('should include notice about random determination', async () => {
        Math.random = jest.fn(() => 0.9);

        const result = await handler(makeEvent());
        const responseBody = body(result);
        expect(responseBody.notice).toContain('randomly determined');
    });

    it('should include querystring parameters from event', async () => {
        Math.random = jest.fn(() => 0.9);
        const event = makeEvent({ queryStringParameters: { foo: 'bar', baz: '123' } });

        const result = await handler(event);
        const responseBody = body(result);
        expect(responseBody.querystring).toEqual({ foo: 'bar', baz: '123' });
    });

    it('should set CORS headers from environment', async () => {
        Math.random = jest.fn(() => 0.9);

        const result = await handler(makeEvent());
        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });

    it('should set isBase64Encoded to false', async () => {
        Math.random = jest.fn(() => 0.9);

        const result = await handler(makeEvent());
        expect(result.isBase64Encoded).toBe(false);
    });
});
