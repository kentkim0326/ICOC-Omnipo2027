-- ============================================================
-- ICOC OMNIPO — Supabase 스키마 (wisemom 프로젝트 임시 사용)
-- 테이블명 icoc_ 접두사로 wisemom 테이블과 분리
-- Supabase → SQL Editor에서 실행하세요
-- ============================================================

-- 1. 프로필
CREATE TABLE IF NOT EXISTS icoc_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  nickname     TEXT UNIQUE NOT NULL,
  country      TEXT NOT NULL,
  city         TEXT DEFAULT '',
  district     TEXT DEFAULT '',
  dong         TEXT DEFAULT '',
  generation   TEXT NOT NULL,
  main_sports  TEXT[] DEFAULT '{}',
  avatar_url   TEXT DEFAULT '',
  points       INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 게임 전적
CREATE TABLE IF NOT EXISTS icoc_game_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES icoc_profiles(id) ON DELETE CASCADE,
  sport       TEXT NOT NULL,
  wins        INTEGER DEFAULT 0,
  losses      INTEGER DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, sport)
);

-- 3. 채팅 (지역·세대·종목별)
CREATE TABLE IF NOT EXISTS icoc_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES icoc_profiles(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_icoc_chat_room ON icoc_chat_messages(room_id, created_at DESC);

-- 4. 장소 (기원·보드카페·당구장 등)
CREATE TABLE IF NOT EXISTS icoc_venues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  address       TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  country       TEXT DEFAULT '대한민국',
  city          TEXT,
  sports        TEXT[] DEFAULT '{}',
  registered_by UUID REFERENCES icoc_profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE icoc_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE icoc_game_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE icoc_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE icoc_venues        ENABLE ROW LEVEL SECURITY;

-- 정책
CREATE POLICY "icoc_profiles_read"   ON icoc_profiles FOR SELECT USING (true);
CREATE POLICY "icoc_profiles_insert" ON icoc_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "icoc_profiles_update" ON icoc_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "icoc_records_read"    ON icoc_game_records FOR SELECT USING (true);
CREATE POLICY "icoc_records_write"   ON icoc_game_records FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "icoc_chat_read"       ON icoc_chat_messages FOR SELECT USING (true);
CREATE POLICY "icoc_chat_insert"     ON icoc_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "icoc_venues_read"     ON icoc_venues FOR SELECT USING (true);
CREATE POLICY "icoc_venues_insert"   ON icoc_venues FOR INSERT WITH CHECK (auth.uid() = registered_by);

-- Realtime (채팅용)
ALTER PUBLICATION supabase_realtime ADD TABLE icoc_chat_messages;
