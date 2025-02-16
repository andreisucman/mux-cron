import doWithRetries from "@/helpers/doWithRetries.js";
import { adminDb } from "@/init.js";
import { daysFrom, setToUtcMidnight } from "@/helpers/utils.js";

type Props = {
  date: Date;
};

export default async function getActiveTodayUsersCount({ date }: Props) {
  try {
    const start = setToUtcMidnight(date);
    const end = setToUtcMidnight(daysFrom({ days: 1, date }));

    const usersActiveOnThatDate = await doWithRetries(async () =>
      adminDb
        .collection("UserStats")
        .countDocuments({ lastActiveOn: { $gte: start, $lt: end } })
    );

    return usersActiveOnThatDate;
  } catch (err) {
    throw err;
  }
}
