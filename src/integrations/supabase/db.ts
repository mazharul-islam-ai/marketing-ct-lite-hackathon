// Untyped supabase client for tables/columns not yet in the generated types.
// Import this instead of client.ts when you hit SelectQueryError or missing-column TS errors.
import { supabase as typedClient } from "./client";
export const supabase = typedClient as any;
