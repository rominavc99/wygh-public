-- Tres recordatorios por boletín (2 h, 1 h y 30 min antes del envío): el
-- registro pasa a ser único por grupo, fecha y anticipación. Lo enviado
-- antes era el de 1 hora.
ALTER TABLE "ReminderSend" ADD COLUMN "minutesBefore" INTEGER NOT NULL DEFAULT 60;
DROP INDEX "ReminderSend_groupId_date_key";
CREATE UNIQUE INDEX "ReminderSend_groupId_date_minutesBefore_key" ON "ReminderSend"("groupId", "date", "minutesBefore");
