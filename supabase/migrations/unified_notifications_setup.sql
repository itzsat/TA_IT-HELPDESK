-- =====================================================
-- UNIFIED MIGRATION: Notifikasi (Lonceng & Email) - REVISI KV STORE
-- =====================================================

-- 1. Buat tabel notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info',  -- 'info' | 'success' | 'warning'
  is_read BOOLEAN DEFAULT FALSE,
  ticket_id TEXT, -- Menggunakan TEXT karena ID tiket dari KV Store adalah string (misal: 'ticket_1234')
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Abaikan error jika policy sudah ada
DO $$ BEGIN
    CREATE POLICY "Users can see own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. MENGAKTIFKAN REALTIME UNTUK TABEL NOTIFICATIONS
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- =====================================================
-- 4. TRIGGER IN-APP NOTIFIKASI
-- =====================================================

CREATE OR REPLACE FUNCTION notify_in_app_on_kv_change()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  status_label TEXT;
BEGIN
  -- HANYA PROSES JIKA KEY ADALAH TIKET
  IF NEW.key LIKE 'ticket_%' THEN
    
    -- JIKA TIKET BARU DIBUAT (INSERT)
    IF TG_OP = 'INSERT' THEN
      INSERT INTO notifications (user_id, title, body, type, ticket_id)
      SELECT 
        (au.raw_user_meta_data->>'id')::uuid,
        'Tiket Baru Masuk',
        'Tiket baru dari pengguna telah masuk dan menunggu penanganan.',
        'info',
        NEW.value->>'id'
      FROM auth.users au
      WHERE au.raw_user_meta_data->>'role' = 'support';
      
    -- JIKA TIKET DIUPDATE (UPDATE)
    ELSIF TG_OP = 'UPDATE' THEN
      old_status := OLD.value->>'status';
      new_status := NEW.value->>'status';
      
      IF old_status IS DISTINCT FROM new_status THEN
        status_label := CASE new_status
          WHEN 'open'        THEN 'Menunggu'
          WHEN 'in-progress' THEN 'Sedang Diproses'
          WHEN 'resolved'    THEN 'Selesai'
          WHEN 'closed'      THEN 'Ditutup'
          ELSE new_status
        END;

        INSERT INTO notifications (user_id, title, body, type, ticket_id)
        VALUES (
          (NEW.value->>'userId')::uuid,
          CASE WHEN new_status = 'resolved' THEN 'Tiket Anda Selesai ✓' ELSE 'Status Tiket Diperbarui' END,
          'Status tiket Anda telah diperbarui menjadi: ' || status_label,
          CASE WHEN new_status = 'resolved' THEN 'success'
               WHEN new_status = 'closed'   THEN 'warning'
               ELSE 'info' END,
          NEW.value->>'id'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_kv_ticket_changed ON kv_store_688b6236;
CREATE TRIGGER on_kv_ticket_changed
  AFTER INSERT OR UPDATE ON kv_store_688b6236
  FOR EACH ROW EXECUTE FUNCTION notify_in_app_on_kv_change();


-- =====================================================
-- 5. PENGATURAN EMAIL (PG_NET)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_email_on_kv_change()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  req_id BIGINT;
  old_status TEXT;
  new_status TEXT;
BEGIN
  IF NEW.key LIKE 'ticket_%' THEN
    
    -- JIKA TIKET BARU DIBUAT (INSERT)
    IF TG_OP = 'INSERT' THEN
      SELECT email INTO user_email FROM auth.users WHERE id = (NEW.value->>'userId')::uuid;

      SELECT net.http_post(
          url:='https://pdeompiprsszupbietfh.supabase.co/functions/v1/send-email',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.headers', true)::json->>'apikey' || '"}'::jsonb,
          body:=json_build_object(
            'to', user_email,
            'subject', 'IT Helpdesk: Tiket Baru #' || (NEW.value->>'id') || ' Telah Diterima',
            'html', '<p>Halo,</p><p>Tiket baru dengan ID <strong>#' || (NEW.value->>'id') || '</strong> telah kami terima dan sedang menunggu penanganan IT Support.</p><p>Detail masalah:<br>' || (NEW.value->>'description') || '</p>'
          )::jsonb
      ) INTO req_id;

    -- JIKA TIKET DIUPDATE (UPDATE)
    ELSIF TG_OP = 'UPDATE' THEN
      old_status := OLD.value->>'status';
      new_status := NEW.value->>'status';
      
      IF old_status IS DISTINCT FROM new_status THEN
        SELECT email INTO user_email FROM auth.users WHERE id = (NEW.value->>'userId')::uuid;

        SELECT net.http_post(
            url:='https://pdeompiprsszupbietfh.supabase.co/functions/v1/send-email',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.headers', true)::json->>'apikey' || '"}'::jsonb,
            body:=json_build_object(
              'to', user_email,
              'subject', 'IT Helpdesk: Update Status Tiket #' || (NEW.value->>'id'),
              'html', '<p>Halo,</p><p>Status tiket Anda dengan ID <strong>#' || (NEW.value->>'id') || '</strong> telah berubah menjadi <strong>' || new_status || '</strong>.</p>'
            )::jsonb
        ) INTO req_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_kv_ticket_email ON kv_store_688b6236;
CREATE TRIGGER on_kv_ticket_email
  AFTER INSERT OR UPDATE ON kv_store_688b6236
  FOR EACH ROW EXECUTE FUNCTION trigger_email_on_kv_change();
