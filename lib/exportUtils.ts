import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportToPDF = (
    title: string,
    headers: string[],
    data: any[][],
    fileName: string,
    orientation: 'portrait' | 'landscape' = 'portrait',
    chartImage?: string
) => {
    const doc = new jsPDF(orientation);

    // Title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    // Date
    const date = new Date().toLocaleDateString();
    doc.text(`Fecha de reporte: ${date}`, 14, 30);

    let startY = 35;

    // Add Chart if provided
    if (chartImage) {
        const imgProps = doc.getImageProperties(chartImage);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Adjust width to fit margins
        const margin = 14;
        const maxImgWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * maxImgWidth) / imgProps.width;

        doc.addImage(chartImage, 'PNG', margin, 40, maxImgWidth, imgHeight);
        startY = 40 + imgHeight + 10;
    }

    // Table
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: startY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`${fileName}.pdf`);
};


