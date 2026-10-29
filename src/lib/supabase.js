import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error(
        "CRITICAL ERROR: Missing Supabase Environment Variables!\n" +
        "Please create a .env file in the root folder with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n" +
        "You can copy .env.example to .env."
    );
}

export const supabase = createClient(
    supabaseUrl || "",
    supabaseKey || ""
);
