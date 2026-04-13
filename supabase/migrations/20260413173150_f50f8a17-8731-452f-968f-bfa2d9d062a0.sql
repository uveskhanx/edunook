
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  keywords TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chats table
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tests table
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create test_attempts table
CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Courses policies
CREATE POLICY "Published courses viewable by everyone" ON public.courses FOR SELECT USING (is_published = true OR auth.uid() = user_id);
CREATE POLICY "Users can create courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own courses" ON public.courses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own courses" ON public.courses FOR DELETE USING (auth.uid() = user_id);

-- Videos policies
CREATE POLICY "Videos viewable for published courses" ON public.videos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = videos.course_id AND (courses.is_published = true OR courses.user_id = auth.uid()))
);
CREATE POLICY "Course owners can manage videos" ON public.videos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = videos.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Course owners can update videos" ON public.videos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = videos.course_id AND courses.user_id = auth.uid())
);
CREATE POLICY "Course owners can delete videos" ON public.videos FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.courses WHERE courses.id = videos.course_id AND courses.user_id = auth.uid())
);

-- Chats policies
CREATE POLICY "Users can view own chats" ON public.chats FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.chats FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Tests policies
CREATE POLICY "Tests viewable by everyone" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Users can create tests" ON public.tests FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update own tests" ON public.tests FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete own tests" ON public.tests FOR DELETE USING (auth.uid() = creator_id);

-- Questions policies
CREATE POLICY "Questions viewable by everyone" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Test creators can manage questions" ON public.questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.creator_id = auth.uid())
);
CREATE POLICY "Test creators can update questions" ON public.questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.creator_id = auth.uid())
);
CREATE POLICY "Test creators can delete questions" ON public.questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tests WHERE tests.id = questions.test_id AND tests.creator_id = auth.uid())
);

-- Test attempts policies
CREATE POLICY "Users can view own attempts" ON public.test_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create attempts" ON public.test_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Thumbnails are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "Users can upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update thumbnails" ON storage.objects FOR UPDATE USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Videos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Users can upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update videos" ON storage.objects FOR UPDATE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indexes
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_courses_user_id ON public.courses(user_id);
CREATE INDEX idx_courses_category ON public.courses(category);
CREATE INDEX idx_videos_course_id ON public.videos(course_id);
CREATE INDEX idx_chats_sender ON public.chats(sender_id);
CREATE INDEX idx_chats_receiver ON public.chats(receiver_id);
CREATE INDEX idx_tests_creator ON public.tests(creator_id);
CREATE INDEX idx_questions_test ON public.questions(test_id);
CREATE INDEX idx_test_attempts_user ON public.test_attempts(user_id);
CREATE INDEX idx_test_attempts_test ON public.test_attempts(test_id);
