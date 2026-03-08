import { jest } from '@jest/globals';

export const mockSend = jest.fn().mockResolvedValue({});

export const SQSClient = jest.fn(() => ({ send: mockSend }));

export const SendMessageCommand = jest.fn((input) => ({ ...input }));
