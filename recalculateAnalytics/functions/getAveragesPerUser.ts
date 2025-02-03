import doWithRetries from "@/helpers/doWithRetries.js";
import { adminDb } from "@/init.js";

export default async function getFinancialCalculations() {
  try {
    const latestTotalAnalyticsDoc = await doWithRetries(async () =>
      adminDb
        .collection("TotalAnalytics")
        .find()
        .sort({ _id: -1 })
        .project({
          "overview.user.totalUsers": 1,
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
      totalUsers,
      totalRevenue,
      totalCost,
      totalReward,
      totalPayable,
      totalWithdrawn,
    } = user;

    const netRevenue = totalRevenue - totalCost - totalReward - totalPayable;
    const netCash = totalRevenue - totalCost - totalWithdrawn;

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
