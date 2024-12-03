import * as dotenv from "dotenv";
dotenv.config();

import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.DATABASE_URI!);
const db = client.db(process.env.DATABASE_NAME);

export { client, db };
