import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import mock handles through module name (resolved by moduleNameMapper)
import { mockScan } from '@aws-sdk/lib-dynamodb';

// Set process.env BEFORE dynamic import
process.env.TABLE_NAME = 'test-table';
process.env.CORS_ORIGIN = 'https://example.com';

const { handler } = await import('../../../handlers/dynamodb/scan.mjs');

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

describe('dynamodb scan handler', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Set safe default
        mockScan.mockResolvedValue({ Items: [] });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should return 200 with Items array', async () => {
        const items = [
            { dataOwner: 'owner1', objectId: 'obj1', payload: { test: 'data1' } },
            { dataOwner: 'owner2', objectId: 'obj2', payload: { test: 'data2' } }
        ];
        mockScan.mockResolvedValue({ Items: items });

        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(200);
        expect(body(result)).toEqual(items);
    });

    it('should return empty array when no items', async () => {
        mockScan.mockResolvedValue({ Items: [] });

        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(200);
        expect(body(result)).toEqual([]);
    });

    it('should call scan with correct TableName', async () => {
        await handler(makeEvent());
        expect(mockScan).toHaveBeenCalledWith({
            TableName: 'test-table'
        });
    });

    it('should return 500 when DynamoDB throws', async () => {
        const error = new Error('DynamoDB error');
        mockScan.mockRejectedValue(error);

        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('an unexpected error occurred');
    });

    it('should log error when DynamoDB throws', async () => {
        const error = new Error('DynamoDB error');
        mockScan.mockRejectedValue(error);

        await handler(makeEvent());
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should set CORS headers', async () => {
        const result = await handler(makeEvent());
        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });
});
