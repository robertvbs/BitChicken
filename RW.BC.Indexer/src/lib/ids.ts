interface EventLogReference {
  transaction: { hash: string };
  log: { logIndex: number };
}

export function eventId(event: EventLogReference): string {
  return `${event.transaction.hash}-${event.log.logIndex}`;
}
