import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Set process.env BEFORE dynamic import
process.env.CORS_ORIGIN = 'https://example.com';

const { handler } = await import('../../../handlers/scheduled/index.mjs');

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

describe('scheduled handler', () => {
    let consoleLogSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('should return undefined for warmup call (no pathParameters)', async () => {
        const event = makeEvent({ pathParameters: undefined });
        const result = await handler(event);
        expect(result).toBeUndefined();
    });

    it('should log warmup detection', async () => {
        const event = makeEvent({ pathParameters: undefined });
        await handler(event);
        expect(consoleLogSpy).toHaveBeenCalledWith('warmup call detected, ending');
    });

    it('should return 200 for normal call (with pathParameters)', async () => {
        const event = makeEvent({ pathParameters: { id: '123' } });
        const result = await handler(event);
        expect(result.statusCode).toBe(200);
    });

    it('should include success=true in response body', async () => {
        const event = makeEvent({ pathParameters: { id: '123' } });
        const result = await handler(event);
        const responseBody = body(result);
        expect(responseBody.success).toBe(true);
    });

    it('should include message in response body', async () => {
        const event = makeEvent({ pathParameters: { id: '123' } });
        const result = await handler(event);
        const responseBody = body(result);
        expect(responseBody.message).toBe('This is the response to an unscheduled HTTP request');
    });

    it('should set CORS headers from environment', async () => {
        const event = makeEvent({ pathParameters: { id: '123' } });
        const result = await handler(event);
        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });

    it('should set isBase64Encoded to false', async () => {
        const event = makeEvent({ pathParameters: { id: '123' } });
        const result = await handler(event);
        expect(result.isBase64Encoded).toBe(false);
    });

    it('should log warning message for non-scheduled call', async () => {
        const event = makeEvent({ pathParameters: { id: '123' } });
        await handler(event);
        expect(consoleWarnSpy).toHaveBeenCalledWith('This is the response to an unscheduled HTTP request');
    });
});
