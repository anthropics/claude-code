import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { InspectionReport } from '../types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

function formatDate(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('fi-FI', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

const urgencyLabels: Record<string, string> = {
  välitön: 'Välitön',
  '1-2v': '1–2 vuotta',
  '3-5v': '3–5 vuotta',
  seurattava: 'Seurattava',
  ei_toimenpiteitä: 'Ei toimenpiteitä',
};

const urgencyColors: Record<string, string> = {
  välitön: '#dc2626',
  '1-2v': '#d97706',
  '3-5v': '#eab308',
  seurattava: '#2563eb',
  ei_toimenpiteitä: '#16a34a',
};

function buildHtml(report: InspectionReport): string {
  const pi = report.propertyInfo;
  const address = `${pi.address || ''}${pi.postalCode || pi.city ? ', ' + pi.postalCode + ' ' + pi.city : ''}`;

  const categoriesHtml = report.categories
    .filter(cat => cat.observations.length > 0 || cat.notes)
    .map(cat => {
      const obsHtml = cat.observations.map((obs, i) => {
        const uc = urgencyColors[obs.urgency] || '#6b7280';
        const ul = urgencyLabels[obs.urgency] || obs.urgency;
        const text = obs.withTheory || obs.processedText || obs.rawText;

        const photosHtml = obs.photos
          .filter(p => p.uri || p.base64)
          .map(p => {
            const src = p.base64 ? `data:${p.mediaType};base64,${p.base64}` : p.uri;
            return `
              <div style="margin:8px 0;">
                <img src="${src}" style="max-width:100%;max-height:300px;border-radius:6px;" />
                ${p.caption ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0 0;font-style:italic;">${escapeHtml(p.caption)}</p>` : ''}
              </div>`;
          }).join('');

        return `
          <div style="margin-bottom:16px;border-left:3px solid ${uc};padding-left:12px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="background:${uc}15;color:${uc};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">${ul}</span>
              <span style="font-size:11px;color:#9ca3af;">Havainto ${i + 1}</span>
            </div>
            <p style="font-size:13px;color:#374151;line-height:1.6;margin:0;">${escapeHtml(text)}</p>
            ${obs.moistureReading ? `<p style="font-size:12px;color:#2563eb;margin:4px 0;">Kosteusarvo: ${escapeHtml(obs.moistureReading)}</p>` : ''}
            ${photosHtml}
          </div>`;
      }).join('');

      const notesHtml = cat.notes
        ? `<div style="background:#f9fafb;padding:10px;border-radius:6px;margin-top:8px;">
            <p style="font-size:11px;font-weight:600;color:#6b7280;margin:0 0 4px 0;">MUISTIINPANOT</p>
            <p style="font-size:12px;color:#374151;margin:0;">${escapeHtml(cat.notes)}</p>
          </div>`
        : '';

      return `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px;color:#1e40af;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:0 0 12px 0;">${escapeHtml(cat.name)}</h3>
          ${obsHtml}
          ${notesHtml}
        </div>`;
    }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #111827; }
    .cover { background: #1e40af; color: white; padding: 40px 24px; }
    .cover h1 { font-size: 24px; margin: 0 0 8px 0; }
    .cover p { font-size: 13px; opacity: 0.85; margin: 4px 0; }
    .info-box { background: #dbeafe; padding: 16px; margin: 0 24px; border-radius: 8px; transform: translateY(-20px); }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .info-item label { font-size: 10px; color: #475569; font-weight: 600; display: block; }
    .info-item span { font-size: 13px; color: #111827; }
    .section { padding: 0 24px; }
    .people { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 24px; }
    .person-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .person-card .role { font-size: 10px; font-weight: 600; color: #6b7280; margin: 0 0 6px 0; }
    .person-card .name { font-size: 13px; font-weight: 600; margin: 0; }
    .person-card .detail { font-size: 11px; color: #6b7280; margin: 2px 0 0 0; }
    .summary-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 24px; }
    .summary-box h4 { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0; }
    .summary-box p { font-size: 13px; color: #374151; line-height: 1.6; margin: 0; }
    .footer { text-align: center; color: #9ca3af; font-size: 10px; padding: 24px; border-top: 1px solid #e5e7eb; margin-top: 32px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <!-- Cover -->
  <div class="cover">
    <h1>KUNTOTARKASTUSRAPORTTI</h1>
    <p>Rakennuksen tekninen kuntoarvio</p>
    <p style="opacity:0.7;font-size:11px;">Laadittu KuntotarkastusAI-järjestelmällä</p>
  </div>

  <!-- Property info -->
  <div class="info-box">
    <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(address || 'Kohde')}</div>
    <div class="info-grid">
      ${pi.buildingType ? `<div class="info-item"><label>Rakennustyyppi</label><span>${escapeHtml(pi.buildingType)}</span></div>` : ''}
      ${pi.buildYear ? `<div class="info-item"><label>Rakennusvuosi</label><span>${escapeHtml(pi.buildYear)}</span></div>` : ''}
      ${pi.floorArea ? `<div class="info-item"><label>Kerrosala</label><span>${escapeHtml(pi.floorArea)} m²</span></div>` : ''}
      ${pi.floors ? `<div class="info-item"><label>Kerroksia</label><span>${escapeHtml(pi.floors)}</span></div>` : ''}
      ${pi.inspectionDate ? `<div class="info-item"><label>Tarkastuspäivä</label><span>${formatDate(pi.inspectionDate)}</span></div>` : ''}
      ${pi.propertyId ? `<div class="info-item"><label>Kiinteistötunnus</label><span>${escapeHtml(pi.propertyId)}</span></div>` : ''}
    </div>
  </div>

  <!-- People -->
  <div class="people">
    <div class="person-card">
      <p class="role">TARKASTAJA</p>
      <p class="name">${escapeHtml(pi.inspector || '')}</p>
      <p class="detail">${escapeHtml(pi.inspectorTitle || '')}</p>
    </div>
    <div class="person-card">
      <p class="role">TILAAJA</p>
      <p class="name">${escapeHtml(pi.clientName || '')}</p>
      <p class="detail">${escapeHtml(pi.clientPhone || '')}</p>
      <p class="detail">${escapeHtml(pi.clientEmail || '')}</p>
    </div>
  </div>

  ${report.summary?.findingsSummary ? `
  <div class="summary-box">
    <h4>Havaintoyhteenveto</h4>
    <p>${escapeHtml(report.summary.findingsSummary)}</p>
  </div>` : ''}

  <!-- Observations -->
  <div class="section" style="margin-top:16px;">
    <h2 style="font-size:18px;color:#1e40af;margin:0 0 16px 0;">Tarkastushavainnot</h2>
    ${categoriesHtml}
  </div>

  ${report.summary?.finalSummary ? `
  <div class="summary-box">
    <h4>Loppuyhteenveto</h4>
    <p>${escapeHtml(report.summary.finalSummary)}</p>
  </div>` : ''}

  <div class="footer">
    ${escapeHtml(address)} · ${pi.inspectionDate ? formatDate(pi.inspectionDate) : ''}<br/>
    KuntotarkastusAI · Laadittu tekoälyavusteisesti
  </div>
</body>
</html>`;
}

/**
 * Generate PDF and open share dialog (save, email, AirDrop, etc.)
 */
export async function exportPDF(report: InspectionReport): Promise<void> {
  const html = buildHtml(report);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Vie kuntotarkastusraportti',
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Generate PDF and open print preview
 */
export async function printPDF(report: InspectionReport): Promise<void> {
  const html = buildHtml(report);
  await Print.printAsync({ html });
}
