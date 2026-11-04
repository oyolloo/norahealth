import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();

  // Find any order or account or booking for 1325
  const orders = await client.query('SELECT * FROM "Order" WHERE "userId" = 1325');
  console.log('Orders for 1325 count:', orders.rows.length);

  // Check bookings for 1325
  const bookings = await client.query('SELECT * FROM "Booking" WHERE "userId" = 1325');
  console.log('Bookings for 1325 count:', bookings.rows.length);

  // If no order exists, let's create a test order for user 1325 so they can test
  const totalOrders = await client.query('SELECT id, "userId", "medicineName", "createdAt" FROM "Order" ORDER BY id DESC LIMIT 5');
  console.log('Recent 5 orders in DB:', totalOrders.rows);

  await client.end();
}

run().catch(console.error);

