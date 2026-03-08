import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import mock handles through module names (resolved by moduleNameMapper)
import { mockPut } from '@aws-sdk/lib-dynamodb';
import { mockV4, __reset as resetUuid } from 'uuid';

// Set process.env BEFORE dynamic import
process.env.TABLE_NAME = 'test-table';
process.env.CORS_ORIGIN = 'https://example.com';

const { handler } = await import('../../../handlers/dynamodb/create.mjs');

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

describe('dynamodb create handler', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        resetUuid();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPut.mockResolvedValue({});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should return 400 on invalid JSON body', async () => {
        const event = makeEvent({ body: 'invalid json{' });
        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toContain('unable to parse request body');
    });

    it('should return 200 on success', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(body(result).success).toBe(true);
    });

    it('should include dataOwner and objectId in response', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await handler(event);

        const responseBody = body(result);
        expect(responseBody.dataOwner).toBe('mock-uuid-1');
        expect(responseBody.objectId).toBe('mock-uuid-2');
    });

    it('should generate distinct uuids for dataOwner and objectId', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await handler(event);

        const responseBody = body(result);
        expect(responseBody.dataOwner).not.toBe(responseBody.objectId);
    });

    it('should call uuid twice', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        await handler(event);

        expect(mockV4).toHaveBeenCalledTimes(2);
    });

    it('should call dynamodb.put with correct parameters', async () => {
        const payload = { test: 'data', nested: { value: 123 } };
        const event = makeEvent({ body: JSON.stringify(payload) });
        await handler(event);

        expect(mockPut).toHaveBeenCalledWith({
            TableName: 'test-table',
            Item: {
                dataOwner: 'mock-uuid-1',
                objectId: 'mock-uuid-2',
                payload: payload,
                expiration: expect.any(Number)
            }
        });
    });

    it('should set expiration time in the future', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const nowInSeconds = Math.floor(Date.now() / 1000);

        await handler(event);

        const putCall = mockPut.mock.calls[0][0];
        expect(putCall.Item.expiration).toBeGreaterThan(nowInSeconds);
    });

    it('should return 500 when DynamoDB put throws', async () => {
        const error = new Error('DynamoDB error');
        mockPut.mockRejectedValue(error);

        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('an unexpected error occurred');
    });

    it('should log error when DynamoDB throws', async () => {
        const error = new Error('DynamoDB error');
        mockPut.mockRejectedValue(error);

        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        await handler(event);

        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should set CORS headers', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await handler(event);

        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });
});
