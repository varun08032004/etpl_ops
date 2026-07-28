import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Switch, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

// Was missing legal_hod/compliance_hod/marketing_hod/partnerships_hod —
// same class of bug flagged earlier in App.js/Layout.js/staff-accounts.js:
// any *_hod role added to ROLE_TO_NAV_GROUP_LABELS needs to also land here,
// or it can never actually be assigned to a login through this page.
const ROLES = ['owner', 'admin', 'hr', 'finance', 'legal_hod', 'compliance_hod', 'marketing_hod', 'sales_hod', 'product_hod', 'accounting_hod', 'manager', 'employee'];

export default function Team() {
  const { staff: me } = useAuth();
  const isFounder = me?.role === 'owner';

  const [staff, setStaff] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'employee', employee_id: '' });

  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionMessage, setActionMessage] = useState(null);

  // Link-employee dialog — for accounts that already exist but weren't
  // linked at creation time (e.g. created here before this fix, or via an
  // API call that didn't pass employee_id).
  const [linkTarget, setLinkTarget] = useState(null); // the staff row being linked
  const [linkEmployeeId, setLinkEmployeeId] = useState('');
  const [linking, setLinking] = useState(false);

  const load = () => client.get('/staff-accounts').then(({ data }) => setStaff(data.staff)).catch(() => setStaff([]));
  const loadPending = () =>
    client.get('/approvals', { params: { status: 'pending' } })
      .then(({ data }) => setPendingRequests(data.requests || []))
      .catch(() => setPendingRequests([]));
  const loadEmployees = () => client.get('/employees').then(({ data }) => setEmployees(data.employees)).catch(() => setEmployees([]));

  useEffect(() => { load(); loadPending(); loadEmployees(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, employee_id: form.employee_id || null };
      await client.post('/staff-accounts', payload);
      setOpen(false);
      setForm({ email: '', password: '', role: 'employee', employee_id: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  // Prefills email from the chosen employee's work email, same convenience
  // the employee-detail "Create login" button already gives — this dialog
  // was the one entry point that didn't do that.
  const handleEmployeePick = (employeeId) => {
    const emp = employees.find((e) => e.id === employeeId);
    setForm({ ...form, employee_id: employeeId, email: emp?.work_email || form.email });
  };

  const toggleActive = async (s) => {
    setActionMessage(null);
    if (s.is_active) {
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

  const changeRole = async (s, newRole) => {
    if (newRole === s.role) return;
    if (!window.confirm(`Change ${s.email}'s role from ${s.role} to ${newRole}?`)) return;
    try {
      await client.put(`/staff-accounts/${s.id}/role`, { role: newRole });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change role');
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

  const openLinkDialog = (s) => {
    setLinkTarget(s);
    setLinkEmployeeId(s.employee_id || '');
    setActionMessage(null);
  };

  const saveLink = async () => {
    setLinking(true);
    try {
      await client.post(`/staff-accounts/${linkTarget.id}/link-employee`, { employee_id: linkEmployeeId || null });
      setLinkTarget(null);
      load();
    } catch (err) {
      setActionMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to link employee' });
      setLinkTarget(null);
    } finally {
      setLinking(false);
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
                  {r.action_type === 'staff_account.deactivate' ? 'Deactivate' : r.action_type === 'employee.exit' ? 'Exit employee' : r.action_type === 'department.delete' ? 'Delete department' : r.action_type}{' '}
                  <strong>{r.target_label}</strong>
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
          {pendingRequests.length} request{pendingRequests.length === 1 ? '' : 's'} awaiting Founder approval.
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
                    <TextField select size="small" value={s.role} onChange={(e) => changeRole(s, e.target.value)} sx={{ minWidth: 150 }}>
                      {ROLES.map((r) => <MenuItem key={r} value={r}>{r.replace('_', ' ')}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    {s.employee_name ? (
                      <Chip size="small" label={s.employee_name} onClick={() => openLinkDialog(s)} variant="outlined" />
                    ) : (
                      <Button size="small" startIcon={<LinkIcon fontSize="small" />} onClick={() => openLinkDialog(s)}>
                        Link to employee
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
          <TextField
            fullWidth select label="Link to employee (optional)" margin="normal" value={form.employee_id}
            onChange={(e) => handleEmployeePick(e.target.value)}
            helperText="Picking an employee links this login so their profile, payslips, and leave show up correctly."
          >
            <MenuItem value="">Not linked to an employee</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Email" margin="normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField fullWidth label="Temporary password" margin="normal" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} helperText="Share this with them securely — they should change it after first login (no self-service change screen yet)." />
          <TextField fullWidth select label="Role" margin="normal" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r.replace('_', ' ')}</MenuItem>)}
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

      <Dialog open={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Link {linkTarget?.email} to an employee</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth select label="Employee" margin="normal" value={linkEmployeeId}
            onChange={(e) => setLinkEmployeeId(e.target.value)}
            helperText="This unlocks their self-service profile — payslips, leave balance, and their own record."
          >
            <MenuItem value="">Not linked to an employee</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveLink} disabled={linking}>{linking ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}