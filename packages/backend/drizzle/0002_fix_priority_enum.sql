-- Fix conversation_priority enum: change 'medium' to 'normal'
-- This migration ensures all environments (fresh + existing) use correct enum values
-- WARNING: Only drop old enum type if no other dependent objects reference it

-- Step 1: Create new enum type with correct values
CREATE TYPE conversation_priority_new AS ENUM ('low', 'normal', 'high', 'urgent');

-- Step 2: Update conversations table to use new enum type
-- This USING clause converts old enum values to new ones
ALTER TABLE conversations 
  ALTER COLUMN priority DROP DEFAULT,
  ALTER COLUMN priority TYPE conversation_priority_new USING 
    CASE 
      WHEN priority::text = 'low' THEN 'low'::conversation_priority_new
      WHEN priority::text = 'medium' THEN 'normal'::conversation_priority_new
      WHEN priority::text = 'high' THEN 'high'::conversation_priority_new
      WHEN priority::text = 'urgent' THEN 'urgent'::conversation_priority_new
      ELSE 'normal'::conversation_priority_new
    END;

-- Step 3: Set default back to 'normal'
ALTER TABLE conversations 
  ALTER COLUMN priority SET DEFAULT 'normal'::conversation_priority_new;

-- Step 4: Drop old enum type (without CASCADE to prevent accidental deletion of dependent objects)
-- If this fails, check that no other columns or types depend on conversation_priority
DROP TYPE conversation_priority;

-- Step 5: Rename new enum back to original name
ALTER TYPE conversation_priority_new RENAME TO conversation_priority;
