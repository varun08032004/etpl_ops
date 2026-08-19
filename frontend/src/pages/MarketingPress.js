import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Link,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
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

const SENTIMENT_COLOR = { positive: 'success', neutral: 'default', negative: 'error' };
const TYPES = ['article', 'interview', 'podcast', 'award', 'backlink', 'other'];

const emptyForm = { title: '', publication: '', mention_type: 'article', url: '', published_date: '', sentiment: 'neutral', notes: '' };

export default function MarketingPress() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Press & Media</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Coverage, interviews, podcasts, awards — useful for investor updates too.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add mention</MobileButton>}
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
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
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{m.published_date?.slice(0, 10) || '—'}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{m.title}</Typography>
                    {m.url && <Link href={m.url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>View</Link>}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{m.publication || '—'}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', textTransform: 'capitalize' }}>{m.mention_type}</TableCell>
                  <TableCell><Chip size="small" label={m.sentiment} color={SENTIMENT_COLOR[m.sentiment]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(m)}>Edit</MobileButton>}
                      {canEdit && <MobileButton size="small" color="error" onClick={() => handleDelete(m)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!mentions.length && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No press mentions logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} press mention</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <MobileTextField fullWidth label="Publication" value={form.publication} onChange={(e) => setForm({ ...form, publication: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Type"
              value={form.mention_type}
              onChange={(e) => setForm({ ...form, mention_type: e.target.value })}
              options={TYPES.map((t) => ({ value: t, label: t }))}
            />
            <MobileTextField fullWidth label="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Published date" InputLabelProps={{ shrink: true }} value={form.published_date} onChange={(e) => setForm({ ...form, published_date: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Sentiment"
              value={form.sentiment}
              onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
              options={[
                { value: 'positive', label: 'Positive' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'negative', label: 'Negative' },
              ]}
            />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}