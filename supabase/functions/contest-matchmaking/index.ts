// Contest Matchmaking - Auto-allocate users to contest pools

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateUser, checkRateLimit } from "../shared/auth-helpers.ts";
import { mapErrorToClient, logSecureError } from "../shared/error-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const auth = await authenticateUser(req, SUPABASE_URL, ANON_KEY);
    if (!auth) {
      return new Response(JSON.stringify({ error: mapErrorToClient({ message: "not authenticated" }) }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = auth.user.id;

    // Rate limit: 20 requests per minute per user
    const rateLimitOk = await checkRateLimit(auth.supabase, userId, "contest-matchmaking", 20, 1);
    if (!rateLimitOk) {
      return new Response(JSON.stringify({ error: mapErrorToClient({ message: "rate limit" }) }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input
    const entrySchema = z.object({
      contestTemplateId: z.string().uuid(),
      tierId: z.string().min(1).max(100),
      picks: z
        .array(
          z.object({
            crewId: z.string(),
            event_id: z.string(), // matches contest_pool_crews.event_id
            predictedMargin: z.number(),
          }),
        )
        .min(1)
        .max(10),
      entryFeeCents: z.number().int().positive().max(1000000),
      stateCode: z.string().length(2).optional().nullable(),
    });

    const body = entrySchema.parse(await req.json());

    // Server-side diversity rule: picks must span at least 2 different events
    const uniqueEvents = new Set(body.picks.map((p) => p.event_id));
    if (uniqueEvents.size < 2) {
      return new Response(JSON.stringify({ error: "You must pick crews from at least 2 different events." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[matchmaking] User", userId, "entering template:", body.contestTemplateId);

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get contest template
    const { data: template, error: templateError } = await supabaseAdmin
      .from("contest_templates")
      .select("*")
      .eq("id", body.contestTemplateId)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ error: "Contest template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already entered this contest template
    const { data: existingEntry } = await auth.supabase
      .from("contest_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("contest_template_id", body.contestTemplateId)
      .eq("status", "active")
      .maybeSingle();

    if (existingEntry) {
      return new Response(JSON.stringify({ error: "You have already entered this contest." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create a pool instance with space
    const instance = await findOrCreateInstance(
      supabaseAdmin,
      body.contestTemplateId,
      body.tierId,
      body.entryFeeCents,
      template,
    );

    if (!instance) {
      return new Response(JSON.stringify({ error: "Unable to allocate to a contest pool. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the contest entry
    const { data: entry, error: entryError } = await supabaseAdmin
      .from("contest_entries")
      .insert({
        user_id: userId,
        pool_id: instance.id,
        instance_id: instance.id,
        contest_template_id: body.contestTemplateId,
        picks: body.picks,
        entry_fee_cents: body.entryFeeCents,
        state_code: body.stateCode ?? null,
        status: "active",
      })
      .select()
      .single();

    if (entryError) {
      console.error("[matchmaking] Error creating entry:", entryError);
      return new Response(JSON.stringify({ error: "Failed to create entry" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment entry count on the instance
    const { error: updateError } = await supabaseAdmin
      .from("contest_instances")
      .update({ current_entries: instance.current_entries + 1 })
      .eq("id", instance.id);

    if (updateError) {
      console.error("[matchmaking] Error updating instance count:", updateError);
    }

    // Compliance log
    await supabaseAdmin.from("compliance_audit_logs").insert({
      user_id: userId,
      event_type: "contest_entry_created",
      severity: "info",
      description: `User entered ${template.regatta_name} - Pool ${instance.pool_number}`,
      state_code: body.stateCode ?? null,
      metadata: {
        entry_id: entry.id,
        instance_id: instance.id,
        pool_number: instance.pool_number,
        entry_fee: body.entryFeeCents / 100,
        picks_count: body.picks.length,
        unique_events: uniqueEvents.size,
      },
    });

    console.log("[matchmaking] Entry created:", entry.id, "in pool", instance.pool_number);

    return new Response(
      JSON.stringify({
        entryId: entry.id,
        instanceId: instance.id,
        poolNumber: instance.pool_number,
        currentEntries: instance.current_entries + 1,
        maxEntries: instance.max_entries,
        message: `Successfully entered ${template.regatta_name} - Pool ${instance.pool_number}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    const requestId = logSecureError("contest-matchmaking", error);
    const clientMessage = mapErrorToClient(error);
    return new Response(JSON.stringify({ error: clientMessage, requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------------------
// Find an open pool instance with space, or create a new one
// ---------------------------------------------------------------------------
async function findOrCreateInstance(
  supabase: any,
  templateId: string,
  tierId: string,
  entryFeeCents: number,
  template: any,
) {
  // Fetch all open instances for this template+tier, oldest first (fills A→B→C in order)
  // NOTE: supabase.raw() does not exist in JS v2 — we filter available space in JS
  const { data: allOpenInstances } = await supabase
    .from("contest_instances")
    .select("*")
    .eq("contest_template_id", templateId)
    .eq("tier_id", tierId)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const openInstances = (allOpenInstances || []).filter((i: any) => i.current_entries < i.max_entries);

  if (openInstances.length > 0) {
    console.log("[matchmaking] Found existing pool:", openInstances[0].pool_number);
    return openInstances[0];
  }

  // No space in any existing instance — create a new one
  console.log("[matchmaking] Creating new pool instance");

  // Determine next pool letter (A, B, C, ...)
  const { data: existingPools } = await supabase
    .from("contest_instances")
    .select("pool_number")
    .eq("contest_template_id", templateId)
    .eq("tier_id", tierId)
    .order("pool_number", { ascending: false })
    .limit(1);

  let nextPoolNumber = "A";
  if (existingPools && existingPools.length > 0) {
    const lastChar = existingPools[0].pool_number.slice(-1);
    nextPoolNumber = String.fromCharCode(lastChar.charCodeAt(0) + 1);
  }

  // Get tier capacity from template
  const tier = template.entry_tiers?.find((t: any) => t.id === tierId);
  const maxEntries = tier?.capacity || 10;

  const { data: newInstance, error: createError } = await supabase
    .from("contest_instances")
    .insert({
      contest_template_id: templateId,
      tier_id: tierId,
      pool_number: nextPoolNumber,
      entry_fee_cents: entryFeeCents,
      max_entries: maxEntries,
      min_entries: template.min_picks || 2,
      lock_time: template.lock_time,
      status: "open",
    })
    .select()
    .single();

  if (createError) {
    console.error("[matchmaking] Error creating instance:", createError);
    return null;
  }

  console.log("[matchmaking] Created new pool:", nextPoolNumber);

  await supabase.from("compliance_audit_logs").insert({
    event_type: "contest_instance_created",
    severity: "info",
    description: `New pool created: ${template.regatta_name} - Pool ${nextPoolNumber}`,
    metadata: {
      instance_id: newInstance.id,
      pool_number: nextPoolNumber,
      tier_id: tierId,
      max_entries: maxEntries,
    },
  });

  return newInstance;
}
