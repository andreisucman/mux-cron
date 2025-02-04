import * as dotenv from "dotenv";
dotenv.config();
import { adminDb } from "./init.js";
import doWithRetries from "./helpers/doWithRetries.js";
import addCronLog from "./helpers/addCronLog.js";
async function run() {
    try {
        const idsToReactivate = await doWithRetries(async () => adminDb
            .collection("BlockedUser")
            .find({
            reactivateAt: { $lt: new Date() },
        }, { projection: { userId: 1 } })
            .toArray());
        for (const id of idsToReactivate) {
            await fetch(`${process.env.API_ADMIN_SERVER_URL}/updateAccountAccess`, {
                method: "POST",
                headers: { authorization: process.env.ADMIN_API_SECRET_KEY },
                body: JSON.stringify({
                    userId: id,
                    note: "automatic",
                    moderationStatus: "active",
                }),
            });
        }
        addCronLog({
            functionName: "reactivateBlockedUsers",
            message: `${idsToReactivate.length} users have been reactivated.`,
            isError: false,
        });
    }
    catch (err) {
        addCronLog({
            functionName: "reactivateBlockedUsers",
            message: err.message,
            isError: true,
        });
    }
}
run();
