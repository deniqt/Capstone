// Supabase Edge Function: delete-user
// Deploy:  supabase functions deploy delete-user
// Uses the auto-provided SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ---- 1. Who is calling? Must be a logged-in Admin ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated." }, 401);

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerAuth } } = await caller.auth.getUser();
    if (!callerAuth) return json({ error: "Not authenticated." }, 401);

    const admin = createClient(url, serviceKey);

    const { data: callerRow } = await admin
      .from("users")
      .select("id, Role")
      .eq("auth_id", callerAuth.id)
      .single();

    if (!callerRow || callerRow.Role !== "Admin") {
      return json({ error: "Only admins can delete users." }, 403);
    }

    // ---- 2. Target user ----
    const { userId } = await req.json();
    if (!userId) return json({ error: "userId is required." }, 400);

    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id, Name, Role, auth_id, detail_id")
      .eq("id", userId)
      .single();

    if (targetError || !target) return json({ error: "User not found." }, 404);

    if (target.id === callerRow.id) {
      return json({ error: "You can't delete your own account." }, 400);
    }

    const check = (label: string, error: { message: string } | null) => {
      if (error) throw new Error(`${label}: ${error.message}`);
    };

    // ---- 3. Calendar sessions + their ratings ----
    const { data: sessions } = await admin
      .from("calendar")
      .select("id")
      .or(`tutor_id.eq.${userId},student_id.eq.${userId}`);
    const sessionIds = (sessions ?? []).map((s) => s.id);

    if (sessionIds.length) {
      check("ratings (sessions)", (await admin.from("Session_Ratings")
        .delete().in("Calendar_ID", sessionIds)).error);
    }
    check("ratings", (await admin.from("Session_Ratings")
      .delete().or(`Student_ID.eq.${userId},Tutor_ID.eq.${userId}`)).error);
    check("calendar", (await admin.from("calendar")
      .delete().or(`tutor_id.eq.${userId},student_id.eq.${userId}`)).error);

    // ---- 4. Conversations + messages ----
    const { data: convos } = await admin
      .from("conversations")
      .select("conversation_id")
      .or(`student_id.eq.${userId},tutor_id.eq.${userId}`);
    const convoIds = (convos ?? []).map((c) => c.conversation_id);

    if (convoIds.length) {
      check("messages (conversations)", (await admin.from("messages")
        .delete().in("conversation_id", convoIds)).error);
    }
    check("messages", (await admin.from("messages")
      .delete().eq("sender_id", userId)).error);
    check("conversations", (await admin.from("conversations")
      .delete().or(`student_id.eq.${userId},tutor_id.eq.${userId}`)).error);

    // ---- 5. Learning data ----
    check("submissions", (await admin.from("Assignment_Submissions")
      .delete().eq("Student_ID", userId)).error);
    check("material assignments", (await admin.from("Material_Assignment")
      .delete().eq("Student_ID", userId)).error);
    // A deleted tutor's materials stay in the library, just unowned
    check("materials", (await admin.from("Materials")
      .update({ Tutor_ID: null }).eq("Tutor_ID", userId)).error);

    // ---- 6. Notifications + renewal requests ----
    check("notifications", (await admin.from("notifications")
      .delete().eq("user_id", userId)).error);
    check("notification prefs", (await admin.from("notification_preferences")
      .delete().eq("user_id", userId)).error);
    check("renewal requests", (await admin.from("renewal_requests")
      .delete().eq("student_id", userId)).error);
    check("renewal reviewer", (await admin.from("renewal_requests")
      .update({ admin_id: null }).eq("admin_id", userId)).error);

    // ---- 7. Payments are kept for revenue history ----
    check("payments (student)", (await admin.from("payments")
      .update({ student_id: null, customer_name: target.Name })
      .eq("student_id", userId)).error);
    check("payments (admin)", (await admin.from("payments")
      .update({ admin_id: null }).eq("admin_id", userId)).error);

    // ---- 8. Students of a deleted tutor become unassigned ----
    check("tutor links", (await admin.from("user_details")
      .update({ Tutor_ID: null }).eq("Tutor_ID", userId)).error);

    // ---- 9. The user row, then their details / orphaned parent ----
    check("user", (await admin.from("users").delete().eq("id", userId)).error);

    if (target.detail_id) {
      const { data: detail } = await admin
        .from("user_details")
        .select("Parent_ID")
        .eq("detail_id", target.detail_id)
        .maybeSingle();

      check("details", (await admin.from("user_details")
        .delete().eq("detail_id", target.detail_id)).error);

      if (detail?.Parent_ID) {
        const { count } = await admin
          .from("user_details")
          .select("detail_id", { count: "exact", head: true })
          .eq("Parent_ID", detail.Parent_ID);
        if (!count) {
          await admin.from("Parent_Table").delete()
            .eq("Parent_ID", detail.Parent_ID);
        }
      }
    }

    // ---- 10. The login itself ----
    if (target.auth_id) {
      const { error } = await admin.auth.admin.deleteUser(target.auth_id);
      if (error) throw new Error(`auth: ${error.message}`);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? "Delete failed." }, 500);
  }
});