import { useEffect, useMemo, useState } from "react";

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

import LogoImage from "../../assets/yosefLogo.jpg";

import "./adminReport.css";


// ==========================================
// CONSTANTS
// ==========================================

const DATE_RANGE_LABELS = {
    "7": "Last 7 Days",
    "30": "Last 30 Days",
    "90": "Last 90 Days",
    "365": "Last Year"
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const EMPTY_FILTERS = {
    subject: "",
    location: "",
    school: "",
    ageMin: "",
    ageMax: "",
    birthMonth: "",
    grade: "",
    learningMode: "",
    learningTime: "",
    status: "",
    enrolled: "",
    tutorId: ""
};

const pieColors = [
    "#315B78",
    "#6C8EAD",
    "#8FB3C9",
    "#B7CAD8",
    "#D9E3EA"
];


// ==========================================
// HELPERS
// ==========================================

// "YYYY-MM-DD" -> { year, month (1-12), day }
function parseDateOnly(value) {

    if (!value) {
        return null;
    }

    const [year, month, day] =
        String(value).slice(0, 10).split("-").map(Number);

    if (!year || !month || !day) {
        return null;
    }

    return { year, month, day };

}

function calculateAge(dateOfBirth) {

    const dob = parseDateOnly(dateOfBirth);

    if (!dob) {
        return null;
    }

    const today = new Date();

    let age = today.getFullYear() - dob.year;

    const monthDiff = (today.getMonth() + 1) - dob.month;

    if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < dob.day)
    ) {
        age--;
    }

    return age >= 0 ? age : null;

}

