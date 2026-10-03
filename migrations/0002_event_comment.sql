-- Add optional comment to ticket_events for mandatory status change updates and audit notes.
ALTER TABLE ticket_events ADD COLUMN comment TEXT;
