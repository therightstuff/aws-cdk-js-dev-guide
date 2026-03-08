import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import mock handles through module names (resolved by moduleNameMapper)
import { mockSend, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockPut } from '@aws-sdk/lib-dynamodb';
import { __reset as resetUuid } from 'uuid';

// Set process.env BEFORE dynamic import
process.env.QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue';
process.env.TABLE_NAME = 'test-table';
process.env.CORS_ORIGIN = 'https://example.com';

const { publish, subscribe } = await import('../../../handlers/sqs/index.mjs');

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

describe('sqs publish handler', () => {
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        resetUuid();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should return 400 on invalid JSON body', async () => {
        const event = makeEvent({ body: 'invalid json{' });
        const result = await publish(event);

        expect(result.statusCode).toBe(400);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toContain('unable to parse request body');
    });

    it('should return 200 on success', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await publish(event);

        expect(result.statusCode).toBe(200);
        expect(body(result).success).toBe(true);
    });

    it('should include id in response', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await publish(event);

        expect(body(result).id).toBe('mock-uuid-1');
    });

    it('should construct SendMessageCommand with correct QueueUrl', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        await publish(event);

        expect(SendMessageCommand).toHaveBeenCalledWith({
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            MessageBody: expect.any(String)
        });
    });

    it('should include payload in message body', async () => {
        const payload = { test: 'data', nested: { value: 123 } };
        const event = makeEvent({ body: JSON.stringify(payload) });
        await publish(event);

        const commandCall = SendMessageCommand.mock.calls[0][0];
        const messageBody = JSON.parse(commandCall.MessageBody);
        expect(messageBody.payload).toEqual(payload);
        expect(messageBody.objectId).toBe('mock-uuid-1');
        expect(messageBody.dataOwner).toBe('sqs-publisher');
        expect(messageBody.expiration).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should call sqs.send', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        await publish(event);

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should log publishing message', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        await publish(event);

        expect(consoleLogSpy).toHaveBeenCalledWith('publishing object mock-uuid-1');
    });

    it('should return 500 when sqs.send throws', async () => {
        const error = new Error('SQS error');
        mockSend.mockRejectedValue(error);

        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await publish(event);

        expect(result.statusCode).toBe(500);
        expect(body(result).success).toBe(false);
        expect(body(result).reason).toBe('an unexpected error occurred');
    });

    it('should log error when sqs.send throws', async () => {
        const error = new Error('SQS error');
        mockSend.mockRejectedValue(error);

        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        await publish(event);

        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should set CORS headers', async () => {
        const event = makeEvent({ body: JSON.stringify({ test: 'data' }) });
        const result = await publish(event);

        expect(result.headers['Access-Control-Allow-Origin']).toBe(process.env.CORS_ORIGIN);
        expect(result.headers['Access-Control-Allow-Credentials']).toBe(true);
    });
});

describe('sqs subscribe handler', () => {
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockPut.mockResolvedValue({});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should call dynamodb.put for each record', async () => {
        const event = {
            Records: [
                { body: JSON.stringify({ objectId: 'obj1', dataOwner: 'owner1', payload: { test: 'data1' } }) },
                { body: JSON.stringify({ objectId: 'obj2', dataOwner: 'owner2', payload: { test: 'data2' } }) }
            ]
        };
        await subscribe(event);

        expect(mockPut).toHaveBeenCalledTimes(2);
    });

    it('should put correct item for each record', async () => {
        const obj1 = { objectId: 'obj1', dataOwner: 'owner1', payload: { test: 'data1' }, expiration: 123456 };
        const obj2 = { objectId: 'obj2', dataOwner: 'owner2', payload: { test: 'data2' }, expiration: 789012 };

        const event = {
            Records: [
                { body: JSON.stringify(obj1) },
                { body: JSON.stringify(obj2) }
            ]
        };
        await subscribe(event);

        expect(mockPut).toHaveBeenNthCalledWith(1, {
            TableName: 'test-table',
            Item: obj1
        });
        expect(mockPut).toHaveBeenNthCalledWith(2, {
            TableName: 'test-table',
            Item: obj2
        });
    });

    it('should continue processing after a single record DDB error', async () => {
        const event = {
            Records: [
                { body: JSON.stringify({ objectId: 'obj1', dataOwner: 'owner1', payload: { test: 'data1' } }) },
                { body: JSON.stringify({ objectId: 'obj2', dataOwner: 'owner2', payload: { test: 'data2' } }) },
                { body: JSON.stringify({ objectId: 'obj3', dataOwner: 'owner3', payload: { test: 'data3' } }) }
            ]
        };

        // Make the second put fail
        mockPut
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('DynamoDB error'))
            .mockResolvedValueOnce({});

        await subscribe(event);

        // All three puts should be called despite the error
        expect(mockPut).toHaveBeenCalledTimes(3);
    });

    it('should log processing for each object', async () => {
        const event = {
            Records: [
                { body: JSON.stringify({ objectId: 'obj1', dataOwner: 'owner1', payload: { test: 'data1' } }) },
                { body: JSON.stringify({ objectId: 'obj2', dataOwner: 'owner2', payload: { test: 'data2' } }) }
            ]
        };
        await subscribe(event);

        expect(consoleLogSpy).toHaveBeenCalledWith('processing object obj1');
        expect(consoleLogSpy).toHaveBeenCalledWith('item obj1 stored');
        expect(consoleLogSpy).toHaveBeenCalledWith('processing object obj2');
        expect(consoleLogSpy).toHaveBeenCalledWith('item obj2 stored');
    });

    it('should log error when put fails', async () => {
        const error = new Error('DynamoDB error');
        mockPut.mockRejectedValue(error);

        const event = {
            Records: [
                { body: JSON.stringify({ objectId: 'obj1', dataOwner: 'owner1', payload: { test: 'data1' } }) }
            ]
        };
        await subscribe(event);

        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should return undefined', async () => {
        const event = {
            Records: [
                { body: JSON.stringify({ objectId: 'obj1', dataOwner: 'owner1', payload: { test: 'data1' } }) }
            ]
        };
        const result = await subscribe(event);

        expect(result).toBeUndefined();
    });

    it('should handle empty Records array', async () => {
        const event = { Records: [] };
        await subscribe(event);

        expect(mockPut).not.toHaveBeenCalled();
    });
});
