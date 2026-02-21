import { supabase } from "./src/infrastructure/supabase/supabaseClient";


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

export async function checkUsdaKeyHealth(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("food-usda-search", {
    body: { mode: "health" },
  });

  if (error) {
    console.log("USDA KEY HEALTH invoke error (raw):", error);
    console.log("USDA KEY HEALTH error: Edge unreachable / auth / network", error.message);
    return;
  }

  const ok = Boolean(data?.ok);
  const errorCode = typeof data?.error === "string" ? data.error : null;
  console.log("USDA KEY HEALTH status:", ok ? "ok" : "failed");
  console.log("USDA KEY HEALTH ok:", ok);
  console.log("USDA KEY HEALTH error:", errorCode);
}
