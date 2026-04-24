-- Fix: Create missing is_board_owner function that RLS policies depend on
-- This function was defined in supabase-schema.sql but never created in the actual database

-- Helper function: is_board_owner(board_uuid)
create or replace function is_board_owner(board_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from boards where id = board_uuid and owner_id = auth.uid()
  );
$$ language sql security definer;

-- Verify RLS policies exist and recreate them if needed
-- These policies reference is_board_owner() and will fail if the function is missing

-- Drop and recreate members policy to ensure it uses the new function
drop policy if exists "Users manage members on their boards" on members;
create policy "Users manage members on their boards"
  on members for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

-- Drop and recreate agents policy to ensure it uses the new function
drop policy if exists "Users manage agents on their boards" on agents;
create policy "Users manage agents on their boards"
  on agents for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

-- Verify other policies that depend on is_board_owner are working
-- (boards, columns, tags, cards policies should already exist)
