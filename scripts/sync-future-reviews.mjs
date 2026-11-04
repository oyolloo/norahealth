import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

function parseTimeWindowHour(timeStr) {
  if (!timeStr) return 9;
  const m = String(timeStr).match(/^(\d{1,2})(am|pm)/i);
  if (!m) return 9;
  let h = parseInt(m[1], 10);
  const ampm = m[2].toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h;
}

async function syncFutureReviews() {
  await client.connect();

  try {
    const query = `
      SELECT 
        o.id as "orderId",
        o."userId",
        o."futureApptAt"::text as "futureApptAtText",
        o."futureApptTime",
        o."futureApptDays",
        o."medicineName",
        u.email,
        a."firstName",
        a."lastName",
        a."phoneNumber",
        b.id as "bookingId"
      FROM "Order" o
      LEFT JOIN "User" u ON o."userId" = u.id
      LEFT JOIN "Account" a ON u.id = a."userId"
      LEFT JOIN "Booking" b ON o.id = b."orderId" AND b."bookingType" = 'Review'
      WHERE o."futureApptAt" IS NOT NULL AND b.id IS NULL
      ORDER BY o.id ASC;
    `;

    const res = await client.query(query);
    console.log(`Found ${res.rowCount} existing orders with futureAppt needing Review Booking.`);

    if (res.rowCount === 0) {
      console.log("Everything is already in sync!");
      return;
    }

    let createdCount = 0;

    for (const row of res.rows) {
      const day = row.futureApptAtText ? row.futureApptAtText.slice(0, 10) : null;
      const hour = parseTimeWindowHour(row.futureApptTime);
      const appointmentStr = `${day} ${String(hour).padStart(2, '0')}:00:00`;
      const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || 'Patient';
      const email = row.email || '';
      const phoneNumber = row.phoneNumber || '';
      const medicine = (row.medicineName || '').trim();
      const notes = `Review: ${row.futureApptTime} (${medicine})`;

      const insertRes = await client.query(
        `
        INSERT INTO "Booking" (
          "orderId",
          "bookingType",
          "bookingStatus",
          "slotId",
          "appointment",
          "fullName",
          "email",
          "phoneNumber",
          "serviceName",
          "providerName",
          "nhsService",
          "notes",
          "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        ) RETURNING id;
        `,
        [
          row.orderId,
          'Review',
          'Incomplete',
          null,
          appointmentStr,
          fullName,
          email,
          phoneNumber,
          'Oral Contraception Review',
          'Nora Health',
          'Free NHS',
          notes
        ]
      );

      console.log(`Created Review Booking ID ${insertRes.rows[0].id} for Order #${row.orderId} (${fullName})`);
      createdCount++;
    }

    // Reset sequence just in case
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('"Booking"', 'id'),
        COALESCE((SELECT MAX(id) FROM "Booking"), 1)
      );
    `);

    console.log(`\nSuccessfully synced ${createdCount} Review Bookings!`);
  } catch (error) {
    console.error("Sync error:", error);
  } finally {
    await client.end();
  }
}

syncFutureReviews();

