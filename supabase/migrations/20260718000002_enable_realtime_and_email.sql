-- =====================================================
-- MIGRATION: Enable Realtime & Email Webhooks
-- =====================================================

-- 1. MENGAKTIFKAN REALTIME UNTUK TABEL NOTIFICATIONS
-- Agar frontend React menerima broadcast pesan (ikon lonceng)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 2. MENGAKTIFKAN EKSTENSI PG_NET
-- Digunakan untuk melakukan HTTP request (memanggil Edge Function) dari dalam Database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. TRIGGER UNTUK MEMANGGIL EDGE FUNCTION (EMAIL TIKET BARU)
CREATE OR REPLACE FUNCTION trigger_email_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := current_setting('request.headers')::json->>'origin' || '/functions/v1/send-email';
  anon_key TEXT := current_setting('request.jwt.claim.role'); -- Simplifikasi untuk anon key
  user_email TEXT;
  req_id BIGINT;
BEGIN
  -- Dapatkan email user pembuat tiket
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;

  -- Panggil Edge Function menggunakan pg_net
  SELECT net.http_post(
      url:='https://pdeompiprsszupbietfh.supabase.co/functions/v1/send-email',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.headers')::json->>'apikey' || '"}'::jsonb,
      body:=json_build_object(
        'to', user_email,
        'subject', 'IT Helpdesk: Tiket Baru #' || NEW.id || ' Telah Diterima',
        'html', '<p>Halo,</p><p>Tiket baru dengan ID <strong>#' || NEW.id || '</strong> telah kami terima dan sedang menunggu penanganan IT Support.</p><p>Detail masalah:<br>' || NEW.description || '</p>'
      )::jsonb
  ) INTO req_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mendaftarkan trigger ke tabel tickets (saat insert)
DROP TRIGGER IF EXISTS on_ticket_created_email ON tickets;
CREATE TRIGGER on_ticket_created_email
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION trigger_email_on_new_ticket();

-- 4. TRIGGER UNTUK MEMANGGIL EDGE FUNCTION (UPDATE STATUS TIKET)
CREATE OR REPLACE FUNCTION trigger_email_on_ticket_update()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  req_id BIGINT;
BEGIN
  -- Hanya kirim email jika status berubah
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;

    SELECT net.http_post(
        url:='https://pdeompiprsszupbietfh.supabase.co/functions/v1/send-email',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.headers')::json->>'apikey' || '"}'::jsonb,
        body:=json_build_object(
          'to', user_email,
          'subject', 'IT Helpdesk: Update Status Tiket #' || NEW.id,
          'html', '<p>Halo,</p><p>Status tiket Anda dengan ID <strong>#' || NEW.id || '</strong> telah berubah menjadi <strong>' || NEW.status || '</strong>.</p>'
        )::jsonb
    ) INTO req_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mendaftarkan trigger ke tabel tickets (saat update)
DROP TRIGGER IF EXISTS on_ticket_updated_email ON tickets;
CREATE TRIGGER on_ticket_updated_email
  AFTER UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION trigger_email_on_ticket_update();
