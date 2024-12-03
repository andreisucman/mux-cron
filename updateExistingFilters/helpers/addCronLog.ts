import { db } from "init.js";

type Props = { message: string; isError: boolean; functionName: string };

const addCronLog = async ({ message, isError, functionName }: Props) => {
  try {
    const errorLogsCollection = db.collection("CronLog");

    const newErrorLog = {
      functionName,
      message,
      isError,
      createdAt: new Date(),
    };

    await errorLogsCollection.insertOne(newErrorLog);
    console.log(`Error in ${functionName}: `, message);

    return true;
  } catch (error) {
    throw new Error(`Error thrown in addCronLog: ${error.message}`);
  }
};

export default addCronLog;
