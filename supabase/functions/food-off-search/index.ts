// Supabase Edge Function: food-off-search
// Mock implementation für Open Food Facts Suche

interface SearchRequest {
  query: string;
  locale: "de" | "en";
}

interface MacrosPer100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodItem {
  source: "off" | "usda";
  sourceId: string;
  name: string;
  normalizedName: string;
  macrosPer100g: MacrosPer100g;
}

interface SearchResponse {
  items: FoodItem[];
}

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: SearchRequest = await req.json();
    const query = body.query?.trim().toLowerCase() || "";

    // Mock logic: nur "apfel" gibt Ergebnisse zurück
    const items: FoodItem[] = [];

    if (query === "apfel") {
      items.push({
        source: "off",
        sourceId: "off_bio_apfel_marke_x",
        name: "Bio Apfel Marke X",
        normalizedName: "bio apfel marke x",
        macrosPer100g: {
          kcal: 55,
          protein: 0.4,
          carbs: 15,
          fat: 0.3,
        },
      });
    }

    const response: SearchResponse = { items };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request", items: [] }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
