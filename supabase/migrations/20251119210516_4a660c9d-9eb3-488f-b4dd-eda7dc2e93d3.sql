-- Step 1: Make category nullable first
ALTER TABLE products 
ALTER COLUMN category DROP NOT NULL;

-- Step 2: Update invalid category references to NULL
UPDATE products 
SET category = NULL 
WHERE category NOT IN (SELECT id::text FROM categories);

-- Step 3: Change the category column from text to uuid
ALTER TABLE products 
ALTER COLUMN category TYPE uuid USING category::uuid;

-- Step 4: Add foreign key constraint
ALTER TABLE products
ADD CONSTRAINT products_category_fkey 
FOREIGN KEY (category) 
REFERENCES categories(id) 
ON DELETE SET NULL;

-- Step 5: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);