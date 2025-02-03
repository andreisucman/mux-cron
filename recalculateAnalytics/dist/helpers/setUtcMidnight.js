import { DateTime } from "luxon";
export default function setUtcMidnight({ date, isNextDay, timeZone, }) {
    let midnightDate = DateTime.fromJSDate(date, { zone: timeZone });
    midnightDate = midnightDate.set({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
    if (isNextDay) {
        midnightDate = midnightDate.plus({ days: 1 });
    }
    const utcMidnightDate = midnightDate.toUTC();
    return utcMidnightDate.toJSDate();
}
