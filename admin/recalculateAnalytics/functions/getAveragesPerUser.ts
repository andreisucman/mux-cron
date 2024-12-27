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
          "dashboard.user.totalUsers": 1,
          "dashboard.user.totalRevenue": 1,
          "dashboard.user.totalCost": 1,
          "dashboard.user.totalReward": 1,
          "dashboard.user.totalWithdrawn": 1,
          "dashboard.user.totalPayable": 1,
        })
        .next()
    );

    const { dashboard } = latestTotalAnalyticsDoc;
    const { user } = dashboard;
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
