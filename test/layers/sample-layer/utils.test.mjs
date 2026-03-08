import { describe, it, expect } from '@jest/globals';

// Pure function, no mocks needed, loaded as real source via moduleNameMapper
const { createResponse } = await import('/opt/nodejs/sample-layer/utils.mjs');

describe('createResponse', () => {
    it('should use default statusCode of 200', () => {
        const result = createResponse({ body: { test: 'data' } });
        expect(result.statusCode).toBe(200);
    });

    it('should use provided statusCode', () => {
        const result = createResponse({ statusCode: 201, body: { test: 'data' } });
        expect(result.statusCode).toBe(201);
    });

    it('should JSON-stringify the body', () => {
        const bodyData = { test: 'data', nested: { key: 'value' } };
        const result = createResponse({ body: bodyData });
        expect(JSON.parse(result.body)).toEqual(bodyData);
    });

    it('should default to empty object when body is not provided', () => {
        const result = createResponse({});
        expect(result.body).toBe('{}');
    });

    it('should default isBase64Encoded to false', () => {
        const result = createResponse({ body: { test: 'data' } });
        expect(result.isBase64Encoded).toBe(false);
    });

    it('should pass through isBase64Encoded when true', () => {
        const result = createResponse({ body: { test: 'data' }, isBase64Encoded: true });
        expect(result.isBase64Encoded).toBe(true);
    });

    it('should default headers to empty object', () => {
        const result = createResponse({ body: { test: 'data' } });
        expect(result.headers).toEqual({});
    });

    it('should use provided headers', () => {
        const headers = { 'Content-Type': 'application/json', 'X-Custom': 'value' };
        const result = createResponse({ body: { test: 'data' }, headers });
        expect(result.headers).toEqual(headers);
    });
});
