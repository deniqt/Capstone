import { useEffect, useMemo, useRef, useState } from "react";
import {
    Download,
    FileSpreadsheet,
    X,
    Banknote,
    Calendar,
    Star,
    Users,
    ShoppingBag,
    Filter,
    RotateCcw
} from "lucide-react";

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
import { getMerchandiseList } from "../../Services/merchandiseService";
import {
    getQty,
    isMerchandisePayment,
    matchItemToPayment
} from "../../lib/merchandiseUtils";

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

const EMPTY_FILTERS = {
    subject: "",
    location: "",
    school: "",
    grade: "",
    learningMode: "",
    learningTime: "",
    status: "",
    enrolled: "",
    tutorId: ""
};

const ALL_SHEETS_ON = {
    summary: true,
    payments: true,
    sessions: true,
    ratings: true,
    students: true,
    merchandise: true,
    tutors: true
};

const ALL_SHEETS_OFF = {
    summary: false,
    payments: false,
    sessions: false,
    ratings: false,
    students: false,
    merchandise: false,
    tutors: false
};

const STATUS_COLORS = {
    Confirmed: "#10b981",          // Emerald Green
    Attended: "#2563eb",           // Modern Blue
    Pending: "#f59e0b",            // Amber
    "Reschedule Pending": "#8b5cf6", // Purple/Indigo
    Cancelled: "#ef4444",          // Crimson/Red
    Absent: "#64748b"              // Slate/Grey
};

const pieColors = [
    "#10b981",
    "#2563eb",
    "#f59e0b",
    "#8b5cf6",
    "#ef4444",
    "#64748b",
    "#06b6d4",
    "#ec4899"
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

    return true;

}

function formatCurrency(value) {

    return new Intl.NumberFormat(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 0
        }
    ).format(value || 0);

}

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


