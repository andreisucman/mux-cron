import doWithRetries from "@/helpers/doWithRetries.js";
import { adminDb } from "@/init.js";
import setUtcMidnight from "@/helpers/setUtcMidnight";
import { daysFrom } from "@/helpers/utils";

type Props = {
  date: Date;
};

export default async function getActiveTodayUsersCount({ date }: Props) {
  try {
    const start = setUtcMidnight({ date });
    const end = setUtcMidnight({ date: daysFrom({ days: 1, date }) });

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
