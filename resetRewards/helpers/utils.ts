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

type DaysFromProps = {
  date?: Date;
  days: number;
};

export function daysFrom({ date = new Date(), days }: DaysFromProps) {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
}

export function getDaysUntilNextMonth() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const timeDifference = nextMonth.getTime() - today.getTime();
  const daysDifference = timeDifference / (1000 * 3600 * 24);

  return Math.ceil(daysDifference);
}
