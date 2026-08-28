import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    supabase
} from "../../lib/supabase";

import {
    getCurrentSystemUser,
    getAssignedTutor,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    markMessagesAsRead
} from "../../Services/messagingService";

import MainHeader from "../../MainComponent/MainHeader";

import "./studentMessages.css";


function StudentMessages() {

    const [
        student,
        setStudent
    ] = useState(null);


    const [
        tutor,
        setTutor
    ] = useState(null);


    const [
        conversation,
        setConversation
    ] = useState(null);


    const [
        messages,
        setMessages
    ] = useState([]);


    const [
        messageText,
        setMessageText
    ] = useState("");


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        sending,
        setSending
    ] = useState(false);


    const messagesEndRef =
        useRef(null);


    // ==========================================
    // LOAD
    // ==========================================

    useEffect(() => {

        initializeMessaging();

    }, []);


    async function initializeMessaging() {

        setLoading(true);

        try {

            const currentUser =
                await getCurrentSystemUser();


            setStudent(
                currentUser
            );


            const assignedTutor =
                await getAssignedTutor(
                    currentUser.id
                );


            setTutor(
                assignedTutor
            );


            if (!assignedTutor) {
                return;
            }


            const currentConversation =
                await getOrCreateConversation(
                    currentUser.id,
                    assignedTutor.id
                );


            setConversation(
                currentConversation
            );


            const loadedMessages =
                await getMessages(
                    currentConversation.conversation_id
                );


            setMessages(
                loadedMessages
            );


            await markMessagesAsRead({
                conversationId:
                    currentConversation.conversation_id,

                userId:
                    currentUser.id
            });


        } catch (error) {

            console.error(
                "Messaging error:",
                error
            );

        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // REALTIME
    // ==========================================

    useEffect(() => {

        if (!conversation) {
            return;
        }


        const channel =
            supabase
                .channel(
                    `conversation-${conversation.conversation_id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages",
                        filter:
                            `conversation_id=eq.${conversation.conversation_id}`
                    },
                    payload => {

                        const newMessage =
                            payload.new;


                        setMessages(
                            previous => {

                                if (
                                    previous.some(
                                        message =>
                                            message.message_id ===
                                            newMessage.message_id
                                    )
                                ) {
                                    return previous;
                                }


                                return [
                                    ...previous,
                                    newMessage
                                ];

                            }
                        );


                        if (
                            newMessage.sender_id !==
                            student?.id
                        ) {

                            markMessagesAsRead({
                                conversationId:
                                    conversation.conversation_id,

                                userId:
                                    student.id
                            });

                        }

                    }
                )
                .subscribe();


        return () => {

            supabase.removeChannel(
                channel
            );

        };

    }, [
        conversation,
        student
    ]);


    // ==========================================
    // AUTO SCROLL
    // ==========================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


    // ==========================================
    // SEND
    // ==========================================

    async function handleSendMessage(event) {

        event.preventDefault();


        if (
            !messageText.trim() ||
            !conversation ||
            !student
        ) {
            return;
        }


        setSending(true);


        try {

            const newMessage =
                await sendMessage({

                    conversationId:
                        conversation.conversation_id,

                    senderId:
                        student.id,

                    message:
                        messageText

                });


            setMessages(
                previous => {

                    if (
                        previous.some(
                            item =>
                                item.message_id ===
                                newMessage.message_id
                        )
                    ) {
                        return previous;
                    }


                    return [
                        ...previous,
                        newMessage
                    ];

                }
            );


            setMessageText("");

        } catch (error) {

            console.error(
                "Send message error:",
                error
            );

            alert(
                error.message
            );

        } finally {

            setSending(false);

        }

    }


    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="student-messages-loading">

                Loading messages...

            </div>

        );

    }


    // ==========================================
    // NO TUTOR
    // ==========================================

    if (!tutor) {

        return (

            <div className="student-messages-page">


                <div className="messages-empty-state">

                    <div className="empty-icon">
                        💬
                    </div>

                    <h2>
                        No Tutor Assigned
                    </h2>

                    <p>
                        You don't have an assigned tutor yet.
                    </p>

                </div>

            </div>

        );

    }


    // ==========================================
    // UI
    // ==========================================

    return (

        <div className="student-messages-page">

            <div className="messages-wrapper">


                {/* ==================================
                    PAGE TITLE
                ================================== */}

                <div className="messages-page-title">

                    <div>

                        <h1>
                            Messages
                        </h1>

                        <p>
                            Chat with your assigned tutor.
                        </p>

                    </div>

                </div>


                {/* ==================================
                    CHAT
                ================================== */}

                <div className="student-chat">


                    {/* CHAT HEADER */}

                    <div className="chat-header">

                        <div className="tutor-avatar">

                            {tutor.Name
                                ?.charAt(0)
                                ?.toUpperCase() || "T"}

                        </div>


                        <div>

                            <strong>
                                {tutor.Name}
                            </strong>

                            <span>
                                Tutor
                            </span>

                        </div>

                    </div>


                    {/* MESSAGES */}

                    <div className="chat-messages">

                        {messages.length === 0 ? (

                            <div className="chat-start">

                                <div className="chat-start-icon">
                                    👋
                                </div>

                                <h3>
                                    Start the conversation
                                </h3>

                                <p>
                                    Send a message to your tutor.
                                </p>

                            </div>

                        ) : (

                            messages.map(
                                message => {

                                    const isMine =
                                        message.sender_id ===
                                        student.id;


                                    return (

                                        <div
                                            key={
                                                message.message_id
                                            }
                                            className={
                                                `message-row ${
                                                    isMine
                                                        ? "mine"
                                                        : "theirs"
                                                }`
                                            }
                                        >

                                            <div className="message-bubble">

                                                <p>
                                                    {
                                                        message.message
                                                    }
                                                </p>

                                                <small>

                                                    {new Date(
                                                        message.created_at
                                                    ).toLocaleTimeString(
                                                        [],
                                                        {
                                                            hour:
                                                                "numeric",

                                                            minute:
                                                                "2-digit"
                                                        }
                                                    )}

                                                </small>

                                            </div>

                                        </div>

                                    );

                                }
                            )

                        )}

                        <div
                            ref={
                                messagesEndRef
                            }
                        />

                    </div>


                    {/* INPUT */}

                    <form
                        className="chat-input-area"
                        onSubmit={
                            handleSendMessage
                        }
                    >

                        <input
                            type="text"
                            value={
                                messageText
                            }
                            onChange={
                                event =>
                                    setMessageText(
                                        event.target.value
                                    )
                            }
                            placeholder="Type a message..."
                            disabled={
                                sending
                            }
                        />


                        <button
                            type="submit"
                            disabled={
                                sending ||
                                !messageText.trim()
                            }
                        >

                            {sending
                                ? "..."
                                : "Send"}

                        </button>

                    </form>

                </div>

            </div>

        </div>

    );

}


export default StudentMessages;