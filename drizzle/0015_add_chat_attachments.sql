-- Adds attachment support (images, files, audio, ...) to chat messages.
ALTER TABLE chat_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE chat_messages ADD COLUMN attachment_url TEXT;
ALTER TABLE chat_messages ADD COLUMN attachment_name TEXT;
ALTER TABLE chat_messages ADD COLUMN attachment_size INTEGER;
ALTER TABLE chat_messages ADD COLUMN mime_type TEXT;

CREATE INDEX IF NOT EXISTS chat_msg_message_type_idx ON chat_messages(message_type);
