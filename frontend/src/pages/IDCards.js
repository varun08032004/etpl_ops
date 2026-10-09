import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, DialogTitle, DialogContent, Alert,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import {
  MobilePageHeader,
  MobilePaper,
  MobileButton,
  MobileDialog,
  MobileActionButtons,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';
import logo from '../assets/ethertrack-logo.png';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import ImageCropper from '../components/ImageCropper';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

// TODO: replace these placeholders with your real company details.
// Empty values are simply not rendered on the card.
const COMPANY = {
  name: 'EtherTrack',
  legalName: 'EtherTrack Technologies Pvt. Ltd.',
  cin: '',
  addressLines: ['Registered office address line 1', 'City, State, India'],
};

const CARD_MM = { width: 53.98, height: 85.6 };
const CARD_WIDTH_PX = 340;
const CARD_HEIGHT_PX = Math.round(CARD_WIDTH_PX * (CARD_MM.height / CARD_MM.width)); // 539
const HEADER_OVERLAP = 52; // how far the photo overlaps the black header

const PRIMARY_GREEN = '#22C55E';
const PRIMARY_DARK = '#050505';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const TEXT_WHITE = '#ffffff';
const BODY_BG = '#ffffff';
const FOOTER_BG = '#f3f4f6';
const BORDER_GREY = '#e5e7eb';
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO_STACK = '"SF Mono", Monaco, Consolas, monospace';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getInitials(name = '') {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getEmployeePhoto(emp) {
  if (emp.id_photo_url) return emp.id_photo_url;
  const photoDoc = emp.documents?.find(d => ['photo', 'id_photo'].includes(d.doc_type));
  return photoDoc?.file_url || null;
}

// The stored photo URL may or may not include the /api prefix, and your axios
// client may or may not add it. Try every sensible form, most likely first.
function photoCandidates(rawUrl) {
  // /download returns JSON ({ url }), /file streams the actual image.
  const url = rawUrl.replace(/\/download$/, '/file');
  if (/^https?:\/\//i.test(url)) return [url];
  const base = client.defaults?.baseURL || '';
  const noApi = url.replace(/^\/api/, '');
  const withApi = `/api${noApi.startsWith('/') ? '' : '/'}${noApi}`;
  const primary = base.endsWith('/api') ? noApi : url;
  return [...new Set([primary, noApi, withApi, url])];
}

function nameFontSize(name = '') {
  if (name.length > 30) return 16;
  if (name.length > 24) return 18;
  if (name.length > 18) return 20;
  return 22;
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

const waitForImages = (container) =>
  Promise.all(
    Array.from(container.querySelectorAll('img')).map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
    )
  );

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = dataUrl;
  a.click();
}

// Prints images at exactly CR80 size using a hidden iframe (no popup blockers,
// no scaling problems, colours preserved).
function printImages(dataUrls, title) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @page { size: ${CARD_MM.width}mm ${CARD_MM.height}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      img { display: block; width: ${CARD_MM.width}mm; height: ${CARD_MM.height}mm;
            break-after: page; page-break-after: always; }
      img:last-child { break-after: auto; page-break-after: auto; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style></head><body>${dataUrls.map(u => `<img src="${u}" alt="">`).join('')}</body></html>`);
    doc.close();

    const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); resolve(); };
    Promise.all(Array.from(doc.images).map(i =>
      i.complete ? Promise.resolve() : new Promise(r => { i.onload = r; i.onerror = r; })
    )).then(() => {
      const win = iframe.contentWindow;
      win.onafterprint = cleanup;
      win.focus();
      win.print();
      setTimeout(cleanup, 60000); // safety net
    });
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function IDCards() {
  const isMobile = useMobile();
  const { staff: me } = useAuth();
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const barcodeRef = useRef(null);

  const [myEmployee, setMyEmployee] = useState(null);
  const [photoSrc, setPhotoSrc] = useState(null);
  const [qrSrc, setQrSrc] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showBack, setShowBack] = useState(false);

  const employeeCode = myEmployee?.employee_code;
  const photoPath = myEmployee ? getEmployeePhoto(myEmployee) : null;

  /* Load employee */
  useEffect(() => {
    if (!me?.employee_id) return;
    client.get(`/employees/${me.employee_id}`)
      .then(({ data }) => setMyEmployee(data.employee))
      .catch(() => setMessage({ severity: 'error', text: 'Could not load your employee record' }));
  }, [me?.employee_id]);

  /* Photo: fetch through the authenticated client and use a blob URL.
     A plain <img src="/api/documents/..."> fails when the API needs an
     Authorization header, and a blob URL never taints the export canvas. */
  useEffect(() => {
    if (!photoPath) { setPhotoSrc(null); return undefined; }
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      for (const path of photoCandidates(photoPath)) {
        try {
          const res = await client.get(path, { responseType: 'blob' });
          const type = res.data?.type || '';
          // Reject HTML/JSON/text: a wrong path often returns index.html with status 200.
          if (/html|json|text/i.test(type) || !res.data?.size) {
            console.warn('[IDCard] photo not an image at', path, type);
            continue;
          }
          objectUrl = URL.createObjectURL(res.data);
          if (!cancelled) setPhotoSrc(objectUrl);
          return;
        } catch (err) {
          const status = err.response?.status;
          console.warn('[IDCard] photo fetch failed at', path, status || err.message);
          // 401/403 is a definitive answer from the server, so other URL forms won't help.
          if (status === 401 || status === 403) break;
        }
      }
      if (!cancelled) setPhotoSrc(null);
    })();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoPath]);

  /* Barcode: ONLY the employee code, so the bars stay wide enough to scan.
     (Encoding a JSON blob makes hundreds of tiny bars that no scanner reads.) */
  useEffect(() => {
    if (!barcodeRef.current || !employeeCode) return;
    JsBarcode(barcodeRef.current, employeeCode, {
      format: 'CODE128', width: 2, height: 46, displayValue: false,
      margin: 0, background: '#ffffff', lineColor: '#000000',
    });
    barcodeRef.current.setAttribute('preserveAspectRatio', 'none');
  }, [employeeCode]);

  /* QR: the `qrcode` package has no `new QRCode(el)` API (that is qrcodejs).
     Generate a data URL and render it as a normal <img>. */
  useEffect(() => {
    if (!employeeCode) return;
    const url = `${window.location.origin}/verify/${encodeURIComponent(employeeCode)}`;
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrSrc)
      .catch(() => setQrSrc(null));
  }, [employeeCode]);

  /* ---------------- Photo upload ---------------- */

  const handlePhotoUpload = async () => {
    if (!photoFile || !myEmployee) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('title', `${myEmployee.full_name} - ID Photo`);
      fd.append('doc_type', 'id_photo');
      fd.append('entity_type', 'employee');
      fd.append('entity_id', myEmployee.id);
      fd.append('allow_duplicate', 'true');
      const response = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      let docId = response.data.document?.id;
      if (response.data.duplicate && response.data.existing?.id) docId = response.data.existing.id;

      if (docId) {
        await client.put(`/employees/${myEmployee.id}`, { id_photo_url: `/api/documents/${docId}/file` });
      }

      setPhotoDialogOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      const { data } = await client.get(`/employees/${myEmployee.id}`);
      setMyEmployee(data.employee);
      setMessage({ severity: 'success', text: 'Photo uploaded successfully' });
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to upload photo' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const onPhotoSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ severity: 'error', text: 'Photo must be 2 MB or smaller' });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setCropDialogOpen(true);
  };

  const onCropComplete = (croppedBlob) => {
    setPhotoFile(croppedBlob);
    setPhotoPreview(URL.createObjectURL(croppedBlob));
    setCropDialogOpen(false);
  };

  /* ---------------- Export / print ---------------- */

  // flat = square corners, used for PDF and print so no white corners appear.
  const capture = async (ref, { flat }) => {
    await (document.fonts?.ready || Promise.resolve());
    await waitForImages(ref.current);
    return toPng(ref.current, {
      pixelRatio: 3,
      backgroundColor: flat ? BODY_BG : undefined,
      style: { boxShadow: 'none', borderRadius: flat ? '0' : '16px', margin: '0' },
    });
  };

  const exportCard = async (format) => {
    if (!frontRef.current || !backRef.current || !myEmployee) return;
    setExporting(true);
    try {
      await nextFrame();
      if (format === 'png') {
        const ref = showBack ? backRef : frontRef;
        const url = await capture(ref, { flat: true });
        downloadDataUrl(url, `${employeeCode}-id-card-${showBack ? 'back' : 'front'}.png`);
        setMessage({ severity: 'success', text: 'PNG downloaded' });
      } else {
        const front = await capture(frontRef, { flat: true });
        const back = await capture(backRef, { flat: true });
        if (format === 'pdf') {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_MM.width, CARD_MM.height] });
          pdf.addImage(front, 'PNG', 0, 0, CARD_MM.width, CARD_MM.height);
          pdf.addPage([CARD_MM.width, CARD_MM.height], 'portrait');
          pdf.addImage(back, 'PNG', 0, 0, CARD_MM.width, CARD_MM.height);
          pdf.save(`${employeeCode}-id-card.pdf`);
          setMessage({ severity: 'success', text: 'PDF downloaded (front and back)' });
        } else {
          await printImages([front, back], `ID Card - ${myEmployee.full_name}`);
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      setMessage({ severity: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- Render ---------------- */

  if (!myEmployee) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <Typography color="text.secondary">Loading your ID card...</Typography>
      </Box>
    );
  }

  const emp = myEmployee;
  const initials = getInitials(emp.full_name);
  const doj = formatDate(emp.date_of_joining);
  const validUntil = emp.date_of_joining
    ? formatDate(new Date(new Date(emp.date_of_joining).getFullYear() + 5, 11, 31))
    : null;
  const emergency = emp.emergency_contact || emp.emergency_phone || null;

  const details = [
    { label: 'Employee code', value: emp.employee_code, monospace: true },
    { label: 'Department', value: emp.department },
    { label: 'Date of joining', value: doj },
    { label: 'Valid until', value: validUntil },
    { label: 'Blood group', value: emp.blood_group },
  ].filter(d => d.value);

  // Both faces are always mounted so barcode/QR are ready and exports never flicker.
  // The inactive face is parked off-screen instead of being unmounted.
  const faceWrapStyle = (active) => (active
    ? { position: 'relative' }
    : { position: 'absolute', top: 0, left: '-10000px' });

  const cardStyle = {
    width: `${CARD_WIDTH_PX}px`,
    height: `${CARD_HEIGHT_PX}px`,
    background: BODY_BG,
    borderRadius: '16px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    fontFamily: FONT_STACK,
    color: TEXT_DARK,
  };

  const frontFace = (
    <div ref={frontRef} style={cardStyle}>

      {/* Header: logo left, company name right */}
      <header style={{
        background: PRIMARY_DARK, color: TEXT_WHITE, flexShrink: 0,
        padding: `16px 20px ${HEADER_OVERLAP + 12}px`,
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <div style={{
          width: '54px', height: '54px', borderRadius: '50%', flexShrink: 0,
          padding: '4px', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={logo} alt={`${COMPANY.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'left', lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>{COMPANY.name}</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px', fontWeight: 500 }}>{COMPANY.legalName}</div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0 }}>
        <div style={{
          width: '125px', height: '130px', borderRadius: '16px', flexShrink: 0,
          boxSizing: 'border-box', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          background: '#f9fafb', marginTop: `-${HEADER_OVERLAP}px`, position: 'relative', zIndex: 2,
        }}>
          {photoSrc ? (
            <img src={photoSrc} alt={`${emp.full_name}'s photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', fontWeight: 700, color: PRIMARY_GREEN,
              background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            }}>
              {initials}
            </div>
          )}
        </div>

        <div style={{ width: '100%', padding: '12px 20px 0', boxSizing: 'border-box', textAlign: 'center' }}>
          <div style={{
            fontSize: `${nameFontSize(emp.full_name)}px`, fontWeight: 800, color: TEXT_DARK,
            lineHeight: 1.2, marginBottom: '8px', wordBreak: 'break-word',
          }}>
            {emp.full_name}
          </div>
          {emp.designation && (
            <span style={{
              display: 'inline-block', background: PRIMARY_GREEN, color: TEXT_WHITE,
              padding: '3px 12px', borderRadius: '14px', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {emp.designation}
            </span>
          )}
        </div>

        <div style={{
          width: '100%', padding: '14px 20px 0', boxSizing: 'border-box',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px',
        }}>
          {details.map((d) => (
            <div key={d.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: TEXT_MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {d.label}
              </div>
              <div style={{
                fontSize: '14px', color: TEXT_DARK, fontWeight: 600,
                fontFamily: d.monospace ? MONO_STACK : 'inherit',
                letterSpacing: d.monospace ? '0.5px' : 'normal',
                wordBreak: 'break-word',
              }}>
                {d.value}
              </div>
            </div>
          ))}
        </div>

        {/* Barcode pinned to the bottom of the body, so there is no random gap */}
        <div style={{
          marginTop: 'auto', width: '100%', padding: '10px 20px 12px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
        }}>
          <svg ref={barcodeRef} style={{ width: '220px', height: '46px' }} aria-label={`Barcode for ${emp.employee_code}`} />
          <div style={{ fontFamily: MONO_STACK, fontSize: '12px', fontWeight: 600, letterSpacing: '4px', color: TEXT_DARK }}>
            {emp.employee_code}
          </div>
        </div>
      </div>

      <footer style={{
        flexShrink: 0, background: FOOTER_BG, padding: '10px 20px', borderTop: `1px solid ${BORDER_GREY}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '10px', color: TEXT_MUTED,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600 }}>Authorized Signature</span>
          <div style={{ width: '60px', height: '1px', background: TEXT_MUTED, opacity: 0.5 }} />
        </div>
        <span>Valid while employed</span>
      </footer>
    </div>
  );

  const backFace = (
    <div ref={backRef} style={cardStyle}>
      <div style={{ height: '4px', background: PRIMARY_GREEN, flexShrink: 0 }} />
      <div style={{
        flex: 1, padding: '20px 24px', boxSizing: 'border-box', minHeight: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: PRIMARY_DARK, letterSpacing: '-0.02em' }}>{COMPANY.name}</div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED, fontWeight: 500, marginTop: '2px' }}>{COMPANY.legalName}</div>
          {COMPANY.cin && <div style={{ fontSize: '10px', color: TEXT_MUTED, marginTop: '2px' }}>CIN: {COMPANY.cin}</div>}
        </div>

        <div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>If found, please return to</div>
          <div style={{ fontSize: '12px', color: TEXT_MUTED, lineHeight: 1.6, marginTop: '4px' }}>
            {COMPANY.legalName}
            {COMPANY.addressLines.map(line => <div key={line}>{line}</div>)}
          </div>
        </div>

        {emergency && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>Emergency contact</div>
            <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: MONO_STACK, marginTop: '2px' }}>{emergency}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          {qrSrc && <img src={qrSrc} alt="QR code to verify this employee" style={{ width: '96px', height: '96px' }} />}
          <div style={{ fontSize: '10px', color: TEXT_MUTED }}>Scan to verify employee</div>
        </div>
      </div>
    </div>
  );

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>My ID Card</Typography>
        <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap' }}>
          <MobileButton variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoDialogOpen(true); }}>
            Upload Photo
          </MobileButton>
          <MobileButton variant="contained" startIcon={<DownloadIcon />} onClick={() => exportCard('png')} disabled={exporting}>
            Download PNG
          </MobileButton>
          <MobileButton variant="contained" startIcon={<PictureAsPdfIcon />} onClick={() => exportCard('pdf')} disabled={exporting}>
            Download PDF
          </MobileButton>
          <MobileButton variant="contained" startIcon={<PrintIcon />} onClick={() => exportCard('print')} disabled={exporting}>
            Print Card
          </MobileButton>
        </MobileStack>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}

      <MobilePaper sx={{ mt: 2, overflow: 'visible', pb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>ID Card Preview</Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <ToggleButtonGroup
            value={showBack ? 'back' : 'front'}
            exclusive
            onChange={(e, v) => { if (v) setShowBack(v === 'back'); }}
            aria-label="Card side"
            size="small"
          >
            <ToggleButton value="front">Front</ToggleButton>
            <ToggleButton value="back">Back</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3, overflow: 'hidden' }}>
          {/* Scales down on narrow screens without touching the exported card size */}
          <Box sx={{ position: 'relative', width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX, maxWidth: '100%' }}>
            <div style={faceWrapStyle(!showBack)} aria-hidden={showBack}>{frontFace}</div>
            <div style={faceWrapStyle(showBack)} aria-hidden={!showBack}>{backFace}</div>
          </Box>
        </Box>
      </MobilePaper>

      <MobileDialog open={photoDialogOpen} onClose={() => { setPhotoDialogOpen(false); setPhotoFile(null); setPhotoPreview(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Upload ID Photo</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2 }}>
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" style={{ width: 150, height: 180, objectFit: 'cover', borderRadius: 8, border: '2px solid #e5e7eb' }} />
            ) : (
              <Box sx={{ width: 150, height: 180, border: '2px dashed #d1d5db', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                <PhotoCameraIcon sx={{ fontSize: 32, mb: 1 }} />
                No photo selected
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 300 }}>
              <Button variant="outlined" component="label" startIcon={<PhotoCameraIcon />} disabled={photoUploading}>
                {photoFile ? 'Change Photo' : 'Select Photo'}
                <input type="file" accept="image/*" hidden onChange={onPhotoSelected} />
              </Button>
              {photoSrc && !photoFile && (
                <Button variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => setCropDialogOpen(true)} disabled={photoUploading}>
                  Recrop Current Photo
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Recommended: square or 3:4 portrait, max 2 MB. JPG or PNG.
            </Typography>
          </Box>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => { setPhotoDialogOpen(false); setPhotoFile(null); setPhotoPreview(null); }}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handlePhotoUpload} disabled={photoUploading || !photoFile}>
            {photoUploading ? 'Uploading…' : 'Upload Photo'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {cropDialogOpen && (
        <MobileDialog open={cropDialogOpen} onClose={() => setCropDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Adjust Photo</DialogTitle>
          <DialogContent>
            <ImageCropper src={photoPreview} onCrop={onCropComplete} onCancel={() => setCropDialogOpen(false)} aspect={3/4} />
          </DialogContent>
        </MobileDialog>
      )}
    </Box>
  );
}