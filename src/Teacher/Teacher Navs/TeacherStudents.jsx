import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./teacherStudents.css";

function TeacherStudents() {
    const navigate = useNavigate();

    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState("All Students");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            setLoading(true);
            setError("");

            // 1. Get logged-in Supabase Auth user
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                throw new Error("No logged-in user found.");
            }

            console.log("AUTH USER:", user.id);

            // 2. Get the tutor's public users record
            const { data: tutor, error: tutorError } = await supabase
                .from("users")
                .select("id, detail_id, Name, Email, Role, auth_id")
                .eq("auth_id", user.id)
                .maybeSingle();

            if (tutorError) throw tutorError;

            console.log("TUTOR:", tutor);

            if (!tutor) {
                throw new Error(
                    "No tutor users record was found for this logged-in account."
                );
            }

            if (!tutor.detail_id) {
                throw new Error(
                    "This tutor does not have a detail_id in the users table."
                );
            }

            console.log("TUTOR DETAIL ID:", tutor.detail_id);

            // 3. Find students assigned to this tutor
            // IMPORTANT:
            // user_details.Tutor_ID references users.id
            const { data: studentDetails, error: detailsError } =
                await supabase
                    .from("user_details")
                    .select("*")
                    .eq("Tutor_ID", tutor.id);

            if (detailsError) throw detailsError;

            console.log(
                "ASSIGNED STUDENT DETAILS:",
                studentDetails
            );

            if (!studentDetails || studentDetails.length === 0) {
                console.log(
                    "No user_details records have Tutor_ID =",
                    tutor.id
                );

                setStudents([]);
                return;
            }

            // 4. Get the corresponding users records
            const detailIds = studentDetails
                .map((student) => student.detail_id)
                .filter(Boolean);

            console.log("STUDENT DETAIL IDS:", detailIds);

            if (detailIds.length === 0) {
                setStudents([]);
                return;
            }

            const { data: studentUsers, error: usersError } =
                await supabase
                    .from("users")
                    .select("*")
                    .in("detail_id", detailIds);

            if (usersError) throw usersError;

            console.log("STUDENT USERS:", studentUsers);

            // 5. Combine users + user_details
            const combinedStudents = (studentUsers || [])
                .filter(
                    (student) =>
                        String(student.Role || "").toLowerCase() ===
                        "student"
                )
                .map((student) => {
                    const details = studentDetails.find(
                        (detail) =>
                            detail.detail_id === student.detail_id
                    );

                    return {
                        ...student,
                        ...details,
                        user_id: student.id,
                    };
                });

            console.log(
                "STUDENTS BEFORE SCHEDULES:",
                combinedStudents
            );

            // ---------------------------------------------------------
            // 6. Get upcoming schedules for these students
            // ---------------------------------------------------------

            const studentIds = combinedStudents.map(
                (student) => student.user_id
            );

            let schedules = [];

            if (studentIds.length > 0) {
                const now = new Date().toISOString();

                const { data: calendarData, error: calendarError } =
                    await supabase
                        .from("calendar")
                        .select(
                            `
                            id,
                            tutor_id,
                            student_id,
                            title,
                            description,
                            start_datetime,
                            end_datetime,
                            status,
                            meeting_platform,
                            meeting_link
                            `
                        )
                        .eq("tutor_id", tutor.id)
                        .in("student_id", studentIds)
                        .in("status", ["Pending", "Confirmed"])
                        .gte("start_datetime", now)
                        .order("start_datetime", {
                            ascending: true,
                        });

                if (calendarError) throw calendarError;

                schedules = calendarData || [];

                console.log(
                    "UPCOMING STUDENT SCHEDULES:",
                    schedules
                );
            }

            // ---------------------------------------------------------
            // 7. Match the nearest schedule to each student
            // ---------------------------------------------------------

            const studentsWithSchedules = combinedStudents.map(
                (student) => {
                    const studentSchedules = schedules.filter(
                        (schedule) =>
                            schedule.student_id === student.user_id
                    );

                    // Because schedules are already ordered by
                    // start_datetime ascending, the first one
                    // is the student's nearest upcoming session.
                    const nextSession =
                        studentSchedules.length > 0
                            ? studentSchedules[0]
                            : null;

                    return {
                        ...student,
                        nextSession,
                    };
                }
            );

            console.log(
                "FINAL STUDENTS WITH SCHEDULES:",
                studentsWithSchedules
            );

            setStudents(studentsWithSchedules);
        } catch (error) {
            console.error(
                "Error loading students:",
                error
            );

            setError(
                error.message ||
                    "Unable to load students."
            );
        } finally {
            setLoading(false);
        }
    };

    // Filter + search
    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            const name = student.Name || "";
            const search = searchTerm.toLowerCase();

            const matchesSearch = name
                .toLowerCase()
                .includes(search);

            const status = (
                student.Status || "Inactive"
            ).toLowerCase();

            const matchesFilter =
                activeFilter === "All Students" ||
                (activeFilter === "Active" &&
                    status === "active") ||
                (activeFilter === "Inactive" &&
                    status === "inactive");

            return matchesSearch && matchesFilter;
        });
    }, [students, searchTerm, activeFilter]);

    const activeStudents = students.filter(
        (student) =>
            (student.Status || "").toLowerCase() ===
            "active"
    );

    const inactiveStudents = students.filter(
        (student) =>
            (student.Status || "").toLowerCase() ===
            "inactive"
    );

    const getSubjects = (student) => {
        if (Array.isArray(student.Subjects)) {
            return student.Subjects;
        }

        if (typeof student.Subjects === "string") {
            return student.Subjects
                .split(",")
                .map((subject) => subject.trim())
                .filter(Boolean);
        }

        return [];
    };

  const getInitials = (name) => {
        if (!name) return "?";

        const words = name.trim().split(/\s+/);

        if (words.length === 1) {
            return words[0].charAt(0).toUpperCase();
        }

        return (
            words[0].charAt(0) +
            words[words.length - 1].charAt(0)
        ).toUpperCase();
    };

    const getProfileImage = (student) => {
        return student.profile_url || null;
    };

    // ---------------------------------------------------------
    // Format student's next session
    // ---------------------------------------------------------

    const formatNextSession = (student) => {
        if (!student.nextSession) {
            return "Unscheduled";
        }

        const start = new Date(
            student.nextSession.start_datetime
        );

        if (Number.isNaN(start.getTime())) {
            return "Unscheduled";
        }

        const date = start.toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric",
            }
        );

        const time = start.toLocaleTimeString(
            "en-US",
            {
                hour: "numeric",
                minute: "2-digit",
            }
        );

        return `${date} • ${time}`;
    };

    if (loading) {
        return (
            <div className="teacher-students-page">
                <div className="students-loading">
                    Loading students...
                </div>
            </div>
        );
    }

    return (
        <div className="teacher-students-page">

            {/* Page Header */}
            <div className="students-page-header">
                <h1>My Students</h1>

                <p>
                    View and manage the students assigned to you.
                </p>
            </div>

            {/* Search */}
            <div className="students-toolbar">

                <div className="student-search">
                    <span>⌕</span>

                    <input
                        type="text"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(e.target.value)
                        }
                    />
                </div>

            </div>

            {/* Filters */}
            <div className="students-filters">

                <button
                    className={
                        activeFilter === "All Students"
                            ? "student-filter active"
                            : "student-filter"
                    }
                    onClick={() =>
                        setActiveFilter("All Students")
                    }
                >
                    All Students ({students.length})
                </button>

                <button
                    className={
                        activeFilter === "Active"
                            ? "student-filter active"
                            : "student-filter"
                    }
                    onClick={() =>
                        setActiveFilter("Active")
                    }
                >
                    Active
                </button>

                <button
                    className={
                        activeFilter === "Inactive"
                            ? "student-filter active"
                            : "student-filter"
                    }
                    onClick={() =>
                        setActiveFilter("Inactive")
                    }
                >
                    Inactive
                </button>

            </div>

            {/* Error */}
            {error && (
                <div className="students-error">
                    <strong>
                        Unable to load students.
                    </strong>

                    <span>{error}</span>

                    <button onClick={loadStudents}>
                        Try Again
                    </button>
                </div>
            )}

            {/* Student Table */}
            {!error && (
                <div className="students-table-container">

                    <table className="students-table">

                        <thead>
                            <tr>
                                <th>STUDENT NAME</th>
                                <th>SUBJECTS</th>
                                <th>NEXT SESSION</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>

                        <tbody>

                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className="students-empty"
                                    >
                                        {students.length === 0
                                            ? "No students are currently assigned to you."
                                            : "No students match your search."}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(
                                    (student) => {

                                        const subjects =
                                            getSubjects(student);

                                        const status =
                                            student.Status ||
                                            "Inactive";

                                        return (
                                            <tr
                                                key={
                                                    student.user_id
                                                }
                                                className="student-row"
                                                onClick={() =>
                                                    navigate(
                                                        `/teacher/students/${student.user_id}`
                                                    )
                                                }
                                            >

                                                {/* Student */}
                                                <td>
                                                    <div className="student-name-cell">

                                                        {getProfileImage(student) ? (
                                                            <img
                                                                src={getProfileImage(student)}
                                                                alt={student.Name}
                                                                className="student-list-image"
                                                            />
                                                        ) : (
                                                            <div className="student-list-initials">
                                                                {getInitials(student.Name)}
                                                            </div>
                                                        )}

                                                        <span>
                                                            {student.Name ||
                                                                "Unnamed Student"}
                                                        </span>

                                                    </div>
                                                </td>

                                                {/* Subjects */}
                                                <td>
                                                    <div className="student-subjects">

                                                        {subjects.length >
                                                        0 ? (
                                                            subjects.map(
                                                                (
                                                                    subject,
                                                                    index
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="subject-tag"
                                                                    >
                                                                        {
                                                                            subject
                                                                        }
                                                                    </span>
                                                                )
                                                            )
                                                        ) : (
                                                            <span className="no-subject">
                                                                No subjects
                                                            </span>
                                                        )}

                                                    </div>
                                                </td>

                                                {/* Next Session */}
                                                <td>
                                                    <span className="next-session">

                                                        <span className="calendar-icon">
                                                            ▫
                                                        </span>

                                                        {formatNextSession(
                                                            student
                                                        )}

                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td>
                                                    <span
                                                        className={`student-status-badge ${
                                                            status
                                                                .toLowerCase() ===
                                                            "active"
                                                                ? "active"
                                                                : "inactive"
                                                        }`}
                                                    >
                                                        {status}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td>
                                                    <button
                                                        className="student-action-button"
                                                        onClick={(
                                                            e
                                                        ) => {
                                                            e.stopPropagation();

                                                            navigate(
                                                                `/teacher/students/${student.user_id}`
                                                            );
                                                        }}
                                                        title="View student"
                                                    >
                                                        ⋮
                                                    </button>
                                                </td>

                                            </tr>
                                        );
                                    }
                                )
                            )}

                        </tbody>

                    </table>

                </div>
            )}

        </div>
    );
}

export default TeacherStudents;