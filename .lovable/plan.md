

## Current Security Issues (warn level)

From the scan results, there are **3 warn-level findings** that need fixing:

### 1. Audio Storage Bucket is Public (`STORAGE_EXPOSURE`)
The `audio` bucket is public — anyone with a URL can access exam audio without authentication. Client code already uses signed URLs via `resolveAudioUrl()`, so the only remaining step is a database migration.

### 2. `has_role` Function Publicly Callable (`DEFINER_OR_RPC_BYPASS`)
The `has_role` SECURITY DEFINER function is callable via RPC by any user, enabling role enumeration (checking if any UUID is an admin).

### 3. Leaked Password Protection Disabled (`SUPA_auth_leaked_password_protection`)
Password protection against known leaked passwords is not enabled. This is a configuration change.

### About the "Error loading buckets" Screenshot
This is caused by the same database connectivity timeout that has been blocking migrations in previous attempts. The storage UI cannot load because the backend is intermittently unreachable.

---

## Plan

### Step 1: Apply database migration for storage + RPC security
Run a single migration with:
```sql
-- Make audio bucket private
UPDATE storage.buckets SET public = false WHERE id = 'audio';

-- Replace public read policy with authenticated-only
DROP POLICY IF EXISTS "Anyone can read audio" ON storage.objects;
CREATE POLICY "Authenticated users can read audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio');

-- Revoke public RPC access to has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
```

### Step 2: Enable leaked password protection
Use the `configure_auth` tool to enable leaked password protection.

### Step 3: Update security findings
Delete or mark resolved the findings that have been fixed.

---

**Risk**: Previous migration attempts failed due to database timeouts. If the timeout persists, no code-level workaround exists — it requires backend connectivity to be restored.