// Subjects can be a text[] or (in older rows) a string
function normalizeSubjects(value) {

    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .replace(/[{}"[\]]/g, "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    return [];

}

function uniqueSorted(values) {

    return [...new Set(values.filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), undefined, { numeric: true })
    );

}

function matchesFilters(student, filters) {

    if (filters.subject && !student.subjectList.includes(filters.subject)) {
        return false;
    }

    if (
        filters.location &&
        !(student.Address || "")
            .toLowerCase()
            .includes(filters.location.trim().toLowerCase())
    ) {
        return false;
    }

    if (
        filters.school &&
        !(student.school || "")
            .toLowerCase()
            .includes(filters.school.trim().toLowerCase())
    ) {
        return false;
    }

    if (filters.grade && student.Grade_Level !== filters.grade) {
        return false;
    }

    if (filters.learningMode && student.Learning_Mode !== filters.learningMode) {
        return false;
    }

    if (filters.learningTime && student.Learning_Time !== filters.learningTime) {
        return false;
    }

    if (filters.status && student.Status !== filters.status) {
        return false;
    }

    if (filters.enrolled) {
        const isEnrolled = Boolean(student.Enrolled_Student);

        if ((filters.enrolled === "yes") !== isEnrolled) {
            return false;
        }
    }

    if (filters.tutorId && String(student.Tutor_ID) !== filters.tutorId) {
        return false;
    }

    // Birthday month
    if (
        filters.birthMonth &&
        student.birthMonth !== Number(filters.birthMonth)
    ) {
        return false;
    }

    // Age range (students without a birthdate are excluded
    // whenever an age filter is set)
    if (
        filters.ageMin !== "" &&
        (student.age === null || student.age < Number(filters.ageMin))
    ) {
        return false;
    }

    if (
        filters.ageMax !== "" &&
        (student.age === null || student.age > Number(filters.ageMax))
    ) {
        return false;
    }

    return true;

}


function AdminReport() {

    // ==========================================
    // STATE
    // ==========================================

    const [loading, setLoading] = useState(true);

    const [exporting, setExporting] = useState(false);

    const [dateRange, setDateRange] = useState("30");

    const [filters, setFilters] = useState(EMPTY_FILTERS);

    const [showMoreFilters, setShowMoreFilters] = useState(false);

    const [showRevenueDetails, setShowRevenueDetails] =
        useState(false);

    // Raw rows from the database (re-fetched only when the
    // date range changes). Profile filters are applied on top
    // of this in the useMemo blocks below, so they are instant.
    const [raw, setRaw] = useState({
        payments: [],
        sessions: [],
        ratings: [],
        students: [],
        tutors: [],
        startDate: ""
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

            const startDate = new Date();

            startDate.setDate(
                startDate.getDate() - Number(dateRange)
            );

            const startISO = startDate.toISOString();

            const startDateOnly = startISO.split("T")[0];


            const [
                paymentsRes,
                sessionsRes,
                ratingsRes,
                studentsRes,
                tutorsRes
            ] = await Promise.all([

                // PAYMENTS
                supabase
                    .from("payments")
                    .select(`
                        payment_id,
                        student_id,
                        customer_name,
                        amount,
                        payment_date,
                        status,
                        subscription_start,
                        subscription_expires,
                        remarks
                    `)
                    .gte("payment_date", startISO)
                    .order("payment_date", { ascending: false }),

                // SESSIONS
                supabase
                    .from("calendar")
                    .select(`
                        id,
                        title,
                        status,
                        student_id,
                        tutor_id,
                        start_datetime,
                        end_datetime
                    `)
                    .gte("start_datetime", startISO),

                // RATINGS
                supabase
                    .from("Session_Ratings")
                    .select(`
                        Rating_ID,
                        Rating,
                        Student_ID,
                        Tutor_ID,
                        created_at
                    `)
                    .gte("created_at", startISO),

                // ALL STUDENTS + PROFILE DETAILS
                // (users has two relationships with user_details, so the
                //  foreign key name is used to pick the right one)
                supabase
                    .from("users")
                    .select(`
                        id,
                        Name,
                        Email,
                        Joined,
                        Status,
                        user_details!users_detail_id_fkey (
                            date_of_birth,
                            Address,
                            school,
                            Tutor_ID,
                            Subjects,
                            Grade_Level,
                            Learning_Mode,
                            Learning_Time,
                            Enrolled_Student
                        )
                    `)
                    .eq("Role", "Student"),

                // TUTORS (for names + tutor filter)
                supabase
                    .from("users")
                    .select("id, Name")
                    .eq("Role", "Tutor")

            ]);

            if (paymentsRes.error) throw paymentsRes.error;
            if (sessionsRes.error) throw sessionsRes.error;
            if (ratingsRes.error) throw ratingsRes.error;
            if (studentsRes.error) throw studentsRes.error;
            if (tutorsRes.error) throw tutorsRes.error;

            setRaw({
                payments: paymentsRes.data || [],
                sessions: sessionsRes.data || [],
                ratings: ratingsRes.data || [],
                students: studentsRes.data || [],
                tutors: tutorsRes.data || [],
                startDate: startDateOnly
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
    // DERIVED: TUTORS, STUDENTS (with profile)
    // ==========================================

    const tutorNameById = useMemo(() => {

        const map = new Map();

        raw.tutors.forEach(tutor => map.set(tutor.id, tutor.Name));

        return map;

    }, [raw.tutors]);


    const students = useMemo(() => {

        return raw.students.map(row => {

            // Supabase returns the embedded row as an object
            // (many-to-one), but guard against an array too.
            const details = Array.isArray(row.user_details)
                ? row.user_details[0] || {}
                : row.user_details || {};

            const dob = parseDateOnly(details.date_of_birth);

            return {
                id: row.id,
                Name: row.Name,
                Email: row.Email,
                Joined: row.Joined,
                Status: row.Status,

                date_of_birth: details.date_of_birth || null,
                age: calculateAge(details.date_of_birth),
                birthMonth: dob ? dob.month : null,

                Address: details.Address || "",
                school: details.school || "",
                Grade_Level: details.Grade_Level || "",
                Learning_Mode: details.Learning_Mode || "",
                Learning_Time: details.Learning_Time || "",
                Enrolled_Student: details.Enrolled_Student,
                Tutor_ID: details.Tutor_ID,
                tutorName: tutorNameById.get(details.Tutor_ID) || "",
                subjectList: normalizeSubjects(details.Subjects)
            };

        });

    }, [raw.students, tutorNameById]);


    const studentById = useMemo(() => {

        const map = new Map();

        students.forEach(student => map.set(student.id, student));

        return map;

    }, [students]);


    // ==========================================
    // DERIVED: FILTER OPTIONS (built from real data)
    // ==========================================

    const filterOptions = useMemo(() => {

        // Address is free text, so offer the most common
        // comma-separated pieces (barangay / city / province)
        // as suggestions for the Location box.
        const pieceCounts = {};

        students.forEach(student => {

            student.Address
                .split(",")
                .map(piece => piece.trim())
                .filter(piece => piece.length >= 3)
                .forEach(piece => {
                    pieceCounts[piece] = (pieceCounts[piece] || 0) + 1;
                });

        });

        const locationSuggestions = Object.entries(pieceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 60)
            .map(([piece]) => piece);

        return {
            subjects: uniqueSorted(students.flatMap(s => s.subjectList)),
            grades: uniqueSorted(students.map(s => s.Grade_Level)),
            modes: uniqueSorted(students.map(s => s.Learning_Mode)),
            times: uniqueSorted(students.map(s => s.Learning_Time)),
            statuses: uniqueSorted(students.map(s => s.Status)),
            locationSuggestions
        };

    }, [students]);


    // ==========================================
    // DERIVED: APPLY FILTERS
    // ==========================================

    const appliedFilters = useMemo(() => {

        const list = [];

        if (filters.subject)
            list.push({ label: "Subject", value: filters.subject });

        if (filters.location.trim())
            list.push({ label: "Location contains", value: filters.location.trim() });

        if (filters.school.trim())
            list.push({ label: "School contains", value: filters.school.trim() });

        if (filters.ageMin !== "" || filters.ageMax !== "") {
            const from = filters.ageMin !== "" ? filters.ageMin : "any";
            const to = filters.ageMax !== "" ? filters.ageMax : "any";

            list.push({ label: "Age", value: `${from} to ${to}` });
        }

        if (filters.birthMonth)
            list.push({
                label: "Birthday month",
                value: MONTHS[Number(filters.birthMonth) - 1]
            });

        if (filters.grade)
            list.push({ label: "Grade", value: filters.grade });

        if (filters.learningMode)
            list.push({ label: "Learning mode", value: filters.learningMode });

        if (filters.learningTime)
            list.push({ label: "Learning time", value: filters.learningTime });

        if (filters.status)
            list.push({ label: "Account status", value: filters.status });

        if (filters.enrolled)
            list.push({
                label: "Enrolled",
                value: filters.enrolled === "yes" ? "Yes" : "No"
            });

        if (filters.tutorId)
            list.push({
                label: "Assigned tutor",
                value: tutorNameById.get(Number(filters.tutorId)) || filters.tutorId
            });

        return list;

    }, [filters, tutorNameById]);


    const filtersActive = appliedFilters.length > 0;


    const filteredStudents = useMemo(() => {

        return students
            .filter(student => matchesFilters(student, filters))
            .sort((a, b) =>
                String(b.Joined || "").localeCompare(String(a.Joined || ""))
            );

    }, [students, filters]);


    const reportData = useMemo(() => {

        const allowedIds = new Set(filteredStudents.map(s => s.id));

        // When a profile filter is active, only records that
        // belong to a matching student are kept. Records with no
        // student (e.g. walk-in payments) are dropped in that case.
        const keep = studentId =>
            !filtersActive || allowedIds.has(studentId);

        const nameOf = id => studentById.get(id)?.Name || "";


        // ---------- PAYMENTS ----------
        const completedPayments = raw.payments
            .filter(payment =>
                payment.status === "Completed" &&
                keep(payment.student_id)
            )
            .map(payment => ({
                ...payment,
                studentName:
                    nameOf(payment.student_id) ||
                    payment.customer_name ||
                    ""
            }));

        const totalRevenue = completedPayments.reduce(
            (total, payment) => total + Number(payment.amount || 0),
            0
        );


        // ---------- SESSIONS ----------
        const sessionsData = raw.sessions
            .filter(session => keep(session.student_id))
            .map(session => ({
                ...session,
                studentName: nameOf(session.student_id),
                tutorName: tutorNameById.get(session.tutor_id) || ""
            }));


        // ---------- RATINGS ----------
        const ratingsData = raw.ratings
            .filter(rating => keep(rating.Student_ID))
            .map(rating => ({
                ...rating,
                studentName: nameOf(rating.Student_ID),
                tutorName: tutorNameById.get(rating.Tutor_ID) || ""
            }));

        const validRatings = ratingsData.filter(
            rating =>
                rating.Rating !== null &&
                rating.Rating !== undefined
        );

        const averageRating = validRatings.length
            ? validRatings.reduce(
                (total, rating) => total + Number(rating.Rating),
                0
            ) / validRatings.length
            : 0;


        // ---------- NEW ENROLLMENTS ----------
        const enrollmentsData = filteredStudents.filter(
            student =>
                student.Joined &&
                student.Joined >= raw.startDate
        );


        // ---------- REVENUE BY MONTH ----------
        const monthlyRevenue = {};

        completedPayments.forEach(payment => {

            const month = new Date(payment.payment_date).toLocaleString(
                "en-US",
                { month: "short", year: "numeric" }
            );

            monthlyRevenue[month] =
                (monthlyRevenue[month] || 0) +
                Number(payment.amount || 0);

        });

        // payments are sorted newest-first, so reverse for the chart
        const revenueByMonth = Object.entries(monthlyRevenue)
            .map(([month, revenue]) => ({ month, revenue }))
            .reverse();


        // ---------- SESSIONS BY STATUS ----------
        const statusCounts = {};

        sessionsData.forEach(session => {

            const status = session.status || "Unknown";

            statusCounts[status] = (statusCounts[status] || 0) + 1;

        });

        const sessionsByStatus = Object.entries(statusCounts).map(
            ([name, value]) => ({ name, value })
        );


        return {
            revenue: totalRevenue,
            sessions: sessionsData.length,
            avgRating: Number(averageRating.toFixed(1)),
            newEnrollments: enrollmentsData.length,

            revenueByMonth,
            sessionsByStatus,

            completedPayments,
            sessionsData,
            ratingsData,
            enrollmentsData,
            studentsList: filteredStudents
        };

    }, [
        raw,
        filteredStudents,
        filtersActive,
        studentById,
        tutorNameById
    ]);


    // ==========================================
    // FILTER ACTIONS
    // ==========================================

    function updateFilter(name, value) {

        setFilters(previous => ({
            ...previous,
            [name]: value
        }));

    }

    function resetFilters() {

        setFilters(EMPTY_FILTERS);

    }


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
    // EXPORT PDF
    // ==========================================

    async function exportReportData() {

        setExporting(true);

        try {

            // loaded on demand so jsPDF is not part of the initial bundle
            const { generateReportPdf } =
                await import("../../lib/reportPdf");

            const stamp = new Date().toISOString().split("T")[0];

            await generateReportPdf({
                reportData,
                dateRangeLabel: DATE_RANGE_LABELS[dateRange],
                appliedFilters,
                matchedStudentCount: filteredStudents.length,
                logoSrc: LogoImage,
                fileName:
                    `YOSEF_Report_Last_${dateRange}_Days` +
                    `${filtersActive ? "_Filtered" : ""}_${stamp}.pdf`
            });

        } catch (error) {

            console.error("PDF export error:", error);

            alert("Unable to generate the PDF report. Please try again.");

        } finally {

            setExporting(false);

        }

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
                            setDateRange(event.target.value)
                        }
                    >
                        {Object.entries(DATE_RANGE_LABELS).map(
                            ([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            )
                        )}
                    </select>

                    <select
                        value={filters.subject}
                        onChange={event =>
                            updateFilter("subject", event.target.value)
                        }
                    >
                        <option value="">
                            All Subjects
                        </option>

                        {filterOptions.subjects.map(subject => (
                            <option key={subject} value={subject}>
                                {subject}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className="report-more-button"
                        onClick={() =>
                            setShowMoreFilters(previous => !previous)
                        }
                    >
                        {showMoreFilters ? "Hide filters" : "More filters"}

                        {filtersActive && (
                            <span className="report-filter-badge">
                                {appliedFilters.length}
                            </span>
                        )}
                    </button>

                    {filtersActive && (
                        <button
                            type="button"
                            className="report-reset-button"
                            onClick={resetFilters}
                        >
                            Reset
                        </button>
                    )}

                </div>

                <button
                    className="export-report-button"
                    onClick={exportReportData}
                    disabled={exporting}
                >
                    {exporting ? "Generating PDF..." : "↓ Export PDF"}
                </button>

            </div>


            {/* ==================================
                STUDENT PROFILE FILTERS
            ================================== */}

            {showMoreFilters && (

                <div className="report-advanced-filters">

                    <div className="report-advanced-title">
                        Filter by student profile
                    </div>

                    <div className="report-advanced-grid">

                        {/* LOCATION */}
                        <div className="report-filter-field">
                            <label>Location</label>
                            <input
                                type="text"
                                list="report-location-options"
                                placeholder="City, barangay, province..."
                                value={filters.location}
                                onChange={event =>
                                    updateFilter("location", event.target.value)
                                }
                            />
                            <datalist id="report-location-options">
                                {filterOptions.locationSuggestions.map(piece => (
                                    <option key={piece} value={piece} />
                                ))}
                            </datalist>
                        </div>

                        {/* SCHOOL */}
                        <div className="report-filter-field">
                            <label>School</label>
                            <input
                                type="text"
                                placeholder="School name"
                                value={filters.school}
                                onChange={event =>
                                    updateFilter("school", event.target.value)
                                }
                            />
                        </div>

                        {/* AGE */}
                        <div className="report-filter-field">
                            <label>Age (from – to)</label>
                            <div className="report-age-range">
                                <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    placeholder="Min"
                                    value={filters.ageMin}
                                    onChange={event =>
                                        updateFilter("ageMin", event.target.value)
                                    }
                                />
                                <span>–</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    placeholder="Max"
                                    value={filters.ageMax}
                                    onChange={event =>
                                        updateFilter("ageMax", event.target.value)
                                    }
                                />
                            </div>
                        </div>

                        {/* BIRTHDAY MONTH */}
                        <div className="report-filter-field">
                            <label>Birthday month</label>
                            <select
                                value={filters.birthMonth}
                                onChange={event =>
                                    updateFilter("birthMonth", event.target.value)
                                }
                            >
                                <option value="">Any month</option>
                                {MONTHS.map((month, index) => (
                                    <option key={month} value={index + 1}>
                                        {month}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* GRADE */}
                        <div className="report-filter-field">
                            <label>Grade level</label>
                            <select
                                value={filters.grade}
                                onChange={event =>
                                    updateFilter("grade", event.target.value)
                                }
                            >
                                <option value="">All grades</option>
                                {filterOptions.grades.map(grade => (
                                    <option key={grade} value={grade}>
                                        {grade}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* LEARNING MODE */}
                        <div className="report-filter-field">
                            <label>Learning mode</label>
                            <select
                                value={filters.learningMode}
                                onChange={event =>
                                    updateFilter("learningMode", event.target.value)
                                }
                            >
                                <option value="">All modes</option>
                                {filterOptions.modes.map(mode => (
                                    <option key={mode} value={mode}>
                                        {mode}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* LEARNING TIME */}
                        <div className="report-filter-field">
                            <label>Learning time</label>
                            <select
                                value={filters.learningTime}
                                onChange={event =>
                                    updateFilter("learningTime", event.target.value)
                                }
                            >
                                <option value="">Any time</option>
                                {filterOptions.times.map(time => (
                                    <option key={time} value={time}>
                                        {time}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* TUTOR */}
                        <div className="report-filter-field">
                            <label>Assigned tutor</label>
                            <select
                                value={filters.tutorId}
                                onChange={event =>
                                    updateFilter("tutorId", event.target.value)
                                }
                            >
                                <option value="">All tutors</option>
                                {raw.tutors.map(tutor => (
                                    <option key={tutor.id} value={tutor.id}>
                                        {tutor.Name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ACCOUNT STATUS */}
                        <div className="report-filter-field">
                            <label>Account status</label>
                            <select
                                value={filters.status}
                                onChange={event =>
                                    updateFilter("status", event.target.value)
                                }
                            >
                                <option value="">All statuses</option>
                                {filterOptions.statuses.map(status => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ENROLLED */}
                        <div className="report-filter-field">
                            <label>Enrolled student</label>
                            <select
                                value={filters.enrolled}
                                onChange={event =>
                                    updateFilter("enrolled", event.target.value)
                                }
                            >
                                <option value="">Any</option>
                                <option value="yes">Enrolled</option>
                                <option value="no">Not enrolled</option>
                            </select>
                        </div>

                    </div>

                </div>

            )}


            {/* ==================================
                FILTER SUMMARY
            ================================== */}

            {filtersActive && (

                <div className="report-filter-summary">

                    <strong>
                        {filteredStudents.length}
                    </strong>
                    {" "}student{filteredStudents.length === 1 ? "" : "s"} match
                    {filteredStudents.length === 1 ? "es" : ""} your filters.
                    Revenue, sessions, ratings and enrollments below only
                    include these students.

                </div>

            )}


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
                                setShowRevenueDetails(true)
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
                                    data={reportData.revenueByMonth}
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
                                            formatCurrency(value)
                                        }
                                    />

                                    <Bar
                                        dataKey="revenue"
                                        radius={[4, 4, 0, 0]}
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
                                            (entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
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
                        setShowRevenueDetails(false)
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
                                    setShowRevenueDetails(false)
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
                                    {reportData.completedPayments.length}
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
                                            <th>Payment ID</th>
                                            <th>Student</th>
                                            <th>Amount</th>
                                            <th>Payment Date</th>
                                            <th>Status</th>
                                        </tr>

                                    </thead>

                                    <tbody>

                                        {reportData.completedPayments.map(
                                            payment => (

                                                <tr key={payment.payment_id}>

                                                    <td>
                                                        #{payment.payment_id}
                                                    </td>

                                                    <td>
                                                        {payment.studentName || "—"}
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
                                                            {payment.status}
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