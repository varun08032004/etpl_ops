import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Chip, IconButton, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptySigner = () => ({ name: '', email: '', role_label: '', staff_id: '' });

function StatusChipLocal({ status }) {
  const color = { pending: 'warning', completed: 'success', voided: 'default', signed: 'success', declined: 'error' }[status] || 'default';
  return <Chip size="small" label={status} color={color} />;
}

export default function ESignatures() {
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', entity_type: '', entity_id: '', signers: [emptySigner()] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [staffList, setStaffList] = useState([]);

  const load = () => client.get('/esignatures').then(({ data }) => setRequests(data.requests)).catch(() => setRequests([]));
  useEffect(() => {
    load();
    client.get('/staff-accounts').then(({ data }) => setStaffList(data.staff)).catch(() => setStaffList([]));
  }, []);

  const updateSigner = (i, key, value) => {
    const next = [...form.signers];
    next[i] = { ...next[i], [key]: value };
    // If picking an internal staff member, prefill name/email and clear any
    // manual entry — internal signers don't get an emailed link, they sign
    // in-app, so email is just for display here.
    if (key === 'staff_id' && value) {
      const s = staffList.find((x) => x.id === value);
      if (s) { next[i].name = s.employee_name || s.email; next[i].email = s.email; }
    }
    setForm({ ...form, signers: next });
  };
  const addSigner = () => setForm({ ...form, signers: [...form.signers, emptySigner()] });
  const removeSigner = (i) => setForm({ ...form, signers: form.signers.filter((_, idx) => idx !== i) });

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, signers: form.signers.filter((s) => s.name && s.email).map((s) => ({ ...s, staff_id: s.staff_id || null })) };
      await client.post('/esignatures', payload);
      setOpen(false);
      setForm({ title: '', entity_type: '', entity_id: '', signers: [emptySigner()] });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    const { data } = await client.get(`/esignatures/${id}`);
    setDetail(data);
  };

  const voidRequest = async (id) => {
    if (!window.confirm('Void this signature request? Signers will no longer be able to sign.')) return;
    await client.post(`/esignatures/${id}/void`);
    setDetail(null);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">E-Signatures</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New signature request</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        Built-in e-signature — a typed full name plus timestamp, IP, and browser info, stored as
        an audit trail. Good for internal offer letters, quotations, and simple agreements. Not a
        substitute for a licensed provider (DocuSign, Zoho Sign, Aadhaar eSign) if a specific
        document type has a regulatory requirement for one.
      </Alert>

      <Paper>
        <Table>
          <TableHead>
            <TableRow><TableCell>Title</TableCell><TableCell>Progress</TableCell><TableCell>Status</TableCell><TableCell align="right"></TableCell></TableRow>
          </TableHead>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(r.id)}>
                <TableCell>{r.title}</TableCell>
                <TableCell sx={{ width: 200 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.3 }} className="figure">
                    {r.signed_count}/{r.signer_count} signed
                  </Typography>
                  <LinearProgress variant="determinate" value={r.signer_count ? (r.signed_count / r.signer_count) * 100 : 0} />
                </TableCell>
                <TableCell><StatusChipLocal status={r.status} /></TableCell>
                <TableCell align="right">
                  {r.status === 'pending' && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); voidRequest(r.id); }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!requests.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No signature requests yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New signature request</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Offer letter — Priya Sharma" />

          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 2, mb: 1 }}>Signers</Typography>
          {form.signers.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
              <TextField
                select size="small" label="Internal? (optional)" value={s.staff_id} sx={{ width: 170 }}
                onChange={(e) => updateSigner(i, 'staff_id', e.target.value)}
              >
                <MenuItem value="">External</MenuItem>
                {staffList.map((st) => <MenuItem key={st.id} value={st.id}>{st.employee_name || st.email}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Name" value={s.name} onChange={(e) => updateSigner(i, 'name', e.target.value)} sx={{ flex: 1 }} disabled={!!s.staff_id} />
              <TextField size="small" label="Email" value={s.email} onChange={(e) => updateSigner(i, 'email', e.target.value)} sx={{ flex: 1 }} disabled={!!s.staff_id} />
              <TextField size="small" label="Role" value={s.role_label} onChange={(e) => updateSigner(i, 'role_label', e.target.value)} sx={{ width: 130 }} placeholder="e.g. Client" />
              <IconButton size="small" onClick={() => removeSigner(i)} disabled={form.signers.length === 1}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" onClick={addSigner}>Add another signer</Button>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={saving || !form.title}>{saving ? 'Sending…' : 'Create & send'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{detail?.request.title}</DialogTitle>
        <DialogContent>
          {detail?.signers.map((s) => (
            <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontSize: '0.85rem' }}>{s.name}{s.role_label ? ` (${s.role_label})` : ''}</Typography>
                {s.status === 'signed' && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    Signed as "{s.signed_name}" · {new Date(s.signed_at).toLocaleString()}
                  </Typography>
                )}
                {s.status === 'declined' && <Typography sx={{ fontSize: '0.72rem', color: 'error.main' }}>Declined{s.decline_reason ? `: ${s.decline_reason}` : ''}</Typography>}
              </Box>
              <StatusChipLocal status={s.status} />
            </Box>
          ))}
          {detail?.request.status === 'pending' && (
            <Button size="small" color="error" sx={{ mt: 2 }} onClick={() => voidRequest(detail.request.id)}>Void this request</Button>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetail(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}