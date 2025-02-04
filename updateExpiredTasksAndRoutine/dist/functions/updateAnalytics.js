import doWithRetries from "../helpers/doWithRetries.js";
import { adminDb } from "../init.js";
import setUtcMidnight from "../helpers/setUtcMidnight.js";
import { ObjectId } from "mongodb";
export default async function updateAnalytics({ userId, incrementPayload, }) {
    const createdAt = setUtcMidnight({ date: new Date() });
    try {
        if (userId) {
            await doWithRetries(async () => adminDb.collection("UserAnalytics").updateOne({ createdAt, userId: new ObjectId(userId) }, {
                $inc: incrementPayload,
            }, {
                upsert: true,
            }));
        }
        await doWithRetries(async () => adminDb.collection("TotalAnalytics").updateOne({ createdAt }, {
            $inc: incrementPayload,
        }, {
            upsert: true,
        }));
    }
    catch (err) {
        throw err;
    }
}
