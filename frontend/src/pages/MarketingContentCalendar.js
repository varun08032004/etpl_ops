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

const STATUS_COLOR = { idea: 'default', draft: 'warning', scheduled: 'info', published: 'success', cancelled: 'error' };
const CONTENT_TYPES = ['post', 'reel', 'video', 'story', 'blog', 'email', 'ad', 'press_release', 'other'];
const PLATFORMS = ['instagram', 'twitter', 'linkedin', 'facebook', 'youtube', 'tiktok', 'threads', 'pinterest', 'website', 'other'];

const emptyForm = {
  title: '', content_type: 'post', platform: '', social_account_id: '', campaign_id: '',
  scheduled_date: '', status: 'idea', caption: '', link_url: '', assigned_to: '', notes: '',
};

export default function MarketingContentCalendar() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/marketing/content-calendar', { params }).then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  useEffect(() => {
    client.get('/marketing/social-accounts').then(({ data }) => setAccounts(data.accounts)).catch(() => setAccounts([]));
    client.get('/marketing/campaigns').then(({ data }) => setCampaigns(data.campaigns)).catch(() => setCampaigns([]));
    client.get('/employees').then(({ data }) => setEmployees(data.employees || data || [])).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsMarketingHead(!!(dept?.isHOD && dept?.departmentName === 'Marketing'));
      })
      .catch(() => setIsMarketingHead(false));
  }, [staff?.role]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title, content_type: item.content_type, platform: item.platform || '',
      social_account_id: item.social_account_id || '', campaign_id: item.campaign_id || '',
      scheduled_date: item.scheduled_date?.slice(0, 10) || '', status: item.status,
      caption: item.caption || '', link_url: item.link_url || '', assigned_to: item.assigned_to || '',
      notes: item.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await client.put(`/marketing/content-calendar/${editingId}`, form);
      } else {
        await client.post('/marketing/content-calendar', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/content-calendar/${item.id}`);
    load();
  };

  const employeeList = Array.isArray(employees) ? employees : [];

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Content Calendar</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            What's going out, on which platform, and who owns it.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New item</MobileButton>}
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          select
          size="small"
          label="Filter status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...Object.keys(STATUS_COLOR).map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
        />
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Platform / handle</TableCell>
                <TableCell>Campaign</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned to</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.scheduled_date?.slice(0, 10) || '—'}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{item.title}</Typography>
                    {item.link_url && (
                      <Link href={item.link_url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
                        View link
                      </Link>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', textTransform: 'capitalize' }}>{item.content_type?.replace('_', ' ')}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                    {item.platform ? <Chip size="small" label={item.platform} sx={{ textTransform: 'capitalize', mr: 0.5 }} /> : null}
                    {item.account_name || ''}
                  </TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.campaign_name || '—'}</TableCell>
                  <TableCell><Chip size="small" label={item.status} color={STATUS_COLOR[item.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.assignee_name || '—'}</TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(item)}>Edit</MobileButton>}
                      {canEdit && <MobileButton size="small" color="error" onClick={() => handleDelete(item)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!items.length && (
                <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nothing on the calendar yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'New'} content item</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Content type"
              value={form.content_type}
              onChange={(e) => setForm({ ...form, content_type: e.target.value })}
              options={CONTENT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Platform"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              options={[{ value: '', label: '—' }, ...PLATFORMS.map((p) => ({ value: p, label: p }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Social account"
              value={form.social_account_id}
              onChange={(e) => setForm({ ...form, social_account_id: e.target.value })}
              options={[{ value: '', label: '—' }, ...accounts.map((a) => ({ value: a.id, label: `${a.display_name} (${a.platform})` }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Campaign"
              value={form.campaign_id}
              onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
              options={[{ value: '', label: '—' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <MobileTextField fullWidth type="date" label="Scheduled date" InputLabelProps={{ shrink: true }} value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={Object.keys(STATUS_COLOR).map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Assigned to"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              options={[{ value: '', label: '—' }, ...employeeList.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
            <MobileTextField fullWidth label="Caption / copy" multiline rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            <MobileTextField fullWidth label="Link URL" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.title}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}