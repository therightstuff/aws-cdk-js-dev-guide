import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import mock handles through module names (resolved by moduleNameMapper)
import { mockQuery, mockUpdate } from '@aws-sdk/lib-dynamodb';

// Set process.env BEFORE dynamic import
process.env.TABLE_NAME = 'test-table';
process.env.DDB_GSI_NAME = 'test-gsi';
process.env.CORS_ORIGIN = 'https://example.com';

const { handler } = await import('../../../handlers/dynamodb/update.mjs');

// Helper to parse response body
const body = (r) => JSON.parse(r.body);

// Helper to create test event
const makeEvent = (overrides = {}) => ({
    body: null,
    pathParameters: { objectId: 'test-object-id' },
    queryStringParameters: {},
    headers: {},
    ...overrides,
});

describe('dynamodb update handler', () => {
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockQuery.mockResolvedValue({
            Items: [{ dataOwner: 'test-owner', objectId: 'test-object-id', payload: { old: 'data' } }]
        });
        mockUpdate.mockResolvedValue({});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should return 400 on invalid JSON body', async () => {
        const event = makeEvent({ body: 'invalid json{' });
        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toContain('unable to parse request body');
    });

    it('should return 200 when item found and update succeeds', async () => {
        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(body(result).success).toBe(true);
    });

    it('should query GSI for objectId', async () => {
        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        await handler(event);

        expect(mockQuery).toHaveBeenCalledWith({
            TableName: 'test-table',
            IndexName: 'test-gsi',
            KeyConditionExpression: 'objectId = :obj_id',
            ExpressionAttributeValues: { ':obj_id': 'test-object-id' }
        });
    });

    it('should call update with correct parameters', async () => {
        const payload = { test: 'data', nested: { value: 123 } };
        const event = makeEvent({
            body: JSON.stringify(payload),
            pathParameters: { objectId: 'test-object-id' }
        });
        await handler(event);

        expect(mockUpdate).toHaveBeenCalledWith({
            TableName: 'test-table',
            Key: {
                dataOwner: 'test-owner',
                objectId: 'test-object-id'
            },
            UpdateExpression: 'set payload = :p, expiration = :x',
            ExpressionAttributeValues: {
                ':p': payload,
                ':x': expect.any(Number)
            }
        });
    });

    it('should set expiration time in the future', async () => {
        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        const nowInSeconds = Math.floor(Date.now() / 1000);

        await handler(event);

        const updateCall = mockUpdate.mock.calls[0][0];
        expect(updateCall.ExpressionAttributeValues[':x']).toBeGreaterThan(nowInSeconds);
    });

    it('should return 500 when item not found', async () => {
        mockQuery.mockResolvedValue({ Items: [] });

        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('object not found');
    });

    it('should return 500 when update throws', async () => {
        const error = new Error('DynamoDB update error');
        mockUpdate.mockRejectedValue(error);

        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('an unexpected error occurred');
    });

    it('should return 500 when initial query throws', async () => {
        const error = new Error('DynamoDB query error');
        mockQuery.mockRejectedValue(error);

        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('an unexpected error occurred');
    });

    it('should log errors when they occur', async () => {
        const error = new Error('DynamoDB error');
        mockQuery.mockRejectedValue(error);

        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        await handler(event);

        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should log when querying table index', async () => {
        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        await handler(event);

        expect(consoleLogSpy).toHaveBeenCalledWith('querying table index');
    });

    it('should set CORS headers', async () => {
        const event = makeEvent({
            body: JSON.stringify({ test: 'data' }),
            pathParameters: { objectId: 'test-object-id' }
        });
        const result = await handler(event);

        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });
});
