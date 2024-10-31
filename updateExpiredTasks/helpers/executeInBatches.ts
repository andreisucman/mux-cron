import doWithRetries from "./doWithRetries";

type ExecuteInBatchesProps = {
  promises: Promise<any>[];
  batchSize: number;
};

export default async function executeInBatches({
  promises,
  batchSize,
}: ExecuteInBatchesProps) {
  const results = [];
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    const batchResults = await doWithRetries({
      functionName: "executeInBatches",
      functionToExecute: async () => Promise.all(batch),
    });
    results.push(...batchResults);
  }
  return results;
}
