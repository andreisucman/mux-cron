import * as dotenv from "dotenv";
dotenv.config();

import Stripe from "stripe";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.DATABASE_URI);
const db = client.db(process.env.DATABASE_NAME);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export { client, db, stripe };
