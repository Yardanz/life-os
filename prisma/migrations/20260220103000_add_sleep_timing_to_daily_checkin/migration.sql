-- Add sleep timing fields for circadian/regularity modeling.
ALTER TABLE "DailyCheckIn"
ADD COLUMN "bedtimeMinutes" INTEGER,
ADD COLUMN "wakeTimeMinutes" INTEGER;

