-- =====================================================
-- PERBAIKAN LENGKAP: In-App Notification + Email ke IT Support
-- Jalankan seluruh file ini di Supabase SQL Editor
-- =====================================================

-- =========================================
-- BAGIAN 1: PERBAIKI TRIGGER IN-APP NOTIFIKASI
-- (Fix: null user_id karena salah ambil ID)
-- =========================================

CREATE OR REPLACE FUNCTION notify_in_app_on_kv_change()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  status_label TEXT;
  ticket_user_id UUID;
BEGIN
  IF NEW.key LIKE 'ticket_%' THEN

    -- TIKET BARU: Beri notif ke semua IT Support
    IF TG_OP = 'INSERT' THEN
      INSERT INTO notifications (user_id, title, body, type, ticket_id)
      SELECT
        au.id,  -- Gunakan au.id langsung, bukan dari metadata
        'Tiket Baru Masuk',
        'Tiket baru dari pengguna telah masuk dan menunggu penanganan.',
        'info',
        NEW.value->>'id'
      FROM auth.users au
      WHERE au.raw_user_meta_data->>'role' = 'support';

    -- STATUS BERUBAH: Beri notif ke User pemilik tiket
    ELSIF TG_OP = 'UPDATE' THEN
      old_status := OLD.value->>'status';
      new_status := NEW.value->>'status';

      IF old_status IS DISTINCT FROM new_status THEN
        -- Ambil user_id dari field userId di JSONB value
        ticket_user_id := (NEW.value->>'userId')::uuid;

        status_label := CASE new_status
          WHEN 'open'        THEN 'Menunggu'
          WHEN 'in-progress' THEN 'Sedang Diproses'
          WHEN 'resolved'    THEN 'Selesai'
          WHEN 'closed'      THEN 'Ditutup'
          ELSE new_status
        END;

        INSERT INTO notifications (user_id, title, body, type, ticket_id)
        VALUES (
          ticket_user_id,
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

-- Pastikan trigger terpasang
DROP TRIGGER IF EXISTS on_kv_ticket_changed ON kv_store_688b6236;
CREATE TRIGGER on_kv_ticket_changed
  AFTER INSERT OR UPDATE ON kv_store_688b6236
  FOR EACH ROW EXECUTE FUNCTION notify_in_app_on_kv_change();


-- =========================================
-- BAGIAN 2: PERBAIKI TRIGGER EMAIL
-- (Fix: operator does not exist: text ->> unknown)
-- =========================================

CREATE OR REPLACE FUNCTION trigger_email_on_kv_change()
RETURNS TRIGGER AS $$
DECLARE
  user_email      TEXT;
  support_email   TEXT;
  req_id          BIGINT;
  old_status      TEXT;
  new_status      TEXT;
  ticket_id_val   TEXT;
  ticket_desc     TEXT;
  support_record  RECORD;
  resend_url      TEXT := 'https://api.resend.com/emails';
  resend_api_key  TEXT := 'YOUR_RESEND_API_KEY';
BEGIN
  -- Hanya proses key tiket
  IF NEW.key NOT LIKE 'ticket_%' THEN
    RETURN NEW;
  END IF;

  ticket_id_val := NEW.value->>'id';
  ticket_desc   := COALESCE(NEW.value->>'description', '(tidak ada deskripsi)');

  -- TIKET BARU: Kirim email ke User & semua IT Support
  IF TG_OP = 'INSERT' THEN
    -- Ambil email user pembuat tiket
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = (NEW.value->>'userId')::uuid;

    -- Kirim email konfirmasi ke User
    IF user_email IS NOT NULL THEN
      SELECT net.http_post(
        url    := resend_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || resend_api_key
        ),
        body   := jsonb_build_object(
          'from',    'IT Helpdesk <onboarding@resend.dev>',
          'to',      user_email,
          'subject', 'IT Helpdesk: Tiket #' || ticket_id_val || ' Telah Diterima',
          'html',    '<p>Tiket Anda dengan ID <strong>#' || ticket_id_val || '</strong> telah diterima dan sedang menunggu penanganan.</p><p>Detail: ' || ticket_desc || '</p>'
        )
      ) INTO req_id;
    END IF;

    -- Kirim email notifikasi ke semua IT Support
    FOR support_record IN
      SELECT email FROM auth.users WHERE raw_user_meta_data->>'role' = 'support'
    LOOP
      SELECT net.http_post(
        url    := resend_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || resend_api_key
        ),
        body   := jsonb_build_object(
          'from',    'IT Helpdesk <onboarding@resend.dev>',
          'to',      support_record.email,
          'subject', '[SUPPORT] Tiket Baru Masuk: #' || ticket_id_val,
          'html',    '<p>Halo Tim IT Support,</p><p>Ada tiket baru masuk: <strong>#' || ticket_id_val || '</strong></p><p>Detail keluhan:<br>' || ticket_desc || '</p><p>Silakan login ke sistem untuk menangani tiket ini.</p>'
        )
      ) INTO req_id;
    END LOOP;

  -- STATUS BERUBAH: Kirim email update ke User
  ELSIF TG_OP = 'UPDATE' THEN
    old_status := OLD.value->>'status';
    new_status := NEW.value->>'status';

    IF old_status IS DISTINCT FROM new_status THEN
      SELECT email INTO user_email
      FROM auth.users
      WHERE id = (NEW.value->>'userId')::uuid;

      IF user_email IS NOT NULL THEN
        SELECT net.http_post(
          url    := resend_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || resend_api_key
          ),
          body   := jsonb_build_object(
            'from',    'IT Helpdesk <onboarding@resend.dev>',
            'to',      user_email,
            'subject', 'IT Helpdesk: Update Status Tiket #' || ticket_id_val,
            'html',    '<p>Status tiket Anda <strong>#' || ticket_id_val || '</strong> telah berubah menjadi <strong>' || new_status || '</strong>.</p>'
          )
        ) INTO req_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pastikan trigger terpasang
DROP TRIGGER IF EXISTS on_kv_ticket_email ON kv_store_688b6236;
CREATE TRIGGER on_kv_ticket_email
  AFTER INSERT OR UPDATE ON kv_store_688b6236
  FOR EACH ROW EXECUTE FUNCTION trigger_email_on_kv_change();
