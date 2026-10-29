import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
    Users,
    UserCheck,
    Calendar,
    Search,
    X,
    ChevronRight,
    MessageSquare,
    BookOpen,
    Clock,
    RefreshCw
} from "lucide-react";
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

            // 2. Get the tutor's public users record
            const { data: tutor, error: tutorError } = await supabase
                .from("users")
                .select("id, detail_id, Name, Email, Role, auth_id")
                .eq("auth_id", user.id)
                .maybeSingle();

            if (tutorError) throw tutorError;

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

            // 3. Find students assigned to this tutor
            // user_details.Tutor_ID references users.id
            const { data: studentDetails, error: detailsError } =
                await supabase
                    .from("user_details")
                    .select("*")
                    .eq("Tutor_ID", tutor.id);

            if (detailsError) throw detailsError;

            if (!studentDetails || studentDetails.length === 0) {
                setStudents([]);
                return;
            }

            // 4. Get the corresponding users records
            const detailIds = studentDetails
                .map((student) => student.detail_id)
                .filter(Boolean);

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

            // 5. Combine users + user_details
            const combinedStudents = (studentUsers || [])
                .filter(
                    (student) =>
                        String(student.Role || "").toLowerCase() === "student"
                )
                .map((student) => {
                    const details = studentDetails.find(
                        (detail) => detail.detail_id === student.detail_id
                    );

                    return {
                        ...student,
                        ...details,
                        user_id: student.id,
                    };
                });

            // 6. Get upcoming schedules for these students
            const studentIds = combinedStudents.map(
                (student) => student.user_id
            );

            let schedules = [];
            let prevTutorMap = {};

            if (studentIds.length > 0) {
                const now = new Date().toISOString();

                const [calendarRes, prevTutorRes] = await Promise.all([
                    supabase
                        .from("calendar")
                        .select("id, student_id, tutor_id, title, start_datetime, status")
                        .in("student_id", studentIds)
                        .eq("tutor_id", tutor.id)
                        .gte("start_datetime", now)
                        .neq("status", "Cancelled")
                        .order("start_datetime", { ascending: true }),
                    supabase
                        .from("calendar")
                        .select(`
                            student_id,
                            tutor_id,
                            tutor:users!calendar_tutor_id_fkey(Name)
                        `)
                        .in("student_id", studentIds)
                        .neq("tutor_id", tutor.id)
                ]);

                if (calendarRes.error) {
                    console.error("Calendar error:", calendarRes.error);
                } else {
                    schedules = calendarRes.data || [];
                }

                if (!prevTutorRes.error && prevTutorRes.data) {
                    prevTutorRes.data.forEach((row) => {
                        if (row.tutor?.Name && !prevTutorMap[row.student_id]) {
                            prevTutorMap[row.student_id] = row.tutor.Name;
                        }
                    });
                }
            }

            // 7. Attach next session & previous tutor to each student
            const studentsWithSchedules = combinedStudents.map((student) => {
                const nextSession = schedules.find(
                    (session) => session.student_id === student.user_id
                );

                return {
                    ...student,
                    nextSession: nextSession || null,
                    previousTutorName: prevTutorMap[student.user_id] || null
                };
            });

            setStudents(studentsWithSchedules);
        } catch (err) {
            console.error("LOAD STUDENTS ERROR:", err);
            setError(err.message || "Failed to load assigned students.");
        } finally {
            setLoading(false);
        }
    };

    // ---------------------------------------------------------
    // Filter + Search Logic
    // ---------------------------------------------------------

    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            const name = (student.Name || "").toLowerCase();
            const email = (student.Email || "").toLowerCase();
            const school = (student.school || "").toLowerCase();
            const grade = (student.Grade_Level || student.grade || "").toLowerCase();
            const search = searchTerm.toLowerCase();

            const matchesSearch =
                name.includes(search) ||
                email.includes(search) ||
                school.includes(search) ||
                grade.includes(search);

            const status = (student.Status || "").toLowerCase();

            const matchesFilter =
                activeFilter === "All Students" ||
                (activeFilter === "Active" && status === "active") ||
                (activeFilter === "Inactive" && status === "inactive");

            return matchesSearch && matchesFilter;
        });
    }, [students, searchTerm, activeFilter]);

    const activeStudents = useMemo(() => {
        return students.filter(
            (student) => (student.Status || "").toLowerCase() === "active"
        );
    }, [students]);

    const inactiveStudents = useMemo(() => {
        return students.filter(
            (student) => (student.Status || "").toLowerCase() === "inactive"
        );
    }, [students]);

    const scheduledStudentsCount = useMemo(() => {
        return students.filter((student) => !!student.nextSession).length;
    }, [students]);

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

    const formatNextSession = (student) => {
        if (!student.nextSession) {
            return "Unscheduled";
        }

        const start = new Date(student.nextSession.start_datetime);

        if (Number.isNaN(start.getTime())) {
            return "Unscheduled";
        }

        const date = start.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });

        const time = start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });

        return `${date} • ${time}`;
    };

    if (loading) {
        return (
            <div className="teacher-students-page">
                <div className="students-loading">
                    <div className="students-spinner"></div>
                    <p>Loading your assigned students...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="teacher-students-page">

            {/* Page Header */}
            <div className="students-page-header">
                <div className="header-text-block">
                    <h1>My Students</h1>
                    <p>View and manage the students assigned to you.</p>
                </div>
                <button
                    type="button"
                    className="students-refresh-btn"
                    onClick={loadStudents}
                    title="Refresh student list"
                >
                    <RefreshCw size={15} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Stat Summary Cards */}
            <div className="teacher-students-kpi-grid">
                <div className="teacher-students-kpi-card">
                    <div className="kpi-icon-pill kpi-icon-blue">
                        <Users size={22} />
                    </div>
                    <div className="kpi-details">
                        <span className="kpi-label">Total Assigned</span>
                        <div className="kpi-number">{students.length}</div>
                        <span className="kpi-caption">Students in your roster</span>
                    </div>
                </div>

                <div className="teacher-students-kpi-card">
                    <div className="kpi-icon-pill kpi-icon-emerald">
                        <UserCheck size={22} />
                    </div>
                    <div className="kpi-details">
                        <span className="kpi-label">Active Learners</span>
                        <div className="kpi-number">{activeStudents.length}</div>
                        <span className="kpi-caption">Currently active</span>
                    </div>
                </div>

                <div className="teacher-students-kpi-card">
                    <div className="kpi-icon-pill kpi-icon-purple">
                        <Calendar size={22} />
                    </div>
                    <div className="kpi-details">
                        <span className="kpi-label">Upcoming Sessions</span>
                        <div className="kpi-number">{scheduledStudentsCount}</div>
                        <span className="kpi-caption">Scheduled next</span>
                    </div>
                </div>
            </div>

            {/* Unified Toolbar (Filter Pills + Search Bar) */}
            <div className="students-unified-toolbar">
                <div className="students-filter-pills">
                    <button
                        type="button"
                        className={`filter-pill-btn ${activeFilter === "All Students" ? "active" : ""}`}
                        onClick={() => setActiveFilter("All Students")}
                    >
                        <span>All Students</span>
                        <span className="filter-pill-count">{students.length}</span>
                    </button>

                    <button
                        type="button"
                        className={`filter-pill-btn ${activeFilter === "Active" ? "active" : ""}`}
                        onClick={() => setActiveFilter("Active")}
                    >
                        <span>Active</span>
                        <span className="filter-pill-count count-active">{activeStudents.length}</span>
                    </button>

                    <button
                        type="button"
                        className={`filter-pill-btn ${activeFilter === "Inactive" ? "active" : ""}`}
                        onClick={() => setActiveFilter("Inactive")}
                    >
                        <span>Inactive</span>
                        <span className="filter-pill-count">{inactiveStudents.length}</span>
                    </button>
                </div>

                <div className="student-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search students by name, grade, school..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            className="search-clear-btn"
                            onClick={() => setSearchTerm("")}
                            title="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="students-error">
                    <strong>Unable to load students.</strong>
                    <span>{error}</span>
                    <button onClick={loadStudents}>Try Again</button>
                </div>
            )}

            {/* Student Table */}
            {!error && (
                <div className="students-table-container">
                    <table className="students-table">
                        <thead>
                            <tr>
                                <th style={{ width: "32%" }}>STUDENT NAME</th>
                                <th style={{ width: "24%" }}>SUBJECTS</th>
                                <th style={{ width: "20%" }}>NEXT SESSION</th>
                                <th style={{ width: "12%" }}>STATUS</th>
                                <th style={{ width: "12%", textAlign: "right" }}>ACTIONS</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="students-empty">
                                        <div className="students-empty-inner">
                                            <div className="empty-icon-circle">
                                                <Users size={24} />
                                            </div>
                                            <h4>No students found</h4>
                                            <p>
                                                {students.length === 0
                                                    ? "No students are currently assigned to you."
                                                    : "No students match your search or filter."}
                                            </p>
                                            {searchTerm && (
                                                <button
                                                    type="button"
                                                    className="empty-reset-btn"
                                                    onClick={() => {
                                                        setSearchTerm("");
                                                        setActiveFilter("All Students");
                                                    }}
                                                >
                                                    Reset Filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => {
                                    const subjects = getSubjects(student);
                                    const status = student.Status || "Inactive";
                                    const rawGrade = student.Grade_Level || student.grade || "";
                                    const formattedGrade = rawGrade
                                        ? rawGrade.replace(/^Grade(\d+)$/i, "Grade $1")
                                        : null;
                                    const metaPieces = [
                                        formattedGrade,
                                        student.school,
                                        student.Learning_Mode ? `Learning Modality: ${student.Learning_Mode}` : null
                                    ].filter(Boolean);

                                    return (
                                        <tr
                                            key={student.user_id}
                                            className="student-row"
                                            onClick={() =>
                                                navigate(`/teacher/students/${student.user_id}`)
                                            }
                                        >
                                            {/* Student Name & Subtitle */}
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
                                                    <div className="student-info-col">
                                                        <span className="student-full-name">
                                                            {student.Name || "Unnamed Student"}
                                                        </span>
                                                        <span className="student-secondary-info">
                                                            {metaPieces.length > 0 ? (
                                                                metaPieces.join(" • ")
                                                            ) : student.Email ? (
                                                                student.Email
                                                            ) : (
                                                                "Enrolled Student"
                                                            )}
                                                        </span>
                                                        {student.previousTutorName && (
                                                            <span className="prev-tutor-chip">
                                                                🔄 Prev: {student.previousTutorName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Subjects */}
                                            <td>
                                                <div className="student-subjects">
                                                    {subjects.length > 0 ? (
                                                        subjects.map((subject, index) => (
                                                            <span key={index} className="subject-tag">
                                                                {subject}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="subject-tag general">
                                                            <BookOpen size={13} />
                                                            <span>General Tutorial</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Next Session */}
                                            <td>
                                                {student.nextSession ? (
                                                    <span className="next-session-pill scheduled">
                                                        <Calendar size={14} />
                                                        <span>{formatNextSession(student)}</span>
                                                    </span>
                                                ) : (
                                                    <span className="next-session-pill unscheduled">
                                                        <Clock size={14} />
                                                        <span>Unscheduled</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td>
                                                <span
                                                    className={`student-status-badge ${
                                                        status.toLowerCase() === "active"
                                                            ? "active"
                                                            : "inactive"
                                                    }`}
                                                >
                                                    <span className="status-live-dot"></span>
                                                    {status}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ textAlign: "right" }}>
                                                <div className="student-action-btn-group">
                                                    <button
                                                        type="button"
                                                        className="action-icon-chat-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate("/teacher/messages");
                                                        }}
                                                        title="Message student"
                                                    >
                                                        <MessageSquare size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-view-profile-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/teacher/students/${student.user_id}`);
                                                        }}
                                                    >
                                                        <span>View</span>
                                                        <ChevronRight size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    );
}

export default TeacherStudents;
