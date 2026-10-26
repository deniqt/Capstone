import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ==========================================================
// NOTE ON FONTS
// jsPDF's built-in fonts (Helvetica) cannot draw the peso sign
// (₱), so money is written as "PHP 1,500" in the PDF.
// Keep all text in this file to plain ASCII for the same reason.
// ==========================================================

const COLOR = {
    primary: [49, 91, 120],
    primarySoft: [232, 240, 246],
    text: [30, 41, 59],
    muted: [100, 116, 139],
    border: [226, 232, 240],
    zebra: [248, 250, 252]
};

const MARGIN = 14;
const FOOTER_SPACE = 16;


// ==========================================================
// FORMATTERS
// ==========================================================

function money(value) {
    const number = Number(value || 0);

    return `PHP ${number.toLocaleString("en-PH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}`;
}

function parseDate(value) {
    if (!value) return null;

    // "YYYY-MM-DD" (date columns) must be parsed as a LOCAL date,
    // otherwise some timezones show the previous day.
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

function orDash(value) {
    return value === null || value === undefined || value === ""
        ? "-"
        : String(value);
}


// ==========================================================
// LOGO (optional - export still works if it fails to load)
// ==========================================================

function loadLogo(src) {
    return new Promise(resolve => {
        if (!src) return resolve(null);

        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext("2d").drawImage(img, 0, 0);

                resolve({
                    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
                    ratio: img.naturalWidth / img.naturalHeight
                });
            } catch {
                resolve(null);
            }
        };

        img.onerror = () => resolve(null);
        img.src = src;
    });
}


// ==========================================================
// MAIN
// ==========================================================

