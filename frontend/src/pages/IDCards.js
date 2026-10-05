import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle,
  DialogContent, Alert, IconButton, Tooltip,
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

function generateQRCode(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

function generateBarcode(data) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(data)}&code=Code128&dpi=300&dataseparator=`;
}

const CARD_DIMENSIONS = {
  inches: { width: 2.125, height: 3.375 },
  mm: { width: 54, height: 86 },
  screen: { width: 204, height: 324 },
  print: { width: 638, height: 1013 },
};

export default function IDCards() {
  const isMobile = useMobile();
  const { staff: me } = useAuth();

  const [myEmployee, setMyEmployee] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (me?.employee_id) {
      client.get(`/employees/${me.employee_id}`).then(({ data }) => {
        setMyEmployee(data.employee);
      }).catch(() => {});
    }
  }, [me?.employee_id]);

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
      const response = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      console.log('Photo upload response:', response.data);
      
      const docId = response.data.document?.id;
      if (docId) {
        // Update employee with the photo URL (using document download endpoint)
        const photoUrl = `/api/documents/${docId}/download`;
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

  const getEmployeePhoto = (emp) => {
    if (emp.id_photo_url) return emp.id_photo_url;
    if (emp.documents) {
      const photoDoc = emp.documents.find(d => d.doc_type === 'photo' || d.doc_type === 'id_photo');
      if (photoDoc) return photoDoc.file_url;
    }
    return null;
  };

  const generateCardHTML = (emp, options = {}) => {
    const { forPrint = false } = options;
    const primaryGreen = '#22C55E';
    const primaryDark = '#050807';
    const tierColor = primaryGreen;
    const photoUrl = getEmployeePhoto(emp);
    const qrData = `ETPL:${emp.employee_code}|${emp.full_name}|${emp.designation || ''}|${emp.department || ''}`;
    const barcodeData = emp.employee_code;
    const validityDate = emp.date_of_joining ? new Date(new Date(emp.date_of_joining).getFullYear() + 5, 11, 31).toLocaleDateString('en-IN') : '—';
    const bloodGroup = emp.blood_group || '—';
    const emergencyContact = emp.emergency_contact || emp.emergency_phone || '—';

    const W = forPrint ? CARD_DIMENSIONS.print.width : CARD_DIMENSIONS.screen.width;
    const H = forPrint ? CARD_DIMENSIONS.print.height : CARD_DIMENSIONS.screen.height;
    const scale = forPrint ? 3.125 : 1;

    const HEADER_H = Math.round(120 * scale);
    const FOOTER_H = Math.round(60 * scale);
    const BODY_H = H - HEADER_H - FOOTER_H;
    const PHOTO_W = Math.round(160 * scale);
    const PHOTO_H = Math.round(180 * scale);
    const DETAIL_W = W - PHOTO_W - Math.round(40 * scale);
    const PADDING = Math.round(20 * scale);
    const GAP = Math.round(16 * scale);

    const fontSize = (base) => Math.round(base * scale);

    return `
      <div class="card" style="
        width: ${W}px; 
        height: ${H}px; 
        border: ${Math.round(3 * scale)}px solid ${primaryGreen}; 
        border-radius: ${Math.round(12 * scale)}px; 
        overflow: hidden; 
        position: relative; 
        box-shadow: 0 ${Math.round(8 * scale)}px ${Math.round(24 * scale)}px rgba(0,0,0,0.15);
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: ${fontSize(11)}px;
      ">
        <div style="height: ${Math.round(5 * scale)}px; background: ${primaryGreen};"></div>
        <div style="background: ${primaryDark}; color: white; padding: ${Math.round(18 * scale)}px ${PADDING}px; display: flex; flex-direction: column; align-items: center; gap: ${Math.round(12 * scale)}px; height: ${HEADER_H}px; box-sizing: border-box;">
          <div style="width: ${Math.round(70 * scale)}px; height: ${Math.round(70 * scale)}px; border-radius: 50%; background: rgba(255,255,255,0.1); padding: ${Math.round(6 * scale)}px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 ${Math.round(4 * scale)}px ${Math.round(12 * scale)}px rgba(0,0,0,0.2); backdrop-filter: blur(4px);">
            <img src="${logo}" alt="EtherTrack Logo" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div style="text-align: center; width: 100%;">
            <div style="font-size: ${fontSize(18)}px; font-weight: 800; letter-spacing: -0.02em; margin: 0; line-height: 1.2;">EtherTrack</div>
            <div style="font-size: ${fontSize(10)}px; opacity: 0.9; margin-top: ${Math.round(3 * scale)}px; font-weight: 500;">EtherTrack Technologies Pvt. Ltd.</div>
            <div style="font-size: ${fontSize(9)}px; opacity: 0.7; margin-top: ${Math.round(2 * scale)}px;">CIN: U72900MH2020PTC123456</div>
          </div>
          <div style="width: ${Math.round(64 * scale)}px; height: ${Math.round(64 * scale)}px; background: rgba(255,255,255,0.1); border-radius: ${Math.round(8 * scale)}px; padding: ${Math.round(6 * scale)}px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <img src="${generateQRCode(qrData)}" alt="QR Code" style="width: 100%; height: 100%;" />
          </div>
        </div>
        <div style="padding: ${Math.round(18 * scale)}px ${PADDING}px; display: flex; flex-direction: column; gap: ${Math.round(16 * scale)}px; height: ${BODY_H}px; box-sizing: border-box;">
          <div style="display: flex; gap: ${GAP}px; align-items: flex-start;">
            <div style="width: ${PHOTO_W}px; flex-shrink: 0;">
              <div style="width: ${PHOTO_W}px; height: ${PHOTO_H}px; border-radius: ${Math.round(10 * scale)}px; overflow: hidden; border: ${Math.round(3 * scale)}px solid #e5e7eb; background: #f9fafb; position: relative; box-shadow: 0 ${Math.round(2 * scale)}px ${Math.round(8 * scale)}px rgba(0,0,0,0.08);">
                ${photoUrl ? `
                  <img src="${photoUrl}" alt="${emp.full_name}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; font-size: ${fontSize(10)}px; text-align: center; padding: ${Math.round(12 * scale)}px;">
                    <svg width="${Math.round(32 * scale)}" height="${Math.round(32 * scale)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: ${Math.round(6 * scale)}px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    No Photo
                  </div>
                `}
              </div>
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: baseline; gap: ${Math.round(10 * scale)}px; margin-bottom: ${Math.round(14 * scale)}px; flex-wrap: wrap;">
                  <div style="font-size: ${fontSize(18)}px; font-weight: 800; color: #111827; letter-spacing: -0.01em;">${emp.full_name}</div>
                  <span style="background: ${tierColor}; color: white; padding: ${Math.round(3 * scale)}px ${Math.round(10 * scale)}px; border-radius: ${Math.round(14 * scale)}px; font-size: ${fontSize(8)}px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${emp.designation || 'Employee'}</span>
                </div>
                <div style="font-size: ${fontSize(10)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Employee Code</div>
                <div style="font-size: ${fontSize(17)}px; font-weight: 700; color: #111827; font-family: 'SF Mono', Monaco, monospace; letter-spacing: 0.5px; margin-bottom: ${Math.round(12 * scale)}px;">${emp.employee_code}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${Math.round(10 * scale)}px;">
                  <div>
                    <div style="font-size: ${fontSize(9)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Designation</div>
                    <div style="font-size: ${fontSize(13)}px; font-weight: 600; color: #111827;">${emp.designation || '—'}</div>
                  </div>
                  <div>
                    <div style="font-size: ${fontSize(9)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Department</div>
                    <div style="font-size: ${fontSize(13)}px; font-weight: 600; color: #111827;">${emp.department || '—'}</div>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${Math.round(10 * scale)}px; margin-top: ${Math.round(10 * scale)}px;">
                  <div>
                    <div style="font-size: ${fontSize(9)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Date of Joining</div>
                    <div style="font-size: ${fontSize(13)}px; font-weight: 600; color: #111827;">${emp.date_of_joining?.slice(0,10) || '—'}</div>
                  </div>
                  <div>
                    <div style="font-size: ${fontSize(9)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Valid Until</div>
                    <div style="font-size: ${fontSize(13)}px; font-weight: 600; color: #111827;">${validityDate}</div>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${Math.round(10 * scale)}px; margin-top: ${Math.round(10 * scale)}px;">
                  <div>
                    <div style="font-size: ${fontSize(9)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Blood Group</div>
                    <div style="font-size: ${fontSize(13)}px; font-weight: 600; color: #111827;">${bloodGroup}</div>
                  </div>
                  <div>
                    <div style="font-size: ${fontSize(9)}px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${Math.round(3 * scale)}px;">Emergency</div>
                    <div style="font-size: ${fontSize(12)}px; font-weight: 600; color: #111827;">${emergencyContact}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="text-align: center; padding-top: ${Math.round(12 * scale)}px; border-top: ${Math.round(2 * scale)}px solid #e5e7eb;">
            <img src="${generateBarcode(barcodeData)}" alt="Barcode: ${barcodeData}" style="height: ${Math.round(36 * scale)}px; max-width: 100%;" />
            <div style="font-family: 'Courier New', monospace; font-size: ${fontSize(11)}px; font-weight: 600; color: #374151; margin-top: ${Math.round(6 * scale)}px; letter-spacing: ${Math.round(2 * scale)}px;">${barcodeData}</div>
          </div>
        </div>
        <div style="background: #f8fafc; padding: ${Math.round(10 * scale)}px ${PADDING}px; border-top: ${Math.round(2 * scale)}px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: ${fontSize(9)}px; color: #64748b;">
          <div style="display: flex; align-items: center; gap: ${Math.round(8 * scale)}px;"><span style="font-weight: 600;">Authorized Signature</span></div>
          <div style="display: flex; align-items: center; gap: ${Math.round(16 * scale)}px;">
            <span>Valid while employed</span>
            <span style="font-family: 'Courier New', monospace; font-size: ${fontSize(10)}px; font-weight: 600; color: #374151;">${barcodeData}</span>
          </div>
        </div>
      </div>
    `;
  };

  const downloadCard = () => {
    const emp = myEmployee;
    const cardHtml = generateCardHTML(emp, { forPrint: true });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${emp.full_name}</title>
        <style>
          @media print {
            @page { margin: 0; size: ${CARD_DIMENSIONS.print.width}px ${CARD_DIMENSIONS.print.height}px; }
            body { margin: 0; padding: 0; }
          }
          body { margin: 0; padding: 0; background: transparent; }
          .card { width: ${CARD_DIMENSIONS.print.width}px; height: ${CARD_DIMENSIONS.print.height}px; }
        </style>
      </head>
      <body>${cardHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); setTimeout(() => printWindow.close(), 1000); };
  };

  const downloadCardImage = () => {
    const emp = myEmployee;
    const cardHtml = generateCardHTML(emp, { forPrint: true });
    const printWindow = window.open('', '_blank');
    const fileName = `ID_Card_${emp.employee_code}.png`;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${emp.full_name}</title>
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
        <style>
          body { margin: 0; padding: 0; background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          #card { width: ${CARD_DIMENSIONS.print.width}px; height: ${CARD_DIMENSIONS.print.height}px; }
        </style>
      </head>
      <body>
        <div id="card">${cardHtml}</div>
        <script>
          (async function() {
            await new Promise(r => setTimeout(r, 200));
            const card = document.getElementById('card');
            const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
            const link = document.createElement('a');
            link.download = '${fileName}';
            link.href = canvas.toDataURL('image/png');
            link.click();
            window.close();
          })();
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>My ID Card</Typography>
        <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap' }}>
          <MobileButton variant="outlined" startIcon={<PhotoCameraIcon />} onClick={openPhotoDialog}>
            Upload Photo
          </MobileButton>
          <MobileButton variant="contained" startIcon={<DownloadIcon />} onClick={downloadCardImage}>
            Download PNG
          </MobileButton>
          <MobileButton variant="contained" startIcon={<PrintIcon />} onClick={downloadCard}>
            Print Card
          </MobileButton>
        </MobileStack>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

      <MobilePaper sx={{ mt: 2, overflow: 'visible', minHeight: 360 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>ID Card Preview</Typography>
        <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap', mb: 2 }}>
          <Tooltip title="Upload/Change Photo">
            <IconButton onClick={openPhotoDialog} size="small">
              <PhotoCameraIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as PNG">
            <IconButton onClick={downloadCardImage} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print Card">
            <IconButton onClick={downloadCard} size="small">
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </MobileStack>
        <div style={{ display: 'flex', justifyContent: 'center', overflow: 'visible', minHeight: 360 }}>
          <Box sx={{ overflow: 'visible' }}>
            <div 
              dangerouslySetInnerHTML={{ __html: generateCardHTML(myEmployee) }}
              style={{
                transform: isMobile ? 'scale(0.7)' : 'none',
                transformOrigin: 'top center',
                width: '204px',
              }}
            />
          </Box>
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