
-- First, drop the existing RLS policies that depend on is_super_admin
DROP POLICY IF EXISTS "Allow super admins to insert users" ON users;
DROP POLICY IF EXISTS "Allow super admins to update users" ON users;
DROP POLICY IF EXISTS "Allow super admins to delete users" ON users;
DROP POLICY IF EXISTS "Allow super admins to select users" ON users;

-- Create enum for the three roles
CREATE TYPE user_role AS ENUM ('super_admin', 'supervisor', 'employee');

-- Add role column to users table and remove is_super_admin
ALTER TABLE users 
ADD COLUMN role user_role NOT NULL DEFAULT 'employee',
DROP COLUMN is_super_admin;

-- Update existing users to have super_admin role (assuming current super admins)
UPDATE users SET role = 'super_admin' WHERE username = 'ahmedsayed';

-- Create new RLS policies using the role column
CREATE POLICY "Allow super admins full access" 
  ON users 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Allow users to read their own data
CREATE POLICY "Users can read own data" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (id = auth.uid());
