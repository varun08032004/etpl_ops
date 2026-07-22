import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Link,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const SENTIMENT_COLOR = { positive: 'success', neutral: 'default', negative: 'error' };
const TYPES = ['article', 'interview', 'podcast', 'award', 'backlink', 'other'];

const emptyForm = { title: '', publication: '', mention_type: 'article', url: '', published_date: '', sentiment: 'neutral', notes: '' };

export default function MarketingPress() {
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [mentions, setMentions] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/marketing/press').then(({ data }) => setMentions(data.mentions)).catch(() => setMentions([]));
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

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setError(''); setOpen(true); };
  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({
      title: m.title, publication: m.publication || '', mention_type: m.mention_type, url: m.url || '',
      published_date: m.published_date?.slice(0, 10) || '', sentiment: m.sentiment || 'neutral', notes: m.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/marketing/press/${editingId}`, form);
      else await client.post('/marketing/press', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete "${m.title}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/press/${m.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Press & Media</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Coverage, interviews, podcasts, awards — useful for investor updates too.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add mention</Button>}
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Publication</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Sentiment</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mentions.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="figure" sx={{ fontSize: '0.85rem' }}>{m.published_date?.slice(0, 10) || '—'}</TableCell>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.title}</Typography>
                  {m.url && <Link href={m.url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.75rem' }}>View</Link>}
                </TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>{m.publication || '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{m.mention_type}</TableCell>
                <TableCell><Chip size="small" label={m.sentiment} color={SENTIMENT_COLOR[m.sentiment]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell align="right">
                  {canEdit && <Button size="small" onClick={() => openEdit(m)}>Edit</Button>}
                  {canEdit && <Button size="small" color="error" onClick={() => handleDelete(m)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!mentions.length && (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No press mentions logged yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} press mention</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth label="Publication" margin="normal" value={form.publication} onChange={(e) => setForm({ ...form, publication: e.target.value })} />
          <TextField fullWidth select label="Type" margin="normal" value={form.mention_type} onChange={(e) => setForm({ ...form, mention_type: e.target.value })}>
            {TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="URL" margin="normal" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <TextField fullWidth type="date" label="Published date" InputLabelProps={{ shrink: true }} margin="normal" value={form.published_date} onChange={(e) => setForm({ ...form, published_date: e.target.value })} />
          <TextField fullWidth select label="Sentiment" margin="normal" value={form.sentiment} onChange={(e) => setForm({ ...form, sentiment: e.target.value })}>
            <MenuItem value="positive">Positive</MenuItem>
            <MenuItem value="neutral">Neutral</MenuItem>
            <MenuItem value="negative">Negative</MenuItem>
          </TextField>
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}