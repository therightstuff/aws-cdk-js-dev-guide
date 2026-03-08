import { jest } from '@jest/globals';

// Export mock handles so test files can import them directly and control
// return values per-test via mockResolvedValue / mockReset etc.
export const mockGet   = jest.fn();
export const mockPut   = jest.fn();
export const mockQuery = jest.fn();
export const mockScan  = jest.fn();
export const mockUpdate = jest.fn();

export const DynamoDBDocument = {
    from: jest.fn(() => ({
        get:    mockGet,
        put:    mockPut,
        query:  mockQuery,
        scan:   mockScan,
        update: mockUpdate,
    })),
};
