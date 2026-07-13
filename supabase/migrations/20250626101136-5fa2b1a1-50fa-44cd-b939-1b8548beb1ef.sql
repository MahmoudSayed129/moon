
-- Create a custom users table for our authentication system
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert the super admin user (password will be hashed in the application)
INSERT INTO public.users (username, password_hash, is_super_admin) 
VALUES ('ahmedsayed', '$2b$10$placeholder_hash', true);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy for super admin to manage all users
CREATE POLICY "Super admin can manage all users" 
  ON public.users 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.username = current_setting('app.current_user', true) 
      AND u.is_super_admin = true
    )
  );

-- Create policy for users to read their own data
CREATE POLICY "Users can read their own data" 
  ON public.users 
  FOR SELECT 
  USING (username = current_setting('app.current_user', true));
