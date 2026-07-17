import { TestBed } from '@angular/core/testing';
import { SignalrService, MarketChangedPayload, ForgeFulfilledPayload } from './signalr.service';

const DISCONNECTED = 0;
const CONNECTING = 1;
const CONNECTED = 2;
const RECONNECTING = 3;
const DISCONNECTING = 4;

let capturedReconnectedCb: (() => void) | null = null;

const mockConn = vi.hoisted(() => ({
  state: DISCONNECTED as number,
  start: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  stop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  invoke: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  onreconnected: vi.fn<(cb: () => void) => void>().mockImplementation((cb) => {
    capturedReconnectedCb = cb;
  }),
}));

const mockBuilderInstance = vi.hoisted(() => ({
  withUrl: vi.fn(),
  withAutomaticReconnect: vi.fn(),
  build: vi.fn(),
}));

vi.mock('@microsoft/signalr', () => {
  mockBuilderInstance.withUrl.mockReturnValue(mockBuilderInstance);
  mockBuilderInstance.withAutomaticReconnect.mockReturnValue(mockBuilderInstance);
  mockBuilderInstance.build.mockReturnValue(mockConn);

  function HubConnectionBuilder(this: unknown) {
    return mockBuilderInstance;
  }

  return {
    HubConnectionBuilder,
    HubConnectionState: {
      Disconnected: 0,
      Connecting: 1,
      Connected: 2,
      Reconnecting: 3,
      Disconnecting: 4,
    },
  };
});

