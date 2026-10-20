import { logger } from './logger';

/**
 * Logger spec (T2 §6 port): level gating + config override. Console
 * output is spied; nothing asserts on timing.
 */
describe('logger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.setConfig({ enabled: true, minLevel: 'debug' });
  });

  afterEach(() => {
    logger.setConfig({ enabled: true, minLevel: 'debug' });
    vi.restoreAllMocks();
  });

  it('emits every level when minLevel is debug', () => {
    logger.debug('d', { a: 1 });
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).toHaveBeenCalledExactlyOnceWith('[DEBUG] d', { a: 1 });
    expect(infoSpy).toHaveBeenCalledWith('[INFO] i', '');
    expect(warnSpy).toHaveBeenCalledWith('[WARN] w', '');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] e', '');
  });

  it('suppresses levels below the configured minimum', () => {
    logger.setConfig({ minLevel: 'warn' });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('is silent when disabled', () => {
    logger.setConfig({ enabled: false });

    logger.error('e');

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
