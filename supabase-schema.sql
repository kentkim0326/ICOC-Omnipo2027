-- ============================================================
-- ICOC OMNIPO — Supabase DB 스키마
-- Supabase → SQL Editor 에서 이 파일 내용을 복사해 실행하세요.
-- ============================================================

-- 1. 프로필 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  nickname     TEXT UNIQUE NOT NULL,
  country      TEXT NOT NULL,          -- 이후 변경 불가 (앱 레벨에서 제한)
  city         TEXT DEFAULT '',
  district     TEXT DEFAULT '',        -- 구/군
  dong         TEXT DEFAULT '',        -- 동
  generation   TEXT NOT NULL,          -- 10대/20대/...
  main_sports  TEXT[] DEFAULT '{}',
  avatar_url   TEXT DEFAULT '',
  points       INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 게임 전적 테이블
CREATE TABLE IF NOT EXISTS game_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport       TEXT NOT NULL,
  wins        INTEGER DEFAULT 0,
  losses      INTEGER DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, sport)
);

-- 3. 채팅 메시지 테이블 (지역·세대·종목별)
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL,   -- 예: "seoul-강남구-바둑" / "30대-전국" / "hearts-global"
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_room ON chat_messages(room_id, created_at DESC);

-- 4. 장소 테이블 (경기장·기원·보드카페 등)
CREATE TABLE IF NOT EXISTS venues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,   -- 기원/보드카페/당구장/볼링장/스크린골프장/파크골프장/기타
  address     TEXT NOT NULL,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  country     TEXT DEFAULT '대한민국',
  city        TEXT,
  sports      TEXT[] DEFAULT '{}',
  registered_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_venues_location ON venues(lat, lng);

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues        ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 모두 읽기 가능
CREATE POLICY "profiles_read_all"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- game_records: 본인만 수정, 모두 읽기
CREATE POLICY "records_read_all"   ON game_records FOR SELECT USING (true);
CREATE POLICY "records_write_own"  ON game_records FOR ALL USING (auth.uid() = user_id);

-- chat_messages: 로그인 사용자만 쓰기, 모두 읽기
CREATE POLICY "chat_read_all"      ON chat_messages FOR SELECT USING (true);
CREATE POLICY "chat_insert_auth"   ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- venues: 로그인 사용자 등록, 모두 읽기
CREATE POLICY "venues_read_all"    ON venues FOR SELECT USING (true);
CREATE POLICY "venues_insert_auth" ON venues FOR INSERT WITH CHECK (auth.uid() = registered_by);

-- ============================================================
-- Realtime 활성화 (채팅용)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================================
-- 설정 완료 후:
-- 1. Supabase → Authentication → Providers → Google 활성화
-- 2. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
-- 3. js/config.js 에 SUPABASE_URL, SUPABASE_ANON_KEY 입력
-- ============================================================
