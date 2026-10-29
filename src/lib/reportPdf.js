import html2canvas from "html2canvas";
import jsPDFRaw from "jspdf";

const jsPDF = typeof jsPDFRaw === "function" ? jsPDFRaw : (jsPDFRaw.jsPDF || jsPDFRaw);

export async function generateReportPdf({
    targetElement,
    fileName = "YOSEF_Report.pdf",
    reportedBy = "Administrator",
    reporterRole = "Admin",
    dateRangeLabel = "",
    appliedFilters = [],
    matchedStudentCount = 0
}) {
    if (!targetElement) {
        throw new Error("No report element found to export.");
    }

    // Wait for fonts to be fully rendered
    if (document.fonts) {
        try {
            await document.fonts.ready;
        } catch {
            // Ignore font ready errors
        }
    }

    // Brief delay to ensure Recharts animations/SVG layout have settled
    await new Promise(resolve => setTimeout(resolve, 80));

    // Capture the target DOM element as high-resolution canvas
    const canvas = await html2canvas(targetElement, {
        scale: 2, // 2x for sharp print quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
            // Hide interactive buttons that shouldn't appear in the report screenshot
            const elementsToHide = clonedDoc.querySelectorAll(
                ".no-print, .export-report-button, .report-more-button, .report-reset-button, .chart-card-header button, .app-modal-overlay"
            );
            elementsToHide.forEach(el => {
                el.style.display = "none";
            });

            // Ensure branding header and footer are visible
            const branding = clonedDoc.querySelector(".report-snapshot-branding");
            if (branding) {
                branding.style.display = "flex";
            }

            const footer = clonedDoc.querySelector(".report-snapshot-footer");
            if (footer) {
                footer.style.display = "flex";
            }
        }
    });

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    if (imgHeight <= usableHeight) {
        // Fits cleanly on a single landscape A4 page
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        doc.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight);
    } else {
        // Multi-page slicing
        let yOffset = 0;
        const sliceHeightInCanvas = (usableHeight * canvas.width) / usableWidth;

        while (yOffset < canvas.height) {
            if (yOffset > 0) doc.addPage();

            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.min(sliceHeightInCanvas, canvas.height - yOffset);

            const ctx = sliceCanvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
                canvas,
                0,
                yOffset,
                canvas.width,
                sliceCanvas.height,
                0,
                0,
                canvas.width,
                sliceCanvas.height
            );

            const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
            const currentSliceHeightMm = (sliceCanvas.height * usableWidth) / canvas.width;
            doc.addImage(sliceData, "JPEG", margin, margin, imgWidth, currentSliceHeightMm);

            yOffset += sliceHeightInCanvas;
        }
    }

    doc.save(fileName);
}
