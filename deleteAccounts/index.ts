import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import { ObjectId } from "mongodb";

async function deleteData(userIds: ObjectId[]) {
  await doWithRetries(async () =>
    db.collection("User").deleteMany({
      _id: { $in: userIds.map((id) => id) },
    })
  );
  await doWithRetries(async () =>
    db.collection("Routine").deleteMany({
      userId: { $in: userIds.map((id) => id) },
    })
  );
  await doWithRetries(async () =>
    db.collection("Task").deleteMany({
      userId: { $in: userIds.map((id) => id) },
    })
  );
  await doWithRetries(async () =>
    db.collection("Progress").deleteMany({
      userId: { $in: userIds.map((id) => id) },
    })
  );
  await doWithRetries(async () =>
    db.collection("Proof").deleteMany({
      userId: { $in: userIds.map((id) => id) },
    })
  );
  await doWithRetries(async () =>
    db.collection("Diary").deleteMany({
      userId: { $in: userIds.map((id) => id) },
    })
  );
  await doWithRetries(async () =>
    db.collection("Purchase").deleteMany({
      $or: [{ sellerId: { $in: userIds.map((id) => id) } }, { buyerId: { $in: userIds.map((id) => id) } }],
    })
  );
  await doWithRetries(async () =>
    db.collection("RoutineData").deleteMany({
      userId: { $in: userIds.map((id) => id) },
    })
  );
}

async function run() {
  try {
    const toBeDeleted = await doWithRetries(async () =>
      db
        .collection("User")
        .find(
          {
            deleteOn: { $lte: new Date() },
          },
          { projection: { _id: 1 } }
        )
        .toArray()
    );

    const toDeleteBatches = [];
    const batchSize = 500;

    for (let i = 0; i < Math.ceil(toBeDeleted.length / batchSize); i++) {
      toDeleteBatches.push(toBeDeleted.slice(i * batchSize, (i + 1) * batchSize).map((obj) => obj._id));
    }

    for (const batch of toDeleteBatches) {
      await deleteData(batch);
    }

    await addCronLog({
      functionName: "deleteAccounts",
      isError: false,
      message: `${toBeDeleted.length} accounts deleted in ${toDeleteBatches.length} batches`,
    });
  } catch (err) {
    await addCronLog({
      functionName: "deleteAccounts",
      isError: true,
      message: err.message,
    });
  }
}

run()
  .then(async () => {
    await client.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await client.close();
    process.exit(1);
  });
