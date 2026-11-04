import 'dotenv/config';
import pg from 'pg';
import { generateBpToken } from '../lib/bpToken.js';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();

  // Find user 1325
  const userRes = await client.query('SELECT u.id, u.email, a."firstName", a."lastName", a."phoneNumber" FROM "User" u LEFT JOIN "Account" a ON a."userId" = u.id WHERE u.id = 1325');
  const user = userRes.rows[0];
  console.log('User 1325:', user);

  // Check existing orders
  let orderRes = await client.query('SELECT id, "status", "futureApptAt", "needsBpCheck", "medicineName" FROM "Order" WHERE "userId" = 1325 ORDER BY id DESC LIMIT 1');
  let order = orderRes.rows[0];

  if (!order) {
    console.log('No order found for user 1325. Creating a test order with Type B medicine...');
    // Create futureApptAt 28 days from now
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + 28);

    const newOrder = await client.query(
      `INSERT INTO "Order" ("userId", "medicineName", "trackingId", "status", "needsBpCheck", "futureApptDays", "futureApptAt", "futureApptTime", "createdAt")
       VALUES ($1, $2, $3, 'clinicalreview', true, 28, $4, 'Morning (09:00 - 12:00)', NOW())
       RETURNING id, "status", "futureApptAt", "needsBpCheck", "medicineName"`,
      [1325, 'Desogestrel 75mcg (Type B)', 'NH-TEST-1325', reviewDate]
    );
    order = newOrder.rows[0];
    console.log('Created order:', order);
  } else {
    console.log('Existing order found:', order);
    await client.query('UPDATE "Order" SET "needsBpCheck" = true WHERE id = $1', [order.id]);
  }

  // Create a brand new pending BpReading token for this test
  const token = generateBpToken(8);
  const bpRes = await client.query(
    `INSERT INTO "BpReading" ("token", "userId", "orderId", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'pending', NOW(), NOW())
     RETURNING id, token, status, "createdAt"`,
    [token, 1325, order.id]
  );
  console.log('Created BpReading record:', bpRes.rows[0]);

  console.log('--- TEST DETAILS ---');
  console.log('Order ID:', order.id);
  console.log('Medicine:', order.medicineName);
  console.log('Token:', token);
  console.log('Local Link:', `http://localhost:3000/bp/${token}`);
  console.log('Live Link:', `https://norahealth.co.uk/bp/${token}`);
  console.log('Admin Patient Orders Page:', `http://localhost:3000/admin/1325/account#orders`);
  console.log('--------------------');

  await client.end();
}

run().catch(console.error);
