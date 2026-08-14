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

    try {

        // ==========================================
        // NOTIFICATION TYPE → PREFERENCE
        // ==========================================

        const preferenceMap = {

            schedule:
                "schedule_notifications",

            material:
                "material_notifications",

            assignment:
                "assignment_notifications",

            grading:
                "grading_notifications",

            payment:
                "payment_notifications",

            system:
                "system_notifications"

        };


        const preferenceColumn =
            preferenceMap[type];


        // ==========================================
        // CHECK NOTIFICATION PREFERENCE
        // ==========================================

        if (preferenceColumn) {

            const {
                data: preferences,
                error: preferenceError
            } = await supabase

                .from("notification_preferences")

                .select(
                    preferenceColumn
                )

                .eq(
                    "user_id",
                    userId
                )

                .maybeSingle();


            if (preferenceError) {

                console.error(
                    "Failed to load notification preferences:",
                    preferenceError
                );

                return {
                    success: false,
                    error: preferenceError
                };

            }


            // ==========================================
            // NO PREFERENCE ROW
            // ==========================================
            // Default behavior:
            // allow the notification.
            //
            // This also protects older users who
            // don't have a preferences row yet.

            if (
                preferences &&
                preferences[preferenceColumn] === false
            ) {

                console.log(
                    `Notification skipped because ${preferenceColumn} is disabled.`
                );

                return {
                    success: true,
                    skipped: true
                };

            }

        }


        // ==========================================
        // CREATE NOTIFICATION
        // ==========================================

        const {
            error
        } = await supabase

            .from("notifications")

            .insert({

                user_id:
                    userId,

                title,

                message,

                type,

                is_read:
                    false,

                related_table:
                    relatedTable,

                related_id:
                    relatedId,

                action_url:
                    actionUrl

            });


        // ==========================================
        // INSERT ERROR
        // ==========================================

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


        // ==========================================
        // SUCCESS
        // ==========================================

        return {
            success: true,
            skipped: false
        };


    } catch (error) {

        console.error(
            "Notification service error:",
            error
        );

        return {
            success: false,
            error
        };

    }

}