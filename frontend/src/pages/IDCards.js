import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle,
  DialogContent, Alert, Select, MenuItem, FormControl,
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

function generateQRCode(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(data)}`;
}

function generateBarcode(data) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(data)}&code=Code128&dpi=96&dataseparator=`;
}

export default function IDCards() {
  const isMobile = useMobile();
  const { staff: me } = useAuth();
  const canManage = ['owner', 'admin', 'hr'].includes(me?.role);

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ department_id: '', tier_id: '' });
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [message, setMessage] = useState(null);
  const [designSettings, setDesignSettings] = useState({
    primaryColor: '#1e3a8a',
    secondaryColor: '#3b82f6',
    showQR: true,
    showBarcode: true,
    cardType: 'horizontal', // horizontal, vertical
  });

  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees)).catch(() => {});
    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
    client.get('/org-hierarchy-tiers').then(({ data }) => setTiers(data.tiers)).catch(() => {});
  }, []);

  const handlePhotoUpload = async () => {
    if (!photoFile || !selectedEmployee) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('title', `${selectedEmployee.full_name} - ID Photo`);
      fd.append('doc_type', 'id_photo');
      fd.append('entity_type', 'employee');
      fd.append('entity_id', selectedEmployee.id);
      await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPhotoDialogOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      // Reload employee to get updated photo
      const { data } = await client.get(`/employees/${selectedEmployee.id}`);
      setSelectedEmployee(data.employee);
      setMessage({ severity: 'success', text: 'Photo uploaded successfully' });
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to upload photo' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const getEmployeePhoto = (emp) => {
    if (emp.id_photo_url) return emp.id_photo_url;
    // Check documents
    if (emp.documents) {
      const photoDoc = emp.documents.find(d => d.doc_type === 'id_photo');
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
      // After print, offer to save as PDF
      setTimeout(() => printWindow.close(), 1000);
    };
  };

  const downloadCardImage = async (emp) => {
    // Use html2canvas approach for image download
    const cardHtml = generateCardHTML(emp, false);
    const printWindow = window.open('', '_blank');
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
            link.download = 'ID_Card_${emp.employee_code}.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printBatch = async () => {
    setBatchSaving(true);
    setBatchError('');
    try {
      let params = {};
      if (batchForm.department_id) params.department_id = batchForm.department_id;
      if (batchForm.tier_id) params.tier_id = batchForm.tier_id;
      const { data } = await client.get('/employees', { params });
      const filtered = data.employees.filter(e => e.status === 'active');
      
      if (filtered.length === 0) {
        setBatchError('No active employees match the criteria');
        return;
      }

      const printWindow = window.open('', '_blank');
      const cardsHtml = filtered.map(emp => generateCardHTML(emp, true)).join('<div style="page-break-after: always;"></div>');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ID Cards Batch</title>
          <style>
            @media print {
              @page { margin: 0; size: 3.375in 2.125in; }
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
            .card { width: 3.375in; height: 2.125in; border: 2px solid #333; border-radius: 8px; overflow: hidden; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 0; page-break-after: always; }
            .card:last-child { page-break-after: auto; }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      setBatchDialogOpen(false);
      setMessage({ severity: 'success', text: `Printing ${filtered.length} ID cards...` });
    } catch (err) {
      setBatchError(err.response?.data?.error || 'Failed to generate batch');
    } finally {
      setBatchSaving(false);
    }
  };

  const getTier = (emp) => {
    if (emp.designation?.tier_id) return tiers.find(t => t.id === emp.designation.tier_id);
    if (emp.designation?.tier_name) return tiers.find(t => t.name === emp.designation.tier_name);
    if (me?.role === 'owner') return tiers.find(t => t.name.includes('Managing Director'));
    if (me?.role === 'admin') return tiers.find(t => t.name === 'CEO');
    if (me?.role === 'hr') return tiers.find(t => t.name === 'Department Head (HOD)');
    return tiers.find(t => t.name === 'Employee');
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
        <div style="height: 4px; background: linear-gradient(90deg, ${tierColor} 0%, ${designSettings.primaryColor} 100%);"></div>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${designSettings.primaryColor} 0%, ${designSettings.secondaryColor} 100%); color: white; padding: 14px 16px; display: flex; align-items: center; gap: 14px; position: relative;">
          <div style="width: 54px; height: 54px; border-radius: 50%; background: white; padding: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <img src="${logo}" alt="EtherTrack Logo" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 16px; font-weight: 800; letter-spacing: -0.02em; margin: 0; line-height: 1.2;">EtherTrack</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 2px; font-weight: 500;">EtherTrack Technologies Pvt. Ltd.</div>
            <div style="font-size: 8px; opacity: 0.8; margin-top: 1px;">CIN: U72900MH2020PTC123456</div>
          </div>
          ${designSettings.showQR ? `
          <div style="width: 50px; height: 50px; background: white; border-radius: 6px; padding: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <img src="${qrUrl}" alt="QR Code" style="width: 100%; height: 100%;" />
          </div>
          ` : ''}
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
            ${canManage && !forPrint ? `
            <button onclick="event.stopPropagation(); window.parent.postMessage({type:'OPEN_PHOTO_DIALOG', employeeId: '${emp.id}'}, '*')" 
              style="margin-top: 6px; width: 100%; padding: 4px 8px; background: ${tierColor}; color: white; border: none; border-radius: 4px; font-size: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
              Change Photo
            </button>
            ` : ''}
          </div>

          <!-- Details Section -->
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
                <div style="font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">${emp.full_name}</div>
                ${tier ? `<span style="background: ${tierColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${tier.name}</span>` : ''}
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
            ${designSettings.showBarcode ? `
            <div style="text-align: center; padding-top: 8px; border-top: 1px solid #e5e7eb;">
              <img src="${barcodeUrl}" alt="Barcode: ${barcodeData}" style="height: 28px; max-width: 100%;" />
              <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; color: #374151; margin-top: 4px; letter-spacing: 2px;">${barcodeData}</div>
            </div>
            ` : ''}
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

  const openPhotoDialog = (emp) => {
    setSelectedEmployee(emp);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoDialogOpen(true);
  };

  // Listen for photo dialog open from print window
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'OPEN_PHOTO_DIALOG') {
        const emp = employees.find(e => e.id === event.data.employeeId);
        if (emp) openPhotoDialog(emp);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [employees]);

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Employee ID Cards</Typography>
        <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap' }}>
          {canManage && (
            <>
              <MobileButton variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => openPhotoDialog(selectedEmployee)} disabled={!selectedEmployee}>
                Upload Photo
              </MobileButton>
              <MobileButton variant="outlined" startIcon={<QrCodeIcon />} onClick={() => setBatchDialogOpen(true)}>
                Batch Print
              </MobileButton>
            </>
          )}
          {selectedEmployee && canManage && (
            <MobileButton variant="contained" startIcon={<DownloadIcon />} onClick={() => downloadCardImage(selectedEmployee)}>
              Download PNG
            </MobileButton>
          )}
          {selectedEmployee && (
            <MobileButton variant="contained" startIcon={<PrintIcon />} onClick={() => downloadCard(selectedEmployee)}>
              Print Card
            </MobileButton>
          )}
        </MobileStack>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

      {/* Design Settings */}
      <MobilePaper sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Card Design Settings</Typography>
        <MobileFormGrid>
          <MobileTextField
            fullWidth
            label="Primary Color"
            type="color"
            value={designSettings.primaryColor}
            onChange={(e) => setDesignSettings({ ...designSettings, primaryColor: e.target.value })}
            InputProps={{ style: { height: 40, padding: 0 } }}
            inputProps={{ style: { height: 32 } }}
          />
          <MobileTextField
            fullWidth
            label="Secondary Color"
            type="color"
            value={designSettings.secondaryColor}
            onChange={(e) => setDesignSettings({ ...designSettings, secondaryColor: e.target.value })}
            InputProps={{ style: { height: 40, padding: 0 } }}
            inputProps={{ style: { height: 32 } }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Card Orientation</InputLabel>
            <Select value={designSettings.cardType} onChange={(e) => setDesignSettings({ ...designSettings, cardType: e.target.value })}>
              <MenuItem value="horizontal">Horizontal (Standard CR80)</MenuItem>
              <MenuItem value="vertical">Vertical</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={designSettings.showQR} onChange={(e) => setDesignSettings({ ...designSettings, showQR: e.target.checked })} />
              Show QR Code
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={designSettings.showBarcode} onChange={(e) => setDesignSettings({ ...designSettings, showBarcode: e.target.checked })} />
              Show Barcode
            </label>
          </Box>
        </MobileFormGrid>
      </MobilePaper>

      <MobilePaper>
        <MobileFormGrid sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="employee-select-label">Select Employee</InputLabel>
            <Select
              labelId="employee-select-label"
              value={selectedEmployee?.id || ''}
              onChange={(e) => {
                const emp = employees.find(emp => emp.id === e.target.value);
                setSelectedEmployee(emp || null);
              }}
              label="Select Employee"
            >
              <MenuItem value="">Select an employee...</MenuItem>
              {employees
                .filter(e => e.status === 'active')
                .map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code}) - {emp.department || 'No Dept'}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </MobileFormGrid>
      </MobilePaper>

      {selectedEmployee && (
        <MobilePaper sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>ID Card Preview</Typography>
          <MobileStack gap={1} direction="row" sx={{ flexWrap: 'wrap', mb: 2 }}>
            {canManage && (
              <Tooltip title="Upload/Change Photo">
                <IconButton onClick={() => openPhotoDialog(selectedEmployee)} size="small">
                  <PhotoCameraIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Download as PNG">
              <IconButton onClick={() => downloadCardImage(selectedEmployee)} size="small" disabled={!canManage}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print Card">
              <IconButton onClick={() => downloadCard(selectedEmployee)} size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </MobileStack>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Box ref={el => { if (el) generateCardHTML(selectedEmployee, false); }}>
              <div dangerouslySetInnerHTML={{ __html: generateCardHTML(selectedEmployee, false) }} />
            </Box>
          </div>
        </MobilePaper>
      )}

      {/* Photo Upload Dialog */}
      <MobileDialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Upload ID Photo for {selectedEmployee?.full_name}</DialogTitle>
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

      {/* Batch Print Dialog */}
      <MobileDialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Batch Print ID Cards</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField
              fullWidth
              select
              label="Department (optional)"
              value={batchForm.department_id}
              onChange={(e) => setBatchForm({ ...batchForm, department_id: e.target.value })}
              options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Tier (optional)"
              value={batchForm.tier_id}
              onChange={(e) => setBatchForm({ ...batchForm, tier_id: e.target.value })}
              options={[{ value: '', label: 'All Tiers' }, ...tiers.map(t => ({ value: t.id, label: t.name }))]}
            />
          </MobileFormGrid>
          {batchError && <Alert severity="error" sx={{ mt: 1 }}>{batchError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setBatchDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={printBatch} disabled={batchSaving} startIcon={<PrintIcon />}>
            {batchSaving ? 'Generating…' : 'Print All Matching'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}