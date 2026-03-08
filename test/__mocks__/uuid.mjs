import { jest } from '@jest/globals';

// Stub for the `uuid` package (not installed in root node_modules — only in
// layers/src/sample-layer/node_modules). Returns predictable values in tests.
let _counter = 0;

export const mockV4 = jest.fn(() => `mock-uuid-${++_counter}`);

// Reset the counter and mock state between tests
export const __reset = () => {
    _counter = 0;
    mockV4.mockImplementation(() => `mock-uuid-${++_counter}`);
};

export const v4 = mockV4;
