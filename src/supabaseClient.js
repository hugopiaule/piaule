import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !cle) {
console.error(
"Clés Supabase manquantes. Vérifie les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY."
);
}

export const supabase = createClient(url, cle);
