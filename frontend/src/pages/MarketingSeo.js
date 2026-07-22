import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = { snapshot_date: '', organic_traffic: '', domain_authority: '', indexed_pages: '', backlinks: '', top_keyword: '', top_keyword_rank: '', notes: '' };

export default function MarketingSeo() {
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [snapshots, setSnapshots] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/marketing/seo').then(({ data }) => setSnapshots(data.snapshots)).catch(() => setSnapshots([]));
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
    date: s.snapshot_date?.slice(0, 10), traffic: s.organic_traffic,
  }));

  const latest = snapshots[0];

  const openCreate = () => { setForm(emptyForm); setError(''); setOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/marketing/seo', form);
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
    await client.delete(`/marketing/seo/${s.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">SEO / Website</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            ethertrack.in organic performance — log a snapshot from GA4 / Search Console / Ahrefs periodically.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Log snapshot</Button>}
      </Box>

      {latest && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, minWidth: 160 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Organic traffic</Typography>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{latest.organic_traffic}</Typography>
          </Paper>
          {latest.domain_authority != null && (
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Domain authority</Typography>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{latest.domain_authority}</Typography>
            </Paper>
          )}
          {latest.backlinks != null && (
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Backlinks</Typography>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{latest.backlinks}</Typography>
            </Paper>
          )}
          {latest.top_keyword && (
            <Paper sx={{ p: 2, minWidth: 200 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Top keyword</Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{latest.top_keyword} {latest.top_keyword_rank ? `(#${latest.top_keyword_rank})` : ''}</Typography>
            </Paper>
          )}
        </Box>
      )}

      {chartData.length > 1 && (
        <Paper sx={{ p: 2, mb: 3, height: 260 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Organic traffic trend</Typography>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="traffic" stroke="#2FBF71" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Organic traffic</TableCell>
              <TableCell align="right">Domain authority</TableCell>
              <TableCell align="right">Indexed pages</TableCell>
              <TableCell align="right">Backlinks</TableCell>
              <TableCell>Top keyword</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshots.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{s.snapshot_date?.slice(0, 10)}</TableCell>
                <TableCell align="right" className="figure">{s.organic_traffic}</TableCell>
                <TableCell align="right" className="figure">{s.domain_authority ?? '—'}</TableCell>
                <TableCell align="right" className="figure">{s.indexed_pages ?? '—'}</TableCell>
                <TableCell align="right" className="figure">{s.backlinks ?? '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{s.top_keyword ? `${s.top_keyword}${s.top_keyword_rank ? ` (#${s.top_keyword_rank})` : ''}` : '—'}</TableCell>
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
        <DialogTitle>Log SEO snapshot</DialogTitle>
        <DialogContent>
          <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} margin="normal" value={form.snapshot_date} onChange={(e) => setForm({ ...form, snapshot_date: e.target.value })} />
          <TextField fullWidth type="number" label="Organic traffic (monthly sessions)" margin="normal" value={form.organic_traffic} onChange={(e) => setForm({ ...form, organic_traffic: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="number" label="Domain authority" margin="normal" value={form.domain_authority} onChange={(e) => setForm({ ...form, domain_authority: e.target.value })} />
            <TextField fullWidth type="number" label="Indexed pages" margin="normal" value={form.indexed_pages} onChange={(e) => setForm({ ...form, indexed_pages: e.target.value })} />
          </Box>
          <TextField fullWidth type="number" label="Backlinks" margin="normal" value={form.backlinks} onChange={(e) => setForm({ ...form, backlinks: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth label="Top keyword" margin="normal" value={form.top_keyword} onChange={(e) => setForm({ ...form, top_keyword: e.target.value })} />
            <TextField fullWidth type="number" label="Rank" margin="normal" value={form.top_keyword_rank} onChange={(e) => setForm({ ...form, top_keyword_rank: e.target.value })} />
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