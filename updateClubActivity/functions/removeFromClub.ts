import { ObjectId } from "mongodb";
import { db } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";
import addErrorLog from "../helpers/addErrorLog.js";

type Props = {
  userId: string;
};

export default async function removeFromClub({ userId }: Props) {
  try {
    await doWithRetries({
      functionName: "removeFromClub - unset club",
      functionToExecute: async () =>
        db
          .collection("User")
          .updateOne({ _id: new ObjectId(userId) }, { $unset: { club: null } }),
    });

    await doWithRetries({
      functionName: "removeFromClub - change privacy",
      functionToExecute: async () =>
        db
          .collection("Proof")
          .updateMany(
            { _id: new ObjectId(userId) },
            { $set: { isPublic: false } }
          ),
    });

    /* if the user is being tracked by someone assign another random user to the someone */
    const randomClubUser = await doWithRetries({
      functionName: "removeFromClub - get a random user",
      functionToExecute: () =>
        db.collection("User").findOne({ "club.isActive": true }),
    });

    await doWithRetries({
      functionName: "removeFromClub - update someone",
      functionToExecute: async () =>
        db
          .collection("User")
          .updateMany(
            { "club.trackedUserId": userId },
            { $set: { "club.trackedUserId": randomClubUser._id } }
          ),
    });
  } catch (error) {
    addErrorLog({ message: error.message, functionName: "removeFromClub" });
    throw error;
  }
}
