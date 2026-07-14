import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Switch, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../context/AuthContext';

const ROLES = ['admin', 'hr', 'finance', 'manager', 'employee'];

// Display-only label mapping — the underlying role value stays 'owner'
// everywhere (requireRole, RBAC checks, etc.); only the label changes.
const ROLE_LABELS = { owner: 'Founder' };
const roleLabel = (role) => ROLE_LABELS[role] || role;

export default function Team() {
  const { staff: me } = useAuth();
  const isFounder = me?.role === 'owner';

  const [staff, setStaff] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'employee', employee_id: '' });

  const [linkTarget, setLinkTarget] = useState(null);
  const [linkEmployeeId, setLinkEmployeeId] = useState('');

  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionMessage, setActionMessage] = useState(null);

  const load = () => client.get('/staff-accounts').then(({ data }) => setStaff(data.staff)).catch(() => setStaff([]));
  const loadEmployees = () => client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  const loadPending = () =>
    client.get('/approvals', { params: { status: 'pending' } })
      .then(({ data }) => setPendingRequests(data.requests || []))
      .catch(() => setPendingRequests([]));

  useEffect(() => { load(); loadEmployees(); loadPending(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/staff-accounts', { ...form, employee_id: form.employee_id || null });
      setOpen(false);
      setForm({ email: '', password: '', role: 'employee', employee_id: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const openLink = (s) => {
    setLinkTarget(s);
    setLinkEmployeeId(s.employee_id || '');
  };
  const saveLink = async () => {
    try {
      await client.post(`/staff-accounts/${linkTarget.id}/link-employee`, { employee_id: linkEmployeeId || null });
      setLinkTarget(null);
      load();
    } catch (err) {
      setActionMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to link employee' });
    }
  };

  const toggleActive = async (s) => {
    setActionMessage(null);
    if (s.is_active) {
      // Deactivating — owner does it immediately, admin's request goes to
      // approval instead (the backend branches on this; we just show
      // whatever it tells us happened).
      try {
        const { data } = await client.post(`/staff-accounts/${s.id}/deactivate`);
        if (data.pending) {
          setActionMessage({ severity: 'info', text: data.message });
          loadPending();
        } else {
          load();
        }
      } catch (err) {
        setActionMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to deactivate' });
      }
    } else {
      await client.post(`/staff-accounts/${s.id}/reactivate`);
      load();
    }
  };

  const decide = async (requestId, decision) => {
    try {
      await client.post(`/approvals/${requestId}/${decision}`);
      loadPending();
      load();
    } catch (err) {
      setActionMessage({ severity: 'error', text: err.response?.data?.error || `Failed to ${decision}` });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Team logins</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Create login</Button>
      </Box>

      {actionMessage && <Alert severity={actionMessage.severity} sx={{ mb: 2.5 }}>{actionMessage.text}</Alert>}

      {isFounder && pendingRequests.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
            Pending your approval ({pendingRequests.length})
          </Typography>
          {pendingRequests.map((r) => (
            <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontSize: '0.875rem' }}>
                  Deactivate <strong>{r.target_label}</strong>
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Requested by {r.requested_by_email} · {new Date(r.created_at).toLocaleString()}
                  {r.reason ? ` · "${r.reason}"` : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" color="error" onClick={() => decide(r.id, 'reject')}>Reject</Button>
                <Button size="small" variant="contained" onClick={() => decide(r.id, 'approve')}>Approve</Button>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {!isFounder && pendingRequests.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {pendingRequests.length} deactivation request{pendingRequests.length === 1 ? '' : 's'} awaiting Founder approval.
        </Alert>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Linked employee</TableCell>
              <TableCell>Last login</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((s) => {
              const hasPendingDeactivation = pendingRequests.some(
                (r) => r.target_type === 'staff_account' && r.target_id === s.id && r.action_type === 'staff_account.deactivate'
              );
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>
                    {s.role === 'owner'
                      ? <Chip size="small" label={roleLabel(s.role)} color="primary" variant="outlined" />
                      : <StatusChip status={s.role} />}
                  </TableCell>
                  <TableCell>
                    {s.employee_name ? (
                      <Button size="small" onClick={() => openLink(s)} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
                        {s.employee_name}
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" onClick={() => openLink(s)} sx={{ fontSize: '0.75rem' }}>
                        Link employee
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="figure">{s.last_login ? new Date(s.last_login).toLocaleString() : 'Never'}</TableCell>
                  <TableCell>
                    {hasPendingDeactivation ? (
                      <Chip size="small" color="warning" label="Deactivation pending" />
                    ) : (
                      <Switch checked={s.is_active} onChange={() => toggleActive(s)} size="small" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!staff.length && (
              <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No team logins yet besides your own.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create a login</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Email" margin="normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField fullWidth label="Temporary password" margin="normal" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} helperText="Share this with them securely — they should change it after first login (no self-service change screen yet)." />
          <TextField fullWidth select label="Role" margin="normal" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <MenuItem key={r} value={r}>{roleLabel(r)}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Linked employee (optional)" margin="normal" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} helperText="Links this login to an employee record so their profile, payslips, and leave show up when they log in.">
            <MenuItem value="">None yet</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.email || !form.password}>
            {saving ? 'Creating…' : 'Create login'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!linkTarget} onClose={() => setLinkTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Link employee — {linkTarget?.email}</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Employee" margin="normal" value={linkEmployeeId} onChange={(e) => setLinkEmployeeId(e.target.value)}>
            <MenuItem value="">Unlink</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveLink}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}