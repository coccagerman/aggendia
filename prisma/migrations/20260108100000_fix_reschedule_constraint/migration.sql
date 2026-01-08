-- Fix: Change anti double-booking constraint to only consider SCHEDULED appointments
-- RESCHEDULED appointments should NOT block their original slot (the slot was moved)
-- This allows the original time slot to be available for new bookings after rescheduling

-- Drop the existing constraint
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_no_overlap";

-- Recreate with only SCHEDULED status (not RESCHEDULED)
-- When an appointment is rescheduled:
-- 1. Original appointment becomes RESCHEDULED -> its slot is now FREE
-- 2. New appointment is SCHEDULED -> it blocks the new slot
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_no_overlap"
    EXCLUDE USING gist (
        "resourceId" WITH =,
        tstzrange("startAt", "occupiedEndAt", '[)') WITH &&
    ) WHERE (status = 'SCHEDULED');