function AdminReport() {

    // ==========================================
    // STATE
    // ==========================================

    const [loading, setLoading] = useState(true);
    const reportContentRef = useRef(null);

    const [exporting, setExporting] = useState(false);

    const [showExportModal, setShowExportModal] = useState(false);

    const [exportFormat, setExportFormat] = useState("excel_pdf");

    const [selectedSheets, setSelectedSheets] = useState(ALL_SHEETS_ON);

    const [adminUser, setAdminUser] = useState({
        name: "Admin",
        role: "Admin",
        email: ""
    });

    const [reporterName, setReporterName] = useState("");

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

                // PAYMENTS (service + method are needed to identify merchandise sales)
                supabase
                    .from("payments")
                    .select(`
                        payment_id,
                        student_id,
                        customer_name,
                        service,
                        method,
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

                // TUTORS (for profiles, names + tutor filter)
                supabase
                    .from("users")
                    .select("id, Name, Email, Status, Joined, Role")
                    .eq("Role", "Tutor")
                    .order("Name", { ascending: true })

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
            times: uniqueSorted(students.map(s => s.Learning_Time)).filter(t => t && t.toLowerCase() !== "evening"),
            statuses: uniqueSorted(students.map(s => s.Status)),
            locationSuggestions
        };

    }, [students]);



    // ==========================================
    // LOAD CURRENT LOGGED-IN ADMIN USER
    // ==========================================

    useEffect(() => {
        async function loadAdminProfile() {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (user && !authError) {
                    const { data: userData } = await supabase
                        .from("users")
                        .select("id, Name, Role, Email")
                        .eq("auth_id", user.id)
                        .single();

                    if (userData?.Name) {
                        const isStudent = (userData.Role || "").toLowerCase() === "student";
                        const name = isStudent ? "Admin Office" : userData.Name;
                        const role = isStudent ? "Administrator" : (userData.Role || "Admin");
                        setAdminUser({
                            name,
                            role,
                            email: userData.Email || user.email || ""
                        });
                        setReporterName(`${name} (${role})`);
                    }
                }
            } catch (error) {
                console.error("Failed to load admin profile for report:", error);
            }
        }
        loadAdminProfile();
    }, []);

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

        if (filters.grade)
            list.push({ label: "Grade", value: filters.grade });

        if (filters.learningMode)
            list.push({ label: "Learning Modality", value: filters.learningMode });

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
        // belong to a matching student are kept. Walk-in merchandise
        // sales have no student profile, so they are handled separately
        // below and are never affected by profile filters.
        const keep = studentId =>
            !filtersActive || allowedIds.has(studentId);

        const nameOf = id => studentById.get(id)?.Name || "";

        // Merchandise catalog (stock + prices) from the inventory service
        const catalogList = getMerchandiseList() || [];


        // ---------- PAYMENTS ----------
        const allCompleted = raw.payments
            .filter(payment => payment.status === "Completed")
            .map(payment => ({
                ...payment,
                studentName:
                    nameOf(payment.student_id) ||
                    payment.customer_name ||
                    ""
            }));

        // Merchandise sales: walk-ins whose service matches the catalog.
        // These ignore the student profile filters.
        const merchandisePayments = allCompleted.filter(payment =>
            isMerchandisePayment(payment, catalogList)
        );

        // Subscriptions / academic services: follow the profile filters
        const completedPayments = allCompleted.filter(payment =>
            !isMerchandisePayment(payment, catalogList) &&
            keep(payment.student_id)
        );

        const academicRevenue = completedPayments.reduce(
            (total, payment) => total + Number(payment.amount || 0),
            0
        );

        const merchandiseRevenue = merchandisePayments.reduce(
            (total, payment) => total + Number(payment.amount || 0),
            0
        );

        // Headline revenue = subscriptions/services + merchandise.
        // With a profile filter active, merchandise is excluded so the
        // total only reflects the filtered students.
        const totalRevenue =
            academicRevenue + (filtersActive ? 0 : merchandiseRevenue);

        // Rows shown in the Revenue Details modal and the export sheets
        const revenuePayments = filtersActive
            ? completedPayments
            : [...completedPayments, ...merchandisePayments].sort(
                (a, b) => new Date(b.payment_date) - new Date(a.payment_date)
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

        revenuePayments.forEach(payment => {

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


        // ---------- MERCHANDISE & INVENTORY STATS ----------
        const merchandiseSummary = catalogList.map(item => {
            let unitsSold = 0;
            let periodRevenue = 0;

            merchandisePayments.forEach(payment => {
                if (matchItemToPayment(item, payment.service, catalogList)) {
                    unitsSold += getQty(payment.service);
                    periodRevenue += Number(payment.amount || 0);
                }
            });

            return {
                ...item,
                unitsSold,
                periodRevenue
            };
        });

        const totalMerchUnitsSold = merchandiseSummary.reduce(
            (sum, item) => sum + item.unitsSold,
            0
        );

        const totalMerchStock = catalogList.reduce(
            (sum, item) => sum + (Number(item.stock) || 0),
            0
        );


        // ---------- TUTOR PROFILES ----------
        const tutorsList = (raw.tutors || []).map(tutor => {
            const assignedStudents = raw.students.filter(s => {
                const det = Array.isArray(s.user_details) ? s.user_details[0] || {} : s.user_details || {};
                return Number(det.Tutor_ID) === Number(tutor.id);
            });
            const tutorSessions = raw.sessions.filter(s => Number(s.tutor_id) === Number(tutor.id));
            const tutorRatings = raw.ratings.filter(r => Number(r.Tutor_ID) === Number(tutor.id) && r.Rating !== null && r.Rating !== undefined);
            const avgScore = tutorRatings.length
                ? Number((tutorRatings.reduce((sum, r) => sum + Number(r.Rating), 0) / tutorRatings.length).toFixed(1))
                : null;

            return {
                id: tutor.id,
                Name: tutor.Name,
                Email: tutor.Email || "—",
                Status: tutor.Status || "Active",
                Joined: tutor.Joined || null,
                assignedStudentsCount: assignedStudents.length,
                sessionsCount: tutorSessions.length,
                avgRating: avgScore !== null ? `${avgScore} / 5.0` : "No ratings yet"
            };
        });

        return {
            revenue: totalRevenue,
            academicRevenue,
            merchandiseRevenue,
            totalMerchUnitsSold,
            totalMerchStock,
            merchandiseList: merchandiseSummary,
            merchandisePayments,

            sessions: sessionsData.length,
            avgRating: Number(averageRating.toFixed(1)),
            newEnrollments: enrollmentsData.length,

            revenueByMonth,
            sessionsByStatus,

            // Used by the Revenue Details modal and the export files
            completedPayments: revenuePayments,
            sessionsData,
            ratingsData,
            enrollmentsData,
            studentsList: filteredStudents,
            tutorsList
        };

    }, [
        raw,
        filteredStudents,
        filtersActive,
        studentById,
        tutorNameById
    ]);


    // ==========================================
    // EXPORT SHEET SELECTION DEFINITIONS & ACTIONS
    // ==========================================

    const sheetDefinitions = useMemo(() => [
        {
            id: "summary",
            sheetNum: "1",
            title: "Executive KPI Summary",
            description: "High-level performance metrics, revenue sums, and report audit metadata",
            count: 6,
            unit: "metrics"
        },
        {
            id: "payments",
            sheetNum: "2",
            title: "Completed Payments",
            description: "Student payment transactions, amounts (PHP), and subscription dates",
            count: reportData.completedPayments.length,
            unit: "records"
        },
        {
            id: "sessions",
            sheetNum: "3",
            title: "Sessions Schedule & Activity",
            description: "Scheduled and completed tutorial sessions, tutor assignments, and times",
            count: reportData.sessionsData.length,
            unit: "records"
        },
        {
            id: "ratings",
            sheetNum: "4",
            title: "Session Ratings & Evaluations",
            description: "Student reviews, tutor performance scores, and evaluation dates",
            count: reportData.ratingsData.length,
            unit: "evaluations"
        },
        {
            id: "students",
            sheetNum: "5",
            title: "Student Roster & Academic Profiles",
            description: "Demographics, birthdates, locations, grade levels, and subjects",
            count: filteredStudents.length,
            unit: "profiles"
        },
        {
            id: "merchandise",
            sheetNum: "6",
            title: "Physical Merchandise & Inventory",
            description: "Tutorial Shirts (XS-XL), notebooks, inventory stock levels, and sales transactions",
            count: (reportData.merchandiseList || []).length,
            unit: "products"
        },
        {
            id: "tutors",
            sheetNum: "7",
            title: "Tutor Profiles & Faculty Performance",
            description: "Faculty roster, active assigned student caseloads, delivered sessions, and evaluation scores",
            count: (reportData.tutorsList || []).length,
            unit: "tutors"
        }
    ], [reportData, filteredStudents]);

    const selectedSheetCount = useMemo(() => {
        return Object.values(selectedSheets).filter(Boolean).length;
    }, [selectedSheets]);

    function toggleSheet(id) {
        setSelectedSheets(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    }

    function selectOnlySheet(id, e) {
        if (e) e.stopPropagation();
        setSelectedSheets({
            ...ALL_SHEETS_OFF,
            [id]: true
        });
    }

    function selectAllSheets() {
        setSelectedSheets({ ...ALL_SHEETS_ON });
    }

    function deselectAllSheets() {
        setSelectedSheets({ ...ALL_SHEETS_OFF });
    }


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
    // EXPORT REPORT (PDF OR EXCEL)
    // ==========================================

    async function handleExecuteExport() {
        if (selectedSheetCount === 0) {
            alert("Please select at least one sheet to export.");
            return;
        }

        setExporting(true);

        const finalReporter = reporterName.trim() || `${adminUser.name} (${adminUser.role})`;
        const stamp = new Date().toISOString().split("T")[0];

        // Determine filename suffix if only 1 sheet is selected
        const singleSheetId = selectedSheetCount === 1 ? Object.keys(selectedSheets).find(k => selectedSheets[k]) : null;
        const sheetNameMap = {
            summary: "KPI_Summary",
            payments: "Completed_Payments",
            sessions: "Sessions_Schedule",
            ratings: "Session_Ratings",
            students: "Student_Roster",
            merchandise: "Merchandise_Inventory",
            tutors: "Tutor_Profiles"
        };
        const sheetSuffix = singleSheetId ? `_${sheetNameMap[singleSheetId] || singleSheetId}_Only` : "";

        try {
            if (exportFormat === "excel_pdf") {
                // Generate Excel-formatted PDF with spreadsheet gridlines & tables
                const { generateExcelStyledPdf } = await import("../../lib/reportExcelPdf");

                await generateExcelStyledPdf({
                    reportData,
                    dateRangeLabel: DATE_RANGE_LABELS[dateRange],
                    appliedFilters,
                    matchedStudentCount: filteredStudents.length,
                    reporterName: finalReporter,
                    selectedSheets,
                    fileName:
                        `YOSEF${sheetSuffix}_Spreadsheet_Report_${dateRange}_Days` +
                        `${filtersActive ? "_Filtered" : ""}_${stamp}.pdf`
                });
            } else {
                // Generate raw Excel .xlsx file
                const { generateReportExcel } = await import("../../lib/reportExcel");

                await generateReportExcel({
                    reportData,
                    dateRangeLabel: DATE_RANGE_LABELS[dateRange],
                    appliedFilters,
                    matchedStudentCount: filteredStudents.length,
                    reportedBy: finalReporter,
                    reporterRole: adminUser.role,
                    selectedSheets,
                    fileName:
                        `YOSEF${sheetSuffix}_Report_Last_${dateRange}_Days` +
                        `${filtersActive ? "_Filtered" : ""}_${stamp}.xlsx`
                });
            }

            setShowExportModal(false);
        } catch (error) {
            console.error("Export error:", error);
            alert(`Unable to generate the ${exportFormat === "excel" ? "Excel" : "PDF"} report. Please try again.`);
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

                    <button
                        type="button"
                        className="report-more-button"
                        onClick={() =>
                            setShowMoreFilters(previous => !previous)
                        }
                    >
                        <Filter size={15} />
                        <span>{showMoreFilters ? "Hide filters" : "More filters"}</span>

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
                            <RotateCcw size={14} />
                            <span>Reset</span>
                        </button>
                    )}

                </div>

                <button
                    type="button"
                    className="export-report-button"
                    onClick={() => {
                        if (!reporterName) {
                            setReporterName(`${adminUser.name} (${adminUser.role})`);
                        }
                        setShowExportModal(true);
                    }}
                >
                    <Download size={16} />
                    <span>Export Report</span>
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

                        {/* LEARNING MODALITY */}
                        <div className="report-filter-field">
                            <label>Learning modality</label>
                            <select
                                value={filters.learningMode}
                                onChange={event =>
                                    updateFilter("learningMode", event.target.value)
                                }
                            >
                                <option value="">All modalities</option>
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
                REPORT DASHBOARD SNAPSHOT AREA
            ================================== */}
            <div className="report-content-snapshot" ref={reportContentRef}>

                {/* ACTIVE PROFILE FILTERS (IF APPLIED) */}
                {filtersActive && (
                    <div className="report-snapshot-filters">
                        <span className="snapshot-filter-title">Active Profile Filters:</span>
                        {appliedFilters.map((f, i) => (
                            <span key={i} className="snapshot-filter-tag">
                                <strong>{f.label}:</strong> {f.value}
                            </span>
                        ))}
                    </div>
                )}

                {/* FILTER SUMMARY */}
                {filtersActive && (
                    <div className="report-filter-summary">
                        <strong>
                            {filteredStudents.length}
                        </strong>
                        {" "}student{filteredStudents.length === 1 ? "" : "s"} match
                        {filteredStudents.length === 1 ? "es" : ""} your filters.
                        Revenue, sessions, ratings and enrollments below only
                        include these students. Merchandise sales are walk-in
                        sales, so they are shown in full and are not part of the
                        filtered revenue total.
                    </div>
                )}

                {/* ==================================
                    KPI CARDS
                ================================== */}

                <div className="report-kpi-grid">

                    <div className="report-kpi-card">
                        <div className="kpi-card-top">
                            <span>Total Revenue</span>
                            <div className="kpi-icon-pill kpi-icon-emerald">
                                <Banknote size={17} />
                            </div>
                        </div>
                        <h2>
                            {formatCurrency(reportData.revenue)}
                        </h2>
                        <div className="kpi-subtitle">
                            From completed payments
                        </div>
                    </div>

                    <div className="report-kpi-card">
                        <div className="kpi-card-top">
                            <span>Total Sessions</span>
                            <div className="kpi-icon-pill kpi-icon-blue">
                                <Calendar size={17} />
                            </div>
                        </div>
                        <h2>
                            {reportData.sessions.toLocaleString()}
                        </h2>
                        <div className="kpi-subtitle">
                            Schedule volume & activity
                        </div>
                    </div>

                    <div className="report-kpi-card">
                        <div className="kpi-card-top">
                            <span>Avg. Tutor Rating</span>
                            <div className="kpi-icon-pill kpi-icon-amber">
                                <Star size={17} />
                            </div>
                        </div>
                        <h2>
                            {reportData.avgRating}
                            <span className="rating-small">
                                / 5.0
                            </span>
                        </h2>
                        <div className="kpi-subtitle">
                            Student evaluations
                        </div>
                    </div>

                    <div className="report-kpi-card">
                        <div className="kpi-card-top">
                            <span>New Enrollments</span>
                            <div className="kpi-icon-pill kpi-icon-purple">
                                <Users size={17} />
                            </div>
                        </div>
                        <h2>
                            {reportData.newEnrollments.toLocaleString()}
                        </h2>
                        <div className="kpi-subtitle">
                            Active student profiles
                        </div>
                    </div>

                    <div className="report-kpi-card">
                        <div className="kpi-card-top">
                            <span>Merchandise Sales</span>
                            <div className="kpi-icon-pill kpi-icon-indigo">
                                <ShoppingBag size={17} />
                            </div>
                        </div>
                        <h2>
                            {formatCurrency(reportData.merchandiseRevenue)}
                        </h2>
                        <div className="kpi-subtitle">
                            <strong>{reportData.totalMerchUnitsSold || 0}</strong> sold • <strong>{reportData.totalMerchStock || 0}</strong> in stock
                        </div>
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
                                        margin={{ top: 12, right: 16, left: 10, bottom: 4 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#f1f5f9"
                                        />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fill: "#64748b", fontSize: 12 }}
                                            axisLine={{ stroke: "#e2e8f0" }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fill: "#64748b", fontSize: 12 }}
                                            axisLine={{ stroke: "#e2e8f0" }}
                                            tickLine={false}
                                            tickFormatter={val => `₱${Number(val).toLocaleString()}`}
                                        />
                                        <Tooltip
                                            formatter={value => [formatCurrency(value), "Total Revenue"]}
                                            contentStyle={{
                                                backgroundColor: "#1e293b",
                                                color: "#ffffff",
                                                borderRadius: "8px",
                                                border: "none",
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                                fontSize: "12px",
                                                padding: "8px 12px"
                                            }}
                                            itemStyle={{ color: "#ffffff" }}
                                            labelStyle={{ color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}
                                        />
                                        <Bar
                                            dataKey="revenue"
                                            maxBarSize={48}
                                            radius={[6, 6, 0, 0]}
                                            fill="#2563eb"
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
                                            cy="42%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={3}
                                        >

                                            {reportData.sessionsByStatus.map(
                                                (entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={
                                                            STATUS_COLORS[entry.name] ||
                                                            pieColors[
                                                                index %
                                                                pieColors.length
                                                            ]
                                                        }
                                                    />
                                                )
                                            )}

                                        </Pie>

                                        <Tooltip
                                            formatter={(val, name) => [`${val} sessions`, name]}
                                            contentStyle={{
                                                backgroundColor: "#1e293b",
                                                color: "#ffffff",
                                                borderRadius: "8px",
                                                border: "none",
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                                fontSize: "12px",
                                                padding: "8px 12px"
                                            }}
                                            itemStyle={{ color: "#ffffff" }}
                                        />

                                        <Legend
                                            verticalAlign="bottom"
                                            iconType="circle"
                                            iconSize={8}
                                            wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
                                            formatter={(value, entry) => (
                                                <span style={{ color: "#334155", fontSize: "12px", fontWeight: 500, marginRight: "8px" }}>
                                                    {value}: <strong style={{ color: "#0f172a" }}>{entry.payload.value}</strong>
                                                </span>
                                            )}
                                        />

                                    </PieChart>

                                </ResponsiveContainer>

                            )}

                        </div>

                    </div>

                </div>

                {/* ==================================
                    PHYSICAL MERCHANDISE & INVENTORY PERFORMANCE
                ================================== */}
                <div className="report-merch-section">
                    <div className="report-merch-header">
                        <div>
                            <h3>Physical Merchandise & Inventory Performance</h3>
                            <p>Official center merchandise sales (Tutorial Shirts & Notebooks) and current stock levels</p>
                        </div>
                        <div className="report-merch-badges">
                            <span className="merch-stat-chip highlight">
                                🛍️ <strong>{formatCurrency(reportData.merchandiseRevenue)}</strong> Merch Sales
                            </span>
                            <span className="merch-stat-chip">
                                📦 <strong>{reportData.totalMerchStock || 0}</strong> Items in Stock
                            </span>
                        </div>
                    </div>

                    <div className="report-table-wrapper" style={{ maxHeight: "360px" }}>
                        <table className="report-details-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product & Variant</th>
                                    <th>Category</th>
                                    <th>Unit Price</th>
                                    <th>Current Stock</th>
                                    <th>Units Sold ({DATE_RANGE_LABELS[dateRange]})</th>
                                    <th>Revenue Generated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(reportData.merchandiseList || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                                            No merchandise in the catalog yet.
                                        </td>
                                    </tr>
                                ) : (
                                    (reportData.merchandiseList || []).map((item, idx) => (
                                        <tr key={item.id}>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                    <strong>{item.name}</strong>
                                                    {item.size && <span className="merch-size-badge">Size: {item.size}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="merch-cat-pill">{item.category}</span>
                                            </td>
                                            <td>
                                                <strong>₱{Number(item.price || 0).toLocaleString()}</strong>
                                            </td>
                                            <td>
                                                <span className={`stock-pill ${item.stock > 10 ? "in-stock" : item.stock > 0 ? "low-stock" : "out-of-stock"}`}>
                                                    {item.stock > 10 ? `${item.stock} in stock` : item.stock > 0 ? `Low (${item.stock})` : "Out of stock (0)"}
                                                </span>
                                            </td>
                                            <td>
                                                <strong>{item.unitsSold || 0} units</strong>
                                            </td>
                                            <td className="report-amount">
                                                {formatCurrency(item.periodRevenue)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="report-table-total-row">
                                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                                        Catalog Total:
                                    </td>
                                    <td>
                                        <strong>{reportData.totalMerchStock || 0} in stock</strong>
                                    </td>
                                    <td>
                                        <strong>{reportData.totalMerchUnitsSold || 0} sold</strong>
                                    </td>
                                    <td className="report-amount" style={{ fontWeight: 800, color: "#1e40af" }}>
                                        {formatCurrency(reportData.merchandiseRevenue)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ==================================
                    TUTOR PROFILES & FACULTY PERFORMANCE
                ================================== */}
                <div className="report-merch-section report-tutor-section" style={{ marginTop: "24px" }}>
                    <div className="report-merch-header">
                        <div>
                            <h3>Tutor Profiles & Faculty Performance</h3>
                            <p>Official faculty roster, assigned student caseloads, sessions delivered, and student ratings</p>
                        </div>
                        <div className="report-merch-badges">
                            <span className="merch-stat-chip highlight">
                                🧑‍🏫 <strong>{(reportData.tutorsList || []).length}</strong> Tutors
                            </span>
                            <span className="merch-stat-chip">
                                ⭐ <strong>{reportData.avgRating || 0} / 5.0</strong> Center Rating
                            </span>
                        </div>
                    </div>

                    <div className="report-table-wrapper" style={{ maxHeight: "360px" }}>
                        <table className="report-details-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "40px" }}>#</th>
                                    <th>Tutor Name</th>
                                    <th>Email Address</th>
                                    <th>Account Status</th>
                                    <th>Date Joined</th>
                                    <th>Assigned Students</th>
                                    <th>Total Sessions</th>
                                    <th>Average Rating</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(reportData.tutorsList || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                                            No tutor records found.
                                        </td>
                                    </tr>
                                ) : (
                                    (reportData.tutorsList || []).map((tutor, idx) => (
                                        <tr key={tutor.id}>
                                            <td>{idx + 1}</td>
                                            <td><strong>{tutor.Name}</strong></td>
                                            <td>{tutor.Email}</td>
                                            <td>
                                                <span className={`status ${String(tutor.Status).toLowerCase() === "active" ? "active" : "inactive"}`}>
                                                    {tutor.Status}
                                                </span>
                                            </td>
                                            <td>{formatDate(tutor.Joined)}</td>
                                            <td><strong>{tutor.assignedStudentsCount}</strong> students</td>
                                            <td>{tutor.sessionsCount} sessions</td>
                                            <td><strong style={{ color: "#2563eb" }}>{tutor.avgRating}</strong></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SNAPSHOT FOOTER */}
                <div className="report-snapshot-footer">
                    <div>
                        <strong>YOSEF Tutorial Center</strong> • Confidential Institutional Analytics
                    </div>
                    <div>
                        Certified & Verified by: <strong>{reporterName || `${adminUser.name} (${adminUser.role})`}</strong>
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


                        <div className="report-modal-summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>

                            <div>
                                <span>Total Revenue</span>
                                <strong>{formatCurrency(reportData.revenue)}</strong>
                            </div>

                            <div>
                                <span>Subscriptions & Services</span>
                                <strong style={{ color: "#2563eb" }}>{formatCurrency(reportData.academicRevenue)}</strong>
                            </div>

                            <div>
                                <span>Physical Merchandise</span>
                                <strong style={{ color: "#059669" }}>{formatCurrency(reportData.merchandiseRevenue)}</strong>
                            </div>

                            <div>
                                <span>Total Transactions</span>
                                <strong>{reportData.completedPayments.length}</strong>
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
                                            <th style={{ width: "40px" }}>#</th>
                                            <th>Service / Item</th>
                                            <th>Customer / Student</th>
                                            <th>Amount</th>
                                            <th>Payment Date</th>
                                            <th>Status</th>
                                        </tr>

                                    </thead>

                                    <tbody>

                                        {reportData.completedPayments.map(
                                            (payment, idx) => (

                                                <tr key={payment.payment_id}>

                                                    <td>
                                                        {idx + 1}
                                                    </td>

                                                    <td>
                                                        <strong>{payment.service || "Tutoring Subscription"}</strong>
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


            {/* ==================================
                EXPORT REPORT OPTIONS MODAL
            ================================== */}
            {showExportModal && (
                <div className="app-modal-overlay" onClick={() => !exporting && setShowExportModal(false)}>
                    <div className="app-modal-card export-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="app-modal-header">
                            <div className="app-modal-header-text">
                                <h2>Export Analytics Report</h2>
                                <p>Select your export format and verify reporting credentials</p>
                            </div>
                            <button
                                type="button"
                                className="app-modal-close"
                                onClick={() => setShowExportModal(false)}
                                disabled={exporting}
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="app-modal-body">
                            {/* Format Selection Cards */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700 }}>Choose Export Format</label>
                                <div className="export-format-grid">
                                    <div
                                        className={`export-format-card ${exportFormat === "excel_pdf" ? "active" : ""}`}
                                        onClick={() => setExportFormat("excel_pdf")}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <span className="export-badge-pill">Recommended</span>
                                        <div className="export-format-icon excel-pdf-icon">
                                            <FileSpreadsheet size={26} />
                                        </div>
                                        <div className="export-format-info">
                                            <h4>Excel-Style Report (.pdf)</h4>
                                            <p>Spreadsheet format with gridlines, complete audit tables & financial sums, saved directly as PDF.</p>
                                        </div>
                                        <div className={`format-radio-dot ${exportFormat === "excel_pdf" ? "selected" : ""}`} />
                                    </div>

                                    <div
                                        className={`export-format-card ${exportFormat === "excel" ? "active" : ""}`}
                                        onClick={() => setExportFormat("excel")}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className="export-format-icon excel-icon">
                                            <FileSpreadsheet size={26} />
                                        </div>
                                        <div className="export-format-info">
                                            <h4>Excel Workbook (.xlsx)</h4>
                                            <p>Raw multi-sheet spreadsheet workbook with dedicated sheets for MS Excel or Google Sheets.</p>
                                        </div>
                                        <div className={`format-radio-dot ${exportFormat === "excel" ? "selected" : ""}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Selection Section */}
                            <div className="form-group sheet-selection-group">
                                <div className="sheet-selection-header">
                                    <div>
                                        <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                                            Select Sheets to Include
                                        </label>
                                        <span className="sheet-selection-subtitle">
                                            Choose which sheets to export ({selectedSheetCount} of {sheetDefinitions.length} selected)
                                        </span>
                                    </div>
                                    <div className="sheet-quick-actions">
                                        <button
                                            type="button"
                                            className="btn-sheet-quick"
                                            onClick={selectAllSheets}
                                            disabled={selectedSheetCount === sheetDefinitions.length}
                                        >
                                            Select All
                                        </button>
                                        <span className="sheet-quick-sep">•</span>
                                        <button
                                            type="button"
                                            className="btn-sheet-quick"
                                            onClick={deselectAllSheets}
                                            disabled={selectedSheetCount === 0}
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <div className="sheet-checkbox-grid">
                                    {sheetDefinitions.map(sheet => {
                                        const isSelected = !!selectedSheets[sheet.id];
                                        return (
                                            <div
                                                key={sheet.id}
                                                className={`sheet-checkbox-card ${isSelected ? "selected" : ""}`}
                                                onClick={() => toggleSheet(sheet.id)}
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                tabIndex={0}
                                            >
                                                <div className="sheet-card-left">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSheet(sheet.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="sheet-checkbox-input"
                                                    />
                                                    <span className="sheet-number-pill">Sheet {sheet.sheetNum}</span>
                                                    <div className="sheet-text-info">
                                                        <span className="sheet-name-text">{sheet.title}</span>
                                                        <span className="sheet-desc-text">{sheet.description}</span>
                                                    </div>
                                                </div>

                                                <div className="sheet-card-right">
                                                    <span className="sheet-meta-pill">
                                                        {sheet.count} {sheet.unit}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn-only-this-sheet"
                                                        title={`Export only Sheet ${sheet.sheetNum}: ${sheet.title}`}
                                                        onClick={(e) => selectOnlySheet(sheet.id, e)}
                                                    >
                                                        Only this
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {selectedSheetCount === 0 && (
                                    <div className="sheet-selection-warning">
                                        ⚠️ Please select at least one sheet to export.
                                    </div>
                                )}
                            </div>

                            {/* Reporter Identification Box */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700 }}>
                                    Reported / Prepared By <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "#64748b" }}>(Embedded in audit metadata & footer)</span>
                                </label>
                                <div className="reporter-input-wrapper">
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={reporterName}
                                        onChange={(e) => setReporterName(e.target.value)}
                                        placeholder="e.g. Den (Admin)"
                                        disabled={exporting}
                                    />
                                </div>
                            </div>

                            {/* Report Summary Details Card */}
                            <div className="export-summary-box">
                                <div className="export-summary-row">
                                    <span className="summary-label">Reporting Period:</span>
                                    <span className="summary-value">{DATE_RANGE_LABELS[dateRange]}</span>
                                </div>
                                <div className="export-summary-row">
                                    <span className="summary-label">Active Filters:</span>
                                    <span className="summary-value">
                                        {appliedFilters.length ? `${appliedFilters.length} filter(s) active` : "All students included"}
                                    </span>
                                </div>
                                <div className="export-summary-row">
                                    <span className="summary-label">Sheets Included:</span>
                                    <span className="summary-value">
                                        {selectedSheetCount === 0
                                            ? "None selected"
                                            : selectedSheetCount === sheetDefinitions.length
                                            ? `All ${sheetDefinitions.length} Sheets Selected`
                                            : `${selectedSheetCount} of ${sheetDefinitions.length} Sheets Selected`}
                                    </span>
                                </div>
                                <div className="export-summary-row">
                                    <span className="summary-label">Records Included:</span>
                                    <span className="summary-value">
                                        {[
                                            selectedSheets.summary ? "KPI Summary" : null,
                                            selectedSheets.payments ? `${reportData.completedPayments.length} Payments` : null,
                                            selectedSheets.sessions ? `${reportData.sessionsData.length} Sessions` : null,
                                            selectedSheets.ratings ? `${reportData.ratingsData.length} Ratings` : null,
                                            selectedSheets.students ? `${filteredStudents.length} Students` : null,
                                            selectedSheets.merchandise ? `${(reportData.merchandiseList || []).length} Merch Items` : null,
                                            selectedSheets.tutors ? `${(reportData.tutorsList || []).length} Tutors` : null
                                        ].filter(Boolean).join(" • ") || "No sheets selected"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="app-modal-footer">
                            <button
                                type="button"
                                className="btn-modal-cancel"
                                onClick={() => setShowExportModal(false)}
                                disabled={exporting}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="btn-modal-submit"
                                onClick={handleExecuteExport}
                                disabled={exporting || selectedSheetCount === 0}
                            >
                                <Download size={15} style={{ marginRight: "6px" }} />
                                {exporting
                                    ? `Generating ${exportFormat === "excel" ? "XLSX" : "PDF"}...`
                                    : selectedSheetCount === 0
                                    ? "Select at Least 1 Sheet"
                                    : selectedSheetCount === 1
                                    ? `Download ${sheetDefinitions.find(s => selectedSheets[s.id])?.title} (${exportFormat === "excel" ? ".xlsx" : ".pdf"})`
                                    : `Download ${exportFormat === "excel" ? "Excel Workbook (.xlsx)" : "Excel-Style PDF Report"}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );

}


export default AdminReport;