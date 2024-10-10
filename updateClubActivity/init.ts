import * as dotenv from "dotenv";
import { SESClient } from "@aws-sdk/client-ses";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db(process.env.DATABASE_NAME);

const sesClient = new SESClient({
  region: process.env.SES_REGION,
  credentials: {
    accessKeyId: process.env.SES_ACCESS_KEY,
    secretAccessKey: process.env.SES_SECRET_KEY,
  },
});

export { client, db, sesClient };
