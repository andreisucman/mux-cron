import doWithRetries from "../helpers/doWithRetries.js";
import { adminDb } from "../init.js";
import setUtcMidnight from "../helpers/setUtcMidnight.js";
import { daysFrom } from "../helpers/utils.js";
export default async function getActiveTodayUsersCount({ date }) {
    try {
        const start = setUtcMidnight({ date });
        const end = setUtcMidnight({ date: daysFrom({ days: 1, date }) });
        const usersActiveOnThatDate = await doWithRetries(async () => adminDb
            .collection("UserStats")
            .countDocuments({ lastActiveOn: { $gte: start, $lt: end } }));
        return usersActiveOnThatDate;
    }
    catch (err) {
        throw err;
    }
}
