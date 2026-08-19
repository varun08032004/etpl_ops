import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Switch, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  ResponsiveTableContainer,
  MobileButton,
  MobileTextField,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';

const ROLES = ['owner', 'admin', 'hr', 'finance', 'legal_hod', 'compliance_hod', 'marketing_hod', 'sales_hod', 'product_hod', 'accounting_hod', 'manager', 'employee'];

export default function Team() {
  const isMobile = useMobile();
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

  const [linkTarget, setLinkTarget] = useState(null);
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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Team logins</Typography>
        <MobileButton variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Create login</MobileButton>
      </MobilePageHeader>

      {actionMessage && <Alert severity={actionMessage.severity} sx={{ mb: 2 }}>{actionMessage.text}</Alert>}

      {isFounder && pendingRequests.length > 0 && (
        <MobilePaper sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5, fontSize: isMobile ? '0.85rem' : '1rem' }}>
            Pending your approval ({pendingRequests.length})
          </Typography>
          {pendingRequests.map((r) => (
            <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ minWidth: isMobile ? '100%' : 'auto' }}>
                <Typography sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
                  {r.action_type === 'staff_account.deactivate' ? 'Deactivate' : r.action_type === 'employee.exit' ? 'Exit employee' : r.action_type === 'department.delete' ? 'Delete department' : r.action_type}{' '}
                  <strong>{r.target_label}</strong>
                </Typography>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary' }}>
                  Requested by {r.requested_by_email} · {new Date(r.created_at).toLocaleString()}
                  {r.reason ? ` · "${r.reason}"` : ''}
                </Typography>
              </Box>
              <MobileStack gap={1} direction="row">
                <MobileButton size="small" color="error" onClick={() => decide(r.id, 'reject')}>Reject</MobileButton>
                <MobileButton size="small" variant="contained" onClick={() => decide(r.id, 'approve')}>Approve</MobileButton>
              </MobileStack>
            </Box>
          ))}
        </MobilePaper>
      )}

      {!isFounder && pendingRequests.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {pendingRequests.length} request{pendingRequests.length === 1 ? '' : 's'} awaiting Founder approval.
        </Alert>
      )}

      <MobilePaper>
        <ResponsiveTableContainer>
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
                      <MobileTextField
                        select
                        size="small"
                        value={s.role}
                        onChange={(e) => changeRole(s, e.target.value)}
                        options={ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))}
                      />
                    </TableCell>
                    <TableCell>
                      {s.employee_name ? (
                        <Chip size="small" label={s.employee_name} onClick={() => openLinkDialog(s)} variant="outlined" />
                      ) : (
                        <MobileButton size="small" startIcon={<LinkIcon fontSize="small" />} onClick={() => openLinkDialog(s)}>
                          Link to employee
                        </MobileButton>
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
                <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No team logins yet besides your own.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create a login</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField
              fullWidth
              select
              label="Link to employee (optional)"
              value={form.employee_id}
              onChange={(e) => handleEmployeePick(e.target.value)}
              helperText="Picking an employee links this login so their profile, payslips, and leave show up correctly."
              options={[{ value: '', label: 'Not linked to an employee' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
            <MobileTextField fullWidth label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <MobileTextField fullWidth label="Temporary password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} helperText="Share this with them securely — they should change it after first login." />
            <MobileTextField
              fullWidth
              select
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))}
            />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={saving || !form.email || !form.password}>
            {saving ? 'Creating…' : 'Create login'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Link {linkTarget?.email} to an employee</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField
              fullWidth
              select
              label="Employee"
              value={linkEmployeeId}
              onChange={(e) => setLinkEmployeeId(e.target.value)}
              helperText="This unlocks their self-service profile — payslips, leave balance, and their own record."
              options={[{ value: '', label: 'Not linked to an employee' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setLinkTarget(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={saveLink} disabled={linking}>{linking ? 'Saving…' : 'Save'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}