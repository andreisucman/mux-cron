import doWithRetries from "../helpers/doWithRetries.js";
export default async function executeInBatches({ promises, batchSize, }) {
    const results = [];
    for (let i = 0; i < promises.length; i += batchSize) {
        const batch = promises.slice(i, i + batchSize);
        const batchResults = await doWithRetries(async () => Promise.all(batch));
        results.push(...batchResults);
    }
    return results;
}
