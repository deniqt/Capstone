import * as XLSX from "xlsx";

function parseDate(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(value) {
    const date = parseDate(value);
    if (!date) return "-";
    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function fmtDateTime(value) {
    const date = parseDate(value);
    if (!date) return "-";
    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

// Automatically calculate reasonable column widths based on maximum cell lengths
function autoColumnWidths(data) {
    if (!data || !data.length) return [];
    const colCount = Math.max(...data.map(row => row.length));
    const widths = [];

    for (let c = 0; c < colCount; c++) {
        let maxLen = 10;
        for (let r = 0; r < data.length; r++) {
            const val = data[r][c];
            if (val !== undefined && val !== null) {
                const len = String(val).length;
                if (len > maxLen) maxLen = len;
            }
        }
        // Cap max width at 45 to prevent overly wide columns
        widths.push({ wch: Math.min(maxLen + 3, 45) });
    }
    return widths;
}

export async function generateReportExcel({
    reportData,
    dateRangeLabel,
    appliedFilters = [],
    matchedStudentCount = 0,
    reportedBy = "Administrator",
    reporterRole = "Admin",
    fileName = "YOSEF_Report.xlsx",
    selectedSheets = { summary: true, payments: true, sessions: true, ratings: true, students: true, merchandise: true, tutors: true }
}) {
    const defaultSheets = { summary: true, payments: true, sessions: true, ratings: true, students: true, merchandise: true, tutors: true };
    const activeSheets = { ...defaultSheets, ...(selectedSheets || {}) };

    const wb = XLSX.utils.book_new();

    wb.Props = {
        Title: "YOSEF Tutorial Center Report",
        Subject: `Performance Report - ${dateRangeLabel}`,
        Author: reportedBy,
        Company: "YOSEF Tutorial Center",
        CreatedDate: new Date()
    };

    const filtersText = appliedFilters.length
        ? appliedFilters.map(f => `${f.label}: ${f.value}`).join(" | ")
        : "None (All students included)";

    const timestamp = new Date().toLocaleString("en-PH", {
        dateStyle: "long",
        timeStyle: "short"
    });

    // ==========================================
    // 1. EXECUTIVE SUMMARY SHEET
    // ==========================================
    if (activeSheets.summary) {
        const summaryRows = [
            ["YOSEF TUTORIAL CENTER - PERFORMANCE & FINANCIAL REPORT"],
            [],
            ["REPORT AUDIT INFORMATION", ""],
            ["Reported / Prepared By:", reportedBy],
            ["Administrative Role:", reporterRole],
            ["Date & Time Generated:", timestamp],
            ["Reporting Period:", dateRangeLabel],
            ["Active Filters:", filtersText],
            ["Matching Students:", `${matchedStudentCount} student(s)`],
            [],
            ["KEY PERFORMANCE INDICATORS", ""],
            ["Metric", "Value"],
            ["Total Revenue (PHP)", Number(reportData.revenue || 0)],
            ["  - Academic Tutoring Revenue (PHP)", Number(reportData.academicRevenue !== undefined ? reportData.academicRevenue : (reportData.revenue - (reportData.merchandiseRevenue || 0)))],
            ["  - Physical Merchandise Revenue (PHP)", Number(reportData.merchandiseRevenue || 0)],
            ["Total Merchandise Units Sold", Number(reportData.totalMerchUnitsSold || 0)],
            ["Total Physical Stock on Hand", Number(reportData.totalMerchStock || 0)],
            ["Total Scheduled Sessions", Number(reportData.sessions || 0)],
            ["Average Tutor Rating (out of 5.0)", Number(reportData.avgRating || 0)],
            ["New Student Enrollments", Number(reportData.newEnrollments || 0)],
            [],
            ["REVENUE BY MONTH", ""],
            ["Month", "Completed Payments (PHP)"],
            ...(reportData.revenueByMonth || []).map(item => [item.month, Number(item.revenue || 0)]),
            [],
            ["SESSIONS BY STATUS", ""],
            ["Status", "Total Sessions"],
            ...(reportData.sessionsByStatus || []).map(item => [item.name, Number(item.value || 0)]),
            [],
            ["INSTRUCTIONS & SYSTEM NOTICE", ""],
            ["Verification Notice:", `This official data export was compiled and certified by ${reportedBy} (${reporterRole}) via YOSEF Admin System.`],
            ["Confidentiality:", "Contains sensitive organizational, academic, and financial information. Intended solely for authorized institutional review."]
        ];

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        wsSummary["!cols"] = [
            { wch: 34 },
            { wch: 45 }
        ];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
    }

    // ==========================================
    // 2. COMPLETED PAYMENTS SHEET (NO IDS)
    // ==========================================
    if (activeSheets.payments) {
        const paymentsRows = [
            ["#", "Student Name", "Amount (PHP)", "Payment Date", "Subscription Start", "Subscription Expires", "Remarks"],
            ...(reportData.completedPayments || []).map((p, i) => [
                i + 1,
                p.studentName || "-",
                Number(p.amount || 0),
                fmtDate(p.payment_date),
                fmtDate(p.subscription_start),
                fmtDate(p.subscription_expires),
                p.remarks || "-"
            ])
        ];

        const wsPayments = XLSX.utils.aoa_to_sheet(paymentsRows);
        wsPayments["!cols"] = autoColumnWidths(paymentsRows);
        XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");
    }

    // ==========================================
    // 3. SESSIONS SHEET (NO IDS)
    // ==========================================
    if (activeSheets.sessions) {
        const sessionsRows = [
            ["#", "Session Title", "Student Name", "Tutor Name", "Status", "Start Time", "End Time"],
            ...(reportData.sessionsData || []).map((s, i) => [
                i + 1,
                s.title || "Tutorial Session",
                s.studentName || "-",
                s.tutorName || "-",
                s.status || "Unknown",
                fmtDateTime(s.start_datetime),
                fmtDateTime(s.end_datetime)
            ])
        ];

        const wsSessions = XLSX.utils.aoa_to_sheet(sessionsRows);
        wsSessions["!cols"] = autoColumnWidths(sessionsRows);
        XLSX.utils.book_append_sheet(wb, wsSessions, "Sessions");
    }

    // ==========================================
    // 4. RATINGS SHEET (NO IDS)
    // ==========================================
    if (activeSheets.ratings) {
        const ratingsRows = [
            ["#", "Student Name", "Tutor Name", "Rating (Score)", "Date Submitted"],
            ...(reportData.ratingsData || []).map((r, i) => [
                i + 1,
                r.studentName || "-",
                r.tutorName || "-",
                r.Rating !== null && r.Rating !== undefined ? Number(r.Rating) : "-",
                fmtDate(r.created_at)
            ])
        ];

        const wsRatings = XLSX.utils.aoa_to_sheet(ratingsRows);
        wsRatings["!cols"] = autoColumnWidths(ratingsRows);
        XLSX.utils.book_append_sheet(wb, wsRatings, "Ratings");
    }

    // ==========================================
    // 5. STUDENT PROFILES SHEET (NO IDS)
    // ==========================================
    if (activeSheets.students) {
        const studentsRows = [
            ["#", "Full Name", "Date of Birth", "Address / Location", "School", "Grade Level", "Assigned Tutor", "Account Status", "Enrollment Date"],
            ...(reportData.studentsList || []).map((s, i) => [
                i + 1,
                s.Name || "-",
                fmtDate(s.date_of_birth),
                s.Address || "-",
                s.school || "-",
                s.Grade_Level || "-",
                s.tutorName || "-",
                s.Status || "-",
                fmtDate(s.Joined)
            ])
        ];

        const wsStudents = XLSX.utils.aoa_to_sheet(studentsRows);
        wsStudents["!cols"] = autoColumnWidths(studentsRows);
        XLSX.utils.book_append_sheet(wb, wsStudents, "Student Profiles");
    }

    // ==========================================
    // 6. PHYSICAL MERCHANDISE & INVENTORY SHEET (NO IDS)
    // ==========================================
    if (activeSheets.merchandise) {
        const merchList = reportData.merchandiseList || [];
        const merchPayments = reportData.merchandisePayments || [];

        const merchRows = [
            ["YOSEF TUTORIAL CENTER - PHYSICAL MERCHANDISE & INVENTORY REPORT"],
            [],
            ["1. OFFICIAL MERCHANDISE CATALOG & CURRENT INVENTORY", ""],
            ["#", "Product Name", "Category", "Size / Variant", "Unit Price (PHP)", "Current Stock", "Stock Status", "Units Sold (Period)", "Revenue Generated (PHP)"],
            ...merchList.map((m, i) => [
                i + 1,
                m.name,
                m.category || "Apparel",
                m.size || "Standard",
                Number(m.price || 0),
                Number(m.stock || 0),
                m.stock > 10 ? "In Stock" : m.stock > 0 ? "Low Stock" : "Out of Stock",
                Number(m.unitsSold || 0),
                Number(m.periodRevenue || 0)
            ]),
            [
                "",
                "TOTAL (OFFICIAL MERCHANDISE SUMMARY)",
                "",
                "—",
                "—",
                Number(reportData.totalMerchStock || 0),
                "—",
                Number(reportData.totalMerchUnitsSold || 0),
                Number(reportData.merchandiseRevenue || 0)
            ],
            [],
            ["2. MERCHANDISE SALES TRANSACTIONS LOG", ""],
            ["#", "Customer / Buyer Name", "Item Description", "Quantity", "Amount (PHP)", "Payment Date", "Payment Method"],
            ...(merchPayments.length > 0
                ? [
                    ...merchPayments.map((p, i) => {
                        const match = (p.service || "").match(/\(x(\d+)\)/);
                        const qty = match ? parseInt(match[1], 10) : 1;
                        return [
                            i + 1,
                            p.studentName || p.customer_name || "Walk-in",
                            p.service || "Merchandise",
                            qty,
                            Number(p.amount || 0),
                            fmtDate(p.payment_date),
                            p.method || "CASH"
                        ];
                    }),
                    [
                        "",
                        `TOTAL (${merchPayments.length} Transactions)`,
                        "—",
                        Number(reportData.totalMerchUnitsSold || 0),
                        Number(reportData.merchandiseRevenue || 0),
                        "—",
                        "—"
                    ]
                ]
                : [["No merchandise sales recorded in this reporting period."]])
        ];

        const wsMerch = XLSX.utils.aoa_to_sheet(merchRows);
        wsMerch["!cols"] = autoColumnWidths(merchRows);
        XLSX.utils.book_append_sheet(wb, wsMerch, "Merchandise & Inventory");
    }

        // ==========================================
    // 7. TUTOR PROFILES & FACULTY PERFORMANCE
    // ==========================================
    if (activeSheets.tutors) {
        const tutorsRows = [
            ["YOSEF TUTORIAL CENTER - TUTOR PROFILES & FACULTY PERFORMANCE"],
            [],
            ["#", "Tutor Name", "Email Address", "Account Status", "Date Joined", "Assigned Students", "Completed Sessions", "Average Rating"],
            ...(reportData.tutorsList || []).map((t, i) => [
                i + 1,
                t.Name || "—",
                t.Email || "—",
                t.Status || "Active",
                fmtDate(t.Joined),
                Number(t.assignedStudentsCount || 0),
                Number(t.sessionsCount || 0),
                t.avgRating || "—"
            ])
        ];

        const wsTutors = XLSX.utils.aoa_to_sheet(tutorsRows);
        wsTutors["!cols"] = autoColumnWidths(tutorsRows);
        XLSX.utils.book_append_sheet(wb, wsTutors, "Tutor Profiles");
    }

    // Fallback if no sheets were selected
    if (wb.SheetNames.length === 0) {
        const wsEmpty = XLSX.utils.aoa_to_sheet([["No sheets were selected for export."]]);
        XLSX.utils.book_append_sheet(wb, wsEmpty, "Report");
    }

    // Download the workbook in browser
    XLSX.writeFile(wb, fileName);
}
