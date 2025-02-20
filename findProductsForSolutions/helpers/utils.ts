export function delayExecution(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getExponentialBackoffDelay(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 12000
) {
  const rawDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay - baseDelay / 2; // random value between -0.5*baseDelay and 0.5*baseDelay
  return Math.min(rawDelay + jitter, maxDelay);
}

export function setToUtcMidnight(date: Date) {
  return new Date(date.setUTCHours(0, 0, 0, 0));
}

export function toSentenceCase(value: any): string {
  if (typeof value !== "string") return value;

  return value.trim().replace(/^\w/, (char) => char.toUpperCase());
}

export function upperFirst(string: string) {
  if (!string) return "";

  return string[0].toUpperCase() + string.slice(1);
}
