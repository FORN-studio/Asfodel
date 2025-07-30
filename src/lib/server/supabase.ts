import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_KEY } from "$env/static/private";
import type { Database } from '$lib/database.types'

export const supabase = createClient<Database>('https://sgalfgywpedhuscqnxlq.supabase.co', SUPABASE_SERVICE_KEY)
