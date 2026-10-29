import jsPDFRaw from "jspdf";
import autoTable from "jspdf-autotable";

const jsPDF = typeof jsPDFRaw === "function" ? jsPDFRaw : (jsPDFRaw.jsPDF || jsPDFRaw);

// ==========================================================
// MODERN SPREADSHEET THEME (Clean Blue Corporate Palette)
// Matching Reference Style (Image 2)
// ==========================================================
const SPREADSHEET_THEME = {
    bannerBlue: [49, 91, 120],       // #315B78 - Brand Primary Steel Blue
    bannerDark: [35, 68, 92],        // #23445C - Dark Banner Trim
    headerFill: [220, 233, 246],     // #DCE9F6 - Soft Pastel Sky Blue (Table Header)
    headerText: [24, 60, 96],        // #183C60 - Deep Corporate Navy Text
    gridLine: [184, 210, 232],       // #B8D2E8 - Crisp Sky Blue Gridlines
    textDark: [30, 41, 59],          // #1E293B - High Contrast Slate Body Text
    textMuted: [100, 116, 139],      // #64748B - Secondary Muted Text
    zebraLight: [247, 251, 255],     // #F7FBFF - Subtle Cool Ice Alternating Row
    totalFill: [214, 231, 248],      // #D6E7F8 - Accounting Total Summary Highlight
    totalText: [16, 52, 88],         // #103458 - Deep Bold Navy for Totals
    auditBoxFill: [238, 246, 253],   // #EEF6FD - Metadata Audit Info Fill
    white: [255, 255, 255]
};

const MARGIN = 12;
const FOOTER_SPACE = 14;

