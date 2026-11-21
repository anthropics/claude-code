-- Profiles (public display data, auto-created via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz DEFAULT now()
);

-- User roles (admin / moderator)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- Debate themes (categories)
CREATE TABLE IF NOT EXISTS debate_themes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  description text,
  color       text DEFAULT '#6366f1',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

-- Debates (sessions within a theme)
CREATE TABLE IF NOT EXISTS debates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    uuid NOT NULL REFERENCES debate_themes(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  starts_at   timestamptz DEFAULT now(),
  ends_at     timestamptz,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  is_featured boolean DEFAULT false
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   uuid NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  content     text NOT NULL CHECK (char_length(content) <= 2000),
  parent_id   uuid REFERENCES messages(id),
  is_hidden   boolean DEFAULT false,
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_debate_id ON messages(debate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);

-- Reactions
CREATE TYPE IF NOT EXISTS reaction_type AS ENUM ('like', 'insightful', 'disagree');

CREATE TABLE IF NOT EXISTS reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  type        reaction_type NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, type)
);

-- Reaction counts view
CREATE OR REPLACE VIEW message_reaction_counts AS
SELECT message_id, type, COUNT(*) as count
FROM reactions
GROUP BY message_id, type;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==================== RLS ====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_public_read"  ON user_roles FOR SELECT USING (true);
CREATE POLICY "roles_admin_manage" ON user_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

ALTER TABLE debate_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_public_read" ON debate_themes FOR SELECT USING (is_active = true);
CREATE POLICY "themes_admin_all"   ON debate_themes FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debates_public_read" ON debates FOR SELECT USING (true);
CREATE POLICY "debates_admin_all"   ON debates FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read_visible" ON messages FOR SELECT
  USING (is_hidden = false AND deleted_at IS NULL);
CREATE POLICY "messages_insert_authenticated" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM debates WHERE id = debate_id AND status = 'open')
  );
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  USING (auth.uid() = user_id AND created_at > now() - interval '5 minutes');
CREATE POLICY "messages_admin_all"  ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')));

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_public_read" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_own"  ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete_own"  ON reactions FOR DELETE USING (auth.uid() = user_id);

-- ==================== Realtime ====================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
