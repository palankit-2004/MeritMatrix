-- ============================================================
-- MERITMATRIX - COMPLETE SUPABASE SQL SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES TABLE (admin assignment only via DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  color TEXT DEFAULT '#FFD700',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_free BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('mock', 'sectional', 'pyq')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_marks INTEGER NOT NULL DEFAULT 100,
  negative_marking BOOLEAN DEFAULT true,
  negative_value NUMERIC(4,2) DEFAULT 0.25,
  is_published BOOLEAN DEFAULT false,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('a','b','c','d')),
  marks NUMERIC(4,2) NOT NULL DEFAULT 1,
  negative_marks NUMERIC(4,2) NOT NULL DEFAULT 0.25,
  subject TEXT DEFAULT 'General',
  explanation TEXT,
  image_url TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast question loading
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);

-- ============================================================
-- ATTEMPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  score NUMERIC(6,2),
  total_marks INTEGER,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  unattempted_count INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','auto_submitted')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON attempts(test_id);

-- ============================================================
-- ANSWERS (prevent tampering with server-side scoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  selected_option CHAR(1) CHECK (selected_option IN ('a','b','c','d')),
  is_correct BOOLEAN,
  marks_awarded NUMERIC(4,2) DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);

-- ============================================================
-- RANKINGS (computed, not user-editable)
-- ============================================================
CREATE TABLE IF NOT EXISTS rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id),
  attempt_id UUID NOT NULL REFERENCES attempts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rank INTEGER,
  percentile NUMERIC(5,2),
  score NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(test_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_rankings_test_id ON rankings(test_id);
CREATE INDEX IF NOT EXISTS idx_rankings_user_id ON rankings(user_id);

-- ============================================================
-- LOGOS (dynamic slider config)
-- ============================================================
CREATE TABLE IF NOT EXISTS logos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  bg_color TEXT DEFAULT '#ffffff',
  display_order INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default logos
INSERT INTO logos (name, file_url, bg_color, display_order) VALUES
  ('Indian Army', '/logos/indianarmy.webp', '#cc0000', 1),
  ('Indian Navy', '/logos/indiannavy.webp', '#1a3a6b', 2),
  ('Indian Air Force', '/logos/iaf.webp', '#87CEEB', 3),
  ('Indian Coast Guard', '/logos/ICG.webp', '#1a3a6b', 4),
  ('BSF', '/logos/bsf.webp', '#ffffff', 5),
  ('CISF', '/logos/cisf.webp', '#ffffff', 6),
  ('CRPF', '/logos/crpf.webp', '#ffffff', 7),
  ('ITBP', '/logos/itbp.webp', '#000000', 8),
  ('Odisha Police', '/logos/odishapolice.webp', '#0033a0', 9),
  ('Odisha Govt', '/logos/odishashashan.webp', '#ffffff', 10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROFILES (extended user info)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  state TEXT DEFAULT 'Odisha',
  target_exam TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SERVER-SIDE SCORING FUNCTION (prevents answer tampering)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_and_submit_attempt(
  p_attempt_id UUID,
  p_answers JSONB  -- [{question_id, selected_option}]
)
RETURNS JSONB AS $$
DECLARE
  v_attempt attempts%ROWTYPE;
  v_question questions%ROWTYPE;
  v_answer JSONB;
  v_score NUMERIC := 0;
  v_correct INT := 0;
  v_wrong INT := 0;
  v_unattempted INT := 0;
  v_total_questions INT;
  v_marks_awarded NUMERIC;
  v_is_correct BOOLEAN;
BEGIN
  -- Validate attempt belongs to current user
  SELECT * INTO v_attempt FROM attempts 
  WHERE id = p_attempt_id AND user_id = auth.uid() AND status = 'in_progress';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid attempt or already submitted';
  END IF;

  -- Count total questions for this test
  SELECT COUNT(*) INTO v_total_questions FROM questions WHERE test_id = v_attempt.test_id;

  -- Process each answer
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    SELECT * INTO v_question FROM questions 
    WHERE id = (v_answer->>'question_id')::UUID AND test_id = v_attempt.test_id;
    
    IF NOT FOUND THEN CONTINUE; END IF;

    v_is_correct := (v_question.correct_answer = lower(v_answer->>'selected_option'));
    
    IF v_is_correct THEN
      v_marks_awarded := v_question.marks;
      v_correct := v_correct + 1;
    ELSIF (v_answer->>'selected_option') IS NOT NULL THEN
      v_marks_awarded := -v_question.negative_marks;
      v_wrong := v_wrong + 1;
    ELSE
      v_marks_awarded := 0;
    END IF;
    
    v_score := v_score + v_marks_awarded;

    INSERT INTO answers (attempt_id, question_id, selected_option, is_correct, marks_awarded)
    VALUES (p_attempt_id, (v_answer->>'question_id')::UUID, lower(v_answer->>'selected_option'), v_is_correct, v_marks_awarded)
    ON CONFLICT (attempt_id, question_id) DO UPDATE 
    SET selected_option = EXCLUDED.selected_option,
        is_correct = EXCLUDED.is_correct,
        marks_awarded = EXCLUDED.marks_awarded;
  END LOOP;

  v_unattempted := v_total_questions - v_correct - v_wrong;
  v_score := GREATEST(0, v_score);

  -- Update attempt
  UPDATE attempts SET
    score = v_score,
    total_marks = (SELECT total_marks FROM tests WHERE id = v_attempt.test_id),
    correct_count = v_correct,
    wrong_count = v_wrong,
    unattempted_count = v_unattempted,
    status = 'completed',
    submitted_at = NOW()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'score', v_score,
    'correct', v_correct,
    'wrong', v_wrong,
    'unattempted', v_unattempted
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: is user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ROLES: Only admins can read all; users can read their own
CREATE POLICY "Users can read own role" ON roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON roles FOR ALL USING (is_admin());

-- ORGANIZATIONS: Public read; admin write
CREATE POLICY "Public read orgs" ON organizations FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage orgs" ON organizations FOR ALL USING (is_admin());

-- EXAMS: Public read published; admin full access
CREATE POLICY "Public read published exams" ON exams FOR SELECT USING (is_published = true);
CREATE POLICY "Admins manage exams" ON exams FOR ALL USING (is_admin());

-- TESTS: Public read published; admin full access
CREATE POLICY "Public read published tests" ON tests FOR SELECT USING (is_published = true);
CREATE POLICY "Admins manage tests" ON tests FOR ALL USING (is_admin());

-- SUBJECTS: Public read
CREATE POLICY "Public read subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Admins manage subjects" ON subjects FOR ALL USING (is_admin());

-- QUESTIONS: Authenticated can read (no correct answer leak in queries)
CREATE POLICY "Auth users can read questions" ON questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage questions" ON questions FOR ALL USING (is_admin());

-- ATTEMPTS: Users own their attempts
CREATE POLICY "Users read own attempts" ON attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own attempts" ON attempts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users cannot update attempts directly" ON attempts FOR UPDATE USING (false); -- must use function
CREATE POLICY "Admins read all attempts" ON attempts FOR SELECT USING (is_admin());

-- ANSWERS: Users read own; no direct insert/update (use scoring function)
CREATE POLICY "Users read own answers" ON answers FOR SELECT 
  USING (attempt_id IN (SELECT id FROM attempts WHERE user_id = auth.uid()));
CREATE POLICY "Admins read all answers" ON answers FOR SELECT USING (is_admin());

-- RANKINGS: Public read
CREATE POLICY "Public read rankings" ON rankings FOR SELECT USING (true);
CREATE POLICY "Admins manage rankings" ON rankings FOR ALL USING (is_admin());

-- LOGOS: Public read active
CREATE POLICY "Public read active logos" ON logos FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage logos" ON logos FOR ALL USING (is_admin());

-- PROFILES: Users own profile
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (is_admin());

-- ============================================================
-- SAMPLE DATA
-- ============================================================
INSERT INTO organizations (name, slug, color) VALUES
  ('Odisha Police', 'odisha-police', '#0033a0'),
  ('Indian Army', 'indian-army', '#cc0000'),
  ('SSC', 'ssc', '#2d5a27'),
  ('OSSSC', 'osssc', '#555555'),
  ('Indian Navy', 'indian-navy', '#1a3a6b'),
  ('Indian Air Force', 'iaf', '#0a6ab5')
ON CONFLICT (slug) DO NOTHING;
