-- =====================================================
-- MIGRATION: Notifications table + triggers
-- Jalankan di Supabase SQL Editor
-- =====================================================

-- 1. Buat tabel notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info',  -- 'info' | 'success' | 'warning'
  is_read BOOLEAN DEFAULT FALSE,
  ticket_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 3. Trigger: Notifikasi ke SEMUA IT Support saat tiket baru dibuat
CREATE OR REPLACE FUNCTION notify_support_new_ticket()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, type, ticket_id)
  SELECT 
    (au.raw_user_meta_data->>'id')::uuid,
    'Tiket Baru Masuk',
    'Tiket baru dari pengguna telah masuk dan menunggu penanganan.',
    'info',
    NEW.id
  FROM auth.users au
  WHERE au.raw_user_meta_data->>'role' = 'support';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_created ON tickets;
CREATE TRIGGER on_ticket_created
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION notify_support_new_ticket();

-- 4. Trigger: Notifikasi ke User saat status tiketnya berubah
CREATE OR REPLACE FUNCTION notify_user_ticket_update()
RETURNS TRIGGER AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    status_label := CASE NEW.status
      WHEN 'open'        THEN 'Menunggu'
      WHEN 'in_progress' THEN 'Sedang Diproses'
      WHEN 'resolved'    THEN 'Selesai'
      WHEN 'closed'      THEN 'Ditutup'
      ELSE NEW.status
    END;

    INSERT INTO notifications (user_id, title, body, type, ticket_id)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'resolved' THEN 'Tiket Anda Selesai ✓' ELSE 'Status Tiket Diperbarui' END,
      'Status tiket Anda telah diperbarui menjadi: ' || status_label,
      CASE WHEN NEW.status = 'resolved' THEN 'success'
           WHEN NEW.status = 'closed'   THEN 'warning'
           ELSE 'info' END,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_updated ON tickets;
CREATE TRIGGER on_ticket_updated
  AFTER UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION notify_user_ticket_update();
