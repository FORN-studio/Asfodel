import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_KEY } from "$env/static/public";
import type { Database } from '$lib/database.types'

export const supabase = createClient<Database>('https://sgalfgywpedhuscqnxlq.supabase.co', PUBLIC_SUPABASE_KEY)
