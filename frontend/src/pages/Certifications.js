import { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileFormGrid,
  MobileActionButtons,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const CERT_TYPES = [
  { value: 'iso_27001', label: 'ISO 27001' },
  { value: 'soc2_type1', label: 'SOC 2 Type I' },
  { value: 'soc2_type2', label: 'SOC 2 Type II' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLOR = { in_progress: 'info', active: 'success', expired: 'error', not_renewed: 'warning' };

const emptyForm = {
  cert_type: 'iso_27001', name: '', issuing_body: '', certificate_number: '',
  issued_date: '', expiry_date: '', status: 'in_progress', renewal_reminder_days: 90, notes: '',
};

export default function Certifications() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [isComplianceHead, setIsComplianceHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isComplianceHead;
  const canDelete = staff?.role === 'owner';

  const [certs, setCerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);

  const load = () => {
    client.get('/certifications').then(({ data }) => setCerts(data.certifications)).catch(() => setCerts([]));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsComplianceHead(!!(dept?.isHOD && dept?.departmentName === 'Legal & Compliance'));
      })
      .catch(() => setIsComplianceHead(false));
  }, [staff?.role]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFileToUpload(null);
    setError('');
    setOpen(true);
  };

  const openEdit = (cert) => {
    setEditingId(cert.id);
    setForm({
      cert_type: cert.cert_type, name: cert.name, issuing_body: cert.issuing_body || '',
      certificate_number: cert.certificate_number || '', issued_date: cert.issued_date?.slice(0, 10) || '',
      expiry_date: cert.expiry_date?.slice(0, 10) || '', status: cert.status,
      renewal_reminder_days: cert.renewal_reminder_days || 90, notes: cert.notes || '',
    });
    setFileToUpload(null);
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let certificate_document_id;
      if (fileToUpload) {
        const fd = new FormData();
        fd.append('file', fileToUpload);
        fd.append('title', `${form.name} — Certificate`);
        fd.append('doc_type', 'certificate');
        fd.append('entity_type', 'company');
        const { data: docRes } = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        certificate_document_id = docRes.document.id;
      }
      const payload = { ...form, ...(certificate_document_id ? { certificate_document_id } : {}) };

      const { data } = editingId
        ? await client.put(`/certifications/${editingId}`, payload)
        : await client.post('/certifications', payload);

      if (data.reminderSpawned) {
        window.alert('A renewal reminder was added to the Compliance tracker.');
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save certification');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cert) => {
    if (!window.confirm(`Delete "${cert.name}"? This cannot be undone.`)) return;
    await client.delete(`/certifications/${cert.id}`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Certifications</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            ISO, SOC 2, and other certifications. Marking one "Active" with an expiry date auto-adds a renewal reminder to Compliance.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add certification</MobileButton>}
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Issuing body</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {certs.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{cert.name}</TableCell>
                  <TableCell><Chip size="small" label={CERT_TYPES.find((c) => c.value === cert.cert_type)?.label || cert.cert_type} variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{cert.issuing_body || '—'}</TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{cert.expiry_date?.slice(0, 10) || '—'}</TableCell>
                  <TableCell><Chip size="small" label={cert.status.replace('_', ' ')} color={STATUS_COLOR[cert.status]} /></TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(cert)}>Edit</MobileButton>}
                      {canDelete && <MobileButton size="small" color="error" onClick={() => handleDelete(cert)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!certs.length && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No certifications tracked yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit certification' : 'Add certification'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField
              fullWidth
              select
              label="Type"
              value={form.cert_type}
              onChange={(e) => setForm({ ...form, cert_type: e.target.value })}
              options={CERT_TYPES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <MobileTextField fullWidth label="Name" placeholder='e.g. "ISO 27001:2022"' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <MobileTextField fullWidth label="Issuing body" value={form.issuing_body} onChange={(e) => setForm({ ...form, issuing_body: e.target.value })} />
            <MobileTextField fullWidth label="Certificate number" value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Issued date" InputLabelProps={{ shrink: true }} value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Expiry date" InputLabelProps={{ shrink: true }} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'in_progress', label: 'In progress' },
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'not_renewed', label: 'Not renewed' },
              ]}
            />
            <MobileTextField
              fullWidth
              type="number"
              label="Renewal reminder (days before expiry)"
              value={form.renewal_reminder_days}
              onChange={(e) => setForm({ ...form, renewal_reminder_days: e.target.value })}
            />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <MobileButton component="label" variant="outlined" fullWidth sx={{ mt: 1 }}>
              {fileToUpload ? fileToUpload.name : 'Upload certificate (optional)'}
              <input type="file" hidden onChange={(e) => setFileToUpload(e.target.files[0])} />
            </MobileButton>
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}