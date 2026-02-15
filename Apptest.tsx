import { supabase } from "./src/infrastructure/supabase/supabaseClient";

export async function runSupabaseTest() {
  console.log("Starting Supabase Test...");

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  console.log("SUPABASE_URL:", url);
  console.log("ANON_KEY prefix:", anon.slice(0, 16));

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon },
    });
    console.log("AUTH HEALTH status:", res.status);
    console.log("AUTH HEALTH body:", await res.text());
  } catch (e) {
    console.error("AUTH HEALTH fetch failed:", e);
    return; // stop here
  }

  // 1️⃣ Login
  const { data: loginData, error: loginError } =
    await supabase.auth.signInWithPassword({
      email: "test@healthapp.dev",
      password: "Test1234!",
    });

  if (loginError) {
    console.error("Login failed:", loginError);
    return;
  }

  console.log("Logged in as:", loginData.user?.id);

  const userId = loginData.user?.id;

  // 2️⃣ Insert
  const { data: insertData, error: insertError } =
    await supabase.from("user_food_aliases").insert({
      user_id: userId,
      alias_text: "Apfel",
      normalized_alias: "apfel",
      locale: "de-DE",
      target_item_id: null,
    }).select();

  if (insertError) {
    console.error("Insert failed:", insertError);
    return;
  }

  console.log("Insert success:", insertData);

  // 3️⃣ Select
  const { data: rows, error: selectError } =
    await supabase.from("user_food_aliases").select("*");

  if (selectError) {
    console.error("Select failed:", selectError);
    return;
  }

  console.log("Select success:", rows);
}
