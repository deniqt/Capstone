import { supabase } from "../lib/supabase";
import { createNotification } from "./notificationService";


// ============================================
// GET CURRENT SYSTEM USER
// ============================================

export async function getCurrentSystemUser() {

    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("User is not authenticated.");
    }


    const {
        data,
        error
    } = await supabase
        .from("users")
        .select(`
            id,
            Name,
            Role,
            auth_id
        `)
        .eq("auth_id", user.id)
        .single();


    if (error) {
        throw error;
    }


    return data;

}


// ============================================
// GET ASSIGNED TUTOR
// ============================================

export async function getAssignedTutor(studentId) {

    const {
        data: student,
        error: studentError
    } = await supabase
        .from("users")
        .select(`
            id,
            Name,
            Role,
            detail_id,
            user_details!detail_id(
                Tutor_ID
            )
        `)
        .eq("id", studentId)
        .single();


    if (studentError) {
        throw studentError;
    }


    const tutorId =
        student?.user_details?.Tutor_ID;


    if (!tutorId) {
        return null;
    }


    const {
        data: tutor,
        error: tutorError
    } = await supabase
        .from("users")
        .select(`
            id,
            Name,
            Role,
            Email
        `)
        .eq("id", tutorId)
        .single();


    if (tutorError) {
        throw tutorError;
    }


    return tutor;

}


// ============================================
// GET OR CREATE CONVERSATION
// ============================================

export async function getOrCreateConversation(
    studentId,
    tutorId
) {

    const {
        data: existing,
        error: existingError
    } = await supabase
        .from("conversations")
        .select("*")
        .eq("student_id", studentId)
        .eq("tutor_id", tutorId)
        .maybeSingle();


    if (existingError) {
        throw existingError;
    }


    if (existing) {
        return existing;
    }


    const {
        data,
        error
    } = await supabase
        .from("conversations")
        .insert({
            student_id: studentId,
            tutor_id: tutorId
        })
        .select()
        .single();


    if (error) {

        // Handles race condition where another request
        // created the conversation first.
        if (error.code === "23505") {

            const {
                data: conversation
            } = await supabase
                .from("conversations")
                .select("*")
                .eq("student_id", studentId)
                .eq("tutor_id", tutorId)
                .single();

            return conversation;
        }

        throw error;
    }


    return data;

}


// ============================================
// GET MESSAGES
// ============================================

export async function getMessages(conversationId) {

    const {
        data,
        error
    } = await supabase
        .from("messages")
        .select(`
            message_id,
            conversation_id,
            sender_id,
            message,
            is_read,
            created_at
        `)
        .eq(
            "conversation_id",
            conversationId
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );


    if (error) {
        throw error;
    }


    return data || [];
}


// ============================================
// SEND MESSAGE
// ============================================

// ============================================
// SEND MESSAGE
// ============================================

export async function sendMessage({
    conversationId,
    senderId,
    message
}) {

    const cleanMessage =
        message.trim();

    if (!cleanMessage) {
        throw new Error(
            "Message cannot be empty."
        );
    }


    // ============================================
    // GET CONVERSATION PARTICIPANTS
    // ============================================

    const {
        data: conversation,
        error: conversationError
    } = await supabase
        .from("conversations")
        .select(`
            conversation_id,
            student_id,
            tutor_id
        `)
        .eq(
            "conversation_id",
            conversationId
        )
        .single();


    if (conversationError) {
        throw conversationError;
    }


    // ============================================
    // DETERMINE RECIPIENT
    // ============================================

    const recipientId =
        conversation.student_id === senderId
            ? conversation.tutor_id
            : conversation.student_id;


    // ============================================
    // GET SENDER INFORMATION
    // ============================================

    const {
        data: sender,
        error: senderError
    } = await supabase
        .from("users")
        .select(`
            id,
            Name,
            Role
        `)
        .eq(
            "id",
            senderId
        )
        .single();


    if (senderError) {
        throw senderError;
    }


    // ============================================
    // INSERT MESSAGE
    // ============================================

    const {
        data,
        error
    } = await supabase
        .from("messages")
        .insert({
            conversation_id:
                conversationId,

            sender_id:
                senderId,

            message:
                cleanMessage
        })
        .select(`
            message_id,
            conversation_id,
            sender_id,
            message,
            is_read,
            created_at
        `)
        .single();


    if (error) {
        throw error;
    }


    // ============================================
    // UPDATE CONVERSATION
    // ============================================

    await supabase
        .from("conversations")
        .update({
            updated_at:
                new Date().toISOString()
        })
        .eq(
            "conversation_id",
            conversationId
        );


    // ============================================
    // CREATE NOTIFICATION
    // ============================================

    try {

        await createNotification({

            userId:
                recipientId,

            title:
                `New message from ${sender.Name}`,

            message:
                cleanMessage.length > 80
                    ? `${cleanMessage.substring(0, 80)}...`
                    : cleanMessage,

            type:
                "Message",

            relatedTable:
                "conversations",

            relatedId:
                conversationId,

            actionUrl:
                sender.Role === "Tutor"
                    ? "/student/messages"
                    : "/teacher/messages"

        });

    } catch (notificationError) {

        // Do not fail the actual message
        // if notification creation fails.

        console.error(
            "Message notification error:",
            notificationError
        );

    }


    return data;
}


// ============================================
// MARK MESSAGES AS READ
// ============================================

export async function markMessagesAsRead({
    conversationId,
    userId
}) {

    const {
        error
    } = await supabase
        .from("messages")
        .update({
            is_read: true
        })
        .eq(
            "conversation_id",
            conversationId
        )
        .neq(
            "sender_id",
            userId
        )
        .eq(
            "is_read",
            false
        );


    if (error) {
        throw error;
    }

}


// ============================================
// GET UNREAD MESSAGE COUNT
// ============================================

export async function getUnreadMessageCount(
    userId
) {

    const {
        data: conversations,
        error: conversationError
    } = await supabase
        .from("conversations")
        .select("conversation_id")
        .or(
            `student_id.eq.${userId},tutor_id.eq.${userId}`
        );


    if (conversationError) {
        throw conversationError;
    }


    if (!conversations?.length) {
        return 0;
    }


    const conversationIds =
        conversations.map(
            item =>
                item.conversation_id
        );


    const {
        count,
        error
    } = await supabase
        .from("messages")
        .select(
            "message_id",
            {
                count: "exact",
                head: true
            }
        )
        .in(
            "conversation_id",
            conversationIds
        )
        .neq(
            "sender_id",
            userId
        )
        .eq(
            "is_read",
            false
        );


    if (error) {
        throw error;
    }


    return count || 0;

}