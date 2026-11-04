import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function check642() {
  await client.connect();
  const res = await client.query('SELECT id, "futureApptAt"::text as "futureApptAtText", "futureApptDays", "futureApptTime" FROM "Order" WHERE id = 642');
  console.log('Order 642 raw text:', res.rows[0]);
  const resB = await client.query('SELECT id, "appointment"::text as "appointmentText" FROM "Booking" WHERE id = 941');
  console.log('Booking 941 raw text:', resB.rows[0]);
  await client.end();
}

check642().catch(console.error);

