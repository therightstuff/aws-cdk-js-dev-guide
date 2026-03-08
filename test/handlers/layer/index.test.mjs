import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Import mock handles directly from the mock module
import { mockV4, __reset as resetUuid } from 'uuid';

// Set process.env BEFORE dynamic import
process.env.CORS_ORIGIN = 'https://example.com';

const { handler } = await import('../../../handlers/layer/index.mjs');

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

describe('layer handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetUuid();
    });

    it('should return 200 status code', async () => {
        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(200);
    });

    it('should include generatedId from uuid', async () => {
        const result = await handler(makeEvent());
        const responseBody = body(result);
        expect(responseBody.generatedId).toBe('mock-uuid-1');
    });

    it('should call uuid once', async () => {
        await handler(makeEvent());
        expect(mockV4).toHaveBeenCalledTimes(1);
    });

    it('should set CORS headers from environment', async () => {
        const result = await handler(makeEvent());
        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });

    it('should set isBase64Encoded to false', async () => {
        const result = await handler(makeEvent());
        expect(result.isBase64Encoded).toBe(false);
    });

    it('should have JSON-stringified body', async () => {
        const result = await handler(makeEvent());
        expect(() => JSON.parse(result.body)).not.toThrow();
    });
});
