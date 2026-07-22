import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = { snapshot_date: '', subscriber_count: '', campaign_title: '', emails_sent: '', open_rate: '', click_rate: '', notes: '' };

export default function MarketingNewsletter() {
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [snapshots, setSnapshots] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/marketing/newsletter').then(({ data }) => setSnapshots(data.snapshots)).catch(() => setSnapshots([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsMarketingHead(!!(dept?.isHOD && dept?.departmentName === 'Marketing'));
      })
      .catch(() => setIsMarketingHead(false));
  }, [staff?.role]);

  const chartData = [...snapshots].reverse().map((s) => ({
    date: s.snapshot_date?.slice(0, 10), subscribers: s.subscriber_count,
  }));

  const latest = snapshots[0];

  const openCreate = () => { setForm(emptyForm); setError(''); setOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/marketing/newsletter', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm('Delete this snapshot?')) return;
    await client.delete(`/marketing/newsletter/${s.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Newsletter / Email</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Subscriber growth and campaign performance — log a snapshot whenever you check your ESP (Mailchimp/Resend/etc).
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Log snapshot</Button>}
      </Box>

      {latest && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, minWidth: 160 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Current subscribers</Typography>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{latest.subscriber_count}</Typography>
          </Paper>
          {latest.open_rate != null && (
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Last open rate</Typography>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{latest.open_rate}%</Typography>
            </Paper>
          )}
          {latest.click_rate != null && (
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Last click rate</Typography>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{latest.click_rate}%</Typography>
            </Paper>
          )}
        </Box>
      )}

      {chartData.length > 1 && (
        <Paper sx={{ p: 2, mb: 3, height: 260 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Subscriber growth</Typography>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="subscribers" stroke="#2FBF71" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Subscribers</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell align="right">Sent</TableCell>
              <TableCell align="right">Open %</TableCell>
              <TableCell align="right">Click %</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshots.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{s.snapshot_date?.slice(0, 10)}</TableCell>
                <TableCell align="right" className="figure">{s.subscriber_count}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{s.campaign_title || '—'}</TableCell>
                <TableCell align="right" className="figure">{s.emails_sent ?? '—'}</TableCell>
                <TableCell align="right" className="figure">{s.open_rate != null ? `${s.open_rate}%` : '—'}</TableCell>
                <TableCell align="right" className="figure">{s.click_rate != null ? `${s.click_rate}%` : '—'}</TableCell>
                <TableCell align="right">
                  {canEdit && <Button size="small" color="error" onClick={() => handleDelete(s)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!snapshots.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No snapshots logged yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log newsletter snapshot</DialogTitle>
        <DialogContent>
          <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} margin="normal" value={form.snapshot_date} onChange={(e) => setForm({ ...form, snapshot_date: e.target.value })} />
          <TextField fullWidth type="number" label="Subscriber count" margin="normal" value={form.subscriber_count} onChange={(e) => setForm({ ...form, subscriber_count: e.target.value })} />
          <TextField fullWidth label="Campaign title (optional)" margin="normal" value={form.campaign_title} onChange={(e) => setForm({ ...form, campaign_title: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="number" label="Emails sent" margin="normal" value={form.emails_sent} onChange={(e) => setForm({ ...form, emails_sent: e.target.value })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="number" label="Open rate %" margin="normal" value={form.open_rate} onChange={(e) => setForm({ ...form, open_rate: e.target.value })} />
            <TextField fullWidth type="number" label="Click rate %" margin="normal" value={form.click_rate} onChange={(e) => setForm({ ...form, click_rate: e.target.value })} />
          </Box>
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}