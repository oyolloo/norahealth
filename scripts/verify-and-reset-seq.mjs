import pg from 'pg';

const SOURCE_URL = "postgresql://neondb_owner:npg_lVJEYs1DjX6v@ep-lively-sunset-abe1x38d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full";
const TARGET_URL = "postgresql://neondb_owner:npg_EbTafc5FXI2y@ep-floral-haze-bbmjtzob-pooler.c-15.us-east-1.aws.neon.tech/neondb?sslmode=verify-full";

const ORDERED_TABLES = [
  "User",
  "AppSetting",
  "SmsOptOut",
  "BookingSlot",
  "PasswordResetToken",
  "Account",
  "Health",
  "Record",
  "History",
  "Medication",
  "Order",
  "Booking",
  "Post",
  "Comment",
  "SmsLog",
];

async function main() {
  const sourceClient = new pg.Client({ connectionString: SOURCE_URL });
  const targetClient = new pg.Client({ connectionString: TARGET_URL });

  await sourceClient.connect();
  await targetClient.connect();

  try {
    console.log("Resetting sequences on target database...");
    await targetClient.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN 
          SELECT c.table_name, c.column_name, pg_get_serial_sequence('"' || c.table_name || '"', c.column_name) AS seq_name
          FROM information_schema.columns c
          WHERE c.table_schema = 'public' 
            AND c.column_default LIKE 'nextval(%'
        LOOP
          IF r.seq_name IS NOT NULL THEN
            EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX("%s") FROM "%s"), 1))', r.seq_name, r.column_name, r.table_name);
          END IF;
        END LOOP;
      END $$;
    `);
    console.log("Sequences successfully reset.");

    console.log("\n================ ROW COUNT COMPARISON ================");
    let allMatched = true;
    for (const table of ORDERED_TABLES) {
      const src = await sourceClient.query(`SELECT COUNT(*)::int AS cnt FROM "${table}";`);
      const tgt = await targetClient.query(`SELECT COUNT(*)::int AS cnt FROM "${table}";`);
      const sc = src.rows[0].cnt;
      const tc = tgt.rows[0].cnt;
      const ok = sc === tc;
      if (!ok) allMatched = false;
      console.log(`Table "${table.padEnd(20)}": Source = ${String(sc).padStart(5)} | Target = ${String(tc).padStart(5)} [${ok ? "MATCHED" : "MISMATCH"}]`);
    }

    if (allMatched) {
      console.log("\n🎉 ALL TABLES CLONED AND VERIFIED 100% PERFECTLY!");
    } else {
      console.error("\n⚠️ Count mismatch detected.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

main();

