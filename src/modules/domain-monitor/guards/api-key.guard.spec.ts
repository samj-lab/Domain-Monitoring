import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockConfigService: { get: jest.Mock };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('valid-api-key'),
    };
    guard = new ApiKeyGuard(mockConfigService as unknown as ConfigService);
  });

  const createMockContext = (apiKey?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-api-key': apiKey,
          },
        }),
      }),
    } as ExecutionContext;
  };

  it('should allow request with valid API key', () => {
    const context = createMockContext('valid-api-key');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when API key is missing', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow(
      'Missing X-API-Key header',
    );
  });

  it('should throw UnauthorizedException when API key is invalid', () => {
    const context = createMockContext('wrong-key');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Invalid API key');
  });

  it('should throw when API_KEY env is not set', () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newGuard = new ApiKeyGuard(
      mockConfigService as unknown as ConfigService,
    );
    const context = createMockContext('some-key');
    expect(() => newGuard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
