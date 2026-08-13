import { useEffect, useState } from "react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";

import { supabase } from "../../lib/supabase";

import "./adminReport.css";


function AdminReport() {

    // ==========================================
    // STATE
    // ==========================================

    const [loading, setLoading] = useState(true);

    const [dateRange, setDateRange] = useState("30");

    const [showRevenueDetails, setShowRevenueDetails] =
        useState(false);

    const [reportData, setReportData] = useState({

        revenue: 0,
        sessions: 0,
        avgRating: 0,
        newEnrollments: 0,

        revenueByMonth: [],
        sessionsByStatus: [],

        completedPayments: [],
        sessionsData: [],
        ratingsData: [],
        enrollmentsData: []

    });


    // ==========================================
    // LOAD REPORT DATA
    // ==========================================

    useEffect(() => {

        loadReportData();

    }, [dateRange]);


    async function loadReportData() {

        setLoading(true);

        try {

            const today = new Date();

            const startDate = new Date();

            startDate.setDate(
                today.getDate() - Number(dateRange)
            );

            const startISO =
                startDate.toISOString();


            // ======================================
            // PAYMENTS
            // ======================================

            const {
                data: payments,
                error: paymentError
            } = await supabase
                .from("payments")
                .select(`
                    payment_id,
                    student_id,
                    amount,
                    payment_date,
                    status,
                    subscription_start,
                    subscription_expires,
                    remarks
                `)
                .gte(
                    "payment_date",
                    startISO
                )
                .order(
                    "payment_date",
                    {
                        ascending: false
                    }
                );


            if (paymentError) {
                throw paymentError;
            }


            // ======================================
            // SESSIONS
            // ======================================

            const {
                data: sessions,
                error: sessionError
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
                    startISO
                );


            if (sessionError) {
                throw sessionError;
            }


            // ======================================
            // RATINGS
            // ======================================

            const {
                data: ratings,
                error: ratingError
            } = await supabase
                .from("Session_Ratings")
                .select(`
                    Rating_ID,
                    Rating,
                    created_at
                `)
                .gte(
                    "created_at",
                    startISO
                );


            if (ratingError) {
                throw ratingError;
            }


            // ======================================
            // NEW ENROLLMENTS
            // ======================================

            const {
                data: users,
                error: userError
            } = await supabase
                .from("users")
                .select(`
                    id,
                    Name,
                    Email,
                    Role,
                    Joined
                `)
                .eq(
                    "Role",
                    "Student"
                )
                .gte(
                    "Joined",
                    startDate
                        .toISOString()
                        .split("T")[0]
                );


            if (userError) {
                throw userError;
            }


            // ======================================
            // COMPLETED PAYMENTS
            // ======================================

            const completedPayments =
                (payments || []).filter(
                    payment =>
                        payment.status ===
                        "Completed"
                );


            const totalRevenue =
                completedPayments.reduce(
                    (total, payment) =>
                        total +
                        Number(
                            payment.amount || 0
                        ),
                    0
                );


            // ======================================
            // AVERAGE RATING
            // ======================================

            const validRatings =
                (ratings || []).filter(
                    rating =>
                        rating.Rating !== null &&
                        rating.Rating !== undefined
                );


            const averageRating =
                validRatings.length
                    ? validRatings.reduce(
                        (total, rating) =>
                            total +
                            Number(
                                rating.Rating
                            ),
                        0
                    ) /
                    validRatings.length
                    : 0;


            // ======================================
            // REVENUE BY MONTH
            // ======================================

            const monthlyRevenue = {};


            completedPayments.forEach(
                payment => {

                    const date =
                        new Date(
                            payment.payment_date
                        );


                    const month =
                        date.toLocaleString(
                            "en-US",
                            {
                                month: "short",
                                year: "numeric"
                            }
                        );


                    if (
                        !monthlyRevenue[month]
                    ) {

                        monthlyRevenue[month] = 0;

                    }


                    monthlyRevenue[month] +=
                        Number(
                            payment.amount || 0
                        );

                }
            );


            const revenueByMonth =
                Object.entries(
                    monthlyRevenue
                )
                    .map(
                        ([month, revenue]) => ({
                            month,
                            revenue
                        })
                    )
                    .reverse();


            // ======================================
            // SESSIONS BY STATUS
            // ======================================

            const statusCounts = {};


            (sessions || []).forEach(
                session => {

                    const status =
                        session.status ||
                        "Unknown";


                    statusCounts[status] =
                        (
                            statusCounts[status] ||
                            0
                        ) + 1;

                }
            );


            const sessionsByStatus =
                Object.entries(
                    statusCounts
                ).map(
                    ([name, value]) => ({
                        name,
                        value
                    })
                );


            // ======================================
            // SET DATA
            // ======================================

            setReportData({

                revenue:
                    totalRevenue,

                sessions:
                    sessions?.length || 0,

                avgRating:
                    Number(
                        averageRating.toFixed(1)
                    ),

                newEnrollments:
                    users?.length || 0,

                revenueByMonth,

                sessionsByStatus,

                completedPayments,

                sessionsData:
                    sessions || [],

                ratingsData:
                    ratings || [],

                enrollmentsData:
                    users || []

            });


        } catch (error) {

            console.error(
                "Admin report loading error:",
                error
            );

        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // PIE COLORS
    // ==========================================

    const pieColors = [
        "#315B78",
        "#6C8EAD",
        "#8FB3C9",
        "#B7CAD8",
        "#D9E3EA"
    ];


    // ==========================================
    // FORMAT MONEY
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


    // ==========================================
    // FORMAT DATE
    // ==========================================

    function formatDate(date) {

        if (!date) {
            return "—";
        }

        return new Date(
            date
        ).toLocaleDateString(
            "en-PH",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );

    }


    // ==========================================
    // EXPORT CSV
    // ==========================================

    function exportReportData() {

        const rows = [];


        // ======================================
        // REPORT SUMMARY
        // ======================================

        rows.push([
            "YOSEF Tutorial Center - Reports & Analytics"
        ]);

        rows.push([]);

        rows.push([
            "Date Range",
            `Last ${dateRange} Days`
        ]);

        rows.push([
            "Total Revenue",
            reportData.revenue
        ]);

        rows.push([
            "Total Sessions",
            reportData.sessions
        ]);

        rows.push([
            "Average Tutor Rating",
            reportData.avgRating
        ]);

        rows.push([
            "New Enrollments",
            reportData.newEnrollments
        ]);

        rows.push([]);


        // ======================================
        // PAYMENTS
        // ======================================

        rows.push([
            "COMPLETED PAYMENTS"
        ]);

        rows.push([
            "Payment ID",
            "Student ID",
            "Amount",
            "Payment Date",
            "Status",
            "Subscription Start",
            "Subscription Expires",
            "Remarks"
        ]);


        reportData.completedPayments.forEach(
            payment => {

                rows.push([
                    payment.payment_id,
                    payment.student_id,
                    payment.amount,
                    formatDate(
                        payment.payment_date
                    ),
                    payment.status,
                    formatDate(
                        payment.subscription_start
                    ),
                    formatDate(
                        payment.subscription_expires
                    ),
                    payment.remarks || ""
                ]);

            }
        );


        rows.push([]);


        // ======================================
        // SESSIONS
        // ======================================

        rows.push([
            "SESSIONS"
        ]);

        rows.push([
            "Session ID",
            "Title",
            "Status",
            "Start",
            "End"
        ]);


        reportData.sessionsData.forEach(
            session => {

                rows.push([
                    session.id,
                    session.title || "",
                    session.status || "",
                    formatDate(
                        session.start_datetime
                    ),
                    formatDate(
                        session.end_datetime
                    )
                ]);

            }
        );


        rows.push([]);


        // ======================================
        // RATINGS
        // ======================================

        rows.push([
            "SESSION RATINGS"
        ]);

        rows.push([
            "Rating ID",
            "Rating",
            "Date"
        ]);


        reportData.ratingsData.forEach(
            rating => {

                rows.push([
                    rating.Rating_ID,
                    rating.Rating,
                    formatDate(
                        rating.created_at
                    )
                ]);

            }
        );


        rows.push([]);


        // ======================================
        // ENROLLMENTS
        // ======================================

        rows.push([
            "NEW ENROLLMENTS"
        ]);

        rows.push([
            "Student ID",
            "Name",
            "Email",
            "Joined"
        ]);


        reportData.enrollmentsData.forEach(
            student => {

                rows.push([
                    student.id,
                    student.Name || "",
                    student.Email || "",
                    student.Joined || ""
                ]);

            }
        );


        // ======================================
        // CSV CONVERSION
        // ======================================

        const csv =
            rows
                .map(row =>
                    row
                        .map(value => {

                            const stringValue =
                                String(
                                    value ?? ""
                                );

                            return `"${stringValue.replace(
                                /"/g,
                                '""'
                            )}"`;

                        })
                        .join(",")
                )
                .join("\n");


        const blob =
            new Blob(
                [csv],
                {
                    type:
                        "text/csv;charset=utf-8;"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href = url;

        link.download =
            `YOSEF_Report_Last_${dateRange}_Days.csv`;


        document.body.appendChild(
            link
        );

        link.click();

        document.body.removeChild(
            link
        );

        URL.revokeObjectURL(
            url
        );

    }


    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="admin-report-loading">

                <div className="report-spinner"></div>

                <p>
                    Loading reports...
                </p>

            </div>

        );

    }


    // ==========================================
    // UI
    // ==========================================

    return (

        <div className="admin-report-page">


            {/* ==================================
                HEADER
            ================================== */}

            <div className="admin-report-header">

                <div>

                    <h1>
                        Reports & Analytics
                    </h1>

                    <p>
                        Monitor the performance of
                        YOSEF's Tutorial Center.
                    </p>

                </div>

            </div>


            {/* ==================================
                FILTER BAR
            ================================== */}

            <div className="report-filter-bar">

                <div className="report-filter-group">

                    <select
                        value={dateRange}
                        onChange={event =>
                            setDateRange(
                                event.target.value
                            )
                        }
                    >

                        <option value="7">
                            Last 7 Days
                        </option>

                        <option value="30">
                            Last 30 Days
                        </option>

                        <option value="90">
                            Last 90 Days
                        </option>

                        <option value="365">
                            Last Year
                        </option>

                    </select>


                    <select>

                        <option>
                            All Subjects
                        </option>

                    </select>

                </div>


                <button
                    className="export-report-button"
                    onClick={
                        exportReportData
                    }
                >

                    ↓ Export Data

                </button>

            </div>


            {/* ==================================
                KPI CARDS
            ================================== */}

            <div className="report-kpi-grid">


                <div className="report-kpi-card">

                    <div className="kpi-card-top">

                        <span>
                            Total Revenue
                        </span>

                        <span className="kpi-icon">
                            ₱
                        </span>

                    </div>

                    <h2>
                        {formatCurrency(
                            reportData.revenue
                        )}
                    </h2>

                </div>


                <div className="report-kpi-card">

                    <div className="kpi-card-top">

                        <span>
                            Total Sessions
                        </span>

                        <span className="kpi-icon">
                            ◫
                        </span>

                    </div>

                    <h2>
                        {reportData.sessions.toLocaleString()}
                    </h2>

                </div>


                <div className="report-kpi-card">

                    <div className="kpi-card-top">

                        <span>
                            Avg. Tutor Rating
                        </span>

                        <span className="kpi-icon">
                            ☆
                        </span>

                    </div>

                    <h2>

                        {reportData.avgRating}

                        <span className="rating-small">
                            /5.0
                        </span>

                    </h2>

                </div>


                <div className="report-kpi-card">

                    <div className="kpi-card-top">

                        <span>
                            New Enrollments
                        </span>

                        <span className="kpi-icon">
                            ♙
                        </span>

                    </div>

                    <h2>
                        {reportData.newEnrollments.toLocaleString()}
                    </h2>

                </div>

            </div>


            {/* ==================================
                CHARTS
            ================================== */}

            <div className="report-chart-grid">


                {/* REVENUE */}

                <div className="report-chart-card revenue-chart">

                    <div className="chart-card-header">

                        <div>

                            <h3>
                                Revenue Over Time
                            </h3>

                            <span>
                                Completed payments
                            </span>

                        </div>


                        <button
                            onClick={() =>
                                setShowRevenueDetails(
                                    true
                                )
                            }
                        >
                            View details
                        </button>

                    </div>


                    <div className="chart-container">

                        {reportData.revenueByMonth.length === 0 ? (

                            <div className="chart-empty">
                                No revenue data available.
                            </div>

                        ) : (

                            <ResponsiveContainer
                                width="100%"
                                height="100%"
                            >

                                <BarChart
                                    data={
                                        reportData.revenueByMonth
                                    }
                                >

                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />

                                    <XAxis
                                        dataKey="month"
                                    />

                                    <YAxis />

                                    <Tooltip
                                        formatter={value =>
                                            formatCurrency(
                                                value
                                            )
                                        }
                                    />

                                    <Bar
                                        dataKey="revenue"
                                        radius={[
                                            4,
                                            4,
                                            0,
                                            0
                                        ]}
                                        fill="#315B78"
                                    />

                                </BarChart>

                            </ResponsiveContainer>

                        )}

                    </div>

                </div>


                {/* SESSION STATUS */}

                <div className="report-chart-card">

                    <div className="chart-card-header">

                        <div>

                            <h3>
                                Sessions by Status
                            </h3>

                            <span>
                                Schedule activity
                            </span>

                        </div>

                    </div>


                    <div className="pie-chart-container">

                        {reportData.sessionsByStatus.length === 0 ? (

                            <div className="chart-empty">
                                No session data available.
                            </div>

                        ) : (

                            <ResponsiveContainer
                                width="100%"
                                height="100%"
                            >

                                <PieChart>

                                   <Pie
                                        data={reportData.sessionsByStatus}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        outerRadius={85}
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {reportData.sessionsByStatus.map(
                                            (
                                                entry,
                                                index
                                            ) => (

                                                <Cell
                                                    key={
                                                        `cell-${index}`
                                                    }
                                                    fill={
                                                        pieColors[
                                                            index %
                                                            pieColors.length
                                                        ]
                                                    }
                                                />

                                            )
                                        )}

                                    </Pie>

                                    <Tooltip />

                                    <Legend />

                                </PieChart>

                            </ResponsiveContainer>

                        )}

                    </div>

                </div>

            </div>


            {/* ==================================
                REVENUE DETAILS MODAL
            ================================== */}

            {showRevenueDetails && (

                <div
                    className="report-modal-overlay"
                    onClick={() =>
                        setShowRevenueDetails(
                            false
                        )
                    }
                >

                    <div
                        className="report-modal"
                        onClick={event =>
                            event.stopPropagation()
                        }
                    >

                        <div className="report-modal-header">

                            <div>

                                <h2>
                                    Revenue Details
                                </h2>

                                <p>
                                    Completed payments from
                                    the last {dateRange} days.
                                </p>

                            </div>


                            <button
                                className="report-modal-close"
                                onClick={() =>
                                    setShowRevenueDetails(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>


                        <div className="report-modal-summary">

                            <div>

                                <span>
                                    Total Revenue
                                </span>

                                <strong>
                                    {formatCurrency(
                                        reportData.revenue
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Transactions
                                </span>

                                <strong>
                                    {
                                        reportData
                                            .completedPayments
                                            .length
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="report-table-wrapper">

                            {reportData.completedPayments.length === 0 ? (

                                <div className="report-table-empty">

                                    No completed payments
                                    found for this period.

                                </div>

                            ) : (

                                <table className="report-details-table">

                                    <thead>

                                        <tr>

                                            <th>
                                                Payment ID
                                            </th>

                                            <th>
                                                Student ID
                                            </th>

                                            <th>
                                                Amount
                                            </th>

                                            <th>
                                                Payment Date
                                            </th>

                                            <th>
                                                Status
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {reportData.completedPayments.map(
                                            payment => (

                                                <tr
                                                    key={
                                                        payment.payment_id
                                                    }
                                                >

                                                    <td>
                                                        #
                                                        {
                                                            payment.payment_id
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            payment.student_id
                                                        }
                                                    </td>

                                                    <td className="report-amount">

                                                        {formatCurrency(
                                                            payment.amount
                                                        )}

                                                    </td>

                                                    <td>
                                                        {formatDate(
                                                            payment.payment_date
                                                        )}
                                                    </td>

                                                    <td>

                                                        <span className="payment-status">

                                                            {
                                                                payment.status
                                                            }

                                                        </span>

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            )}

                        </div>

                    </div>

                </div>

            )}

        </div>

    );

}


export default AdminReport;