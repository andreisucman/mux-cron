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
        })
        .next()
    );

    if (!latestTotalAnalyticsDoc) return;

    const { overview } = latestTotalAnalyticsDoc;
    const { user } = overview;
    const {
      count,
      totalRevenue = 0,
      totalCost = 0,
      totalReward = 0,
      totalPayable = 0,
      totalWithdrawn = 0,
    } = { ...user };

    const { totalUsers } = count;

    const netRevenue =
      safeNumber(totalRevenue) -
      safeNumber(totalCost) -
      safeNumber(totalReward) -
      safeNumber(totalPayable);

    const netCash =
      safeNumber(totalRevenue) -
      safeNumber(totalCost) -
      safeNumber(totalWithdrawn);

    return {
      avgRevenue: totalRevenue / totalUsers,
      avgCost: totalCost / totalUsers,
      avgReward: totalReward / totalUsers,
      netRevenue,
      netCash,
    };
  } catch (err) {
    throw err;
  }
}
