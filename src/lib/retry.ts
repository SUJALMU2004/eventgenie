/** Called only from user actions, never to drive a render-time countdown. */
export function retryWaitSeconds(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function retryDeadline(seconds: number, now = Date.now()): number {
  return now + seconds * 1000;
}
