import doWithRetries from "@/helpers/doWithRetries.js";
import { userDb } from "@/init.js";
import { daysFrom, setToUtcMidnight } from "@/helpers/utils.js";

type Props = {
  date: Date;
};

export default async function getUsersStats({ date }: Props) {
  try {
    const start = setToUtcMidnight(date);
    const end = setToUtcMidnight(daysFrom({ days: 1, date }));

    const usersActiveOnThatDate = await doWithRetries(async () =>
      userDb
        .collection("User")
        .countDocuments({ lastActiveOn: { $gte: start, $lt: end } })
    );

    const blockedUsers = await doWithRetries(async () =>
      userDb.collection("User").countDocuments({ moderationStatus: "blocked" })
    );

    const suspendedUsers = await doWithRetries(async () =>
      userDb
        .collection("User")
        .countDocuments({ moderationStatus: "suspended" })
    );

    return { usersActiveOnThatDate, blockedUsers, suspendedUsers };
  } catch (err) {
    throw err;
  }
}
