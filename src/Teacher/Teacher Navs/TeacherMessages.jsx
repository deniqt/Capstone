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
    getMessages,
    sendMessage,
    markMessagesAsRead
} from "../../Services/messagingService";


import MainHeader from "../../MainComponent/MainHeader";

import "./teacherMessages.css";


function TeacherMessages() {

    const [studentFilter, setStudentFilter] = useState("all");

    const [studentSearch, setStudentSearch] = useState("");

    const [teacher, setTeacher] = useState(null);

    const [students, setStudents] = useState([]);

    const [selectedStudent, setSelectedStudent] = useState(null);

    const [conversation, setConversation] = useState(null);

    const [messages, setMessages] = useState([]);

    const [messageText, setMessageText] = useState("");

    const [loading, setLoading] = useState(true);

    const [messagesLoading, setMessagesLoading] = useState(false);

    const [sending, setSending] = useState(false);

    const [unreadCounts, setUnreadCounts] = useState({});

    const messagesEndRef = useRef(null);


    // ==========================================
    // INITIALIZE
    // ==========================================

    useEffect(() => {

        initializeMessaging();

    }, []);

    


    async function initializeMessaging() {

        setLoading(true);

        try {

            const currentUser =
                await getCurrentSystemUser();

            setTeacher(currentUser);


            await loadStudents(
                currentUser.id
            );

            await loadUnreadCounts(
                currentUser.id
            );
        } catch (error) {

            console.error(
                "Teacher messaging initialization error:",
                error
            );

        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // LOAD ASSIGNED STUDENTS
    // ==========================================

    async function loadStudents(tutorId) {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select(`
                id,
                Name,
                Email,
                Role,
                Status,
                detail_id,
                user_details!detail_id(
                    Tutor_ID
                )
            `)
            .eq(
                "Role",
                "Student"
            );


        if (error) {

            console.error(
                "Student loading error:",
                error
            );

            return;

        }


        const assignedStudents =
            data?.filter(
                student =>
                    student.user_details?.Tutor_ID ===
                    tutorId
            ) || [];


        setStudents(
            assignedStudents
        );

    }


    // ==========================================
    // LOAD UNREAD MESSAGE COUNTS
    // ==========================================

    async function loadUnreadCounts(tutorId) {

        try {

            const {
                data: conversations,
                error
            } = await supabase
                .from("conversations")
                .select(`
                    conversation_id,
                    student_id,
                    tutor_id
                `)
                .eq(
                    "tutor_id",
                    tutorId
                );


            if (error) {
                throw error;
            }


            if (!conversations?.length) {

                setUnreadCounts({});

                return;

            }


            const conversationIds =
                conversations.map(
                    conversation =>
                        conversation.conversation_id
                );


            const {
                data: unreadMessages,
                error: messageError
            } = await supabase
                .from("messages")
                .select(`
                    message_id,
                    conversation_id,
                    sender_id
                `)
                .in(
                    "conversation_id",
                    conversationIds
                )
                .neq(
                    "sender_id",
                    tutorId
                )
                .eq(
                    "is_read",
                    false
                );


            if (messageError) {
                throw messageError;
            }


            const counts = {};


            unreadMessages?.forEach(
                message => {

                    const conversation =
                        conversations.find(
                            item =>
                                item.conversation_id ===
                                message.conversation_id
                        );


                    if (!conversation) {
                        return;
                    }


                    const studentId =
                        conversation.student_id;


                    counts[studentId] =
                        (counts[studentId] || 0) + 1;

                }
            );


            setUnreadCounts(
                counts
            );


        } catch (error) {

            console.error(
                "Unread message loading error:",
                error
            );

        }

    }

    // ==========================================
    // SELECT STUDENT
    // ==========================================

    async function handleSelectStudent(student) {

        setSelectedStudent(
            student
        );

        setConversation(null);

        setMessages([]);

        setMessagesLoading(true);


        try {

            // Find existing conversation

            let {
                data: existingConversation,
                error: conversationError
            } = await supabase
                .from("conversations")
                .select("*")
                .eq(
                    "student_id",
                    student.id
                )
                .eq(
                    "tutor_id",
                    teacher.id
                )
                .maybeSingle();


            if (conversationError) {
                throw conversationError;
            }


            // Create conversation if needed

            if (!existingConversation) {

                const {
                    data: newConversation,
                    error
                } = await supabase
                    .from("conversations")
                    .insert({
                        student_id:
                            student.id,

                        tutor_id:
                            teacher.id
                    })
                    .select()
                    .single();


                if (error) {
                    throw error;
                }


                existingConversation =
                    newConversation;

            }


            setConversation(
                existingConversation
            );


            // Load messages

            const loadedMessages =
                await getMessages(
                    existingConversation.conversation_id
                );


            setMessages(
                loadedMessages
            );


            // Mark incoming messages as read

            await markMessagesAsRead({

                conversationId:
                    existingConversation.conversation_id,

                userId:
                    teacher.id

            });


            setUnreadCounts(
                previous => {

                    const updated = {
                        ...previous
                    };

                    delete updated[student.id];

                    return updated;

                }
            );


        } catch (error) {

            console.error(
                "Conversation loading error:",
                error
            );

        } finally {

            setMessagesLoading(false);

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
                    `teacher-conversation-${conversation.conversation_id}`
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
                            teacher?.id
                        ) {

                            markMessagesAsRead({

                                conversationId:
                                    conversation.conversation_id,

                                userId:
                                    teacher.id

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
        teacher
    ]);


    // ==========================================
    // REALTIME UNREAD MESSAGE MONITOR
    // ==========================================

    useEffect(() => {

        if (!teacher) {
            return;
        }


        const channel =
            supabase
                .channel(
                    `teacher-unread-${teacher.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages"
                    },
                    async payload => {

                        const newMessage =
                            payload.new;


                        // Ignore own messages

                        if (
                            newMessage.sender_id ===
                            teacher.id
                        ) {
                            return;
                        }


                        // Find the conversation

                        const {
                            data: conversationData,
                            error
                        } = await supabase
                            .from("conversations")
                            .select(`
                                conversation_id,
                                student_id,
                                tutor_id
                            `)
                            .eq(
                                "conversation_id",
                                newMessage.conversation_id
                            )
                            .single();


                        if (error) {

                            console.error(
                                "Unread conversation lookup error:",
                                error
                            );

                            return;

                        }


                        // Make sure this message
                        // belongs to this teacher

                        if (
                            conversationData.tutor_id !==
                            teacher.id
                        ) {
                            return;
                        }


                        const studentId =
                            conversationData.student_id;


                        // If currently viewing
                        // this student, don't highlight

                        if (
                            selectedStudent?.id ===
                            studentId
                        ) {

                            return;

                        }


                        setUnreadCounts(
                            previous => ({

                                ...previous,

                                [studentId]:
                                    (previous[studentId] || 0) + 1

                            })
                        );

                    }
                )
                .subscribe();


        return () => {

            supabase.removeChannel(
                channel
            );

        };

    }, [
        teacher,
        selectedStudent
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
    // SEND MESSAGE
    // ==========================================

    async function handleSendMessage(event) {

        event.preventDefault();


        if (
            !messageText.trim() ||
            !conversation ||
            !teacher
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
                        teacher.id,

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

            <div className="teacher-messages-loading">

                Loading messages...

            </div>

        );

    }


    // ==========================================
    // FILTER + SEARCH STUDENTS
    // ==========================================

    const filteredStudents = students.filter(student => {

        // FILTER
        const matchesFilter =
            studentFilter === "all" ||
            unreadCounts[student.id] > 0;


        // SEARCH
        const search =
            studentSearch
                .trim()
                .toLowerCase();


        const matchesSearch =
            !search ||
            student.Name
                ?.toLowerCase()
                .includes(search) ||
            student.Email
                ?.toLowerCase()
                .includes(search);


        return (
            matchesFilter &&
            matchesSearch
        );

    });




    // ==========================================
    // UI
    // ==========================================

    return (

        <div className="teacher-messages-page">

            <MainHeader />


            <div className="teacher-messages-wrapper">


                {/* ==================================
                    TITLE
                ================================== */}

                <div className="teacher-messages-title">

                    <div>

                        <h1>
                            Messages
                        </h1>

                        <p>
                            Communicate with your assigned students.
                        </p>

                    </div>

                </div>


                {/* ==================================
                    MESSAGING AREA
                ================================== */}

                <div className="teacher-messaging-container">


                    {/* ==================================
                        STUDENT LIST
                    ================================== */}

                    <aside className="student-list-panel">

                        <div className="student-list-header">

                            <div className="student-list-title">

                                <h2>
                                    Students
                                </h2>

                                <span>
                                    {filteredStudents.length}
                                </span>

                            </div>

                        </div>

                        {/* ==================================
                            SEARCH + FILTER
                        ================================== */}

                        <div className="student-list-controls">

                            <input
                                type="text"
                                className="student-search-input"
                                placeholder="Search student..."
                                value={studentSearch}
                                onChange={event =>
                                    setStudentSearch(
                                        event.target.value
                                    )
                                }
                            />


                            <div className="student-filter-buttons">

                                <button
                                    type="button"
                                    className={
                                        studentFilter === "all"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        setStudentFilter("all")
                                    }
                                >
                                    All
                                </button>


                                <button
                                    type="button"
                                    className={
                                        studentFilter === "unread"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        setStudentFilter("unread")
                                    }
                                >
                                    Unread

                                    {Object.keys(unreadCounts).length > 0 && (
                                        <span className="filter-unread-count">
                                            {Object.keys(unreadCounts).length}
                                        </span>
                                    )}

                                </button>

                            </div>

                        </div>


                        <div className="student-list">

                            {filteredStudents.length === 0 ? (

                                <div className="no-students">

                                    <span>
                                        👨‍🎓
                                    </span>

                                    <p>
                                        {studentSearch.trim()
                                            ? "No students found."
                                            : studentFilter === "unread"
                                            ? "No unread messages."
                                            : "No assigned students."
                                        }
                                    </p>

                                </div>

                            ) : (

                                filteredStudents.map(
                                    student => (

                                        <button
                                            key={
                                                student.id
                                            }
                                            className={
                                                `student-list-item ${
                                                    selectedStudent?.id ===
                                                    student.id
                                                        ? "selected"
                                                        : ""
                                                } ${
                                                    unreadCounts[student.id] > 0
                                                        ? "has-unread"
                                                        : ""
                                                }`
                                            }
                                            onClick={() =>
                                                handleSelectStudent(
                                                    student
                                                )
                                            }
                                        >

                                            <div className="student-avatar">

                                                {student.Name
                                                    ?.charAt(0)
                                                    ?.toUpperCase() ||
                                                    "S"}

                                            </div>


                                            <div className="student-list-info">

                                                <strong>
                                                    {
                                                        student.Name
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        student.Email
                                                    }
                                                </small>

                                                {unreadCounts[student.id] > 0 && (

                                                    <span className="student-unread-badge">

                                                        {unreadCounts[student.id]}

                                                    </span>

                                                )}

                                            </div>

                                        </button>

                                    )
                                )

                            )}

                        </div>

                    </aside>


                    {/* ==================================
                        CHAT
                    ================================== */}

                    <section className="teacher-chat-panel">


                        {!selectedStudent ? (

                            <div className="chat-placeholder">

                                <div>
                                    💬
                                </div>

                                <h2>
                                    Select a student
                                </h2>

                                <p>
                                    Choose a student from the list to start messaging.
                                </p>

                            </div>

                        ) : (

                            <>

                                {/* CHAT HEADER */}

                                <div className="teacher-chat-header">

                                    <div className="student-avatar large">

                                        {selectedStudent.Name
                                            ?.charAt(0)
                                            ?.toUpperCase() ||
                                            "S"}

                                    </div>


                                    <div>

                                        <strong>
                                            {
                                                selectedStudent.Name
                                            }
                                        </strong>

                                        <span>
                                            Student
                                        </span>

                                    </div>

                                </div>


                                {/* MESSAGES */}

                                <div className="teacher-chat-messages">

                                    {messagesLoading ? (

                                        <div className="chat-loading">

                                            Loading conversation...

                                        </div>

                                    ) : messages.length === 0 ? (

                                        <div className="chat-start">

                                            <div>
                                                👋
                                            </div>

                                            <h3>
                                                Start the conversation
                                            </h3>

                                            <p>
                                                Send a message to your student.
                                            </p>

                                        </div>

                                    ) : (

                                        messages.map(
                                            message => {

                                                const isMine =
                                                    message.sender_id ===
                                                    teacher.id;


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

                                                        <div className="teacher-message-bubble">

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
                                    className="teacher-chat-input"
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

                            </>

                        )}

                    </section>

                </div>

            </div>

        </div>

    );

}


export default TeacherMessages;