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

const emptyForm = { snapshot_date: '', subscriber_count: '', campaign_title: '', emails_sent: '', open_rate: '', click_rate: '', notes: '' };

function formatCount(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export default function MarketingNewsletter() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Newsletter / Email</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Subscriber growth and campaign performance — log a snapshot whenever you check your ESP (Mailchimp/Resend/etc).
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Log snapshot</MobileButton>}
      </MobilePageHeader>

      {latest && (
        <MobileCardGrid sx={{ mb: 3 }}>
          <MobilePaper>
            <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Current subscribers</Typography>
            <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{latest.subscriber_count}</Typography>
          </MobilePaper>
          {latest.open_rate != null && (
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Last open rate</Typography>
              <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{latest.open_rate}%</Typography>
            </MobilePaper>
          )}
          {latest.click_rate != null && (
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Last click rate</Typography>
              <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{latest.click_rate}%</Typography>
            </MobilePaper>
          )}
        </MobileCardGrid>
      )}

      {chartData.length > 1 && (
        <MobilePaper sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Subscriber growth</Typography>
          <MobileChartContainer>
            <Box sx={{ height: isMobile ? 220 : 260, minWidth: isMobile ? '320px' : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232c26" />
                  <XAxis dataKey="date" stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <YAxis stroke="#8fa398" fontSize={isMobile ? 10 : 11} />
                  <ChartTooltip contentStyle={{ background: '#121815', border: '1px solid #232c26', fontSize: isMobile ? 10 : 12 }} />
                  <Line type="monotone" dataKey="subscribers" stroke="#2fbf71" strokeWidth={2} dot={false} />
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
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.snapshot_date?.slice(0, 10)}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.subscriber_count}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.campaign_title || '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.emails_sent ?? '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.open_rate != null ? `${s.open_rate}%` : '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{s.click_rate != null ? `${s.click_rate}%` : '—'}</TableCell>
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
        <DialogTitle>Log newsletter snapshot</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.snapshot_date} onChange={(e) => setForm({ ...form, snapshot_date: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Subscriber count" value={form.subscriber_count} onChange={(e) => setForm({ ...form, subscriber_count: e.target.value })} />
            <MobileTextField fullWidth label="Campaign title (optional)" value={form.campaign_title} onChange={(e) => setForm({ ...form, campaign_title: e.target.value })} />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Emails sent" value={form.emails_sent} onChange={(e) => setForm({ ...form, emails_sent: e.target.value })} />
            </MobileStack>
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Open rate %" value={form.open_rate} onChange={(e) => setForm({ ...form, open_rate: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Click rate %" value={form.click_rate} onChange={(e) => setForm({ ...form, click_rate: e.target.value })} />
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