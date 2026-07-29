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
