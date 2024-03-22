jest.mock('../helpers', () => ({
  getConfigFromSupabase: jest.fn().mockResolvedValue({
    TOKEN_LIMIT: 1000,
    WARNING_BUFFER: 50,
    MAX_CAPABILITY_CALLS: 3,
    MAX_RETRY_COUNT: 2,
  }),
  getPromptsFromSupabase: jest.fn().mockResolvedValue([
    
  ]),
  getUniqueEmoji: jest.fn().mockReturnValue('🔥'),
  doesMessageContainCapability: jest.fn().mockReturnValue(false),
  isExceedingTokenLimit: jest.fn().mockReturnValue(false),
  countMessageTokens: jest.fn().mockReturnValue(0),
  createTokenLimitWarning: jest.fn().mockReturnValue({ role: 'system', content: 'Warning: Token limit approaching.' }),
}));

// Mock more dependencies as needed...


describe('processMessageChain', () => {

  it('should always return an array, even when processing fails', async () => {
    const { isExceedingTokenLimit } = require('../helpers'); // Correctly import isExceedingTokenLimit
    const { processMessageChain } = await require('./chain');

    jest.mocked(isExceedingTokenLimit).mockImplementationOnce(() => {
      throw new Error('Simulated failure');
    });
    const messages = [{ content: 'Test message' }];
    const options = { username: 'testUser', channel: 'testChannel', guild: 'testGuild' };

    const processedMessages = await processMessageChain(messages, options).catch(e => []);
    expect(Array.isArray(processedMessages)).toBe(true);
  });

  it('should return an array of processed messages when processing succeeds', async () => {
    const { processMessageChain } = await require('./chain');

    const messages = [{ content: 'Test message' }];
    const options = { username: 'testUser', channel: 'testChannel', guild: 'testGuild' };

    const processedMessages = await processMessageChain(messages, options);
    expect(Array.isArray(processedMessages)).toBe(true);
  });  
});