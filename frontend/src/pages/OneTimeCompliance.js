import { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Chip, Link, Tooltip,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
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

export default function OneTimeCompliance() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [isComplianceHead, setIsComplianceHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isComplianceHead;
  const isAdminApprover = staff?.role === 'admin';
  const isFounderApprover = staff?.role === 'owner';

  const [items, setItems] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [viewDownloadUrl, setViewDownloadUrl] = useState(null);
  const [form, setForm] = useState({ registration_number: '', registered_on: '', notes: '' });
  const [fileToUpload, setFileToUpload] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    client.get('/one-time-registrations').then(({ data }) => setItems(data.items)).catch(() => setItems([]));
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

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      registration_number: item.registration_number || '',
      registered_on: item.registered_on?.slice(0, 10) || '',
      notes: item.notes || '',
    });
    setFileToUpload(null);
    setError('');
  };

  const openView = async (item) => {
    setViewTarget(item);
    setViewDownloadUrl(null);
    if (item.proof_document_id) {
      try {
        const { data } = await client.get(`/documents/${item.proof_document_id}/download`);
        setViewDownloadUrl(data.url);
      } catch {
      }
    }
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    setError('');
    try {
      let proof_document_id = editTarget.proof_document_id || null;
      if (fileToUpload) {
        if (proof_document_id) {
          const fd = new FormData();
          fd.append('file', fileToUpload);
          const { data: docRes } = await client.post(`/documents/${proof_document_id}/new-version`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          proof_document_id = docRes.document.id;
        } else {
          const fd = new FormData();
          fd.append('file', fileToUpload);
          fd.append('title', `${editTarget.title} — Proof of registration`);
          fd.append('doc_type', 'certificate');
          fd.append('entity_type', 'company');
          fd.append('entity_id', editTarget.id);
          const { data: docRes } = await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          proof_document_id = docRes.document.id;
        }
      }
      const { data } = await client.put(`/one-time-registrations/${editTarget.slug}`, {
        is_done: true,
        registration_number: form.registration_number,
        registered_on: form.registered_on,
        proof_document_id,
        notes: form.notes,
      });
      if (data.spawnedRecurringItems > 0) {
        window.alert(`${data.spawnedRecurringItems} recurring compliance filing(s) were added to the Compliance tracker.`);
      }
      setEditTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const requestDeletion = async (item) => {
    const confirmMsg = staff?.role === 'owner'
      ? `Remove "${item.title}"? As founder this happens immediately — no approval needed.`
      : `Request removal of "${item.title}"? This requires Admin approval, then Founder approval.`;
    if (!window.confirm(confirmMsg)) return;
    await client.post(`/one-time-registrations/${item.slug}/request-deletion`);
    load();
  };

  const cancelDeletionRequest = async (item) => {
    await client.post(`/one-time-registrations/${item.slug}/cancel-deletion-request`);
    load();
  };

  const approveDeletion = async (item) => {
    await client.post(`/one-time-registrations/${item.slug}/approve-deletion`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>One-time Compliance — Registrations</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Statutory registrations done once in the company's lifetime. Marking one "Done" auto-creates its recurring filings in the Compliance tracker.
          </Typography>
        </Box>
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>Registration</TableCell>
                <TableCell>Reg. number</TableCell>
                <TableCell>Registered on</TableCell>
                <TableCell>Govt portal</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const pendingDeletion = !!item.deletion_requested_by;
                const adminApproved = !!item.deletion_admin_approved_by;
                return (
                  <TableRow key={item.slug}>
                    <TableCell>
                      {item.is_done
                        ? <CheckCircleOutlineIcon color="success" fontSize="small" />
                        : <RadioButtonUncheckedIcon color="disabled" fontSize="small" />}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                      {item.title}
                      {!item.is_done && item.applicability_status === 'not_applicable_yet' && (
                        <Tooltip title={item.applicability_note || ''}>
                          <Chip
                            size="small" variant="outlined" sx={{ ml: 1 }}
                            label={`Not required yet${item.applicability_confidence === 'unverified' ? ' (unverified)' : ''}`}
                          />
                        </Tooltip>
                      )}
                      {!item.is_done && item.applicability_status === 'active' && (
                        <Tooltip title={item.applicability_note || ''}>
                          <Chip
                            size="small" color="error" sx={{ ml: 1 }}
                            label={`Required — register now${item.applicability_confidence === 'unverified' ? ' (unverified)' : ''}`}
                          />
                        </Tooltip>
                      )}
                      {pendingDeletion && (
                        <Chip
                          size="small" color="warning" sx={{ ml: 1 }}
                          label={adminApproved ? 'Awaiting founder approval' : 'Awaiting admin approval'}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.registration_number || '—'}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.registered_on?.slice(0, 10) || '—'}</TableCell>
                    <TableCell>
                      <Link href={item.portal_url} target="_blank" rel="noopener" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
                        {item.portal_url}
                      </Link>
                    </TableCell>
                    <TableCell align="right">
                      <MobileStack gap={1} direction="row">
                        {item.is_done && <MobileButton size="small" onClick={() => openView(item)}>View</MobileButton>}
                        {canEdit && !item.is_done && <MobileButton size="small" onClick={() => openEdit(item)}>Mark done</MobileButton>}
                        {canEdit && item.is_done && <MobileButton size="small" onClick={() => openEdit(item)}>Edit</MobileButton>}
                        {canEdit && item.is_done && !pendingDeletion && (
                          <MobileButton size="small" color="warning" onClick={() => requestDeletion(item)}>
                            {staff?.role === 'owner' ? 'Remove' : 'Request removal'}
                          </MobileButton>
                        )}
                        {canEdit && pendingDeletion && <MobileButton size="small" onClick={() => cancelDeletionRequest(item)}>Cancel request</MobileButton>}
                        {pendingDeletion && isAdminApprover && !adminApproved && <MobileButton size="small" color="error" onClick={() => approveDeletion(item)}>Approve (Admin)</MobileButton>}
                        {pendingDeletion && adminApproved && isFounderApprover && <MobileButton size="small" color="error" onClick={() => approveDeletion(item)}>Approve (Founder)</MobileButton>}
                      </MobileStack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Mark-done / edit dialog */}
      <MobileDialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editTarget?.title}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Portal: <Link href={editTarget?.portal_url} target="_blank" rel="noopener">{editTarget?.portal_url}</Link>
          </Alert>
          <MobileFormGrid>
            <MobileTextField
              fullWidth
              label={editTarget?.registration_number_label || 'Registration number'}
              value={form.registration_number}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
            />
            <MobileTextField
              fullWidth
              type="date"
              label="Registered on"
              InputLabelProps={{ shrink: true }}
              value={form.registered_on}
              onChange={(e) => setForm({ ...form, registered_on: e.target.value })}
            />
            <MobileTextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <MobileButton component="label" variant="outlined" fullWidth sx={{ mt: 1 }}>
              {fileToUpload ? fileToUpload.name : 'Upload certificate / proof'}
              <input type="file" hidden onChange={(e) => setFileToUpload(e.target.files[0])} />
            </MobileButton>
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setEditTarget(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.registration_number || !form.registered_on}>
            {saving ? 'Saving…' : (editTarget?.is_done ? 'Save changes' : 'Mark done')}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* View dialog — read-only, shows proof via a signed download URL */}
      <MobileDialog open={!!viewTarget} onClose={() => setViewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{viewTarget?.title}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', mb: 1 }}>
            {viewTarget?.registration_number_label}: <b>{viewTarget?.registration_number}</b>
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', mb: 1 }}>Registered on: {viewTarget?.registered_on?.slice(0, 10)}</Typography>
          {viewTarget?.notes && <Typography sx={{ fontSize: '0.85rem', mb: 1 }}>Notes: {viewTarget.notes}</Typography>}
          {viewTarget?.proof_file_name ? (
            <MobileButton
              variant="outlined"
              fullWidth
              sx={{ mt: 1 }}
              disabled={!viewDownloadUrl}
              onClick={() => window.open(viewDownloadUrl, '_blank', 'noopener')}
            >
              {viewDownloadUrl ? 'View certificate / proof' : 'Generating link…'}
            </MobileButton>
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>No proof document uploaded.</Alert>
          )}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setViewTarget(null)}>Close</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}