export async function generateReportPdf({
    reportData,
    dateRangeLabel,
    appliedFilters = [],
    matchedStudentCount = 0,
    logoSrc,
    fileName
}) {

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - MARGIN * 2;

    let y = MARGIN;


    // ----- helpers -----------------------------------------

    function ensureSpace(height) {
        if (y + height > pageH - FOOTER_SPACE) {
            doc.addPage();
            y = MARGIN;
        }
    }

    function sectionTitle(text, count) {
        ensureSpace(16);

        doc.setFillColor(...COLOR.primary);
        doc.rect(MARGIN, y - 4.2, 1.6, 6, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...COLOR.text);
        doc.text(text, MARGIN + 4, y);

        if (count !== undefined) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...COLOR.muted);
            doc.text(
                `${count} record${count === 1 ? "" : "s"}`,
                MARGIN + 4 + doc.getTextWidth(text) + 4,
                y
            );
        }

        y += 6;
    }

    function addTable({ title, head, body, columnStyles }) {
        sectionTitle(title, body.length);

        if (body.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(...COLOR.muted);
            doc.text("No records for the selected filters.", MARGIN + 4, y + 4);
            y += 14;
            return;
        }

        autoTable(doc, {
            startY: y,
            head: [head],
            body,
            theme: "grid",
            margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_SPACE },
            styles: {
                font: "helvetica",
                fontSize: 7.8,
                cellPadding: 1.8,
                textColor: COLOR.text,
                lineColor: COLOR.border,
                lineWidth: 0.1,
                overflow: "linebreak",
                valign: "middle"
            },
            headStyles: {
                fillColor: COLOR.primary,
                textColor: 255,
                fontStyle: "bold",
                fontSize: 8
            },
            alternateRowStyles: { fillColor: COLOR.zebra },
            columnStyles: columnStyles || {}
        });

        y = doc.lastAutoTable.finalY + 10;
    }

    function drawBars({ x, width, title, items, formatValue }) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLOR.text);
        doc.text(title, x, y);

        let rowY = y + 7;

        if (items.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(...COLOR.muted);
            doc.text("No data available.", x, rowY);
            return 14;
        }

        const labelW = 30;
        const valueW = 30;
        const barMax = width - labelW - valueW;
        const maxValue = Math.max(...items.map(i => i.value), 1);

        items.forEach(item => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...COLOR.text);
            doc.text(String(item.label), x, rowY + 3.2, { maxWidth: labelW - 2 });

            const barW = Math.max((item.value / maxValue) * barMax, 0.8);
            doc.setFillColor(...COLOR.primary);
            doc.roundedRect(x + labelW, rowY, barW, 4.4, 0.8, 0.8, "F");

            doc.setTextColor(...COLOR.muted);
            doc.text(formatValue(item.value), x + labelW + barW + 2, rowY + 3.2);

            rowY += 7;
        });

        return rowY - y;
    }


    // ======================================================
    // 1. HEADER
    // ======================================================

    const logo = await loadLogo(logoSrc);
    let titleX = MARGIN;

    if (logo) {
        const logoH = 16;
        doc.addImage(logo.dataUrl, "JPEG", MARGIN, y - 2, logoH * logo.ratio, logoH);
        titleX = MARGIN + logoH * logo.ratio + 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...COLOR.primary);
    doc.text("YOSEF Tutorial Center", titleX, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.muted);
    doc.text("Reports & Analytics", titleX, y + 12);

    doc.setFontSize(9);
    doc.text(
        `Generated: ${new Date().toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short"
        })}`,
        pageW - MARGIN,
        y + 5,
        { align: "right" }
    );

    doc.text(`Period: ${dateRangeLabel}`, pageW - MARGIN, y + 12, {
        align: "right"
    });

    y += 22;

    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y - 2, pageW - MARGIN, y - 2);
    y += 4;


    // ======================================================
    // 2. APPLIED FILTERS
    // ======================================================

    sectionTitle("Applied Filters");

    const filterText = appliedFilters.length
        ? appliedFilters.map(f => `${f.label}: ${f.value}`).join("     |     ")
        : "No student-profile filters applied (all students included).";

    const filterLines = doc.splitTextToSize(filterText, contentW - 8);
    const filterBoxH = filterLines.length * 4.6 + 6;

    ensureSpace(filterBoxH + 4);

    doc.setFillColor(...COLOR.primarySoft);
    doc.roundedRect(MARGIN, y, contentW, filterBoxH, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.text);
    doc.text(filterLines, MARGIN + 4, y + 5.6);

    y += filterBoxH + 3;

    if (appliedFilters.length) {
        doc.setFontSize(8.5);
        doc.setTextColor(...COLOR.muted);
        doc.text(
            `${matchedStudentCount} student${matchedStudentCount === 1 ? "" : "s"} match these filters. ` +
            "Payments, sessions and ratings below are limited to those students.",
            MARGIN,
            y + 2
        );
        y += 4;
    }

    y += 8;


    // ======================================================
    // 3. KPI CARDS
    // ======================================================

    const kpis = [
        ["Total Revenue", money(reportData.revenue)],
        ["Total Sessions", Number(reportData.sessions).toLocaleString("en-PH")],
        ["Avg. Tutor Rating", `${reportData.avgRating} / 5.0`],
        ["New Enrollments", Number(reportData.newEnrollments).toLocaleString("en-PH")]
    ];

    const gap = 4;
    const cardW = (contentW - gap * 3) / 4;
    const cardH = 22;

    ensureSpace(cardH + 8);

    kpis.forEach(([label, value], index) => {
        const x = MARGIN + index * (cardW + gap);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...COLOR.border);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

        doc.setFillColor(...COLOR.primary);
        doc.rect(x, y + 3, 1.2, cardH - 6, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...COLOR.muted);
        doc.text(label, x + 5, y + 7.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(...COLOR.text);
        doc.text(value, x + 5, y + 16.5);
    });

    y += cardH + 10;


    // ======================================================
    // 4. SIMPLE BAR CHARTS
    // ======================================================

    const halfW = (contentW - 10) / 2;

    const revenueItems = reportData.revenueByMonth
        .slice(-12)
        .map(i => ({ label: i.month, value: i.revenue }));

    const statusItems = reportData.sessionsByStatus
        .map(i => ({ label: i.name, value: i.value }));

    const estimatedH =
        10 + Math.max(revenueItems.length, statusItems.length, 1) * 7;

    ensureSpace(estimatedH);

    const h1 = drawBars({
        x: MARGIN,
        width: halfW,
        title: "Revenue by Month (completed payments)",
        items: revenueItems,
        formatValue: money
    });

    const h2 = drawBars({
        x: MARGIN + halfW + 10,
        width: halfW,
        title: "Sessions by Status",
        items: statusItems,
        formatValue: v => String(v)
    });

    y += Math.max(h1, h2) + 8;


    // ======================================================
    // 5. DATA TABLES
    // ======================================================

    addTable({
        title: "Completed Payments",
        head: ["Payment ID", "Student", "Amount", "Payment Date", "Sub. Start", "Sub. Expires", "Remarks"],
        body: reportData.completedPayments.map(p => [
            `#${p.payment_id}`,
            orDash(p.studentName),
            money(p.amount),
            fmtDate(p.payment_date),
            fmtDate(p.subscription_start),
            fmtDate(p.subscription_expires),
            orDash(p.remarks)
        ]),
        columnStyles: {
            2: { halign: "right" }
        }
    });

    addTable({
        title: "Sessions",
        head: ["ID", "Title", "Student", "Tutor", "Status", "Start", "End"],
        body: reportData.sessionsData.map(s => [
            s.id,
            orDash(s.title),
            orDash(s.studentName),
            orDash(s.tutorName),
            orDash(s.status),
            fmtDateTime(s.start_datetime),
            fmtDateTime(s.end_datetime)
        ])
    });

    addTable({
        title: "Session Ratings",
        head: ["Rating ID", "Student", "Tutor", "Rating", "Date"],
        body: reportData.ratingsData.map(r => [
            r.Rating_ID,
            orDash(r.studentName),
            orDash(r.tutorName),
            orDash(r.Rating),
            fmtDate(r.created_at)
        ])
    });

    addTable({
        title: "Student Profiles",
        head: [
            "ID", "Name", "Age", "Birthday", "Location", "School",
            "Grade", "Subjects", "Learning", "Tutor", "Status", "Joined"
        ],
        body: reportData.studentsList.map(s => [
            s.id,
            orDash(s.Name),
            orDash(s.age),
            fmtDate(s.date_of_birth),
            orDash(s.Address),
            orDash(s.school),
            orDash(s.Grade_Level),
            s.subjectList.length ? s.subjectList.join(", ") : "-",
            [s.Learning_Mode, s.Learning_Time].filter(Boolean).join(" / ") || "-",
            orDash(s.tutorName),
            orDash(s.Status),
            fmtDate(s.Joined)
        ]),
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 32 },
            2: { cellWidth: 10, halign: "center" },
            3: { cellWidth: 22 },
            4: { cellWidth: 40 },
            5: { cellWidth: 26 },
            6: { cellWidth: 15 },
            7: { cellWidth: 28 },
            8: { cellWidth: 24 },
            9: { cellWidth: 24 },
            10: { cellWidth: 14 },
            11: { cellWidth: 22 }
        }
    });


    // ======================================================
    // 6. FOOTER ON EVERY PAGE
    // ======================================================

    const totalPages = doc.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);

        doc.setDrawColor(...COLOR.border);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, pageH - 11, pageW - MARGIN, pageH - 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLOR.muted);
        doc.text("YOSEF Tutorial Center - Confidential", MARGIN, pageH - 6);
        doc.text(`Page ${page} of ${totalPages}`, pageW - MARGIN, pageH - 6, {
            align: "right"
        });
    }

    doc.save(fileName);
}