describe('SignalrService', () => {
  let service: SignalrService;

  beforeEach(() => {
    capturedReconnectedCb = null;
    mockConn.state = DISCONNECTED;
    mockConn.start.mockReset();
    mockConn.start.mockResolvedValue(undefined);
    mockConn.stop.mockReset();
    mockConn.stop.mockResolvedValue(undefined);
    mockConn.on.mockReset();
    mockConn.off.mockReset();
    mockConn.invoke.mockReset();
    mockConn.invoke.mockResolvedValue(undefined);
    mockConn.onreconnected.mockReset();
    mockConn.onreconnected.mockImplementation((cb: () => void) => {
      capturedReconnectedCb = cb;
    });
    mockBuilderInstance.withUrl.mockReturnValue(mockBuilderInstance);
    mockBuilderInstance.withAutomaticReconnect.mockReturnValue(mockBuilderInstance);
    mockBuilderInstance.build.mockReturnValue(mockConn);

    TestBed.configureTestingModule({});
    service = TestBed.inject(SignalrService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('start()', () => {
    it('starts the hub connection when disconnected', async () => {
      await service.start();
      expect(mockConn.start).toHaveBeenCalledOnce();
    });

    it('does not start again when already connected', async () => {
      mockConn.state = CONNECTED;
      await service.start();
      expect(mockConn.start).not.toHaveBeenCalled();
    });

    it('does not start when connecting', async () => {
      mockConn.state = CONNECTING;
      await service.start();
      expect(mockConn.start).not.toHaveBeenCalled();
    });

    it('does not start when reconnecting', async () => {
      mockConn.state = RECONNECTING;
      await service.start();
      expect(mockConn.start).not.toHaveBeenCalled();
    });

    it('does not start again while a start is already in progress', async () => {
      let resolveStart!: () => void;
      mockConn.start.mockReturnValue(new Promise<void>((r) => { resolveStart = r; }));
      const p1 = service.start();
      const p2 = service.start();
      resolveStart();
      await p1;
      await p2;
      expect(mockConn.start).toHaveBeenCalledOnce();
    });

    it('handles connection failure gracefully without throwing', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockConn.start.mockRejectedValue(new Error('network error'));
      await expect(service.start()).resolves.not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('resets starting flag after failure so retry is possible', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockConn.start.mockRejectedValue(new Error('fail'));
      await service.start();
      mockConn.start.mockResolvedValue(undefined);
      mockConn.state = DISCONNECTED;
      await service.start();
      expect(mockConn.start).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop()', () => {
    it('does nothing when no connection has been created', async () => {
      await service.stop();
      expect(mockConn.stop).not.toHaveBeenCalled();
    });

    it('stops a connected connection', async () => {
      await service.start();
      mockConn.state = CONNECTED;
      await service.stop();
      expect(mockConn.stop).toHaveBeenCalledOnce();
    });

    it('does nothing when already disconnected after start', async () => {
      await service.start();
      mockConn.state = DISCONNECTED;
      await service.stop();
      expect(mockConn.stop).not.toHaveBeenCalled();
    });

    it('does nothing when already disconnecting', async () => {
      await service.start();
      mockConn.state = DISCONNECTING;
      await service.stop();
      expect(mockConn.stop).not.toHaveBeenCalled();
    });

    it('handles stop failure gracefully without throwing', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.start();
      mockConn.state = CONNECTED;
      mockConn.stop.mockRejectedValue(new Error('stop error'));
      await expect(service.stop()).resolves.not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('onMarketChanged()', () => {
    it('registers the handler on the hub connection', () => {
      const handler = vi.fn();
      service.onMarketChanged(handler);
      expect(mockConn.on).toHaveBeenCalledWith('marketChanged', handler);
    });

    it('calls the handler when marketChanged fires', () => {
      const handler = vi.fn();
      let capturedCb: ((p: MarketChangedPayload) => void) | undefined;
      mockConn.on.mockImplementation((_event: string, cb: (p: MarketChangedPayload) => void) => {
        capturedCb = cb;
      });
      service.onMarketChanged(handler);
      const payload: MarketChangedPayload = { count: 5, maxBlock: 100 };
      capturedCb?.(payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('returned unsubscribe calls off on the connection', () => {
      const handler = vi.fn();
      const unsub = service.onMarketChanged(handler);
      unsub();
      expect(mockConn.off).toHaveBeenCalledWith('marketChanged', handler);
    });

    it('creates a connection if none exists when registering handler', () => {
      const handler = vi.fn();
      service.onMarketChanged(handler);
      expect(mockConn.on).toHaveBeenCalled();
    });

    it('works with numeric maxBlock payload', () => {
      const handler = vi.fn();
      let capturedCb: ((p: MarketChangedPayload) => void) | undefined;
      mockConn.on.mockImplementation((_event: string, cb: (p: MarketChangedPayload) => void) => {
        capturedCb = cb;
      });
      service.onMarketChanged(handler);
      const payload: MarketChangedPayload = { count: 3, maxBlock: 42 };
      capturedCb?.(payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe('onForgeFulfilled()', () => {
    it('registers the handler on the hub connection', () => {
      const handler = vi.fn();
      service.onForgeFulfilled(handler);
      expect(mockConn.on).toHaveBeenCalledWith('forgeFulfilled', handler);
    });

    it('calls the handler when forgeFulfilled fires', () => {
      const handler = vi.fn();
      let capturedCb: ((p: ForgeFulfilledPayload) => void) | undefined;
      mockConn.on.mockImplementation((_event: string, cb: (p: ForgeFulfilledPayload) => void) => {
        capturedCb = cb;
      });
      service.onForgeFulfilled(handler);
      const payload: ForgeFulfilledPayload = { requestId: '1', tokenId: '42', editionId: '1' };
      capturedCb?.(payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('returned unsubscribe calls off on the connection', () => {
      const handler = vi.fn();
      const unsub = service.onForgeFulfilled(handler);
      unsub();
      expect(mockConn.off).toHaveBeenCalledWith('forgeFulfilled', handler);
    });

    it('creates a connection if none exists when registering forgeFulfilled handler', () => {
      service.onForgeFulfilled(vi.fn());
      expect(mockConn.on).toHaveBeenCalled();
    });
  });

  describe('subscribe()', () => {
    it('invokes Subscribe on the hub when connected', async () => {
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xABCD');
      expect(mockConn.invoke).toHaveBeenCalledWith('Subscribe', '0xabcd');
    });

    it('lowercases the address before invoking', async () => {
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xDEADBEEF');
      expect(mockConn.invoke).toHaveBeenCalledWith('Subscribe', '0xdeadbeef');
    });

    it('does not invoke when connection is not connected', async () => {
      mockConn.state = DISCONNECTED;
      await service.subscribe('0xabc');
      expect(mockConn.invoke).not.toHaveBeenCalled();
    });

    it('creates connection if none exists', async () => {
      mockConn.state = DISCONNECTED;
      await service.subscribe('0xabc');
      expect(mockBuilderInstance.build).toHaveBeenCalled();
    });

    it('handles invoke failure gracefully without throwing', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.start();
      mockConn.state = CONNECTED;
      mockConn.invoke.mockRejectedValueOnce(new Error('invoke fail'));
      await expect(service.subscribe('0xabc')).resolves.not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('re-subscribes all addresses on reconnect', async () => {
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xabc');
      await service.subscribe('0xdef');
      mockConn.invoke.mockClear();
      capturedReconnectedCb?.();
      await Promise.resolve();
      expect(mockConn.invoke).toHaveBeenCalledWith('Subscribe', '0xabc');
      expect(mockConn.invoke).toHaveBeenCalledWith('Subscribe', '0xdef');
    });

    it('handles resubscribe failure on reconnect gracefully', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xabc');
      mockConn.invoke.mockRejectedValue(new Error('reconnect invoke fail'));
      capturedReconnectedCb?.();
      await Promise.resolve();
      await Promise.resolve();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('unsubscribe()', () => {
    it('invokes Unsubscribe on the hub when connected', async () => {
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xabc');
      await service.unsubscribe('0xabc');
      expect(mockConn.invoke).toHaveBeenCalledWith('Unsubscribe', '0xabc');
    });

    it('does not invoke when connection is not connected', async () => {
      mockConn.state = DISCONNECTED;
      await service.unsubscribe('0xabc');
      expect(mockConn.invoke).not.toHaveBeenCalledWith('Unsubscribe', expect.anything());
    });

    it('does not invoke when no connection has been created', async () => {
      await service.unsubscribe('0xabc');
      expect(mockConn.invoke).not.toHaveBeenCalled();
    });

    it('removes address from tracked set so it is not re-subscribed on reconnect', async () => {
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xabc');
      await service.unsubscribe('0xabc');
      mockConn.invoke.mockClear();
      capturedReconnectedCb?.();
      await Promise.resolve();
      expect(mockConn.invoke).not.toHaveBeenCalledWith('Subscribe', '0xabc');
    });

    it('handles invoke failure gracefully without throwing', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.start();
      mockConn.state = CONNECTED;
      await service.subscribe('0xabc');
      mockConn.invoke.mockRejectedValueOnce(new Error('unsub fail'));
      await expect(service.unsubscribe('0xabc')).resolves.not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('URL construction', () => {
    it('builds connection with the correct hub URL containing /hubs/events', () => {
      service.onMarketChanged(vi.fn());
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(expect.stringContaining('/hubs/events'));
    });
  });
});
