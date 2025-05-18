import * as dotenv from "dotenv";
dotenv.config();

import Stripe from "stripe";
import { MongoClient } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const client = new MongoClient(process.env.DATABASE_URI);
const userDb = client.db(process.env.DATABASE_NAME);
const adminDb = client.db(process.env.ADMIN_DATABASE_NAME);

export { client, stripe, userDb, adminDb };
