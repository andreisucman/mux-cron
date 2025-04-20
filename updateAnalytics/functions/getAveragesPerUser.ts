import doWithRetries from "@/helpers/doWithRetries.js";
import { adminDb } from "@/init.js";
import { safeNumber } from "@/helpers/utils.js";

export default async function getFinancialCalculations() {
  try {
    const latestTotalAnalyticsDoc = await doWithRetries(async () =>
      adminDb
        .collection("TotalAnalytics")
        .find()
        .sort({ _id: -1 })
        .project({
          "overview.user.count.totalUsers": 1,
          "overview.user.totalRevenue": 1,
          "overview.user.totalCost": 1,
          "overview.user.totalReward": 1,
          "overview.user.totalWithdrawn": 1,
          "overview.user.totalPayable": 1,
          "overview.user.totalPlatformFee": 1,
        })
        .next()
    );

    if (!latestTotalAnalyticsDoc) return;

    const { overview } = latestTotalAnalyticsDoc;
    const { user } = overview;
    const { count, totalCost = 0, totalReward = 0 } = { ...user };

    const { totalUsers = 0 } = count || {};

    return {
      avgCost: safeNumber(totalCost / totalUsers),
      avgReward: safeNumber(totalReward / totalUsers),
    };
  } catch (err) {
    throw err;
  }
}
