import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotifications } from "../../Services/NotificationContext";

import "./studentHome.css";
import MainHeader from "../../MainComponent/MainHeader";
import { useNavigate } from "react-router-dom";

import {Target
        ,Clock3
        ,Calendar
        ,Book
} from "lucide-react";

function StudentHome() {

    const [student, setStudent] = useState(null);

    const [subjects, setSubjects] = useState([]);

    const [newMaterialsCount, setNewMaterialsCount] = useState(0);

    const [overallProgress, setOverallProgress] = useState(0);

    const [attendancePercentage, setAttendancePercentage] = useState(0);

    const [attendedCount, setAttendedCount] = useState(0);

    const [totalClasses, setTotalClasses] = useState(0);

    const [nextClass, setNextClass] = useState(null);

    const [recentActivities, setRecentActivities] = useState([]);

    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();


    const {
        unreadCount
    } = useNotifications();


    // ==========================================
    // LOAD DASHBOARD
    // ==========================================

    useEffect(() => {

        loadDashboard();

    }, []);


    async function loadDashboard() {

        setLoading(true);

        try {

            // ==========================================
            // GET AUTH USER
            // ==========================================

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser();


            if (authError || !user) {

                console.log(
                    "Authentication error:",
                    authError
                );

                return;

            }


            // ==========================================
            // GET STUDENT
            // ==========================================

            const {
                data: studentData,
                error: studentError
            } = await supabase
                .from("users")
                .select("*")
                .eq("auth_id", user.id)
                .single();


            if (studentError) {

                console.log(
                    "Student error:",
                    studentError
                );

                return;

            }


            setStudent(studentData);


            // ==========================================
            // LOAD EVERYTHING ELSE
            // ==========================================

            await Promise.all([

                loadMaterials(
                    studentData.id
                ),

                loadSubjects(
                    studentData.id
                ),

                loadAttendance(
                    studentData.id
                ),

                loadNextClass(
                    studentData.id
                ),

                loadProgress(
                    studentData.id
                ),

                loadRecentActivity(
                    studentData.id
                )

            ]);

        } catch (error) {

            console.log(
                "Dashboard loading error:",
                error
            );

        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // MATERIALS
    // ==========================================

    async function loadMaterials(studentId) {

        const {
            data,
            error
        } = await supabase

            .from("Material_Assignment")

            .select(`
                ID,
                Material_ID,
                Student_ID,
                Materials(
                    Material_ID,
                    Material_Name,
                    file_name
                )
            `)

            .eq(
                "Student_ID",
                studentId
            );


        if (error) {

            console.log(
                "Material loading error:",
                error
            );

            return;

        }


        const materials =
            data?.filter(
                item =>
                    item.Materials
            ) || [];


        setNewMaterialsCount(
            materials.length
        );

    }


    // ==========================================
    // SUBJECTS
    // ==========================================

    async function loadSubjects(studentId) {

        const {
            data,
            error
        } = await supabase

            .from("Material_Assignment")

            .select(`
                ID,
                Student_ID,

                Materials(
                    Material_ID,
                    Material_Name,

                    Subjects(
                        Subject_ID,
                        Subject_Name
                    )
                )
            `)

            .eq(
                "Student_ID",
                studentId
            );


        if (error) {

            console.log(
                "Subject loading error:",
                error
            );

            return;

        }


        const subjectMap = new Map();


        data?.forEach(item => {

            const subject =
                item.Materials?.Subjects;


            if (
                subject &&
                !subjectMap.has(
                    subject.Subject_ID
                )
            ) {

                subjectMap.set(
                    subject.Subject_ID,
                    subject
                );

            }

        });


        setSubjects(
            Array.from(
                subjectMap.values()
            )
        );

    }


    // ==========================================
    // ATTENDANCE
    // ==========================================

    async function loadAttendance(studentId) {

        const {
            data,
            error
        } = await supabase

            .from("calendar")

            .select(
                "id, status, start_datetime"
            )

            .eq(
                "student_id",
                studentId
            );


        if (error) {

            console.log(
                "Attendance loading error:",
                error
            );

            return;

        }


        const attended =
            data?.filter(
                session =>
                    session.status === "Attended"
            ).length || 0;


        const absent =
            data?.filter(
                session =>
                    session.status === "Absent"
            ).length || 0;


        const total =
            attended + absent;


        const percentage =
            total > 0
                ? Math.round(
                    (attended / total) * 100
                )
                : 0;


        setAttendedCount(
            attended
        );


        setTotalClasses(
            total
        );


        setAttendancePercentage(
            percentage
        );

    }


    // ==========================================
    // NEXT CLASS
    // ==========================================

    async function loadNextClass(studentId) {

        const now =
            new Date().toISOString();


        const {
            data,
            error
        } = await supabase

            .from("calendar")

            .select(`
                id,
                title,
                start_datetime,
                end_datetime,
                status,
                meeting_platform
            `)

            .eq(
                "student_id",
                studentId
            )

            .eq(
                "status",
                "Confirmed"
            )

            .gte(
                "start_datetime",
                now
            )

            .order(
                "start_datetime",
                {
                    ascending: true
                }
            )

            .limit(1);


        if (error) {

            console.log(
                "Next class error:",
                error
            );

            return;

        }


        setNextClass(
            data?.[0] || null
        );

    }


    // ==========================================
    // OVERALL PROGRESS
    // ==========================================

    async function loadProgress(studentId) {

        const {
            data,
            error
        } = await supabase

            .from("Assignment_Submissions")

            .select(`
                Submission_ID,
                Assignment_ID,
                Student_ID,
                Score,
                Status
            `)

            .eq(
                "Student_ID",
                studentId
            );


        if (error) {

            console.log(
                "Progress loading error:",
                error
            );

            return;

        }


        const graded =
            data?.filter(
                submission =>
                    submission.Score !== null &&
                    submission.Score !== undefined
            ) || [];


        if (
            graded.length === 0
        ) {

            setOverallProgress(0);

            return;

        }


        // ==========================================
        // GET ASSIGNMENT TOTAL POINTS
        // ==========================================

        const assignmentIds =
            graded.map(
                submission =>
                    submission.Assignment_ID
            );


        const {
            data: assignments,
            error: assignmentError
        } = await supabase

            .from("Assignments")

            .select(`
                Assignment_ID,
                Total_Points
            `)

            .in(
                "Assignment_ID",
                assignmentIds
            );


        if (assignmentError) {

            console.log(
                "Assignment points error:",
                assignmentError
            );

            return;

        }


        let earnedPoints = 0;

        let totalPoints = 0;


        graded.forEach(
            submission => {

                const assignment =
                    assignments?.find(
                        item =>
                            item.Assignment_ID ===
                            submission.Assignment_ID
                    );


                if (!assignment) {
                    return;
                }


                earnedPoints +=
                    Number(
                        submission.Score
                    ) || 0;


                totalPoints +=
                    Number(
                        assignment.Total_Points
                    ) || 0;

            }
        );


        const progress =
            totalPoints > 0
                ? Math.round(
                    (earnedPoints / totalPoints) *
                    100
                )
                : 0;


        setOverallProgress(
            progress
        );

    }


    // ==========================================
    // RECENT ACTIVITY
    // ==========================================

    async function loadRecentActivity(studentId) {

        const activities = [];


        // ==========================================
        // RECENT SUBMISSIONS
        // ==========================================

        const {
        data: submissions,
        error: submissionError
    } = await supabase
        .from("Assignment_Submissions")
        .select(`
            Submission_ID,
            Assignment_ID,
            Submitted_At,
            Score,
            Status,
            Assignments(
                Assignment_ID,
                Total_Points,
                Materials(
                    Material_Name
                )
            )
        `)
        .eq("Student_ID", studentId)
        .order("Submitted_At", {
            ascending: false
        })
        .limit(5);

        if (submissionError) {

            console.log(
                "Submission activity error:",
                submissionError
            );

        }


        if (submissions?.length) {

            const assignmentIds =
                submissions.map(
                    item =>
                        item.Assignment_ID
                );


            const {
                data: assignments
            } = await supabase

                .from("Assignments")

                .select(`
                    Assignment_ID,
                    Assignment_Type,
                    Materials(
                        Material_Name
                    )
                `)

                .in(
                    "Assignment_ID",
                    assignmentIds
                );


            submissions.forEach(submission => {

                const assignment = submission.Assignments;

                if (!assignment) {
                    return;
                }

                activities.push({

                    id: `submission-${submission.Submission_ID}`,

                    title:
                        assignment.Materials?.Material_Name ||
                        "Assignment",

                    description:
                        submission.Score !== null
                            ? "Assignment graded"
                            : "Assignment submitted",

                    score: submission.Score,

                    total: assignment.Total_Points,

                    date: submission.Submitted_At,

                    icon:
                        submission.Score !== null
                            ? "✓"
                            : "📝"

                });

            });
        }


        // ==========================================
        // RECENT ASSIGNED MATERIALS
        // ==========================================

        const {
            data: materials,
            error: materialError
        } = await supabase

            .from("Material_Assignment")

            .select(`
                ID,
                Material_ID,

                Materials(
                    Material_ID,
                    Material_Name
                )
            `)

            .eq(
                "Student_ID",
                studentId
            )

            .order(
                "ID",
                {
                    ascending: false
                }
            )

            .limit(5);


        if (materialError) {

            console.log(
                "Material activity error:",
                materialError
            );

        }


        materials?.forEach(
            material => {

                if (!material.Materials) {
                    return;
                }


                activities.push({

                    id:
                        `material-${material.ID}`,

                    title:
                        material.Materials.Material_Name,

                    description:
                        "Learning material assigned",

                    score:
                        null,
                    total:
                        null,

                    date:
                        null,

                    icon:
                        "📚"

                });

            }
        );


        // ==========================================
        // SORT
        // ==========================================

        activities.sort(
            (a, b) => {

                const dateA =
                    a.date
                        ? new Date(a.date)
                        : new Date(0);


                const dateB =
                    b.date
                        ? new Date(b.date)
                        : new Date(0);


                return dateB - dateA;

            }
        );


        setRecentActivities(
            activities.slice(0, 5)
        );

    }


    // ==========================================
    // DATE FORMAT
    // ==========================================

    function formatDate(date) {

        if (!date) {
            return "";
        }


        return new Date(
            date
        ).toLocaleDateString(
            undefined,
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );

    }


    // ==========================================
    // TIME FORMAT
    // ==========================================

    function formatTime(start, end) {

        if (!start) {
            return "";
        }


        const startTime =
            new Date(
                start
            ).toLocaleTimeString(
                undefined,
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            );


        if (!end) {
            return startTime;
        }


        const endTime =
            new Date(
                end
            ).toLocaleTimeString(
                undefined,
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            );


        return `${startTime} - ${endTime}`;

    }


    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="student-home-loading">

                Loading dashboard...

            </div>

        );

    }


    // ==========================================
    // UI
    // ==========================================

    return (

        <div className="student-home">


          


            {/* =================================
                WELCOME
            ================================= */}

            <section className="student-welcome-card">

                <div>

                    <h1>

                        Welcome back,{" "}

                        {student?.Name ||
                            "Student"}

                        ! 👋

                    </h1>


                    <p>

                        {newMaterialsCount > 0

                            ? `You have ${newMaterialsCount} learning material${newMaterialsCount === 1 ? "" : "s"} to review.`

                            : "You're all caught up with your learning materials!"
                        }

                    </p>


                    <button onClick={()=>
                        {
                            navigate('/student/materials')
                        }
                    }>

                        ▶ Resume Learning

                    </button>

                </div>


                <div className="welcome-icon">

                    🎓

                </div>

            </section>


            {/* =================================
                STATISTICS
            ================================= */}

            <section className="student-stats">


                {/* Overall Progress */}

                <div className="student-stat-card">

                    <div className="stat-title">

                        Overall Progress

                        <span>
                            <Target color="Blue"/>
                        </span>

                    </div>


                    <h2>

                        {overallProgress}%

                    </h2>


                    <p>

                        Based on graded assignments

                    </p>

                </div>


                {/* Attendance */}

                <div className="student-stat-card">

                    <div className="stat-title">

                        Attendance Rate

                        <span>
                            <Clock3 color="Green"/>
                        </span>

                    </div>


                    <h2>

                        {attendancePercentage}%

                    </h2>


                    <p>

                        Present in{" "}

                        {attendedCount}

                        /

                        {totalClasses}

                        {" "}classes

                    </p>

                </div>


                {/* Next Class */}

                <div className="student-stat-card">

                    <div className="stat-title">

                        Next Class

                        <span>
                            <Calendar color="Orange"/>
                        </span>

                    </div>


                    {nextClass ? (

                        <>

                            <h2>

                                {nextClass.title}

                            </h2>


                            <p>

                                {formatDate(
                                    nextClass.start_datetime
                                )}

                                {" • "}

                                {formatTime(
                                    nextClass.start_datetime,
                                    nextClass.end_datetime
                                )}

                            </p>

                        </>

                    ) : (

                        <>

                            <h2>
                                None
                            </h2>

                            <p>
                                No upcoming confirmed class
                            </p>

                        </>

                    )}

                </div>


            </section>


            {/* =================================
                SUBJECTS
            ================================= */}

            <section className="student-section">

                <h2>
                    My Subjects
                </h2>


                <div className="student-subject-grid">

                    {subjects
                        .slice(0, 5)
                        .map(
                            (subject, index) => (

                                <div
                                    className="student-dashboard-subject-card"
                                    key={
                                        subject.Subject_ID ||
                                        index
                                    }
                                    onClick={()=>navigate(`/student/materials/subject/${subject.Subject_ID}`)}
                                >

                                    <div className="subject-icon">

                                        📚

                                    </div>


                                    <h3>

                                        {
                                            subject.Subject_Name
                                        }

                                    </h3>


                                    <p>

                                        Learning materials

                                    </p>

                                </div>

                            )
                        )
                    }


                    {subjects.length === 0 && (

                        <p>

                            No subjects assigned yet.

                        </p>

                    )}

                </div>

            </section>


            {/* =================================
                RECENT ACTIVITY
            ================================= */}

            <section className="student-section">

                <h2>
                    Recent Activity
                </h2>


                <div className="recent-activity-card">


                    {recentActivities.length === 0 ? (

                        <div className="activity-empty">

                            No recent activity yet.

                        </div>

                    ) : (

                        recentActivities.map(
                            activity => (

                                <div
                                    className="activity-item"
                                    key={
                                        activity.id
                                    }
                                >


                                    <div className="activity-icon">

                                        {
                                            activity.icon
                                        }

                                    </div>


                                    <div className="activity-content">

                                        <strong>

                                            {
                                                activity.title
                                            }

                                        </strong>


                                        <p>

                                            {
                                                activity.description
                                            }

                                        </p>

                                    </div>


                                    {activity.score !== null ? (

                                        <div className="activity-score">

                                            <strong>

                                                {
                                                    activity.score
                                                }   
                                                /
                                                {
                                                    activity.total
                                                }

                                            </strong>


                                            <small>

                                                {formatDate(
                                                    activity.date
                                                )}

                                            </small>

                                        </div>

                                    ) : (

                                        activity.date && (

                                            <div className="activity-date">

                                                {
                                                    formatDate(
                                                        activity.date
                                                    )
                                                }

                                            </div>

                                        )

                                    )}

                                </div>

                            )
                        )

                    )}

                </div>

            </section>


        </div>

    );

}


export default StudentHome;