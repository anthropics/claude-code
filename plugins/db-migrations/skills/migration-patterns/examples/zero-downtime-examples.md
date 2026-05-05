# Zero-Downtime Migration Examples

Real-world examples of safe migration patterns.

## Example 1: Adding a Required Column

**Scenario:** Add `phone` column to `users` table that must be NOT NULL.

### Bad Approach (Causes Downtime)

```sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NOT NULL;
-- ERROR: Column cannot be added with NOT NULL without default
```

### Good Approach (Zero Downtime)

```sql
-- Step 1: Add nullable column
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Step 2: Update application to write phone for new users
-- Deploy this change first

-- Step 3: Backfill existing users (in batches)
UPDATE users SET phone = 'UNKNOWN'
WHERE phone IS NULL AND id BETWEEN 1 AND 10000;

UPDATE users SET phone = 'UNKNOWN'
WHERE phone IS NULL AND id BETWEEN 10001 AND 20000;
-- Continue in batches...

-- Step 4: Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```

## Example 2: Renaming a Column

**Scenario:** Rename `userName` to `username` for consistency.

### Bad Approach

```sql
ALTER TABLE users RENAME COLUMN userName TO username;
-- App breaks immediately!
```

### Good Approach (Expand-Contract)

```sql
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN username VARCHAR(255);

-- Step 2: Deploy code that reads from both, writes to both
-- SELECT COALESCE(username, userName) as username FROM users;

-- Step 3: Backfill
UPDATE users SET username = userName WHERE username IS NULL;

-- Step 4: Deploy code that only uses new column

-- Step 5: Drop old column (later, after verification)
ALTER TABLE users DROP COLUMN userName;
```

## Example 3: Changing Column Type

**Scenario:** Change `price` from DECIMAL(10,2) to BIGINT (storing cents).

```sql
-- Step 1: Add new column
ALTER TABLE products ADD COLUMN price_cents BIGINT;

-- Step 2: Create trigger for dual writes (PostgreSQL)
CREATE OR REPLACE FUNCTION sync_price_cents()
RETURNS TRIGGER AS $$
BEGIN
  NEW.price_cents := NEW.price * 100;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_price
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION sync_price_cents();

-- Step 3: Backfill
UPDATE products SET price_cents = price * 100;

-- Step 4: Verify data
SELECT COUNT(*) FROM products WHERE price_cents != price * 100;

-- Step 5: Switch application to use price_cents
-- Step 6: Drop trigger and old column
DROP TRIGGER tr_sync_price ON products;
ALTER TABLE products DROP COLUMN price;
```

## Example 4: Adding a Foreign Key

**Scenario:** Add `organization_id` FK to `users` table.

```sql
-- Step 1: Add nullable column
ALTER TABLE users ADD COLUMN organization_id UUID;

-- Step 2: Add index first (for FK performance)
CREATE INDEX CONCURRENTLY idx_users_organization_id
ON users(organization_id);

-- Step 3: Add FK constraint (without validation for speed)
ALTER TABLE users
ADD CONSTRAINT fk_users_organization
FOREIGN KEY (organization_id)
REFERENCES organizations(id)
NOT VALID;

-- Step 4: Validate existing data in background
ALTER TABLE users
VALIDATE CONSTRAINT fk_users_organization;
```

## Example 5: Large Table Index Creation

**Scenario:** Add index to `orders` table with 100M rows.

### PostgreSQL

```sql
-- Use CONCURRENTLY to avoid blocking
CREATE INDEX CONCURRENTLY idx_orders_created_at
ON orders(created_at);

-- Note: CONCURRENTLY cannot be in a transaction
-- May take hours on large tables but doesn't block reads/writes
```

### MySQL

```sql
-- Online DDL with no locking
ALTER TABLE orders
ADD INDEX idx_orders_created_at (created_at),
ALGORITHM=INPLACE,
LOCK=NONE;
```

## Example 6: Splitting a Table

**Scenario:** Extract `user_profiles` from `users` table.

```sql
-- Step 1: Create new table
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  bio TEXT,
  avatar_url VARCHAR(500),
  website VARCHAR(255)
);

-- Step 2: Copy data
INSERT INTO user_profiles (user_id, bio, avatar_url, website)
SELECT id, bio, avatar_url, website FROM users;

-- Step 3: Update application to read from both tables
-- Use JOIN or separate queries

-- Step 4: Update application to write to new table

-- Step 5: Drop columns from original table (later)
ALTER TABLE users
DROP COLUMN bio,
DROP COLUMN avatar_url,
DROP COLUMN website;
```
