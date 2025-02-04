import { adminDb } from "../init.js";
const addCronLog = async ({ message, isError, functionName }) => {
    try {
        const errorLogsCollection = adminDb.collection("Cron");
        const newErrorLog = {
            functionName,
            message,
            isError,
            createdAt: new Date(),
        };
        await errorLogsCollection.insertOne(newErrorLog);
        console.log(`${functionName}: `, message);
    }
    catch (error) {
        console.log(`Error in ${functionName}: `, message);
    }
};
export default addCronLog;
