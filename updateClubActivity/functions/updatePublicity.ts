import { ObjectId } from "mongodb";
import doWithRetries from "../helpers/doWithRetries.js";
import { db } from "../init.js";
import addErrorLog from "../helpers/addErrorLog.js";

type Props = {
  userId: string;
  isPublic: boolean;
};

export default async function updatePublicity({ userId, isPublic }: Props) {
  try {
    await doWithRetries({
      functionName: "joinClub - make proofs public",
      functionToExecute: async () =>
        db
          .collection("Proof")
          .updateMany({ userId: new ObjectId(userId) }, { $set: { isPublic } }),
    });

    await doWithRetries({
      functionName: "joinClub - make style public",
      functionToExecute: async () =>
        db
          .collection("StyleAnalysis")
          .updateMany({ userId: new ObjectId(userId) }, { $set: { isPublic } }),
    });

    await doWithRetries({
      functionName: "joinClub - make before afters public",
      functionToExecute: async () =>
        db
          .collection("BeforeAfter")
          .updateMany({ userId: new ObjectId(userId) }, { $set: { isPublic } }),
    });
  } catch (err) {
    addErrorLog({ functionName: "updatePublicity", message: err.message });
    throw err;
  }
}