// ==========================================================
// FORMATTERS
// ==========================================================
function money(value) {
    const num = Number(value || 0);
    return `PHP ${num.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function parseDate(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
    const d = parseDate(value);
    if (!d) return "—";
    return d.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function fmtDateTime(value) {
    const d = parseDate(value);
    if (!d) return "—";
    return d.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function orDash(value) {
    return value === null || value === undefined || value === "" ? "—" : String(value);
}

// ==========================================================
// MAIN GENERATOR
// ==========================================================
export async function generateExcelStyledPdf({
    reportData,
    dateRangeLabel = "Last 30 Days",
    appliedFilters = [],
    matchedStudentCount = 0,
    reporterName = "Den (Admin)",
    fileName = "YOSEF_Analytics_Report.pdf",
    selectedSheets = { summary: true, payments: true, sessions: true, ratings: true, students: true, merchandise: true, tutors: true }
}) {
    const defaultSheets = { summary: true, payments: true, sessions: true, ratings: true, students: true, merchandise: true, tutors: true };
    const activeSheets = { ...defaultSheets, ...(selectedSheets || {}) };
    const hasAnySheet = Object.values(activeSheets).some(Boolean);
    if (!hasAnySheet) {
        activeSheets.summary = true;
    }

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - MARGIN * 2;

    let y = MARGIN;

    function ensureSpace(height) {
        if (y + height > pageH - FOOTER_SPACE) {
            doc.addPage();
            y = MARGIN;
        }
    }

    // ======================================================
    // 1. TOP HEADER BANNER (Clean Corporate Blue)
    // ======================================================
    const bannerH = 17;
    doc.setFillColor(...SPREADSHEET_THEME.bannerBlue);
    doc.roundedRect(MARGIN, y, contentW, bannerH, 1.5, 1.5, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...SPREADSHEET_THEME.white);
    doc.text("YOSEF TUTORIAL CENTER", MARGIN + 6, y + 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(224, 242, 254);
    doc.text("Executive Performance & Institutional Analytics Report", MARGIN + 6, y + 13);

    // Reporter Badge on the right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SPREADSHEET_THEME.white);
    const reporterText = `Reported by: ${reporterName}`;
    doc.text(reporterText, pageW - MARGIN - 6, y + 7.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(224, 242, 254);
    const dateText = `Period: ${dateRangeLabel}  •  Generated: ${new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
    doc.text(dateText, pageW - MARGIN - 6, y + 13, { align: "right" });

    y += bannerH + 4;

    // ======================================================
    // 2. AUDIT INFORMATION BOX
    // ======================================================
    const filterBoxH = appliedFilters.length > 0 ? 15 : 10;
    doc.setFillColor(...SPREADSHEET_THEME.auditBoxFill);
    doc.setDrawColor(...SPREADSHEET_THEME.gridLine);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, y, contentW, filterBoxH, 1.2, 1.2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SPREADSHEET_THEME.headerText);
    doc.text("REPORT AUDIT INFORMATION & SUMMARY:", MARGIN + 4, y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...SPREADSHEET_THEME.textDark);
    const totalRevenueStr = money(reportData.revenue);
    const statSummary = `Total Completed Revenue: ${totalRevenueStr}  |  Total Sessions: ${reportData.sessions}  |  Avg. Tutor Rating: ${reportData.avgRating}/5.0  |  New Enrollments: ${reportData.newEnrollments}  |  Matched Roster: ${matchedStudentCount} Students`;
    doc.text(statSummary, MARGIN + 4, y + 8.5);

    if (appliedFilters.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.4);
        doc.setTextColor(...SPREADSHEET_THEME.textMuted);
        const filterStr = `Active Profile Filters (${appliedFilters.length}): ` + appliedFilters.map(f => `${f.label}: ${f.value}`).join("  •  ");
        doc.text(filterStr.length > 175 ? filterStr.substring(0, 172) + "..." : filterStr, MARGIN + 4, y + 12.5);
    }

    y += filterBoxH + 5;

    // ======================================================
    // HELPER: DRAW CLEAN SHEET HEADER RIBBON
    // ======================================================
    function drawSheetHeader(sheetNumber, sheetTitle, count) {
        ensureSpace(13);

        const countStr = count !== undefined ? `  (${count} record${count === 1 ? "" : "s"})` : "";
        const fullTitle = `Sheet ${sheetNumber}: ${sheetTitle.toUpperCase()}${countStr}`;

        doc.setFillColor(...SPREADSHEET_THEME.bannerBlue);
        doc.roundedRect(MARGIN, y, contentW, 6.2, 1, 1, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.setTextColor(...SPREADSHEET_THEME.white);
        doc.text(fullTitle, MARGIN + 4, y + 4.4);

        y += 8;
    }

    // ======================================================
    // 3. SHEET 1: EXECUTIVE KPI SUMMARY TABLE
    // ======================================================
    if (activeSheets.summary) {
        const summaryHead = [["Metric / KPI Description", "Aggregated Value", "Scope / Details", "Audit Reference Sheet"]];
        const summaryBody = [
            ["Total Completed Revenue", money(reportData.revenue), "All verified transactions within period", "Sheet 2: Completed Payments"],
            ["  • Academic Tutoring Revenue", money(reportData.academicRevenue !== undefined ? reportData.academicRevenue : (reportData.revenue - (reportData.merchandiseRevenue || 0))), "Tuition, hourly tutorials, assessments, and reading programs", "Sheet 2: Completed Payments"],
            ["  • Physical Merchandise Revenue", money(reportData.merchandiseRevenue || 0), "Tutorial Shirts (XS-XL) and spiral tutorial notebooks", "Sheet 6: Merchandise Inventory"],
            ["Merchandise Units Sold", `${Number(reportData.totalMerchUnitsSold || 0).toLocaleString()} Units`, "Total physical products purchased in reporting window", "Sheet 6: Merchandise Inventory"],
            ["Physical Stock on Hand", `${Number(reportData.totalMerchStock || 0).toLocaleString()} Items`, "Current available stock across all sizes and items", "Sheet 6: Merchandise Inventory"],
            ["Total Scheduled Sessions", `${reportData.sessions.toLocaleString()} Sessions`, "Completed, scheduled, and cancelled sessions", "Sheet 3: Sessions Schedule"],
            ["Average Tutor Rating", `${reportData.avgRating} / 5.0 (out of 5.0)`, "Calculated across student session evaluations", "Sheet 4: Session Ratings"],
            ["New Student Enrollments", `${reportData.newEnrollments.toLocaleString()} Students`, "Students enrolled within the selected timeframe", "Sheet 5: Student Roster"],
            ["Matched Student Profiles", `${matchedStudentCount.toLocaleString()} Students`, "Matching all active demographic & academic filters", "Sheet 5: Student Roster"]
        ];

        drawSheetHeader("1", "Executive KPI Summary & Metrics", summaryBody.length);

        autoTable(doc, {
            startY: y,
            head: summaryHead,
            body: summaryBody,
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 8,
                cellPadding: 2.2
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.6,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 2
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            columnStyles: {
                0: { cellWidth: 60, fontStyle: "bold" },
                1: { cellWidth: 45, fontStyle: "bold", textColor: SPREADSHEET_THEME.headerText },
                2: { cellWidth: 100 },
                3: { cellWidth: "auto", textColor: SPREADSHEET_THEME.textMuted }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 7;
    }

    // ======================================================
    // 4. SHEET 2: COMPLETED PAYMENTS TABLE (NO IDS)
    // ======================================================
    if (activeSheets.payments) {
        drawSheetHeader("2", "Completed Payments", reportData.completedPayments.length);

        const paymentHead = [["#", "Student Name", "Amount (PHP)", "Payment Date", "Subscription Start", "Subscription Expires", "Payment Status", "Remarks"]];
        const paymentBody = reportData.completedPayments.map((p, i) => [
            i + 1,
            orDash(p.studentName),
            money(p.amount),
            fmtDate(p.payment_date),
            fmtDate(p.subscription_start),
            fmtDate(p.subscription_expires),
            p.status || "Completed",
            orDash(p.remarks)
        ]);

        const totalRevFormatted = money(reportData.revenue);
        const paymentFoot = [[
            {
                content: "TOTAL COMPLETED REVENUE:",
                colSpan: 2,
                styles: { halign: "right", fontStyle: "bold", textColor: SPREADSHEET_THEME.totalText }
            },
            {
                content: totalRevFormatted,
                styles: { halign: "right", fontStyle: "bold", textColor: [30, 64, 175] }
            },
            {
                content: "—",
                colSpan: 3,
                styles: { halign: "center", textColor: SPREADSHEET_THEME.textMuted }
            },
            {
                content: `${reportData.completedPayments.length} Payments`,
                styles: { halign: "center", fontStyle: "bold" }
            },
            {
                content: "—",
                styles: { halign: "center", textColor: SPREADSHEET_THEME.textMuted }
            }
        ]];

        autoTable(doc, {
            startY: y,
            head: paymentHead,
            body: paymentBody.length ? paymentBody : [["—", "No completed payments found for this period", "—", "—", "—", "—", "—", "—"]],
            foot: paymentBody.length ? paymentFoot : undefined,
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 7.8,
                cellPadding: 2
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.4,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 1.8
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            footStyles: {
                fillColor: SPREADSHEET_THEME.totalFill,
                textColor: SPREADSHEET_THEME.totalText,
                fontStyle: "bold",
                fontSize: 7.8,
                lineWidth: 0.3,
                lineColor: SPREADSHEET_THEME.bannerBlue
            },
            columnStyles: {
                0: { cellWidth: 9, halign: "center" },
                1: { cellWidth: 52, fontStyle: "bold" },
                2: { cellWidth: 34, halign: "right", fontStyle: "bold", textColor: SPREADSHEET_THEME.headerText },
                3: { cellWidth: 28, halign: "center" },
                4: { cellWidth: 30, halign: "center" },
                5: { cellWidth: 30, halign: "center" },
                6: { cellWidth: 26, halign: "center" },
                7: { cellWidth: "auto" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 7;
    }

    // ======================================================
    // 5. SHEET 3: SESSIONS SCHEDULE & ACTIVITY TABLE (NO IDS)
    // ======================================================
    if (activeSheets.sessions) {
        drawSheetHeader("3", "Sessions Schedule & Activity", reportData.sessionsData.length);

        const sessionHead = [["#", "Session Title", "Student Name", "Assigned Tutor", "Status", "Start Date & Time", "End Date & Time"]];
        const sessionBody = reportData.sessionsData.map((s, i) => [
            i + 1,
            orDash(s.title),
            orDash(s.studentName),
            orDash(s.tutorName),
            orDash(s.status),
            fmtDateTime(s.start_datetime),
            fmtDateTime(s.end_datetime)
        ]);

        autoTable(doc, {
            startY: y,
            head: sessionHead,
            body: sessionBody.length ? sessionBody : [["—", "No scheduled sessions found for this period", "—", "—", "—", "—", "—"]],
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 7.8,
                cellPadding: 2
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.4,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 1.8
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            columnStyles: {
                0: { cellWidth: 9, halign: "center" },
                1: { cellWidth: 48, fontStyle: "bold" },
                2: { cellWidth: 46 },
                3: { cellWidth: 46 },
                4: { cellWidth: 28, halign: "center" },
                5: { cellWidth: 45, halign: "center" },
                6: { cellWidth: "auto", halign: "center" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 7;
    }

    // ======================================================
    // 6. SHEET 4: SESSION RATINGS & REVIEWS TABLE (NO IDS)
    // ======================================================
    if (activeSheets.ratings) {
        drawSheetHeader("4", "Session Ratings & Evaluations", reportData.ratingsData.length);

        const ratingsHead = [["#", "Student Name", "Assigned Tutor", "Rating Score", "Evaluation Date"]];
        const ratingsBody = reportData.ratingsData.map((r, i) => [
            i + 1,
            orDash(r.studentName),
            orDash(r.tutorName),
            r.Rating !== null && r.Rating !== undefined ? `${Number(r.Rating).toFixed(1)} / 5.0` : "—",
            fmtDate(r.created_at)
        ]);

        autoTable(doc, {
            startY: y,
            head: ratingsHead,
            body: ratingsBody.length ? ratingsBody : [["—", "No rating evaluations found for this period", "—", "—", "—"]],
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 7.8,
                cellPadding: 2
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.4,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 1.8
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 75, fontStyle: "bold" },
                2: { cellWidth: 75 },
                3: { cellWidth: 45, halign: "center", fontStyle: "bold", textColor: SPREADSHEET_THEME.headerText },
                4: { cellWidth: "auto", halign: "center" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 7;
    }

    // ======================================================
    // 7. SHEET 5: STUDENT ROSTER & PROFILES TABLE (NO IDS)
    // ======================================================
    if (activeSheets.students) {
        drawSheetHeader("5", "Student Roster & Academic Profiles", reportData.studentsList.length);

        const studentsHead = [["#", "Student Name", "Birthdate", "Address / Location", "School", "Grade Level", "Assigned Tutor", "Account Status", "Enrollment Date"]];
        const studentsBody = reportData.studentsList.map((s, i) => [
            i + 1,
            orDash(s.Name),
            fmtDate(s.date_of_birth),
            orDash(s.Address),
            orDash(s.school),
            orDash(s.Grade_Level),
            orDash(s.tutorName),
            orDash(s.Status),
            fmtDate(s.Joined)
        ]);

        autoTable(doc, {
            startY: y,
            head: studentsHead,
            body: studentsBody.length ? studentsBody : [["—", "No students matched the active filters", "—", "—", "—", "—", "—", "—", "—"]],
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 7.6,
                cellPadding: 2
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.2,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 1.8
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            columnStyles: {
                0: { cellWidth: 9, halign: "center" },
                1: { cellWidth: 46, fontStyle: "bold" },
                2: { cellWidth: 26, halign: "center" },
                3: { cellWidth: 50 },
                4: { cellWidth: 42 },
                5: { cellWidth: 26, halign: "center" },
                6: { cellWidth: 36 },
                7: { cellWidth: 22, halign: "center" },
                8: { cellWidth: "auto", halign: "center" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });
    }

    // ==========================================================
    // 8. SHEET 6: PHYSICAL MERCHANDISE & INVENTORY SALES
    // ==========================================================
    if (activeSheets.merchandise) {
        const merchList = reportData.merchandiseList || [];
        const merchPayments = reportData.merchandisePayments || [];

        drawSheetHeader("6", "Physical Merchandise & Inventory Sales", merchList.length);

        // Section A: Catalog & Stock Inventory
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SPREADSHEET_THEME.headerText);
        doc.text("A. OFFICIAL MERCHANDISE CATALOG & STOCK INVENTORY", MARGIN, y + 1);

        const merchHead = [[
            "#",
            "Product Name",
            "Category",
            "Size",
            "Unit Price",
            "Stock Level",
            "Status",
            "Units Sold",
            "Total Sales (PHP)"
        ]];

        const merchBody = merchList.map((m, idx) => [
            String(idx + 1),
            m.name,
            m.category || "Apparel",
            m.size || "—",
            money(m.price),
            `${m.stock} units`,
            m.stock > 10 ? "In Stock" : m.stock > 0 ? "Low Stock" : "Out of Stock",
            `${m.unitsSold || 0} sold`,
            money(m.periodRevenue || 0)
        ]);

        const merchFoot = [[
            {
                content: "TOTAL (OFFICIAL MERCHANDISE SUMMARY):",
                colSpan: 5,
                styles: { halign: "right", fontStyle: "bold", textColor: SPREADSHEET_THEME.totalText }
            },
            {
                content: `${Number(reportData.totalMerchStock || 0)} units`,
                styles: { halign: "center", fontStyle: "bold" }
            },
            {
                content: "—",
                styles: { halign: "center", textColor: SPREADSHEET_THEME.textMuted }
            },
            {
                content: `${Number(reportData.totalMerchUnitsSold || 0)} sold`,
                styles: { halign: "center", fontStyle: "bold" }
            },
            {
                content: money(reportData.merchandiseRevenue || 0),
                styles: { halign: "right", fontStyle: "bold", textColor: [30, 64, 175] }
            }
        ]];

        autoTable(doc, {
            startY: y + 3,
            head: merchHead,
            body: merchBody,
            foot: merchFoot,
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 8,
                cellPadding: 2.2,
                halign: "left"
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.6,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 2
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            footStyles: {
                fillColor: SPREADSHEET_THEME.totalFill,
                textColor: SPREADSHEET_THEME.totalText,
                fontStyle: "bold",
                fontSize: 8,
                lineColor: SPREADSHEET_THEME.bannerBlue,
                lineWidth: 0.3
            },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 55, fontStyle: "bold" },
                2: { cellWidth: 28 },
                3: { cellWidth: 20, halign: "center" },
                4: { cellWidth: 28, halign: "right" },
                5: { cellWidth: 26, halign: "center" },
                6: { cellWidth: 26, halign: "center" },
                7: { cellWidth: 26, halign: "center" },
                8: { cellWidth: 35, halign: "right", fontStyle: "bold" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 7;

        // Section B: Retail Sales Transactions Log
        if (y > pageH - 45) {
            doc.addPage();
            y = 16;
        }

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SPREADSHEET_THEME.headerText);
        doc.text("B. MERCHANDISE SALES TRANSACTIONS LOG", MARGIN, y + 1);

        const salesHead = [[
            "#",
            "Customer / Buyer Name",
            "Item & Description",
            "Quantity",
            "Amount (PHP)",
            "Payment Date",
            "Payment Method"
        ]];

        const salesBody = merchPayments.length > 0
            ? merchPayments.map((p, idx) => {
                const match = (p.service || "").match(/\(x(\d+)\)/);
                const qty = match ? parseInt(match[1], 10) : 1;
                return [
                    String(idx + 1),
                    p.studentName || p.customer_name || "Walk-in",
                    p.service || "Merchandise",
                    `${qty} unit${qty > 1 ? "s" : ""}`,
                    money(p.amount),
                    fmtDate(p.payment_date),
                    p.method || "CASH"
                ];
            })
            : [["—", "No merchandise sales recorded in this period", "—", "—", "—", "—", "—"]];

        const salesFoot = merchPayments.length > 0 ? [[
            {
                content: `TOTAL (${merchPayments.length} Transactions):`,
                colSpan: 3,
                styles: { halign: "right", fontStyle: "bold", textColor: SPREADSHEET_THEME.totalText }
            },
            {
                content: `${Number(reportData.totalMerchUnitsSold || 0)} units`,
                styles: { halign: "center", fontStyle: "bold" }
            },
            {
                content: money(reportData.merchandiseRevenue || 0),
                styles: { halign: "right", fontStyle: "bold", textColor: [30, 64, 175] }
            },
            {
                content: "—",
                colSpan: 2,
                styles: { halign: "center", textColor: SPREADSHEET_THEME.textMuted }
            }
        ]] : undefined;

        autoTable(doc, {
            startY: y + 3,
            head: salesHead,
            body: salesBody,
            foot: salesFoot,
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 8,
                cellPadding: 2.2,
                halign: "left"
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.6,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 2
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            footStyles: {
                fillColor: SPREADSHEET_THEME.totalFill,
                textColor: SPREADSHEET_THEME.totalText,
                fontStyle: "bold",
                fontSize: 8,
                lineColor: SPREADSHEET_THEME.bannerBlue,
                lineWidth: 0.3
            },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 55 },
                2: { cellWidth: 70 },
                3: { cellWidth: 25, halign: "center" },
                4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
                5: { cellWidth: 30, halign: "center" },
                6: { cellWidth: 25, halign: "center" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 8;
    }

        // ==========================================================
    // 8. SHEET 7: TUTOR PROFILES & FACULTY PERFORMANCE
    // ==========================================================
    if (activeSheets.tutors) {
        const tutorsList = reportData.tutorsList || [];
        drawSheetHeader("7", "Tutor Profiles & Faculty Performance", tutorsList.length);

        const tutorsHead = [["#", "Tutor Name", "Email Address", "Status", "Date Joined", "Assigned Students", "Completed Sessions", "Average Rating Score"]];
        const tutorsBody = tutorsList.map((t, i) => [
            i + 1,
            orDash(t.Name),
            orDash(t.Email),
            orDash(t.Status),
            fmtDate(t.Joined),
            `${t.assignedStudentsCount || 0} Students`,
            `${t.sessionsCount || 0} Sessions`,
            orDash(t.avgRating)
        ]);

        autoTable(doc, {
            startY: y,
            head: tutorsHead,
            body: tutorsBody.length ? tutorsBody : [["—", "No tutor records available", "—", "—", "—", "—", "—", "—"]],
            theme: "grid",
            headStyles: {
                fillColor: SPREADSHEET_THEME.headerFill,
                textColor: SPREADSHEET_THEME.headerText,
                fontStyle: "bold",
                fontSize: 7.8,
                cellPadding: 2.2
            },
            styles: {
                lineColor: SPREADSHEET_THEME.gridLine,
                lineWidth: 0.2,
                fontSize: 7.4,
                textColor: SPREADSHEET_THEME.textDark,
                cellPadding: 2
            },
            alternateRowStyles: {
                fillColor: SPREADSHEET_THEME.zebraLight
            },
            columnStyles: {
                0: { cellWidth: 9, halign: "center" },
                1: { cellWidth: 48, fontStyle: "bold" },
                2: { cellWidth: 54 },
                3: { cellWidth: 24, halign: "center" },
                4: { cellWidth: 28, halign: "center" },
                5: { cellWidth: 32, halign: "center" },
                6: { cellWidth: 34, halign: "center" },
                7: { cellWidth: "auto", halign: "center", fontStyle: "bold" }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = doc.lastAutoTable.finalY + 8;
    }

    // ======================================================
    // 9. RUNNING HEADERS & FOOTERS ACROSS ALL PAGES
    // ======================================================
    const totalPages = doc.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);

        // Running header on page 2 and beyond
        if (page > 1) {
            doc.setFillColor(...SPREADSHEET_THEME.auditBoxFill);
            doc.rect(MARGIN, 5, contentW, 5.8, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.4);
            doc.setTextColor(...SPREADSHEET_THEME.headerText);
            doc.text("YOSEF TUTORIAL CENTER  •  INSTITUTIONAL PERFORMANCE & ANALYTICS REPORT", MARGIN + 4, 9);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.text(`Prepared by: ${reporterName}  |  Period: ${dateRangeLabel}`, pageW - MARGIN - 4, 9, { align: "right" });
        }

        // Running footer on every page
        doc.setDrawColor(...SPREADSHEET_THEME.gridLine);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, pageH - 9, pageW - MARGIN, pageH - 9);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...SPREADSHEET_THEME.textMuted);
        doc.text(`YOSEF Tutorial Center  •  Confidential Institutional Analytics  •  Certified by: ${reporterName}`, MARGIN, pageH - 4.5);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SPREADSHEET_THEME.headerText);
        doc.text(`Page ${page} of ${totalPages}`, pageW - MARGIN, pageH - 4.5, { align: "right" });
    }

    doc.save(fileName);
}
