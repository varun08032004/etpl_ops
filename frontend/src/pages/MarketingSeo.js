import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
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
  MobileCardGrid,
  MobileChartContainer,
  useMobile,
} from '../components/MobileResponsive';

const emptyForm = { snapshot_date: '', organic_traffic: '', domain_authority: '', indexed_pages: '', backlinks: '', top_keyword: '', top_keyword_rank: '', notes: '' };

export default function MarketingSeo() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>SEO / Website</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            ethertrack.in organic performance — log a snapshot from GA4 / Search Console / Ahrefs periodically.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Log snapshot</MobileButton>}
      </MobilePageHeader>

      {latest && (
        <MobileCardGrid sx={{ mb: 3 }}>
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Organic traffic</Typography>
            <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{latest.organic_traffic}</Typography>
          </MobilePaper>
          {latest.domain_authority != null && (
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Domain authority</Typography>
              <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{latest.domain_authority}</Typography>
            </MobilePaper>
          )}
          {latest.backlinks != null && (
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Backlinks</Typography>
              <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{latest.backlinks}</Typography>
            </MobilePaper>
          )}
          {latest.top_keyword && (
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Top keyword</Typography>
              <Typography sx={{ fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 700 }}>{latest.top_keyword} {latest.top_keyword_rank ? `(#${latest.top_keyword_rank})` : ''}</Typography>
            </MobilePaper>
          )}
        </MobileCardGrid>
      )}

      {chartData.length > 1 && (
        <MobilePaper sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Organic traffic trend</Typography>
          <MobileChartContainer>
            <Box sx={{ height: isMobile ? 220 : 260, minWidth: isMobile ? '320px' : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                  <XAxis dataKey="date" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  <Line type="monotone" dataKey="traffic" stroke="#2fbf71" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </MobileChartContainer>
        </MobilePaper>
      )}

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
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
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.snapshot_date?.slice(0, 10)}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.organic_traffic}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.domain_authority ?? '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.indexed_pages ?? '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.backlinks ?? '—'}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.top_keyword ? `${s.top_keyword}${s.top_keyword_rank ? ` (#${s.top_keyword_rank})` : ''}` : '—'}</TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" color="error" onClick={() => handleDelete(s)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!snapshots.length && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No snapshots logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log SEO snapshot</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.snapshot_date} onChange={(e) => setForm({ ...form, snapshot_date: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Organic traffic (monthly sessions)" value={form.organic_traffic} onChange={(e) => setForm({ ...form, organic_traffic: e.target.value })} />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Domain authority" value={form.domain_authority} onChange={(e) => setForm({ ...form, domain_authority: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Indexed pages" value={form.indexed_pages} onChange={(e) => setForm({ ...form, indexed_pages: e.target.value })} />
            </MobileStack>
            <MobileTextField fullWidth type="number" label="Backlinks" value={form.backlinks} onChange={(e) => setForm({ ...form, backlinks: e.target.value })} />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth label="Top keyword" value={form.top_keyword} onChange={(e) => setForm({ ...form, top_keyword: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Rank" value={form.top_keyword_rank} onChange={(e) => setForm({ ...form, top_keyword_rank: e.target.value })} />
            </MobileStack>
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}