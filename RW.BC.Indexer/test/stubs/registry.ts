type Handler = (args: { event: unknown; context: unknown }) => Promise<void> | void;

const handlers = new Map<string, Handler>();

export const ponder = {
  on(name: string, fn: Handler) {
    handlers.set(name, fn);
  },
};

export function getHandler(name: string): Handler {
  const fn = handlers.get(name);
  if (!fn) {
    throw new Error(`No handler registered for "${name}". Registered: ${[...handlers.keys()].join(", ")}`);
  }
  return fn;
}

export function resetHandlers(): void {
  handlers.clear();
}
