import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { pdfBase64 } = await req.json();

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: `Analyse ce devis/facture et réponds UNIQUEMENT en JSON sans markdown:
{"client":"","montant":"","reference":"","telephone":"","email":"","categories":[],"resume":""}
IMPORTANT:
- "client" = le nom de l'ACHETEUR/CLIENT (pas le vendeur)
- "telephone" = "" (laisser vide)
- "email" = "" (laisser vide)
- "montant" = le montant total HT (ex: 850.50€ HT)
- "reference" = le numéro du devis/facture
- "categories" = uniquement parmi ces catégories, choisis selon le contenu:
  * "Flocage" = marquage textile, tee-shirts, vêtements floqués
  * "DTF" = impression DTF sur textile
  * "Broderie" = broderie sur textile
  * "Véhicule" = covering, lettrage, stickers véhicule
  * "Vitrine" = adhésif vitrine, vitrophanie, dépoli
  * "Enseigne" = enseignes, panneaux lumineux, caissons
  * "Conception graphique" = création graphique, design, logo
  * "Impression atelier" = impression réalisée en interne
  * "Impression fournisseur" = bâches, panneaux, roll-up, kakémono, impression grand format sous-traitée
- "resume" = résumé des produits/services en 2-3 lignes` }
        ]}]
      })
    });

    const data = await resp.json();
    console.log("Anthropic response:", JSON.stringify(data));
    
    if (!data.content || !data.content[0]) {
      return new Response(JSON.stringify({ error: "No content", data }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const txt = data.content[0].text.replace(/```json|```/g, "").trim();
    return new Response(txt, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});