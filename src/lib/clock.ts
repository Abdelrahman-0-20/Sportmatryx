/**
 * Clock access for server components. Centralized so the react-hooks/purity
 * rule (Date.now during render) has a single documented, intentional site:
 * these are force-dynamic server components reading the server clock once
 * per request — an allowed impure read at request scope, not per render pass.
 */
export function nowMs(): number {
  return Date.now();
}

export function hoursAgoIso(h: number): string {
  return new Date(nowMs() - h * 3600000).toISOString();
}

export function daysAgoIso(d: number): string {
  return new Date(nowMs() - d * 24 * 3600000).toISOString();
}
