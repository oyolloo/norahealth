-- CC-10: Future Appt on orders. Additive, nullable.
ALTER TABLE "Order" ADD COLUMN "futureApptAt" TIMESTAMP(3),
ADD COLUMN "futureApptDays" INTEGER,
ADD COLUMN "futureApptTime" TEXT;
