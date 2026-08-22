import './adminMain.css';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import MainHeader from '../../MainComponent/MainHeader';

function AdminMain() {

    // ==========================================
    // STATE
    // ==========================================

    const [studentCount, setStudentCount] = useState(0);

    const [recentPayments, setRecentPayments] = useState([]);

    const [tutorCount, setTutorCount] = useState(0);

    const [scheduledSessions, setScheduledSessions] = useState(0);

    const [todaySchedule, setTodaySchedule] = useState([]);

    const [monthlyRevenue, setMonthlyRevenue] = useState(0);

    const [loading, setLoading] = useState(true);

    const [admin, setAdmin] = useState(null);


    const navigate = useNavigate();


    // ==========================================
    // INITIALIZE
    // ==========================================

    useEffect(() => {

        async function init() {

            setLoading(true);

            await loadDashboard();

            setLoading(false);

        }

        init();

    }, []);


    // ==========================================
    // LOAD DASHBOARD
    // ==========================================

    async function loadDashboard() {

        await Promise.all([

            getStudentCount(),

            getTutorCount(),

            getScheduledSessions(),

            getMonthlyRevenue(),

            getRecentTransactions(),

            getTodaySchedule(),

            getLoggedInAdmin()

        ]);

    }


    // ==========================================
    // LOGGED IN ADMIN
    // ==========================================

    async function getLoggedInAdmin() {

        const {
            data: { user },
        } = await supabase.auth.getUser();


        if (!user) {
            return;
        }


        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq(
                "auth_id",
                user.id
            )
            .single();


        if (error) {

            console.error(
                "Admin loading error:",
                error
            );

            return;

        }


        setAdmin(data);

    }


    // ==========================================
    // STUDENT COUNT
    // ==========================================

    async function getStudentCount() {

        const {
            count,
            error
        } = await supabase
            .from("users")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq(
                "Role",
                "Student"
            );


        if (error) {

            console.error(
                "Student count error:",
                error
            );

            return;

        }


        setStudentCount(
            count || 0
        );

    }


    // ==========================================
    // ACTIVE TUTOR COUNT
    // ==========================================

    async function getTutorCount() {

        const {
            count,
            error
        } = await supabase
            .from("users")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq(
                "Role",
                "Tutor"
            )
            .eq(
                "Status",
                "Active"
            );


        if (error) {

            console.error(
                "Tutor count error:",
                error
            );

            return;

        }


        setTutorCount(
            count || 0
        );

    }


    // ==========================================
    // SCHEDULED SESSIONS
    // ==========================================

  // ==========================================
    // SCHEDULED SESSIONS — THIS WEEK
    // ==========================================

    async function getScheduledSessions() {

        const now = new Date();

        // Start of current week (Sunday)
        const startOfWeek = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - now.getDay(),
            0,
            0,
            0
        );

        // End of current week (Saturday)
        const endOfWeek = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + (6 - now.getDay()),
            23,
            59,
            59
        );


        const {
            data,
            error
        } = await supabase
            .from("calendar")
            .select(`
                id,
                status,
                start_datetime
            `)
            .gte(
                "start_datetime",
                startOfWeek.toISOString()
            )
            .lte(
                "start_datetime",
                endOfWeek.toISOString()
            )
            .in(
                "status",
                [
                    "Pending",
                    "Confirmed"
                ]
            );


        if (error) {

            console.error(
                "Scheduled sessions error:",
                error
            );

            return;

        }


        setScheduledSessions(
            data?.length || 0
        );

    }


    // ==========================================
    // MONTHLY REVENUE
    // ==========================================

    async function getMonthlyRevenue() {

        const now =
            new Date();


        const firstDay =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );


        const {
            data,
            error
        } = await supabase
            .from("payments")
            .select("amount")
            .eq(
                "status",
                "Completed"
            )
            .gte(
                "payment_date",
                firstDay.toISOString()
            );


        if (error) {

            console.error(
                "Monthly revenue error:",
                error
            );

            return;

        }


        const total =
            (data || []).reduce(
                (
                    sum,
                    payment
                ) =>
                    sum +
                    Number(
                        payment.amount || 0
                    ),
                0
            );


        setMonthlyRevenue(
            total
        );

    }


    // ==========================================
    // RECENT TRANSACTIONS
    // ==========================================

    async function getRecentTransactions() {

        const {
            data,
            error
        } = await supabase
            .from("payments")
            .select(`
                *,
                student:users!payments_student_id_fkey(
                    id,
                    Name,
                    detail_id
                )
            `)
            .order(
                "payment_date",
                {
                    ascending: false
                }
            )
            .limit(9);


        if (error) {

            console.error(
                "Recent transactions error:",
                error
            );

            return;

        }


        const payments = data || [];

        const detailIds = payments
            .map(payment => payment.student?.detail_id)
            .filter(Boolean);

        let details = [];

        if (detailIds.length > 0) {

            const {
                data: detailData,
                error: detailError
            } = await supabase
                .from("user_details")
                .select(`
                    detail_id,
                    profile_url
                `)
                .in("detail_id", detailIds);

            if (detailError) {
                console.error(
                    "Student profile error:",
                    detailError
                );
            } else {
                details = detailData || [];
            }
        }

        const paymentsWithProfiles = payments.map(payment => {

            const profile = details.find(
                detail =>
                    detail.detail_id ===
                    payment.student?.detail_id
            );

            return {
                ...payment,

                student: {
                    ...payment.student,

                    profile_url:
                        profile?.profile_url || null
                }
            };
        });

        setRecentPayments(
            paymentsWithProfiles
        );

    }


    // ==========================================
    // TODAY'S SCHEDULE
    // ==========================================

    async function getTodaySchedule() {

        const now =
            new Date();


        const startOfDay =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0,
                0,
                0
            );


        const endOfDay =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                23,
                59,
                59
            );


        const {
            data,
            error
        } = await supabase
            .from("calendar")
            .select(`
                id,
                title,
                status,
                start_datetime,
                end_datetime
            `)
            .gte(
                "start_datetime",
                startOfDay.toISOString()
            )
            .lte(
                "start_datetime",
                endOfDay.toISOString()
            )
            .in(
                "status",
                [
                    "Pending",
                    "Confirmed"
                ]
            )
            .order(
                "start_datetime",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "Today's schedule error:",
                error
            );

            return;

        }


        setTodaySchedule(
            data || []
        );

    }


    // ==========================================
    // FORMAT TIME
    // ==========================================

    function formatTime(date) {

        if (!date) {
            return "—";
        }


        return new Date(
            date
        ).toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    }

    
    // ==========================================
    // FORMAT Date
    // ==========================================

    function formatDate(date) {

        if (!date) {
            return "—";
        }

        return new Date(date).toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );

    }


    // ==========================================
    // FORMAT CURRENCY
    // ==========================================

    function formatCurrency(value) {

        return new Intl.NumberFormat(
            "en-PH",
            {
                style: "currency",
                currency: "PHP",
                maximumFractionDigits: 0
            }
        ).format(value);

    }

    //=======================
    //for profile
    //================
    function getStudentInitials(name) {

        if (!name) {
            return "?";
        }

        const words = name
            .trim()
            .split(/\s+/);

        if (words.length === 1) {
            return words[0]
                .charAt(0)
                .toUpperCase();
        }

        return (
            words[0].charAt(0) +
            words[words.length - 1].charAt(0)
        ).toUpperCase();
    }

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="admin-dashboard-loading">

                <div className="admin-dashboard-spinner"></div>

                <p>
                    Loading dashboard...
                </p>

            </div>

        );

    }


    // ==========================================
    // UI
    // ==========================================

    return (

        <div id="theRoot">


            {/* ==================================
                HEADER
            ================================== */}

            <MainHeader/>

            <h1 id="dashboardTitle">
                Dashboard Overview
            </h1>


            <div id="welcomeText">

                Welcome back,{" "}

                <strong>
                    {admin?.Name || "Admin"}
                </strong>.

                {" "}Here's what's happening today.

            </div>


            {/* ==================================
                KPI CARDS
            ================================== */}

            <div className="AdminDashboardNumberPanel">


                {/* STUDENTS */}

                <div className="NumberBox">

                    <span>
                        Total Students
                    </span>

                    <h1>
                        {studentCount.toLocaleString()}
                    </h1>

                </div>


                {/* TUTORS */}

                <div className="NumberBox">

                    <span>
                        Active Tutors
                    </span>

                    <h1>
                        {tutorCount.toLocaleString()}
                    </h1>

                </div>


                {/* SESSIONS */}

                <div className="NumberBox">

                    <span>
                        Scheduled Sessions
                    </span>

                    <h1>
                        {scheduledSessions.toLocaleString()}
                    </h1>

                </div>


                {/* REVENUE */}

                <div className="NumberBox">

                    <span>
                        Monthly Revenue
                    </span>

                    <h1>
                        {formatCurrency(
                            monthlyRevenue
                        )}
                    </h1>

                </div>

            </div>


            {/* ==================================
                LOWER DASHBOARD
            ================================== */}

            <div className="AdminLowerDashboardPanel">


                {/* ==================================
                    RECENT TRANSACTIONS
                ================================== */}

                <div className="RecentTransactionPanel">


                    <div id="RecentTransactionBanner">

                        <span
                            style={{
                                fontSize: "16px",
                                fontFamily:
                                    "Inter, sans-serif",
                                fontWeight: "500"
                            }}
                        >
                            Recent Transactions
                        </span>


                        <span
                            className="viewall"
                            onClick={() =>
                                navigate(
                                    "/admin/payment"
                                )
                            }
                        >
                            View All
                        </span>

                    </div>


                    <table className="student-table">

                        <thead>

                            <tr>

                                <th>
                                    Transaction ID
                                </th>

                                <th>
                                    Student
                                </th>

                                <th>
                                    Amount
                                </th>

                                <th>
                                    Date
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {recentPayments.length === 0 ? (

                                <tr>

                                    <td colSpan="5">

                                        No recent transactions.

                                    </td>

                                </tr>

                            ) : (

                                recentPayments.map(
                                    payment => (

                                        <tr
                                            key={
                                                payment.payment_id
                                            }
                                        >

                                            <td>
                                                {
                                                    payment.payment_id
                                                }
                                            </td>


                                            <td>

                                                <div className="transaction-student">

                                                    {payment.student?.profile_url ? (

                                                        <img
                                                            src={payment.student.profile_url}
                                                            alt={
                                                                payment.student?.Name ||
                                                                "Student"
                                                            }
                                                            className="transaction-student-image"
                                                        />

                                                    ) : (

                                                        <div className="transaction-student-initials">

                                                            {getStudentInitials(
                                                                payment.student?.Name
                                                            )}

                                                        </div>

                                                    )}

                                                    <span>
                                                        {
                                                            payment.student?.Name ??
                                                            "Unknown Student"
                                                        }
                                                    </span>

                                                </div>

                                            </td>

                                            <td>

                                                {formatCurrency(
                                                    payment.amount
                                                )}

                                            </td>


                                          <td className='data-date'>

                                                {formatDate(
                                                    payment.payment_date
                                                )}

                                          </td>


                                            <td>

                                                <span
                                                    className={
                                                        `status ${
                                                            payment.status
                                                                ?.toLowerCase()
                                                        }`
                                                    }
                                                >
                                                    {
                                                        payment.status
                                                    }
                                                </span>

                                            </td>

                                        </tr>

                                    )
                                )

                            )}

                        </tbody>

                    </table>

                </div>


                {/* ==================================
                    TODAY'S SCHEDULE
                ================================== */}

                <div className="TodaySchedulePanel">


                    <div id="RecentTransactionBanner">

                        <span
                            style={{
                                fontSize: "16px",
                                fontFamily:
                                    "Inter, sans-serif",
                                fontWeight: "500"
                            }}
                        >
                            Today's Schedule
                        </span>


                        <span
                            className="viewall"
                            onClick={() =>
                                navigate(
                                    "/admin/schedule"
                                )
                            }
                        >
                            Calendar
                        </span>

                    </div>


                    <table className="TodaySchedule-table">

                        <thead>

                            <tr>

                                <th>
                                    Time
                                </th>

                                <th>
                                    Session
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {todaySchedule.length === 0 ? (

                                <tr>

                                    <td
                                        colSpan="3"
                                        className="empty-schedule"
                                    >

                                        No sessions scheduled
                                        for today.

                                    </td>

                                </tr>

                            ) : (

                                todaySchedule.map(
                                    session => (

                                        <tr
                                            key={
                                                session.id
                                            }
                                        >

                                            <td>

                                                {formatTime(
                                                    session.start_datetime
                                                )}

                                            </td>


                                            <td>

                                                {session.title ||
                                                    "Tutorial Session"}

                                            </td>


                                            <td>

                                                <span
                                                    className={
                                                        `status ${
                                                            session.status
                                                                ?.toLowerCase()
                                                        }`
                                                    }
                                                >

                                                    {
                                                        session.status
                                                    }

                                                </span>

                                            </td>

                                        </tr>

                                    )
                                )

                            )}

                        </tbody>

                    </table>

                </div>

            </div>

        </div>

    );

}

export default AdminMain;