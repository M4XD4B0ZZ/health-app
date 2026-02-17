import { supabase } from "@/infrastructure/supabase/supabaseClient";

export async function testOffEdge(query = "apfel") {
  const { data, error } = await supabase.functions.invoke("food-off-search", {
    body: { query, locale: "de-DE" },
  });

  console.log("OFF EDGE data:", data);
  console.log("OFF EDGE error:", error);

  if (error) throw error;
  return data;
}

export async function testUsdaEdge(query = "apple") {
  const { data, error } = await supabase.functions.invoke("food-usda-search", {
    body: { query, locale: "de-DE" },
  });

  console.log("USDA EDGE data:", data);
  console.log("USDA EDGE error:", error);

  if (error) throw error;
  return data;
}