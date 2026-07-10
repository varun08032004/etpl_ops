import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import StatusChip from '../components/StatusChip';

const ROLES = ['admin', 'hr', 'finance', 'manager', 'employee'];

export default function Team() {
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'employee' });

  const load = () => client.get('/staff-accounts').then(({ data }) => setStaff(data.staff)).catch(() => setStaff([]));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/staff-accounts', form);
      setOpen(false);
      setForm({ email: '', password: '', role: 'employee' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    await client.post(`/staff-accounts/${s.id}/${s.is_active ? 'deactivate' : 'reactivate'}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Team logins</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Create login</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Last login</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.email}</TableCell>
                <TableCell><StatusChip status={s.role} /></TableCell>
                <TableCell className="figure">{s.last_login ? new Date(s.last_login).toLocaleString() : 'Never'}</TableCell>
                <TableCell><Switch checked={s.is_active} onChange={() => toggleActive(s)} size="small" /></TableCell>
              </TableRow>
            ))}
            {!staff.length && (
              <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No team logins yet besides your own.</TableCell></TableRow>
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
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
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
    </Box>
  );
}
