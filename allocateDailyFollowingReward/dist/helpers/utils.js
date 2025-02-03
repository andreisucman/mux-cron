import { DateTime } from "luxon";
export function delayExecution(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function getExponentialBackoffDelay(attempt, baseDelay = 1000, maxDelay = 12000) {
    const rawDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * baseDelay - baseDelay / 2;
    return Math.min(rawDelay + jitter, maxDelay);
}
export function getTotalDaysInCurrentMonth() {
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const daysInCurrentMonth = (nextMonth.getTime() -
        new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime()) /
        (1000 * 60 * 60 * 24);
    return Math.floor(daysInCurrentMonth);
}
export function getIsToday(date) {
    const today = new Date();
    const inputDate = new Date(date);
    return (today.getFullYear() === inputDate.getFullYear() &&
        today.getMonth() === inputDate.getMonth() &&
        today.getDate() === inputDate.getDate());
}
export default function setUtcMidnight({ date, timeZone, }) {
    let midnightDate = DateTime.fromJSDate(date, { zone: timeZone });
    midnightDate = midnightDate.set({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
    const utcMidnightDate = midnightDate.toUTC();
    return utcMidnightDate.toJSDate();
}
