import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle,
  DialogContent, Alert, IconButton, Tooltip,
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
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

const CARD_RATIO = 53.98 / 85.6;
const CARD_WIDTH_PX = 340;
const CARD_HEIGHT_PX = Math.round(CARD_WIDTH_PX / CARD_RATIO);
const CARD_MM = { width: 53.98, height: 85.6 };
const PRIMARY_GREEN = '#22C55E';
const PRIMARY_DARK = '#050505';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const TEXT_WHITE = '#ffffff';
const BODY_BG = '#ffffff';
const FOOTER_BG = '#f3f4f6';
const BORDER_GREY = '#e5e7eb';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getEmployeePhoto(emp) {
  if (emp.id_photo_url) return emp.id_photo_url;
  if (emp.documents) {
    const photoDoc = emp.documents.find(d => d.doc_type === 'photo' || d.doc_type === 'id_photo' || d.doc_type === 'id_proof');
    if (photoDoc) return photoDoc.file_url;
  }
  return null;
}

function generateVerificationUrl(emp) {
  return `${window.location.origin}/verify/${emp.employee_code}`;
}

export default function IDCards() {
  const isMobile = useMobile();
  const { staff: me } = useAuth();
  const cardRef = useRef(null);
  const barcodeRef = useRef(null);
  const qrRef = useRef(null);

  const [myEmployee, setMyEmployee] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    if (me?.employee_id) {
      client.get(`/employees/${me.employee_id}`).then(({ data }) => {
        setMyEmployee(data.employee);
      }).catch(() => {});
    }
  }, [me?.employee_id]);

  useEffect(() => {
    if (barcodeRef.current && myEmployee?.employee_code) {
      JsBarcode(barcodeRef.current, myEmployee.employee_code, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        color: '#000000',
      });
    }
  }, [myEmployee?.employee_code]);

  useEffect(() => {
    if (qrRef.current && myEmployee?.employee_code) {
      const url = generateVerificationUrl(myEmployee);
      new QRCode(qrRef.current, {
        text: url,
        width: 100,
        height: 100,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    }
  }, [myEmployee?.employee_code]);

  const handlePhotoUpload = async () => {
    if (!photoFile || !myEmployee) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('title', `${myEmployee.full_name} - ID Photo`);
      fd.append('doc_type', 'id_proof');
      fd.append('entity_type', 'employee');
      fd.append('entity_id', myEmployee.id);
      fd.append('allow_duplicate', 'true');
      const response = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      let docId = response.data.document?.id;
      if (response.data.duplicate && response.data.existing?.id) {
        docId = response.data.existing.id;
      }
      
      if (docId) {
        const photoUrl = `/api/documents/${docId}/file`;
        await client.put(`/employees/${myEmployee.id}`, { id_photo_url: photoUrl });
      }
      
      setPhotoDialogOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      const { data } = await client.get(`/employees/${myEmployee.id}`);
      setMyEmployee(data.employee);
      setMessage({ severity: 'success', text: 'Photo uploaded successfully' });
    } catch (err) {
      console.error('Photo upload error:', err.response?.data || err.message);
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to upload photo' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const waitForImages = (container) => {
    const images = container.querySelectorAll('img');
    return Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
        img.crossOrigin = 'anonymous';
      });
    }));
  };

  const waitForFonts = () => document.fonts?.ready || Promise.resolve();

  const exportCard = async (format) => {
    if (!cardRef.current || !myEmployee) return;
    setExporting(true);
    try {
      await waitForFonts();
      await waitForImages(cardRef.current);
      await new Promise(r => setTimeout(r, 100));

      if (format === 'png') {
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 3,
          backgroundColor: BODY_BG,
          skipFonts: false,
        });
        const link = document.createElement('a');
        link.download = `${myEmployee.employee_code}-id-card.png`;
        link.href = dataUrl;
        link.click();
        setMessage({ severity: 'success', text: 'PNG downloaded successfully' });
      } else if (format === 'pdf') {
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 3,
          backgroundColor: BODY_BG,
          skipFonts: false,
        });
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [CARD_MM.width, CARD_MM.height],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, CARD_MM.width, CARD_MM.height);
        pdf.save(`${myEmployee.employee_code}-id-card.pdf`);
        setMessage({ severity: 'success', text: 'PDF downloaded successfully' });
      }
    } catch (err) {
      console.error('Export error:', err);
      setMessage({ severity: 'error', text: 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const printCard = () => {
    if (!cardRef.current) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${myEmployee.full_name}</title>
        <style>
          @media print {
            @page { size: ${CARD_MM.width}mm ${CARD_MM.height}mm; margin: 0; }
            html, body { margin: 0; padding: 0; width: ${CARD_MM.width}mm; height: ${CARD_MM.height}mm; }
            .card { width: ${CARD_MM.width}mm; height: ${CARD_MM.height}mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { margin: 0; padding: 0; background: white; }
        </style>
      </head>
      <body>${cardRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); setTimeout(() => printWindow.close(), 1000); };
  };

  const openPhotoDialog = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoDialogOpen(true);
  };

  if (!myEmployee) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <Typography color="text.secondary">Loading your ID card...</Typography>
      </Box>
    );
  }

  const emp = myEmployee;
  const photoUrl = getEmployeePhoto(emp);
  const initials = getInitials(emp.full_name);
  const designation = emp.designation;
  const department = emp.department;
  const doj = formatDate(emp.date_of_joining);
  const validUntil = emp.date_of_joining ? formatDate(new Date(new Date(emp.date_of_joining).getFullYear() + 5, 11, 31).toISOString()) : null;

  const details = [
    { label: 'EMPLOYEE CODE', value: emp.employee_code, monospace: true },
    { label: 'DEPARTMENT', value: department },
    { label: 'DATE OF JOINING', value: doj },
    { label: 'VALID UNTIL', value: validUntil },
  ].filter(d => d.value);

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>My ID Card</Typography>
        <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap' }}>
          <MobileButton variant="outlined" startIcon={<PhotoCameraIcon />} onClick={openPhotoDialog}>
            Upload Photo
          </MobileButton>
          <MobileButton variant="contained" startIcon={<DownloadIcon />} onClick={() => exportCard('png')} disabled={exporting}>
            Download PNG
          </MobileButton>
          <MobileButton variant="contained" startIcon={<PictureAsPdfIcon />} onClick={() => exportCard('pdf')} disabled={exporting}>
            Download PDF
          </MobileButton>
          <MobileButton variant="contained" startIcon={<PrintIcon />} onClick={printCard} disabled={exporting}>
            Print Card
          </MobileButton>
        </MobileStack>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

      <MobilePaper sx={{ mt: 2, overflow: 'visible', pb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>ID Card Preview</Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup value={showBack ? 'back' : 'front'} exclusive onChange={(e, v) => setShowBack(v === 'back')} aria-label="Card side">
            <ToggleButton value="front" startIcon={<FlipCameraAndroidIcon />}>Front</ToggleButton>
            <ToggleButton value="back" startIcon={<FlipCameraAndroidIcon />}>Back</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'flex-start',
          minHeight: `${CARD_HEIGHT_PX + 40}px`,
          padding: 24,
        }}>
          <div 
            ref={cardRef}
            style={{ 
              width: `${CARD_WIDTH_PX}px`, 
              height: `${CARD_HEIGHT_PX}px`,
              background: BODY_BG,
              borderRadius: '16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              position: 'relative',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              color: TEXT_DARK,
            }}
          >
            <div style={{ height: '4px', background: PRIMARY_GREEN }} />
            
            {showBack ? (
              <div style={{ 
                height: '100%', 
                padding: '24px', 
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: PRIMARY_DARK, letterSpacing: '-0.02em' }}>EtherTrack</div>
                <div style={{ fontSize: '11px', color: TEXT_MUTED, fontWeight: 500 }}>EtherTrack Technologies Pvt. Ltd.</div>
                <div style={{ fontSize: '10px', color: TEXT_MUTED }}>CIN: U72900MH2020PTC123456</div>
                <div style={{ width: '1px', height: '24px', background: BORDER_GREY, margin: '8px 0' }} />
                <div style={{ fontSize: '13px', color: TEXT_DARK, fontWeight: 600, marginTop: '8px' }}>If found, please return to:</div>
                <div style={{ fontSize: '12px', color: TEXT_MUTED, lineHeight: 1.6 }}>
                  EtherTrack Technologies Pvt. Ltd.<br />
                  Registered Office Address<br />
                  Mumbai, Maharashtra, India
                </div>
                <div style={{ width: '1px', height: '24px', background: BORDER_GREY, margin: '8px 0' }} />
                <div style={{ fontSize: '13px', color: TEXT_DARK, fontWeight: 600 }}>Emergency Contact</div>
                <div style={{ fontSize: '14px', color: TEXT_DARK, fontWeight: 600, fontFamily: 'monospace' }}>{emp.emergency_contact || emp.emergency_phone || '—'}</div>
                <div ref={qrRef} style={{ marginTop: '16px' }} />
                <div style={{ fontSize: '10px', color: TEXT_MUTED, marginTop: '8px' }}>Scan to verify employee</div>
              </div>
            ) : (
              <>
                <header style={{
                  background: PRIMARY_DARK,
                  color: TEXT_WHITE,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)', padding: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    <img src={logo} alt="EtherTrack Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
                  </div>
                  <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>EtherTrack</div>
                    <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px', fontWeight: 500 }}>EtherTrack Technologies Pvt. Ltd.</div>
                  </div>
                </header>

                <div style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: '50px',
                }}>
                  <div style={{
                    width: '110px', height: '110px', borderRadius: '16px',
                    border: `3px solid ${PRIMARY_GREEN}`,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(34,197,94,0.2), 0 2px 8px rgba(0,0,0,0.08)',
                    background: '#f9fafb',
                    marginTop: '-50px',
                    position: 'relative',
                    zIndex: 2,
                  }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={`${emp.full_name}'s photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '32px', fontWeight: 700, color: PRIMARY_GREEN,
                        background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                      }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  <div style={{ width: '100%', padding: '0 20px 8px', boxSizing: 'border-box', textAlign: 'center' }}>
                    <div style={{
                      fontSize: '22px', fontWeight: 800, color: TEXT_DARK,
                      lineHeight: 1.2, marginBottom: '6px',
                      wordBreak: 'break-word', overflowWrap: 'break-word',
                    }}>
                      {emp.full_name}
                    </div>
                    {designation && (
                      <span style={{
                        display: 'inline-block',
                        background: PRIMARY_GREEN, color: TEXT_WHITE,
                        padding: '3px 12px', borderRadius: '14px',
                        fontSize: '10px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                      }}>
                        {designation}
                      </span>
                    )}
                  </div>

                  <div style={{
                    width: '100%', padding: '8px 20px 0', boxSizing: 'border-box',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px',
                  }}>
                    {details.map((d, i) => (
                      <div key={d.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{
                          fontSize: '10px', color: TEXT_MUTED,
                          fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {d.label}
                        </div>
                        <div style={{
                          fontSize: '14px', color: TEXT_DARK,
                          fontWeight: 600,
                          fontFamily: d.monospace ? '"SF Mono", Monaco, Consolas, monospace' : 'inherit',
                          letterSpacing: d.monospace ? '0.5px' : 'normal',
                        }}>
                          {d.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    width: '100%', padding: '16px 20px 0', boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  }}>
                    <svg ref={barcodeRef} style={{ width: '220px', height: '50px' }} />
                    <div style={{
                      fontFamily: '"SF Mono", Monaco, Consolas, monospace',
                      fontSize: '12px', fontWeight: 600, color: TEXT_DARK,
                      letterSpacing: '3px',
                    }}>
                      {emp.employee_code}
                    </div>
                  </div>
                </div>

                <footer style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: FOOTER_BG,
                  padding: '10px 20px',
                  borderTop: `1px solid ${BORDER_GREY}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '10px', color: TEXT_MUTED,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600 }}>Authorized Signature</span>
                    <div style={{ width: '80px', height: '1px', background: BORDER_GREY, marginLeft: '8px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span>Valid while employed</span>
                  </div>
                </footer>
              </>
            )}
          </div>
        </div>
      </MobilePaper>

      <MobileDialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Upload ID Photo</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2 }}>
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" style={{ width: 150, height: 180, objectFit: 'cover', borderRadius: 8, border: '2px solid #e5e7eb' }} />
            ) : (
              <Box sx={{ width: 150, height: 180, border: '2px dashed #d1d5db', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                <PhotoCameraIcon sx={{ fontSize: 32, mb: 1 }} />
                No photo selected
              </Box>
            )}
            <Button
              variant="outlined"
              component="label"
              startIcon={<PhotoCameraIcon />}
              disabled={photoUploading}
            >
              {photoFile ? 'Change Photo' : 'Select Photo'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              Recommended: 300x380px (3:4 ratio), max 2MB. JPG/PNG.
            </Typography>
          </Box>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setPhotoDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handlePhotoUpload} disabled={photoUploading || !photoFile}>
            {photoUploading ? 'Uploading…' : 'Upload Photo'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}