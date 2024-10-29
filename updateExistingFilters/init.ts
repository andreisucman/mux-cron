import * as dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.DATABASE_URI!);
const db = client.db(process.env.DATABASE_NAME);

export { client, db };
