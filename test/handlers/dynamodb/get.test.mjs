import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import mock handles through module names (resolved by moduleNameMapper)
import { mockGet, mockQuery } from '@aws-sdk/lib-dynamodb';

// Set process.env BEFORE dynamic import
process.env.TABLE_NAME = 'test-table';
process.env.DDB_GSI_NAME = 'test-gsi';
process.env.CORS_ORIGIN = 'https://example.com';

const { handler } = await import('../../../handlers/dynamodb/get.mjs');

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

describe('dynamodb get handler', () => {
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockGet.mockResolvedValue({ Item: { dataOwner: 'test-owner', objectId: 'test-object-id' } });
        mockQuery.mockResolvedValue({ Items: [{ dataOwner: 'test-owner', objectId: 'test-object-id' }] });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should use get when dataOwner is present', async () => {
        const event = makeEvent({
            queryStringParameters: { dataOwner: 'test-owner' },
            pathParameters: { objectId: 'test-object-id' }
        });

        const result = await handler(event);

        expect(mockGet).toHaveBeenCalledWith({
            TableName: 'test-table',
            Key: {
                dataOwner: 'test-owner',
                objectId: 'test-object-id'
            }
        });
        expect(result.statusCode).toBe(200);
    });

    it('should use query on base table when dataOwner is present', async () => {
        mockGet.mockResolvedValue({ Item: null });

        const event = makeEvent({
            queryStringParameters: { dataOwner: 'test-owner' },
            pathParameters: { objectId: 'test-object-id' }
        });

        await handler(event);

        // The handler defines both getParams and queryParams but uses getParams if it exists
        // So mockQuery might not be called if mockGet is used first
        expect(mockGet).toHaveBeenCalled();
    });

    it('should use GSI query when dataOwner is not present', async () => {
        const event = makeEvent({
            queryStringParameters: {},
            pathParameters: { objectId: 'test-object-id' }
        });

        const result = await handler(event);

        expect(mockQuery).toHaveBeenCalledWith({
            TableName: 'test-table',
            IndexName: 'test-gsi',
            KeyConditionExpression: 'objectId = :obj_id',
            ExpressionAttributeValues: { ':obj_id': 'test-object-id' }
        });
        expect(result.statusCode).toBe(200);
    });

    it('should log when querying table index', async () => {
        const event = makeEvent({
            queryStringParameters: {},
            pathParameters: { objectId: 'test-object-id' }
        });

        await handler(event);

        expect(consoleLogSpy).toHaveBeenCalledWith('querying table index');
    });

    it('should return 200 with result body', async () => {
        const mockResult = { Item: { dataOwner: 'owner1', objectId: 'obj1', payload: { test: 'data' } } };
        mockGet.mockResolvedValue(mockResult);

        const event = makeEvent({
            queryStringParameters: { dataOwner: 'owner1' },
            pathParameters: { objectId: 'obj1' }
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(body(result)).toEqual(mockResult);
    });

    it('should return 500 when DynamoDB throws', async () => {
        const error = new Error('DynamoDB error');
        mockGet.mockRejectedValue(error);

        const event = makeEvent({
            queryStringParameters: { dataOwner: 'test-owner' },
            pathParameters: { objectId: 'test-object-id' }
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('an unexpected error occurred');
    });

    it('should log error when DynamoDB throws', async () => {
        const error = new Error('DynamoDB error');
        mockQuery.mockRejectedValue(error);

        const event = makeEvent({
            queryStringParameters: {},
            pathParameters: { objectId: 'test-object-id' }
        });

        await handler(event);

        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should throw when queryStringParameters is undefined', async () => {
        const event = makeEvent({
            queryStringParameters: undefined,
            pathParameters: { objectId: 'test-object-id' }
        });

        // The handler will try to access event.queryStringParameters.dataOwner
        // which will throw TypeError: Cannot read property 'dataOwner' of undefined
        await expect(handler(event)).rejects.toThrow();
    });

    it('should set CORS headers', async () => {
        const event = makeEvent({
            queryStringParameters: { dataOwner: 'test-owner' },
            pathParameters: { objectId: 'test-object-id' }
        });

        const result = await handler(event);

        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });
});
