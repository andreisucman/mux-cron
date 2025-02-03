export function delayExecution(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function getExponentialBackoffDelay(attempt, baseDelay = 1000, maxDelay = 12000) {
    const rawDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * baseDelay - baseDelay / 2;
    return Math.min(rawDelay + jitter, maxDelay);
}
