import doWithRetries from "@/helpers/doWithRetries.js";
import { adminDb } from "@/init.js";
import { safeNumber } from "@/helpers/utils.js";

export default async function getFinancialCalculations(filter?: { [key: string]: any }) {
  try {
    const latestTotalAnalyticsDoc = await doWithRetries(async () =>
      adminDb
        .collection("TotalAnalytics")
        .find(filter)
        .sort({ _id: -1 })
        .project({
          "overview.user.user.count.totalUsers": 1,
          "overview.user.user.totalRevenue": 1,
          "overview.user.accounting.totalCost": 1,
          "overview.user.accounting.totalReward": 1,
        })
        .next()
    );

    if (!latestTotalAnalyticsDoc) return;

    const { overview } = latestTotalAnalyticsDoc;
    const { user, accounting } = overview;
    const { count } = { ...user };
    const { totalCost = 0, totalReward = 0 } = { ...accounting };

    const { totalUsers = 0 } = count || {};

    return {
      avgCost: safeNumber(totalCost / totalUsers),
      avgReward: safeNumber(totalReward / totalUsers),
    };
  } catch (err) {
    throw err;
  }
}
