// Supabase Edge Function: food-usda-search
// Mock implementation für USDA Food Database Suche

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
        source: "usda",
        sourceId: "usda_apple_raw_167765",
        name: "Apple, raw",
        normalizedName: "apple raw",
        macrosPer100g: {
          kcal: 52,
          protein: 0.3,
          carbs: 14,
          fat: 0.2,
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
