-- CepFinans Supabase Database Schema
-- Bu script'i Supabase SQL Editor'da çalıştırın

-- 1. Profiles Table (Kullanıcı profilleri)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. User Data Table (Kullanıcının finansal verileri)
CREATE TABLE IF NOT EXISTS public.user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('accounts', 'transactions', 'recurring_transactions', 'notes', 'settings')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, data_type)
);

-- 3. Functions for automatic updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Triggers for updated_at
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_user_data_updated_at
  BEFORE UPDATE ON public.user_data
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User Data RLS Policies
CREATE POLICY "Users can view own data"
  ON public.user_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON public.user_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON public.user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON public.user_data FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_type ON public.user_data(data_type);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 7. Storage for avatars (opsiyonel)
-- Storage bucket'ları manuel olarak oluşturmanız gerekebilir
-- Supabase Dashboard > Storage > Policies bölümünden aşağıdaki politikaları ekleyin:

-- Bucket oluşturma (manuel olarak yapın):
-- 1. Supabase Dashboard > Storage
-- 2. "New bucket" tıklayın
-- 3. Name: "avatars"
-- 4. Public: true
-- 5. File size limit: 1048576 (1MB)
-- 6. Allowed MIME types: image/png, image/jpeg, image/gif, image/webp

-- Bucket oluşturma SQL komutu:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars (bucket oluşturduktan sonra çalıştırın):
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own avatar"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Alternatif olarak daha basit policy (tüm authenticated kullanıcılar kendi avatarlarını yönetebilir):
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can manage own avatars"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR name LIKE auth.uid()::text || '%')
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.role() = 'authenticated' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR name LIKE auth.uid()::text || '%')
  );

-- 8. Sample data structure for user_data
-- Bu, verilerin nasıl saklanacağını gösteren örneklerdir:

-- Accounts data örneği:
-- {
--   "cash": { balance: 1000, currency: "TRY" },
--   "bank": { balance: 5000, currency: "TRY" },
--   "savings": { balance: 2000, currency: "TRY" }
-- }

-- Transactions data örneği:
-- [
--   {
--     "id": "uuid",
--     "type": "income",
--     "amount": 1000,
--     "category": "Maaş",
--     "account": "bank",
--     "description": "Aylık maaş",
--     "date": "2025-01-15"
--   }
-- ]

-- Recurring transactions data örneği:
-- [
--   {
--     "id": "uuid",
--     "type": "expense",
--     "amount": 1500,
--     "category": "Kira",
--     "account": "bank",
--     "frequency": "monthly",
--     "dayOfMonth": 1,
--     "description": "Ev kirası",
--     "startDate": "2025-01-01"
--   }
-- ]

-- Notes data örneği:
-- [
--   {
--     "id": "uuid",
--     "content": "Finansal hedefler...",
--     "tags": ["hedef", "2025"],
--     "createdAt": "2025-01-15T10:00:00Z"
--   }
-- ]

-- Settings data örneği:
-- {
--   "currency": "TRY",
--   "language": "tr",
--   "theme": "light",
--   "notifications": true,
--   "autoBackup": true
-- }