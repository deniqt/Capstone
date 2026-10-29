import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import "./teacherStudent.css";

function TeacherStudent() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [student, setStudent] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [parent, setParent] = useState(null);

    const [previousTutors, setPreviousTutors] = useState([]);
    const [currentTutorName, setCurrentTutorName] = useState("");
    const [tutorMap, setTutorMap] = useState({});

    const [sessions, setSessions] = useState([]);
    const [assignments, setAssignments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);

    const [error, setError] = useState("");
    const [sessionsError, setSessionsError] = useState("");
    const [assignmentsError, setAssignmentsError] = useState("");

    const [activeTab, setActiveTab] = useState("Overview");

    useEffect(() => {
        loadStudent();
    }, [id]);

    const loadStudent = async () => {
        try {
            setLoading(true);
            setError("");

            // =========================================================
            // 1. Get currently logged-in Auth user
            // =========================================================

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                throw new Error("No logged-in user found.");
            }

            console.log("TEACHER AUTH USER:", user.id);

            // =========================================================
            // 2. Get logged-in tutor's users record
            // =========================================================

            const { data: tutor, error: tutorError } =
                await supabase
                    .from("users")
                    .select("id, detail_id, Name, Role, auth_id")
                    .eq("auth_id", user.id)
                    .maybeSingle();

            if (tutorError) throw tutorError;

            if (!tutor) {
                throw new Error(
                    "Tutor account was not found."
                );
            }

            console.log("LOGGED-IN TUTOR:", tutor);

            // =========================================================
            // 3. Get requested student's users record
            // =========================================================

            const { data: studentData, error: studentError } =
                await supabase
                    .from("users")
                    .select("*")
                    .eq("id", id)
                    .eq("Role", "Student")
                    .maybeSingle();

            if (studentError) throw studentError;

            if (!studentData) {
                throw new Error("Student not found.");
            }

            console.log("STUDENT:", studentData);

            // =========================================================
            // 4. Get student's user_details
            // =========================================================

            if (!studentData.detail_id) {
                throw new Error(
                    "This student does not have profile details."
                );
            }

            const { data: detailsData, error: detailsError } =
                await supabase
                    .from("user_details")
                    .select("*")
                    .eq("detail_id", studentData.detail_id)
                    .maybeSingle();

            if (detailsError) throw detailsError;

            if (!detailsData) {
                throw new Error(
                    "Student profile details were not found."
                );
            }

            console.log(
                "STUDENT DETAILS:",
                detailsData
            );

            // =========================================================
            // 5. SECURITY CHECK & TUTOR RESOLUTION
            //
            // user_details.Tutor_ID references users.id
            // Authorize if currently assigned OR previously taught this student
            // =========================================================

            const isCurrentlyAssigned = Number(detailsData.Tutor_ID) === Number(tutor.id);
            const isStaff = (tutor.Role || "").toLowerCase() === "admin";

            if (!isCurrentlyAssigned && !isStaff) {
                const { data: pastSessionCheck } = await supabase
                    .from("calendar")
                    .select("id")
                    .eq("student_id", studentData.id)
                    .eq("tutor_id", tutor.id)
                    .limit(1);

                if (!pastSessionCheck || pastSessionCheck.length === 0) {
                    throw new Error("You are not authorized to view this student.");
                }
            }

            // Load all tutors to map IDs to Names
            const { data: allTutors } = await supabase
                .from("users")
                .select("id, Name")
                .eq("Role", "Tutor");

            const tMap = {};
            (allTutors || []).forEach(t => { tMap[t.id] = t.Name; });
            setTutorMap(tMap);

            if (detailsData?.Tutor_ID && tMap[detailsData.Tutor_ID]) {
                setCurrentTutorName(tMap[detailsData.Tutor_ID]);
            }

            // =========================================================
            // 6. Load parent / guardian
            // =========================================================

            let parentData = null;

            if (detailsData.Parent_ID) {
                const {
                    data,
                    error: parentError,
                } = await supabase
                    .from("Parent_Table")
                    .select("*")
                    .eq(
                        "Parent_ID",
                        detailsData.Parent_ID
                    )
                    .maybeSingle();

                if (parentError) {
                    console.error(
                        "Parent error:",
                        parentError
                    );
                } else {
                    parentData = data;
                }
            }

            // =========================================================
            // 7. Save basic student data
            // =========================================================

            setStudent(studentData);
            setUserDetails(detailsData);
            setParent(parentData);

            // =========================================================
            // 8. Load sessions
            // =========================================================

            await loadSessions(studentData.id, detailsData.Tutor_ID, tMap);

            // =========================================================
            // 9. Load assignments / grading
            // =========================================================

            await loadAssignments(studentData.id);

        } catch (error) {
            console.error(
                "Error loading student:",
                error
            );

            setError(
                error.message ||
                    "Unable to load student information."
            );
        } finally {
            setLoading(false);
        }
    };

    // =============================================================
    // LOAD STUDENT SESSIONS
    // =============================================================

    const loadSessions = async (studentId, currentTutorId, preloadedMap) => {
        try {
            setSessionsLoading(true);
            setSessionsError("");

            let map = preloadedMap;
            if (!map || Object.keys(map).length === 0) {
                const { data: tutorList } = await supabase
                    .from("users")
                    .select("id, Name")
                    .eq("Role", "Tutor");
                map = {};
                (tutorList || []).forEach(t => { map[t.id] = t.Name; });
                setTutorMap(map);
            }

            const {
                data: sessionData,
                error: sessionError,
            } = await supabase
                .from("calendar")
                .select(`
                    id,
                    title,
                    description,
                    event_type,
                    tutor_id,
                    student_id,
                    start_datetime,
                    end_datetime,
                    status,
                    meeting_link,
                    meeting_platform,
                    notes,
                    attendance_status,
                    requested_start_datetime,
                    requested_end_datetime,
                    reschedule_reason,
                    reschedule_requested_by,
                    tutor_approval,
                    admin_approval,
                    reschedule_status,
                    student_approval,
                    created_at
                `)
                .eq("student_id", studentId)
                .order("start_datetime", {
                    ascending: false,
                });

            if (sessionError) throw sessionError;

            console.log(
                "STUDENT SESSIONS:",
                sessionData
            );

            setSessions(sessionData || []);

            // Identify previous tutors from past sessions
            const prevMap = {};
            (sessionData || []).forEach(s => {
                const sTutorId = Number(s.tutor_id);
                const currId = Number(currentTutorId);
                if (sTutorId && sTutorId !== currId) {
                    if (!prevMap[sTutorId]) {
                        prevMap[sTutorId] = {
                            tutorId: sTutorId,
                            name: (map && map[sTutorId]) || ("Tutor #" + sTutorId),
                            sessionCount: 0,
                            firstDate: s.start_datetime,
                            lastDate: s.start_datetime
                        };
                    }
                    prevMap[sTutorId].sessionCount++;
                    if (new Date(s.start_datetime) < new Date(prevMap[sTutorId].firstDate)) {
                        prevMap[sTutorId].firstDate = s.start_datetime;
                    }
                    if (new Date(s.start_datetime) > new Date(prevMap[sTutorId].lastDate)) {
                        prevMap[sTutorId].lastDate = s.start_datetime;
                    }
                }
            });

            setPreviousTutors(Object.values(prevMap));

        } catch (error) {
            console.error(
                "Error loading sessions:",
                error
            );

            setSessionsError(
                error.message ||
                    "Unable to load sessions."
            );
        } finally {
            setSessionsLoading(false);
        }
    };

    // =============================================================
    // LOAD ASSIGNMENTS + SUBMISSIONS
    // =============================================================

    const loadAssignments = async (studentId) => {
        try {
            setAssignmentsLoading(true);
            setAssignmentsError("");

            // -----------------------------------------------------
            // 1. Get materials assigned to this student
            // -----------------------------------------------------

            const {
                data: materialAssignments,
                error: materialAssignmentError,
            } = await supabase
                .from("Material_Assignment")
                .select(`
                    ID,
                    Material_ID,
                    Student_ID,
                    Assigned_At,
                    Completed
                `)
                .eq("Student_ID", studentId);

            if (materialAssignmentError) {
                throw materialAssignmentError;
            }

            if (
                !materialAssignments ||
                materialAssignments.length === 0
            ) {
                setAssignments([]);
                return;
            }

            const materialIds = materialAssignments
                .map(
                    (item) => item.Material_ID
                )
                .filter(Boolean);

            if (materialIds.length === 0) {
                setAssignments([]);
                return;
            }

            // -----------------------------------------------------
            // 2. Get materials
            // -----------------------------------------------------

            const {
                data: materials,
                error: materialsError,
            } = await supabase
                .from("Materials")
                .select(`
                    Material_ID,
                    Material_Name,
                    Material_URL,
                    Material_Description,
                    file_name,
                    Subject_ID,
                    Tutor_ID,
                    created_at
                `)
                .in(
                    "Material_ID",
                    materialIds
                );

            if (materialsError) {
                throw materialsError;
            }

            // -----------------------------------------------------
            // 3. Get assignments belonging to those materials
            // -----------------------------------------------------

            const {
                data: assignmentData,
                error: assignmentError,
            } = await supabase
                .from("Assignments")
                .select(`
                    Assignment_ID,
                    Material_ID,
                    Assignment_Type,
                    Due_Date,
                    Total_Points,
                    Created_At,
                    Updated_At
                `)
                .in(
                    "Material_ID",
                    materialIds
                );

            if (assignmentError) {
                throw assignmentError;
            }

            // -----------------------------------------------------
            // 4. Get student's submissions
            // -----------------------------------------------------

            const assignmentIds = (
                assignmentData || []
            )
                .map(
                    (assignment) =>
                        assignment.Assignment_ID
                )
                .filter(Boolean);

            let submissions = [];

            if (assignmentIds.length > 0) {
                const {
                    data: submissionData,
                    error: submissionError,
                } = await supabase
                    .from("Assignment_Submissions")
                    .select(`
                        Submission_ID,
                        Assignment_ID,
                        Student_ID,
                        created_at,
                        Submission_URL,
                        file_name,
                        Submitted_At,
                        Score,
                        Feedback,
                        Status,
                        Graded_At,
                        Is_Late
                    `)
                    .eq(
                        "Student_ID",
                        studentId
                    )
                    .in(
                        "Assignment_ID",
                        assignmentIds
                    );

                if (submissionError) {
                    throw submissionError;
                }

                submissions =
                    submissionData || [];
            }

            // -----------------------------------------------------
            // 5. Combine everything
            // -----------------------------------------------------

            const combinedAssignments = (
                assignmentData || []
            ).map((assignment) => {

                const material =
                    materials?.find(
                        (item) =>
                            item.Material_ID ===
                            assignment.Material_ID
                    );

                const materialAssignment =
                    materialAssignments.find(
                        (item) =>
                            item.Material_ID ===
                            assignment.Material_ID
                    );

                const submission =
                    submissions.find(
                        (item) =>
                            item.Assignment_ID ===
                            assignment.Assignment_ID
                    );

                return {
                    ...assignment,

                    Material_Name:
                        material?.Material_Name ||
                        "Unnamed Assignment",

                    Material_URL:
                        material?.Material_URL ||
                        null,

                    Material_Description:
                        material?.Material_Description ||
                        "",

                    file_name:
                        material?.file_name ||
                        null,

                    Assigned_At:
                        materialAssignment?.Assigned_At ||
                        null,

                    Completed:
                        materialAssignment?.Completed ||
                        null,

                    submission:
                        submission || null,
                };
            });

            console.log(
                "STUDENT ASSIGNMENTS:",
                combinedAssignments
            );

            setAssignments(
                combinedAssignments
            );

        } catch (error) {
            console.error(
                "Error loading assignments:",
                error
            );

            setAssignmentsError(
                error.message ||
                    "Unable to load assignments."
            );
        } finally {
            setAssignmentsLoading(false);
        }
    };

    // =============================================================
    // HELPERS
    // =============================================================

    const formatDate = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "—";
        }

        return parsedDate.toLocaleDateString(
            "en-US",
            {
                month: "long",
                day: "numeric",
                year: "numeric",
            }
        );
    };

    const formatDateTime = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "—";
        }

        return parsedDate.toLocaleString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }
        );
    };

    const getSubjects = () => {
        if (Array.isArray(userDetails?.Subjects)) {
            return userDetails.Subjects;
        }

        if (
            typeof userDetails?.Subjects ===
            "string"
        ) {
            return userDetails.Subjects
                .split(",")
                .map(
                    (subject) =>
                        subject.trim()
                )
                .filter(Boolean);
        }

        return [];
    };

    const getProfileImage = () => {
        return (
            userDetails?.profile_url ||
            "https://via.placeholder.com/100"
        );
    };

    const getSessionStatusClass = (status) => {
        if (!status) return "";

        return status
            .toLowerCase()
            .replace(/\s+/g, "-");
    };

    const getAttendanceClass = (
        attendance
    ) => {
        if (!attendance) return "";

        return attendance
            .toLowerCase()
            .replace(/\s+/g, "-");
    };

    const getAssignmentStatus = (
        assignment
    ) => {
        const submission =
            assignment.submission;

        if (!submission) {
            return "Not Submitted";
        }

        if (
            submission.Score !== null &&
            submission.Score !== undefined
        ) {
            return "Graded";
        }

        if (submission.Status) {
            return submission.Status;
        }

        return "Submitted";
    };

    const getScoreDisplay = (
        assignment
    ) => {
        const submission =
            assignment.submission;

        if (!submission) {
            return "—";
        }

        if (
            submission.Score === null ||
            submission.Score === undefined
        ) {
            return "Pending";
        }

        return `${submission.Score}/${assignment.Total_Points}`;
    };

    const subjects = getSubjects();

    // =============================================================
    // LOADING
    // =============================================================

    if (loading) {
        return (
            <div className="teacher-student-page">
                <div className="student-loading">
                    Loading student information...
                </div>
            </div>
        );
    }

    // =============================================================
    // ERROR / NOT FOUND
    // =============================================================

    if (error || !student) {
        return (
            <div className="teacher-student-page">

                <div className="student-not-found">

                    <h2>
                        {error ===
                        "You are not authorized to view this student."
                            ? "Access denied"
                            : "Student not found"}
                    </h2>

                    <p>
                        {error ||
                            "The requested student could not be found."}
                    </p>

                    <button
                        onClick={() =>
                            navigate(
                                "/teacher/students"
                            )
                        }
                    >
                        Back to My Students
                    </button>

                </div>

            </div>
        );
    }

    return (
        <div className="teacher-student-page">

            {/* =====================================================
                BACK
            ====================================================== */}

            <button
                className="back-students"
                onClick={() =>
                    navigate(
                        "/teacher/students"
                    )
                }
            >
                ← Back to My Students
            </button>

            {/* =====================================================
                STUDENT HEADER
            ====================================================== */}

            <div className="student-profile-header">

                <img
                    src={getProfileImage()}
                    alt={student.Name}
                    className="student-profile-image"
                />

                <div className="student-profile-info">

                    <h1>
                        {student.Name ||
                            "Unnamed Student"}
                    </h1>

                    <div className="student-subject-status">

                        {subjects.length > 0 ? (
                            <span>
                                {subjects.join(
                                    ", "
                                )}
                            </span>
                        ) : (
                            <span>
                                No subjects assigned
                            </span>
                        )}

                        <span
                            className={`student-status ${
                                student.Status
                                    ?.toLowerCase() ===
                                "active"
                                    ? "active"
                                    : "inactive"
                            }`}
                        >
                            {student.Status ||
                                "Inactive"}
                        </span>

                    </div>

                    {/* TUTOR ASSIGNMENT & PREVIOUS TUTOR BADGES */}
                    <div className="student-tutor-badges">
                        <span className="student-tutor-chip current">
                            👨‍🏫 <strong>Current Tutor:</strong> {currentTutorName || (userDetails?.Tutor_ID && tutorMap[userDetails.Tutor_ID]) || "Assigned"}
                        </span>
                        {previousTutors.length > 0 && (
                            <span className="student-tutor-chip previous">
                                🔄 <strong>Previous Tutor:</strong> {previousTutors.map(pt => `${pt.name} (${pt.sessionCount} sessions)`).join(", ")}
                            </span>
                        )}
                    </div>

                </div>

            </div>

            {/* =====================================================
                TABS
            ====================================================== */}

            <div className="student-tabs">

                {[
                    "Overview",
                    "Sessions",
                    "Evaluation & Grading",
                ].map((tab) => (
                    <button
                        key={tab}
                        className={
                            activeTab === tab
                                ? "student-tab active"
                                : "student-tab"
                        }
                        onClick={() =>
                            setActiveTab(tab)
                        }
                    >
                        {tab}
                    </button>
                ))}

            </div>

            {/* =====================================================
                OVERVIEW
            ====================================================== */}

            {activeTab === "Overview" && (
                <div className="student-overview">

                    {/* STUDENT INFORMATION */}

                    <div className="student-card">

                        <div className="student-card-header">
                            <h2>
                                Student Information
                            </h2>
                        </div>

                        <div className="student-card-body">

                            <div className="student-info-grid">

                                <div className="info-item">
                                    <label>
                                        Full Name
                                    </label>

                                    <p>
                                        {student.Name ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Date of Birth
                                    </label>

                                    <p>
                                        {formatDate(
                                            userDetails?.date_of_birth
                                        )}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Email Address
                                    </label>

                                    <p>
                                        {student.Email ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Grade Level
                                    </label>

                                    <p>
                                        {userDetails?.Grade_Level ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item full-width">
                                    <label>
                                        School
                                    </label>

                                    <p>
                                        {userDetails?.school ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item full-width">
                                    <label>
                                        Home Address
                                    </label>

                                    <p>
                                        {userDetails?.Address ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Phone Number
                                    </label>

                                    <p>
                                        {userDetails?.phone_number ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Current Assigned Tutor
                                    </label>

                                    <p>
                                        {currentTutorName || (userDetails?.Tutor_ID && tutorMap[userDetails.Tutor_ID]) || "None Assigned"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Previous Tutor History
                                    </label>

                                    {previousTutors.length > 0 ? (
                                        <div className="previous-tutor-box">
                                            {previousTutors.map(pt => (
                                                <div key={pt.tutorId} className="previous-tutor-item">
                                                    <strong>{pt.name}</strong>
                                                    <span>
                                                        {pt.sessionCount} session{pt.sessionCount === 1 ? "" : "s"} ({formatDate(pt.firstDate)} – {formatDate(pt.lastDate)})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: "#64748b", fontWeight: 500 }}>
                                            None on record (First assigned tutor)
                                        </p>
                                    )}
                                </div>

                            </div>

                        </div>

                    </div>

                    {/* PARENT / GUARDIAN */}

                    <div className="student-card">

                        <div className="student-card-header">
                            <h2>
                                Parent / Guardian Information
                            </h2>
                        </div>

                        <div className="student-card-body">

                            <div className="student-info-grid">

                                <div className="info-item">
                                    <label>
                                        Guardian
                                    </label>

                                    <p>
                                        {parent?.Parent_Name ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Relationship
                                    </label>

                                    <p>
                                        {parent?.Parent_Relation ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Email Address
                                    </label>

                                    <p>
                                        {parent?.Parent_Email ||
                                            "—"}
                                    </p>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Phone Number
                                    </label>

                                    <p>
                                        {parent?.Parent_Phone ||
                                            "—"}
                                    </p>
                                </div>

                            </div>

                        </div>

                    </div>

                </div>
            )}

            {/* =====================================================
                SESSIONS
            ====================================================== */}

            {activeTab === "Sessions" && (
                <div className="student-tab-content">

                    <div className="student-card">

                        <div className="student-card-header">
                            <h2>
                                Session History & Schedule
                            </h2>
                        </div>

                        <div className="student-card-body">

                            {sessionsLoading ? (
                                <p>
                                    Loading sessions...
                                </p>
                            ) : sessionsError ? (
                                <div className="students-error">
                                    <strong>
                                        Unable to load sessions.
                                    </strong>

                                    <span>
                                        {sessionsError}
                                    </span>
                                </div>
                            ) : sessions.length === 0 ? (
                                <div className="students-empty">
                                    No sessions found for
                                    this student.
                                </div>
                            ) : (
                                <div className="student-sessions-list">

                                    {sessions.map(
                                        (session) => (
                                            <div
                                                key={
                                                    session.id
                                                }
                                                className="student-session-item"
                                            >

                                                <div className="session-main">

                                                    <h3>
                                                        {session.title ||
                                                            "Tutorial Session"}
                                                    </h3>

                                                    <p>
                                                        {formatDateTime(
                                                            session.start_datetime
                                                        )}
                                                    </p>

                                                    <p>
                                                        End:{" "}
                                                        {formatDateTime(
                                                            session.end_datetime
                                                        )}
                                                    </p>

                                                    <div className="session-conductor-line">
                                                        <span>
                                                            Tutor: <strong>{tutorMap[session.tutor_id] || "Assigned Tutor"}</strong>
                                                        </span>
                                                        {Number(session.tutor_id) !== Number(userDetails?.Tutor_ID) && (
                                                            <span className="session-prev-tutor-badge">
                                                                Previous Tutor
                                                            </span>
                                                        )}
                                                    </div>

                                                </div>

                                                <div className="session-meta">

                                                    <span
                                                        className={`student-session-status ${getSessionStatusClass(
                                                            session.status
                                                        )}`}
                                                    >
                                                        {session.status ||
                                                            "Unknown"}
                                                    </span>

                                                    {session.attendance_status && (
                                                        <span
                                                            className={`student-session-attendance ${getAttendanceClass(
                                                                session.attendance_status
                                                            )}`}
                                                        >
                                                            {
                                                                session.attendance_status
                                                            }
                                                        </span>
                                                    )}

                                                    {session.meeting_platform && (
                                                        <span>
                                                            {
                                                                session.meeting_platform
                                                            }
                                                        </span>
                                                    )}

                                                    {session.meeting_link && (
                                                        <a
                                                            href={
                                                                session.meeting_link
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Open Meeting
                                                        </a>
                                                    )}

                                                </div>

                                            </div>
                                        )
                                    )}

                                </div>
                            )}

                        </div>

                    </div>

                </div>
            )}

            {/* =====================================================
                EVALUATION & GRADING
            ====================================================== */}

            {activeTab ===
                "Evaluation & Grading" && (
                <div className="student-tab-content">

                    <div className="student-card">

                        <div className="student-card-header">
                            <h2>
                                Assignments & Grading
                            </h2>
                        </div>

                        <div className="student-card-body">

                            {assignmentsLoading ? (
                                <p>
                                    Loading assignments...
                                </p>
                            ) : assignmentsError ? (
                                <div className="students-error">

                                    <strong>
                                        Unable to load assignments.
                                    </strong>

                                    <span>
                                        {assignmentsError}
                                    </span>

                                </div>
                            ) : assignments.length === 0 ? (
                                <div className="students-empty">
                                    No assignments have
                                    been assigned to this
                                    student.
                                </div>
                            ) : (
                                <div className="student-assignments-list">

                                    {assignments.map(
                                        (assignment) => (
                                            <div
                                                key={
                                                    assignment.Assignment_ID
                                                }
                                                className="student-assignment-item"
                                            >

                                                <div className="assignment-main">

                                                    <h3>
                                                        {assignment.Material_Name}
                                                    </h3>

                                                    {assignment.Assignment_Type && (
                                                        <p>
                                                            Type:{" "}
                                                            {
                                                                assignment.Assignment_Type
                                                            }
                                                        </p>
                                                    )}

                                                    <p>
                                                        Due:{" "}
                                                        {formatDateTime(
                                                            assignment.Due_Date
                                                        )}
                                                    </p>

                                                    <p>
                                                        Total Points:{" "}
                                                        {assignment.Total_Points ??
                                                            "—"}
                                                    </p>

                                                </div>

                                                <div className="assignment-meta">

                                                    <span>
                                                        Status:{" "}
                                                        {
                                                            getAssignmentStatus(
                                                                assignment
                                                            )
                                                        }
                                                    </span>

                                                    <strong>
                                                        Score:{" "}
                                                        {
                                                            getScoreDisplay(
                                                                assignment
                                                            )
                                                        }
                                                    </strong>

                                                    {assignment.submission
                                                        ?.Submitted_At && (
                                                        <span>
                                                            Submitted:{" "}
                                                            {formatDateTime(
                                                                assignment
                                                                    .submission
                                                                    .Submitted_At
                                                            )}
                                                        </span>
                                                    )}

                                                    {assignment.submission
                                                        ?.Feedback && (
                                                        <span>
                                                            Feedback:{" "}
                                                            {
                                                                assignment
                                                                    .submission
                                                                    .Feedback
                                                            }
                                                        </span>
                                                    )}

                                                    {assignment.submission
                                                        ?.Graded_At && (
                                                        <span>
                                                            Graded:{" "}
                                                            {formatDateTime(
                                                                assignment
                                                                    .submission
                                                                    .Graded_At
                                                            )}
                                                        </span>
                                                    )}

                                                    {assignment.submission
                                                        ?.Is_Late && (
                                                        <span>
                                                            Late Submission
                                                        </span>
                                                    )}

                                                </div>

                                            </div>
                                        )
                                    )}

                                </div>
                            )}

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}

export default TeacherStudent;