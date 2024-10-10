import * as dotenv from "dotenv";
dotenv.config();

import path from "path";
import { MongoClient } from "mongodb";
import { fileURLToPath } from "url";

const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db(process.env.DATABASE_NAME);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { client, db, __dirname };
