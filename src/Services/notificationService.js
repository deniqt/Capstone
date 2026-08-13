import { supabase } from "../lib/supabase";

export async function createNotification({
    userId,
    title,
    message,
    type,
    relatedTable = null,
    relatedId = null,
    actionUrl = null
}) {
    const { error } = await supabase
        .from("notifications")
        .insert({
            user_id: userId,
            title,
            message,
            type,
            is_read: false,
            related_table: relatedTable,
            related_id: relatedId,
            action_url: actionUrl
        });

    if (error) {
        console.error(
            "Notification creation failed:",
            error
        );

        return {
            success: false,
            error
        };
    }

    return {
        success: true
    };
}