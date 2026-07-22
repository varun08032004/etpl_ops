import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import client from '../api/client';

const STAGE_COLOR = {
  prospect: 'default', contacted: 'info', meeting_scheduled: 'info', demo_done: 'primary',
  partnership_discussion: 'warning', active_partner: 'success', dormant: 'default', dead: 'error',
};
const ACTIVITY_TYPES = ['cold_call', 'follow_up_call', 'email', 'meeting', 'demo', 'other'];
const emptyActivity = { activity_type: 'follow_up_call', activity_date: '', outcome: '', next_follow_up_date: '' };

function daysOverdue(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today - d) / 86400000);
}

export default function PartnershipFollowUps() {
  const [due, setDue] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logFirm, setLogFirm] = useState(null);
  const [form, setForm] = useState(emptyActivity);
  const [saving, setSaving] = useState(false);

  const load = () => client.get('/partnerships/activities/due').then(({ data }) => setDue(data.due)).catch(() => setDue([]));
  useEffect(() => { load(); }, []);

  const openLog = (row) => {
    setLogFirm(row);
    setForm(emptyActivity);
    setLogOpen(true);
  };

  const handleLog = async () => {
    setSaving(true);
    try {
      await client.post('/partnerships/activities', { ...form, firm_id: logFirm.firm_id });
      setLogOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to log activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Follow-ups Today</Typography>
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 3 }}>
        Every firm whose next scheduled call is today or overdue — log the call here to clear it off this list and set the next one.
      </Typography>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Firm</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>BDE</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Last outcome</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {due.map((row) => {
              const overdue = daysOverdue(row.next_follow_up_date);
              return (
                <TableRow key={row.firm_id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{row.firm_name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{row.firm_type?.replace(/_/g, ' ')}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {row.contact_name && <div>{row.contact_name}</div>}
                    {row.phone && <div>{row.phone}</div>}
                  </TableCell>
                  <TableCell><Chip size="small" label={row.stage.replace(/_/g, ' ')} color={STAGE_COLOR[row.stage]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{row.bde_name || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={overdue > 0 ? `${overdue}d overdue` : 'Due today'}
                      color={overdue > 0 ? 'error' : 'warning'}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', maxWidth: 220 }}>{row.outcome || '—'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" onClick={() => openLog(row)}>Log call</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!due.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nothing due — you're caught up.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log call — {logFirm?.firm_name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Type" margin="normal" value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })}>
            {ACTIVITY_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} margin="normal" value={form.activity_date} onChange={(e) => setForm({ ...form, activity_date: e.target.value })} />
          <TextField fullWidth multiline rows={2} label="Outcome / notes" margin="normal" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
          <TextField fullWidth type="date" label="Next follow-up date" InputLabelProps={{ shrink: true }} margin="normal" value={form.next_follow_up_date} onChange={(e) => setForm({ ...form, next_follow_up_date: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLog} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}