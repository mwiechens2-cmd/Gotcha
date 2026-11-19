import { jsPDF } from 'jspdf';
import { PhoneLookupResult, VehicleAlprAuditResult } from '../types';

export type ExportPayload =
  | { type: 'phone'; content: PhoneLookupResult }
  | { type: 'alpr'; content: VehicleAlprAuditResult };

interface PdfGeneratorOptions {
  reportId: string;
  timestamp: string;
  exportData: ExportPayload;
}

const PAGE_WIDTH = 612; // US Letter width in pt
const PAGE_HEIGHT = 792; // US Letter height in pt
const MARGIN_X = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const MARGIN_BOTTOM = 54;

type BannerTone = 'danger' | 'warn' | 'ok' | 'info';

const TONE_STYLES: Record<
  BannerTone,
  { fill: [number, number, number]; border: [number, number, number]; text: [number, number, number] }
> = {
  danger: { fill: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
  warn: { fill: [255, 251, 235], border: [245, 158, 11], text: [146, 64, 14] },
  ok: { fill: [236, 253, 245], border: [16, 185, 129], text: [6, 95, 70] },
  info: { fill: [236, 254, 255], border: [6, 182, 212], text: [14, 116, 144] },
};

export function generateDossierPdf({ reportId, timestamp, exportData }: PdfGeneratorOptions): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const generatedLabel = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const reportCategory =
    exportData.type === 'phone'
      ? 'FORENSIC TELECOM OSINT DOSSIER'
      : 'FLOCK SAFETY & ALPR SURVEILLANCE AUDIT';

  let cursorY = 0;

  const drawMainHeader = () => {
    // Dark cyber-defense banner
    doc.setFillColor(8, 12, 20);
    doc.rect(0, 0, PAGE_WIDTH, 78, 'F');

    // Cyan accent stripe along bottom of header
    doc.setFillColor(6, 182, 212);
    doc.rect(0, 75, PAGE_WIDTH, 3, 'F');

    // Left title lockup
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('VigilALPR / TraceID', MARGIN_X, 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(34, 211, 238);
    doc.text(reportCategory, MARGIN_X, 50);

    // Right metadata block
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Report ID: ${reportId}`, PAGE_WIDTH - MARGIN_X, 30, { align: 'right' });
    doc.text(`Generated: ${generatedLabel}`, PAGE_WIDTH - MARGIN_X, 44, { align: 'right' });
    doc.text('Classification: Investigative Brief', PAGE_WIDTH - MARGIN_X, 58, { align: 'right' });

    cursorY = 100;
  };

  const drawContinuationHeader = () => {
    doc.setFillColor(8, 12, 20);
    doc.rect(0, 0, PAGE_WIDTH, 40, 'F');
    doc.setFillColor(6, 182, 212);
    doc.rect(0, 38, PAGE_WIDTH, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('VigilALPR / TraceID', MARGIN_X, 24);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${reportCategory} | ${reportId}`, PAGE_WIDTH - MARGIN_X, 24, { align: 'right' });

    cursorY = 60;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      drawContinuationHeader();
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, MARGIN_X, cursorY);
    cursorY += 6;
    doc.setDrawColor(6, 182, 212);
    doc.setLineWidth(1.2);
    doc.line(MARGIN_X, cursorY, PAGE_WIDTH - MARGIN_X, cursorY);
    cursorY += 14;
  };

  const drawStatusBanner = (headline: string, summary: string, tone: BannerTone) => {
    const palette = TONE_STYLES[tone];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const wrappedSummary = doc.splitTextToSize(summary, CONTENT_WIDTH - 24) as string[];
    const boxHeight = 30 + wrappedSummary.length * 13;

    ensureSpace(boxHeight + 10);

    doc.setFillColor(...palette.fill);
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(MARGIN_X, cursorY, CONTENT_WIDTH, boxHeight, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...palette.text);
    doc.text(headline, MARGIN_X + 12, cursorY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(wrappedSummary, MARGIN_X + 12, cursorY + 33);

    cursorY += boxHeight + 16;
  };

  const drawKeyValueGrid = (rows: Array<{ label: string; value: string }>) => {
    const colGap = 14;
    const colWidth = (CONTENT_WIDTH - colGap) / 2;

    for (let i = 0; i < rows.length; i += 2) {
      const left = rows[i];
      const right = rows[i + 1];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const leftLines = doc.splitTextToSize(left.value || 'N/A', colWidth - 18) as string[];
      const rightLines = right
        ? (doc.splitTextToSize(right.value || 'N/A', colWidth - 18) as string[])
        : [];
      const maxLines = Math.max(leftLines.length, rightLines.length, 1);
      const cellHeight = 22 + maxLines * 12;

      ensureSpace(cellHeight + 8);

      const drawCell = (x: number, item: { label: string; value: string }, lines: string[]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.6);
        doc.roundedRect(x, cursorY, colWidth, cellHeight, 4, 4, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label.toUpperCase(), x + 9, cursorY + 13);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(lines, x + 9, cursorY + 26);
      };

      drawCell(MARGIN_X, left, leftLines);
      if (right) {
        drawCell(MARGIN_X + colWidth + colGap, right, rightLines);
      }

      cursorY += cellHeight + 8;
    }

    cursorY += 8;
  };

  const drawRecordCard = (title: string, subtitle: string, bodyLines: string[]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const wrappedBody: string[] = [];
    for (const line of bodyLines) {
      const parts = doc.splitTextToSize(line, CONTENT_WIDTH - 20) as string[];
      wrappedBody.push(...parts);
    }

    const cardHeight = 36 + wrappedBody.length * 12.5;
    ensureSpace(cardHeight + 8);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.7);
    doc.roundedRect(MARGIN_X, cursorY, CONTENT_WIDTH, cardHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, MARGIN_X + 10, cursorY + 15);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(14, 116, 144);
    doc.text(subtitle, MARGIN_X + 10, cursorY + 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(wrappedBody, MARGIN_X + 10, cursorY + 41);

    cursorY += cardHeight + 8;
  };

  drawMainHeader();

  if (exportData.type === 'phone') {
    const p = exportData.content;
    const tone: BannerTone =
      p.riskAnalysis.spamScore >= 70
        ? 'danger'
        : p.riskAnalysis.spamScore >= 35
        ? 'warn'
        : 'ok';

    drawStatusBanner(
      `${p.riskAnalysis.riskLevel.toUpperCase()} RISK PROFILE - THREAT SCORE ${p.riskAnalysis.spamScore}/100`,
      `Target ${p.formattedInternational} is classified as ${p.riskAnalysis.activityCategory} (${p.lineType}) with ${p.riskAnalysis.totalReports.toLocaleString()} community reports. Primary flag: ${p.riskAnalysis.primaryFlag}.`,
      tone
    );

    drawSectionHeader('01. Target MSISDN & Telecom Routing');
    drawKeyValueGrid([
      { label: 'National Format', value: p.formattedNational },
      { label: 'International Format', value: p.formattedInternational },
      { label: 'Serving Carrier', value: p.carrier.name },
      { label: 'Carrier Classification', value: `${p.carrier.type} (${p.carrier.networkCode})` },
      { label: 'Line Classification', value: p.lineType },
      {
        label: 'Porting History',
        value: p.carrier.isPorted
          ? `Ported from ${p.carrier.originalNetwork}${p.carrier.lastPortedDate ? ` on ${p.carrier.lastPortedDate}` : ''}`
          : 'Original Network Allocation',
      },
      {
        label: 'Geographic Region',
        value: `${p.location.city}, ${p.location.state} ${p.location.postalCode}`,
      },
      { label: 'Rate Center & Time Zone', value: `${p.location.rateCenter} | ${p.location.timeZone}` },
    ]);

    drawSectionHeader('02. Fraud & Telemarketing Telemetry');
    drawKeyValueGrid([
      { label: 'Composite Threat Score', value: `${p.riskAnalysis.spamScore} / 100 (${p.riskAnalysis.riskLevel})` },
      { label: 'Activity Category', value: p.riskAnalysis.activityCategory },
      { label: 'Community Reports', value: `${p.riskAnalysis.totalReports.toLocaleString()} incidents` },
      { label: 'Primary Red Flag', value: p.riskAnalysis.primaryFlag },
    ]);

    drawSectionHeader('03. Deep OSINT Subscriber Dossier');
    if (p.dossier) {
      drawKeyValueGrid([
        { label: 'Registered Subscriber', value: p.dossier.subscriberName },
        { label: 'Subscriber Entity Type', value: p.dossier.subscriberType },
        {
          label: 'Associated Emails',
          value: p.dossier.associatedEmails.join(', ') || 'None identified',
        },
        {
          label: 'Linked Alternate Lines',
          value: p.dossier.altPhoneNumbers.join(', ') || 'None identified',
        },
      ]);

      if (p.dossier.addressHistory.length > 0) {
        drawRecordCard(
          'Physical Address History',
          `${p.dossier.addressHistory.length} address record(s)`,
          p.dossier.addressHistory.map(
            (addr) => `- ${addr.street}, ${addr.cityState} (${addr.years})`
          )
        );
      }

      if (p.dossier.digitalFootprint.length > 0) {
        drawRecordCard(
          'Digital Footprint Associations',
          `${p.dossier.digitalFootprint.length} linked handle(s)`,
          p.dossier.digitalFootprint.map(
            (fp) => `- ${fp.platform}: ${fp.profileHandle}${fp.verified ? ' [Verified]' : ''}`
          )
        );
      }

      if (p.dossier.breachExposures.length > 0) {
        drawRecordCard(
          'Dark Web & Data Breach Incidents',
          `${p.dossier.breachExposures.length} exposure(s) matched`,
          p.dossier.breachExposures.map(
            (b) => `- ${b.breachName} (${b.year}): Compromised ${b.compromisedData.join(', ')}`
          )
        );
      }
    } else {
      drawStatusBanner(
        'SUBSCRIBER DOSSIER REDACTED',
        'Upgrade to Investigator Pro or Enterprise OSINT to include subscriber registry, address history, and breach records in PDF exports.',
        'info'
      );
    }
  } else {
    const v = exportData.content;
    const isQueried = v.auditSummary.overallStatus === 'queried_active';

    drawStatusBanner(
      isQueried
        ? `ACTIVE SURVEILLANCE QUERIES LOGGED (${v.auditSummary.activeAgencyQueriesCount})`
        : 'NOMINAL - PASSIVE OPTICAL SIGHTINGS ONLY',
      isQueried
        ? `License plate [${v.plateNumber}] (${v.state}) has been actively queried in law enforcement ALPR logs within recent patrol records.`
        : `No targeted investigative searches or hotlist hits were recorded for [${v.plateNumber}] (${v.state}). Sightings reflect passive roadside scans.`,
      isQueried ? 'warn' : 'ok'
    );

    drawSectionHeader('01. Target Vehicle & Exposure Summary');
    drawKeyValueGrid([
      { label: 'License Plate & State', value: `${v.plateNumber} (${v.state})` },
      {
        label: 'Vehicle Description',
        value: `${v.vehicleDetails.year} ${v.vehicleDetails.make} ${v.vehicleDetails.model} - ${v.vehicleDetails.color}`,
      },
      { label: 'Body Style & Masked VIN', value: `${v.vehicleDetails.bodyStyle} | VIN: ${v.vehicleDetails.vinMasked}` },
      { label: 'Exposure Level', value: `${v.auditSummary.exposureLevel} (Score ${v.auditSummary.exposureScore}/100)` },
      {
        label: 'Detection Volume',
        value: `${v.auditSummary.totalDetections30Days} (30 days) | ${v.auditSummary.totalDetections90Days} (90 days)`,
      },
      { label: 'Last Known Sector', value: v.auditSummary.lastDetectedLocation },
      { label: 'Jurisdiction Retention Policy', value: v.auditSummary.retentionPolicyStandard },
      {
        label: 'Last Sighted Timestamp',
        value: new Date(v.auditSummary.lastDetectedTimestamp).toLocaleString('en-US'),
      },
    ]);

    drawSectionHeader(`02. Agency Query & Search Audit Log (${v.queryAuditLog.length})`);
    for (const q of v.queryAuditLog) {
      drawRecordCard(
        `${q.requestingAgency} (${q.agencyType})`,
        `Query ID: ${q.queryId} | ${new Date(q.timestamp).toLocaleString('en-US')}`,
        [
          `Reason: ${q.queryReason}`,
          `Reference: ${q.officerBadgeOrCaseId} | Disposition: ${q.alertDisposition}`,
        ]
      );
    }

    drawSectionHeader(`03. Optical Camera Sighting Nodes (${v.cameraSightings.length})`);
    for (const c of v.cameraSightings) {
      drawRecordCard(
        c.cameraName,
        `Node: ${c.cameraId} | ${c.cameraType} | ${new Date(c.timestamp).toLocaleString('en-US')}`,
        [
          `Agency: ${c.municipalityAgency}`,
          `Location: ${c.intersectionOrLocation}`,
          `Telemetry: ${c.directionOfTravel} (Lane ${c.laneNumber}) | ~${c.speedEstimateMph} MPH | Confidence ${c.captureConfidence}% | Purge in ${c.retentionDaysRemaining}d`,
        ]
      );
    }

    if (v.reciprocalAgencies.length > 0) {
      drawSectionHeader(`04. Reciprocal Sharing Network (${v.reciprocalAgencies.length})`);
      drawRecordCard(
        'Regional ALPR Data-Sharing Memorandums',
        `Jurisdiction: ${v.state}`,
        v.reciprocalAgencies.map(
          (a) => `- ${a.agencyName} (${a.jurisdiction}): ${a.dataShareScope}`
        )
      );
    }
  }

  // Stamp consistent page footers across all generated pages
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_X, PAGE_HEIGHT - 36, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 36);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `VigilALPR & TraceID | Confidential Dossier | ${reportId}`,
      MARGIN_X,
      PAGE_HEIGHT - 22
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 22, {
      align: 'right',
    });
  }

  const targetSlug =
    exportData.type === 'phone'
      ? exportData.content.phoneNumber.replace(/[^0-9]/g, '')
      : `${exportData.content.state}_${exportData.content.plateNumber.replace(/[^A-Z0-9-]/gi, '')}`;
  const fileName = `VigilALPR_${exportData.type}_${targetSlug}_${reportId}.pdf`;

  doc.save(fileName);
  return fileName;
}
