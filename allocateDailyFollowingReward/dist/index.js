import * as dotenv from "dotenv";
dotenv.config();
import { db, adminDb, stripe } from "./init.js";
import doWithRetries from "./helpers/doWithRetries.js";
import addCronLog from "./helpers/addCronLog.js";
import setUtcMidnight, { getTotalDaysInCurrentMonth, getIsToday, } from "./helpers/utils.js";
import { ObjectId } from "mongodb";
async function run() {
    try {
        const latestAllocation = (await doWithRetries(async () => adminDb
            .collection("Cron")
            .find({ functionName: "allocateDailyFollowingReward", isError: false }, { projection: { createdAt: 1 } })
            .sort({ createdAt: -1 })
            .next()));
        console.log("latestAllocation", latestAllocation);
        const { createdAt } = latestAllocation || {};
        const isToday = getIsToday(createdAt);
        console.log("isToday", isToday);
        if (createdAt && isToday)
            return;
        const peekPlanInfo = await doWithRetries(async () => db
            .collection("Plan")
            .findOne({ name: "peek" }, { projection: { priceId: 1 } }));
        console.log("peekPlanInfo", peekPlanInfo);
        const { priceId } = peekPlanInfo;
        const stripePeekPriceObject = await stripe.prices.retrieve(priceId);
        const price = stripePeekPriceObject.unit_amount / 100;
        const totalDaysInCurrentMonth = getTotalDaysInCurrentMonth();
        const dailyRewardShare = (price / totalDaysInCurrentMonth) *
            (1 - Number(process.env.STRIPE_PROCESSING_SHARE)) -
            -Number(process.env.STRIPE_PROCESSING_FEE);
        console.log("dailyRewardShare", dailyRewardShare);
        const toIncrement = await doWithRetries(async () => db
            .collection("User")
            .aggregate([
            {
                $match: {
                    "club.followingUserId": { $exists: true },
                    "subscriptions.peek.validUntil": { $gte: new Date() },
                },
            },
            {
                $group: {
                    _id: null,
                    ids: { $push: "$club.followingUserId" },
                },
            },
            { $project: { _id: 0, ids: 1 } },
        ])
            .next());
        console.log("toIncrement", toIncrement);
        if (!toIncrement || toIncrement.ids.length === 0)
            return;
        const uniqueToIncrementIds = [
            ...new Set(toIncrement.ids.map((id) => String(id))),
        ];
        const batchSize = 500;
        const bulkOperations = [];
        const now = setUtcMidnight({ date: new Date() });
        const totalAnalyticsUpdate = {
            [`overview.accounting.totalPayable`]: 0,
        };
        const userAnalyticsUpdates = [];
        console.log("userAnalyticsUpdates", userAnalyticsUpdates);
        for (let i = 0; i < uniqueToIncrementIds.length; i++) {
            const followerCount = uniqueToIncrementIds.filter((id) => id === uniqueToIncrementIds[i]).length;
            totalAnalyticsUpdate[`overview.accounting.totalPayable`] +=
                Number(dailyRewardShare);
            userAnalyticsUpdates.push({
                updateOne: {
                    filter: {
                        userId: new ObjectId(uniqueToIncrementIds[i]),
                        createdAt: now,
                    },
                    update: {
                        $inc: {
                            [`overview.accounting.totalPayable`]: dailyRewardShare,
                            [`accounting.totalPayable`]: dailyRewardShare,
                        },
                    },
                    upsert: true,
                },
            });
            bulkOperations.push({
                updateOne: {
                    filter: { _id: new ObjectId(uniqueToIncrementIds[i]) },
                    update: {
                        $inc: {
                            "club.payouts.balance": dailyRewardShare * followerCount,
                            netBenefit: dailyRewardShare * followerCount,
                        },
                    },
                },
            });
            if (bulkOperations.length >= batchSize) {
                await doWithRetries(async () => db.collection("User").bulkWrite(bulkOperations));
                await doWithRetries(async () => db.collection("UserAnalytics").bulkWrite(userAnalyticsUpdates));
                bulkOperations.length = 0;
            }
        }
        console.log("bulkOperations", bulkOperations);
        if (bulkOperations.length > 0) {
            await doWithRetries(async () => db.collection("User").bulkWrite(bulkOperations));
            await doWithRetries(async () => db.collection("UserAnalytics").bulkWrite(bulkOperations));
        }
        await doWithRetries(async () => db
            .collection("TotalAnalytics")
            .updateOne({ createdAt: now }, { $set: totalAnalyticsUpdate }));
        addCronLog({
            functionName: "allocateDailyFollowingReward",
            isError: false,
            message: `Allocated to ${bulkOperations.length} users.`,
        });
    }
    catch (err) {
        addCronLog({
            functionName: "allocateDailyFollowingReward",
            isError: true,
            message: err.message,
        });
    }
}
run();
