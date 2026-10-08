import jsPDF from 'jspdf';
import { InspectionReport } from '../types';

// Helper to strip markdown formatting for plain-text PDF
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\|/g, ' | ')
    .replace(/^[-*]\s/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('fi-FI', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Generates a professional PDF report from the inspection data
 */
export async function generatePDF(report: InspectionReport): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // ── Color palette ──────────────────────────────────────────────────
  const colors = {
    primary: [30, 64, 175] as [number, number, number],   // blue-800
    secondary: [71, 85, 105] as [number, number, number], // slate-500
    accent: [219, 234, 254] as [number, number, number],  // blue-100
    text: [17, 24, 39] as [number, number, number],       // gray-900
    muted: [107, 114, 128] as [number, number, number],   // gray-500
    divider: [229, 231, 235] as [number, number, number], // gray-200
    urgentRed: [220, 38, 38] as [number, number, number],
    urgentAmber: [217, 119, 6] as [number, number, number],
    urgentGreen: [22, 163, 74] as [number, number, number],
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > 280) {
      pdf.addPage();
      y = margin;
    }
  };

  const addSectionTitle = (title: string, level: 1 | 2 = 1) => {
    checkPageBreak(15);
    if (level === 1) {
      pdf.setFillColor(...colors.primary);
      pdf.rect(margin, y, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin + 3, y + 5.5);
      y += 12;
    } else {
      pdf.setTextColor(...colors.primary);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, y + 4);
      pdf.setDrawColor(...colors.primary);
      pdf.line(margin, y + 6, margin + contentWidth, y + 6);
      y += 10;
    }
    pdf.setTextColor(...colors.text);
  };

  const addText = (text: string, fontSize = 9, bold = false, color = colors.text) => {
    pdf.setTextColor(...color);
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = pdf.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.5;
    checkPageBreak(lines.length * lineHeight + 2);
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight + 2;
  };

  const addKV = (key: string, value: string) => {
    if (!value) return;
    checkPageBreak(6);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.secondary);
    pdf.text(key + ':', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    const valueLines = pdf.splitTextToSize(value, contentWidth - 45);
    pdf.text(valueLines, margin + 45, y);
    y += Math.max(5, valueLines.length * 4.5);
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 1: COVER PAGE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Header bar
  pdf.setFillColor(...colors.primary);
  pdf.rect(0, 0, 210, 50, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('KUNTOTARKASTUSRAPORTTI', margin, 22);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Rakennuksen tekninen kuntoarvio', margin, 32);
  pdf.setFontSize(9);
  pdf.setTextColor(219, 234, 254);
  pdf.text('Laadittu tekoälyavusteisella KuntotarkastusAI-järjestelmällä', margin, 43);

  // Property info box
  y = 65;
  pdf.setFillColor(...colors.accent);
  pdf.roundedRect(margin, y, contentWidth, 55, 3, 3, 'F');
  y += 7;

  const { propertyInfo: pi } = report;
  pdf.setTextColor(...colors.text);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  const addressText = `${pi.address}${pi.postalCode || pi.city ? ', ' + pi.postalCode + ' ' + pi.city : ''}`;
  pdf.text(addressText || 'Kohde', margin + 5, y + 4);
  y += 10;

  const infoGrid = [
    ['Rakennustyyppi', pi.buildingType],
    ['Rakennusvuosi', pi.buildYear],
    ['Kerrosala', pi.floorArea ? pi.floorArea + ' m²' : ''],
    ['Kerroksia', pi.floors],
    ['Tarkastuspäivä', formatDate(pi.inspectionDate)],
    ['Kiinteistötunnus', pi.propertyId],
  ].filter(([, v]) => v);

  const colWidth = contentWidth / 2 - 5;
  infoGrid.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xPos = margin + 5 + col * (colWidth + 10);
    const yPos = y + row * 9;
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.secondary);
    pdf.text(k, xPos, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    pdf.text(v, xPos, yPos + 4);
  });

  y = 130;

  // Inspector + client cards
  [[
    'TARKASTAJA',
    [`${pi.inspector}`, `${pi.inspectorTitle}`],
  ], [
    'TILAAJA',
    [`${pi.clientName}`, `${pi.clientPhone}`, `${pi.clientEmail}`],
  ]].forEach(([title, lines], i) => {
    const xPos = margin + i * (colWidth + 10);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(xPos, y, colWidth, 30, 2, 2, 'F');
    pdf.setDrawColor(...colors.divider);
    pdf.roundedRect(xPos, y, colWidth, 30, 2, 2, 'S');
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.secondary);
    pdf.text(String(title), xPos + 4, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    (lines as string[]).filter(Boolean).forEach((line, j) => {
      pdf.setFontSize(j === 0 ? 9 : 8);
      if (j === 0) pdf.setFont('helvetica', 'bold');
      else pdf.setFont('helvetica', 'normal');
      pdf.text(line, xPos + 4, y + 12 + j * 6);
    });
  });

  y = 172;

  // Weather
  if (pi.weatherConditions || pi.outdoorTemp || pi.indoorTemp) {
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.secondary);
    pdf.text('OLOSUHTEET TARKASTUSHETKELLÄ', margin + 4, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    const weatherParts = [
      pi.weatherConditions,
      pi.outdoorTemp ? `Ulko ${pi.outdoorTemp}°C` : '',
      pi.indoorTemp ? `Sisä ${pi.indoorTemp}°C` : '',
    ].filter(Boolean);
    pdf.text(weatherParts.join('  ·  '), margin + 4, y + 12);
    y += 24;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 2: FINDINGS SUMMARY TABLE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (report.summary?.findingsSummary) {
    pdf.addPage();
    y = margin;
    addSectionTitle('HAVAINTOYHTEENVETO');
    addText(stripMarkdown(report.summary.findingsSummary), 8.5);
    y += 4;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INSPECTION CATEGORIES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const categoriesWithContent = report.categories.filter(
    cat => cat.observations.length > 0 || cat.notes
  );

  if (categoriesWithContent.length > 0) {
    pdf.addPage();
    y = margin;
    addSectionTitle('TARKASTUSHAVAINNOT');

    for (const cat of categoriesWithContent) {
      checkPageBreak(20);
      addSectionTitle(cat.name.toUpperCase(), 2);

      // Observations
      for (let i = 0; i < cat.observations.length; i++) {
        const obs = cat.observations[i];
        checkPageBreak(25);

        // Observation header
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentWidth, 7, 'F');

        // Urgency color indicator
        const urgencyColors: Record<string, [number, number, number]> = {
          välitön: colors.urgentRed,
          '1-2v': colors.urgentAmber,
          '3-5v': [234, 179, 8],
          seurattava: colors.primary,
          ei_toimenpiteitä: colors.urgentGreen,
        };
        const urgencyLabels: Record<string, string> = {
          välitön: 'Välitön', '1-2v': '1–2 v', '3-5v': '3–5 v',
          seurattava: 'Seurattava', ei_toimenpiteitä: 'Ei toimenpiteitä',
        };
        const uc = urgencyColors[obs.urgency] || colors.secondary;
        pdf.setFillColor(...uc);
        pdf.rect(margin, y, 3, 7, 'F');

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...uc);
        pdf.text(urgencyLabels[obs.urgency] || obs.urgency, margin + 5, y + 4.5);
        pdf.setTextColor(...colors.muted);
        pdf.text(`Havainto ${i + 1}`, margin + 35, y + 4.5);
        y += 9;

        // Observation text
        const obsText = stripMarkdown(obs.withTheory || obs.processedText || obs.rawText);
        addText(obsText, 8.5);

        // Photos
        for (const photo of obs.photos) {
          if (photo.dataUrl) {
            checkPageBreak(60);
            try {
              const imgFormat = photo.mediaType.includes('png') ? 'PNG' : 'JPEG';
              pdf.addImage(photo.dataUrl, imgFormat, margin, y, 80, 55, undefined, 'MEDIUM');

              if (photo.caption) {
                pdf.setFontSize(7.5);
                pdf.setFont('helvetica', 'italic');
                pdf.setTextColor(...colors.muted);
                const captionLines = pdf.splitTextToSize(photo.caption, 80);
                pdf.text(captionLines, margin, y + 57);
                y += captionLines.length * 4;
              }
              y += 62;
            } catch {
              // Skip invalid images
            }
          }
        }

        y += 4;
      }

      // Category notes
      if (cat.notes) {
        checkPageBreak(12);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...colors.secondary);
        pdf.text('Muistiinpanot:', margin, y);
        y += 5;
        addText(cat.notes, 8);
      }

      y += 6;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FINAL SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (report.summary?.finalSummary) {
    pdf.addPage();
    y = margin;
    addSectionTitle('LOPPUYHTEENVETO');
    addText(stripMarkdown(report.summary.finalSummary), 9);
  }

  // ── Footer on all pages ──────────────────────────────────────────
  const totalPages = (pdf as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.muted);
    pdf.text(
      `${pi.address || 'Kuntotarkastus'} · ${formatDate(pi.inspectionDate)} · Sivu ${page}/${totalPages}`,
      margin,
      290
    );
    pdf.text('KuntotarkastusAI · Laadittu tekoälyavusteisesti', pageWidth - margin, 290, { align: 'right' });
    if (page > 1) {
      pdf.setDrawColor(...colors.divider);
      pdf.line(margin, 285, pageWidth - margin, 285);
    }
  }

  // Save
  const filename = `kuntotarkastus_${pi.address?.replace(/\s+/g, '_') || 'raportti'}_${pi.inspectionDate || 'uusi'}.pdf`;
  pdf.save(filename);
}
