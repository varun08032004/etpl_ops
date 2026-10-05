import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle,
  DialogContent, Alert, FormControl,
  InputLabel, IconButton, Tooltip,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import {
  MobilePageHeader,
  MobilePaper,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileActionButtons,
  MobileFormGrid,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';
import logo from '../assets/ethertrack-logo.png';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import QrCodeIcon from '@mui/icons-material/QrCode';

function generateQRCode(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(data)}`;
}

function generateBarcode(data) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(data)}&code=Code128&dpi=96&dataseparator=`;
}

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
      fd.append('doc_type', 'photo');
      fd.append('entity_type', 'employee');
      fd.append('entity_id', myEmployee.id);
      const response = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      console.log('Photo upload response:', response.data);
      setPhotoDialogOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      // Reload employee to get updated photo
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
      const photoDoc = emp.documents.find(d => d.doc_type === 'id_photo' || d.doc_type === 'photo');
      if (photoDoc) return photoDoc.file_url;
    }
    return null;
  };

  const downloadCard = async (emp) => {
    const cardHtml = generateCardHTML(emp, true);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(cardHtml);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    };
  };

  const downloadCardImage = async (emp) => {
    const cardHtml = generateCardHTML(emp, false);
    const printWindow = window.open('', '_blank');
    const fileName = `ID_Card_${emp.employee_code}.png`;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${emp.full_name}</title>
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
        <style>
          body { margin: 0; padding: 20px; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .card { width: 3.375in; height: 2.125in; border: 2px solid #333; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white; }
        </style>
      </head>
      <body>
        <div id="card">${cardHtml}</div>
        <button onclick="downloadImage()" style="position:fixed;top:20px;right:20px;z-index:999;padding:10px 20px;background:#1e3a8a;color:white;border:none;border-radius:4px;cursor:pointer;">Download as PNG</button>
        <script>
          async function downloadImage() {
            const canvas = await html2canvas(document.getElementById('card'), { scale: 4, useCORS: true });
            const link = document.createElement('a');
            link.download = '${fileName}';
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getTier = (emp) => {
    // For now, return a default tier since we don't have tier info in employee detail
    // In a real app, you'd fetch tier from designation
    return { name: 'Employee', color: '#166534' };
  };

  const getTierColor = (emp) => {
    const tier = getTier(emp);
    return tier?.color || '#6366f1';
  };

  const generateCardHTML = (emp, forPrint) => {
    const tier = getTier(emp);
    const tierColor = getTierColor(emp);
    const photoUrl = getEmployeePhoto(emp);
    const qrData = `ETPL:${emp.employee_code}|${emp.full_name}|${emp.designation || ''}|${emp.department || ''}|${tier?.name || ''}`;
    const barcodeData = emp.employee_code;
    const qrUrl = generateQRCode(qrData);
    const barcodeUrl = generateBarcode(barcodeData);
    const validityDate = emp.date_of_joining ? new Date(new Date(emp.date_of_joining).getFullYear() + 5, 11, 31).toLocaleDateString('en-IN') : '—';
    const bloodGroup = emp.blood_group || '—';
    const emergencyContact = emp.emergency_contact || emp.emergency_phone || '—';

    return `
      <div class="card" style="
        width: 3.375in; 
        height: 2.125in; 
        border: 2px solid #1e3a8a; 
        border-radius: 8px; 
        overflow: hidden; 
        position: relative; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ${forPrint ? 'page-break-after: always;' : ''}
      ">
        <!-- Top colored strip -->
        <div style="height: 4px; background: linear-gradient(90deg, ${tierColor} 0%, #1e3a8a 100%);"></div>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 14px 16px; display: flex; align-items: center; gap: 14px; position: relative;">
          <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,0.15); padding: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.15); backdrop-filter: blur(4px);">
            <img src="${logo}" alt="EtherTrack Logo" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 16px; font-weight: 800; letter-spacing: -0.02em; margin: 0; line-height: 1.2;">EtherTrack</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 2px; font-weight: 500;">EtherTrack Technologies Pvt. Ltd.</div>
            <div style="font-size: 8px; opacity: 0.8; margin-top: 1px;">CIN: U72900MH2020PTC123456</div>
          </div>
          <div style="width: 50px; height: 50px; background: white; border-radius: 6px; padding: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <img src="${qrUrl}" alt="QR Code" style="width: 100%; height: 100%;" />
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 14px 16px; display: flex; gap: 14px; height: calc(2.125in - 104px);">
          <!-- Photo Section -->
          <div style="width: 85px; flex-shrink: 0;">
            <div style="width: 85px; height: 108px; border-radius: 6px; overflow: hidden; border: 2px solid #e5e7eb; background: #f9fafb; position: relative; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
              ${photoUrl ? `
                <img src="${photoUrl}" alt="${emp.full_name}" style="width: 100%; height: 100%; object-fit: cover;" />
              ` : `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; font-size: 9px; text-align: center; padding: 8px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  No Photo
                </div>
              `}
            </div>
            <button onclick="event.stopPropagation(); window.parent.postMessage({type:'OPEN_PHOTO_DIALOG', employeeId: '${emp.id}'}, '*')" 
              style="margin-top: 6px; width: 100%; padding: 4px 8px; background: ${tierColor}; color: white; border: none; border-radius: 4px; font-size: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
              Change Photo
            </button>
          </div>

          <!-- Details Section -->
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
                <div style="font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">${emp.full_name}</div>
                <span style="background: ${tierColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${tier.name}</span>
              </div>
              
              <div style="font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Employee Code</div>
              <div style="font-size: 14px; font-weight: 700; color: #111827; font-family: 'SF Mono', Monaco, monospace; letter-spacing: 0.5px; margin-bottom: 8px;">${emp.employee_code}</div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="font-size: 8px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Designation</div>
                  <div style="font-size: 11px; font-weight: 600; color: #111827;">${emp.designation || '—'}</div>
                </div>
                <div>
                  <div style="font-size: 8px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Department</div>
                  <div style="font-size: 11px; font-weight: 600; color: #111827;">${emp.department || '—'}</div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
                <div>
                  <div style="font-size: 8px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Date of Joining</div>
                  <div style="font-size: 11px; font-weight: 600; color: #111827;">${emp.date_of_joining?.slice(0,10) || '—'}</div>
                </div>
                <div>
                  <div style="font-size: 8px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Valid Until</div>
                  <div style="font-size: 11px; font-weight: 600; color: #111827;">${validityDate}</div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
                <div>
                  <div style="font-size: 8px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Blood Group</div>
                  <div style="font-size: 11px; font-weight: 600; color: #111827;">${bloodGroup}</div>
                </div>
                <div>
                  <div style="font-size: 8px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Emergency</div>
                  <div style="font-size: 11px; font-weight: 600; color: #111827;">${emergencyContact}</div>
                </div>
              </div>
            </div>

            <!-- Barcode at bottom of details -->
            <div style="text-align: center; padding-top: 8px; border-top: 1px solid #e5e7eb;">
              <img src="${barcodeUrl}" alt="Barcode: ${barcodeData}" style="height: 28px; max-width: 100%;" />
              <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; color: #374151; margin-top: 4px; letter-spacing: 2px;">${barcodeData}</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 8px 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #64748b;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 600;">Authorized Signature</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span>Valid while employed</span>
            <span style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; color: #374151;">${barcodeData}</span>
          </div>
        </div>
      </div>
    `;
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
          <MobileButton variant="contained" startIcon={<DownloadIcon />} onClick={() => downloadCardImage(myEmployee)}>
            Download PNG
          </MobileButton>
          <MobileButton variant="contained" startIcon={<PrintIcon />} onClick={() => downloadCard(myEmployee)}>
            Print Card
          </MobileButton>
        </MobileStack>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

      <MobilePaper sx={{ mt: 2, overflow: 'visible' }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>ID Card Preview</Typography>
        <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap', mb: 2 }}>
          <Tooltip title="Upload/Change Photo">
            <IconButton onClick={openPhotoDialog} size="small">
              <PhotoCameraIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as PNG">
            <IconButton onClick={() => downloadCardImage(myEmployee)} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print Card">
            <IconButton onClick={() => downloadCard(myEmployee)} size="small">
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </MobileStack>
        <div style={{ display: 'flex', justifyContent: 'center', overflow: 'visible', minHeight: 360 }}>
          <Box sx={{ overflow: 'visible' }}>
            <div dangerouslySetInnerHTML={{ __html: generateCardHTML(myEmployee, false) }} />
          </Box>
        </div>
      </MobilePaper>

      <MobileDialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Upload ID Photo</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
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
          </MobileFormGrid>
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