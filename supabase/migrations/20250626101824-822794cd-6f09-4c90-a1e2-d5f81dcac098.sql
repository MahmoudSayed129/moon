
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Super admin can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;

-- Create simpler policies that don't cause recursion
-- Allow all authenticated users to read from users table (we'll handle permissions in the app)
CREATE POLICY "Allow authenticated read access" 
  ON public.users 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow all authenticated users to insert (we'll handle permissions in the app)
CREATE POLICY "Allow authenticated insert access" 
  ON public.users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Allow all authenticated users to update (we'll handle permissions in the app)
CREATE POLICY "Allow authenticated update access" 
  ON public.users 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Allow all authenticated users to delete (we'll handle permissions in the app)
CREATE POLICY "Allow authenticated delete access" 
  ON public.users 
  FOR DELETE 
  TO authenticated 
  USING (true);
