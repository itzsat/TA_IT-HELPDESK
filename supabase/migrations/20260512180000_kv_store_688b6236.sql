-- Storage used by Edge Function `make-server-688b6236`

-- 1. Tabel KV Store (untuk menyimpan data sementara)
CREATE TABLE IF NOT EXISTS public.kv_store_688b6236 (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kv_store_688b6236_key_prefix 
ON kv_store_688b6236 USING btree (key text_pattern_ops);

ALTER TABLE public.kv_store_688b6236 ENABLE ROW LEVEL SECURITY;

-- Policy: Edge Function pakai service_role, bypass RLS
REVOKE ALL ON public.kv_store_688b6236 FROM anon, authenticated;

-- 2. Tabel Symptoms (gejala masalah IT)
CREATE TABLE IF NOT EXISTS public.symptoms (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read symptoms" ON symptoms
  FOR SELECT TO anon, authenticated USING (true);
  
CREATE POLICY "Service role can manage symptoms" ON symptoms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Tabel Damages (kerusakan/masalah)
CREATE TABLE IF NOT EXISTS public.damages (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.damages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read damages" ON damages
  FOR SELECT TO anon, authenticated USING (true);
  
CREATE POLICY "Service role can manage damages" ON damages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Tabel Rules (aturan inferensi)
CREATE TABLE IF NOT EXISTS public.rules (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  damage_code TEXT REFERENCES damages(code),
  symptom_codes TEXT[] NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read rules" ON rules
  FOR SELECT TO anon, authenticated USING (true);
  
CREATE POLICY "Service role can manage rules" ON rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Tabel Solutions (solusi untuk masalah)
CREATE TABLE IF NOT EXISTS public.solutions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  damage_code TEXT REFERENCES damages(code),
  description TEXT NOT NULL,
  steps JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read solutions" ON solutions
  FOR SELECT TO anon, authenticated USING (true);
  
CREATE POLICY "Service role can manage solutions" ON solutions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Insert data contoh (optional, untuk testing)
INSERT INTO damages (code, name, description) VALUES
  ('DMG001', 'Email Access Issue', 'Cannot access email account'),
  ('DMG002', 'Performance Issue', 'Computer running slow'),
  ('DMG003', 'Printer Connection Issue', 'Printer not responding')
ON CONFLICT (code) DO NOTHING;

INSERT INTO symptoms (code, name, category) VALUES
  ('SYM001', 'Cannot access email', 'Email'),
  ('SYM002', 'Computer is slow', 'Performance'),
  ('SYM003', 'Cannot print', 'Hardware')
ON CONFLICT (code) DO NOTHING;

INSERT INTO rules (code, damage_code, symptom_codes) VALUES
  ('RULE001', 'DMG001', ARRAY['SYM001']),
  ('RULE002', 'DMG002', ARRAY['SYM002']),
  ('RULE003', 'DMG003', ARRAY['SYM003'])
ON CONFLICT (code) DO NOTHING;

INSERT INTO solutions (code, damage_code, description) VALUES
  ('SOL001', 'DMG001', 'Reset your password at company.com/reset'),
  ('SOL002', 'DMG002', 'Close unnecessary background applications'),
  ('SOL003', 'DMG003', 'Check printer connection and restart')
ON CONFLICT (code) DO NOTHING;