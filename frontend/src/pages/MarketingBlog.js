import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Link,
  Tabs, Tab, Grid, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SyncIcon from '@mui/icons-material/Sync';
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
  useMobile,
} from '../components/MobileResponsive';

const STATUS_COLOR = { draft: 'default', in_review: 'warning', scheduled: 'info', published: 'success', archived: 'default' };
const STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived'];
const CATEGORIES = ['brsr', 'ghg', 'tcfd', 'cdp', 'gri', 'esg_general', 'company_news', 'product_updates', 'other'];
const CATEGORY_LABEL = {
  brsr: 'BRSR', ghg: 'GHG', tcfd: 'TCFD', cdp: 'CDP', gri: 'GRI',
  esg_general: 'ESG (general)', company_news: 'Company news', product_updates: 'Product updates', other: 'Other',
};

const emptyForm = {
  title: '', slug: '', excerpt: '', content: '', category: 'other', tags: '', status: 'draft',
  author_employee_id: '', cover_image_url: '', seo_title: '', seo_description: '', published_url: '',
  scheduled_date: '', published_at: '', view_count: '', notes: '',
};

function slugify(title) {
  return String(title || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function MarketingBlog() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [posts, setPosts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('write');
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncError, setSyncError] = useState('');

  const load = () => {
    const params = statusFilter ? { status: statusFilter } : {};
    client.get('/marketing/blog', { params }).then(({ data }) => setPosts(data.posts)).catch(() => setPosts([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
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

  const totals = posts.reduce((acc, p) => {
    acc.total++;
    if (p.status === 'published') acc.published++;
    if (p.status === 'draft' || p.status === 'in_review') acc.inProgress++;
    return acc;
  }, { total: 0, published: 0, inProgress: 0 });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setTab('write');
    setError('');
    setOpen(true);
  };

  const openEdit = async (p) => {
    setEditingId(p.id);
    setSlugTouched(true);
    setTab('write');
    setError('');
    setOpen(true);
    try {
      const { data } = await client.get(`/marketing/blog/${p.id}`);
      const post = data.post;
      setForm({
        title: post.title, slug: post.slug || '', excerpt: post.excerpt || '', content: post.content || '',
        category: post.category, tags: (post.tags || []).join(', '), status: post.status,
        author_employee_id: post.author_employee_id || '', cover_image_url: post.cover_image_url || '',
        seo_title: post.seo_title || '', seo_description: post.seo_description || '', published_url: post.published_url || '',
        scheduled_date: post.scheduled_date?.slice(0, 10) || '', published_at: post.published_at?.slice(0, 10) || '',
        view_count: post.view_count ?? '', notes: post.notes || '',
      });
    } catch {
      setError('Failed to load post content');
    }
  };

  const handleTitleChange = (title) => {
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/marketing/blog/${editingId}`, form);
      else await client.post('/marketing/blog', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncAnalytics = async (p) => {
    setSyncingId(p.id);
    setSyncError('');
    try {
      const { data } = await client.post(`/marketing/blog/${p.id}/sync-analytics`);
      if (data.warnings?.length) setSyncError(`${p.title}: ${data.warnings.join(' · ')}`);
      load();
    } catch (err) {
      setSyncError(`${p.title}: ${err.response?.data?.error || 'Sync failed'}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllAnalytics = async () => {
    setSyncingAll(true);
    setSyncError('');
    try {
      const { data } = await client.post('/marketing/blog/sync-all-analytics');
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length) setSyncError(failed.map((f) => f.error).join(' · '));
      load();
    } catch (err) {
      setSyncError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/blog/${p.id}`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Blog</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Write and manage ethertrack.in blog posts — BRSR/GHG/TCFD/CDP/GRI explainers, product updates, company news.
          </Typography>
        </Box>
        <MobileStack gap={1} direction="row" flexWrap="wrap">
          {canEdit && (
            <MobileButton
              variant="outlined"
              startIcon={syncingAll ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={handleSyncAllAnalytics}
              disabled={syncingAll}
            >
              {syncingAll ? 'Syncing…' : 'Sync analytics'}
            </MobileButton>
          )}
          {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New post</MobileButton>}
        </MobileStack>
      </MobilePageHeader>

      {syncError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSyncError('')}>{syncError}</Alert>}

      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total posts</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.total}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Published</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.published}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>In progress</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }} className="figure">{totals.inProgress}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          select
          size="small"
          label="Filter status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
        />
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Clicks</TableCell>
                <TableCell align="right">Impressions</TableCell>
                <TableCell align="right">Views</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{p.title}</Typography>
                    {p.published_url && (
                      <Link href={p.published_url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                        View live <OpenInNewIcon sx={{ fontSize: 12 }} />
                      </Link>
                    )}
                  </TableCell>
                  <TableCell><Chip size="small" label={CATEGORY_LABEL[p.category] || p.category} /></TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}>{p.author_name || '—'}</TableCell>
                  <TableCell><Chip size="small" label={p.status.replace('_', ' ')} color={STATUS_COLOR[p.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }}>
                    {(p.published_at || p.scheduled_date)?.slice(0, 10) || '—'}
                  </TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{p.clicks ?? '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{p.impressions ?? '—'}</TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{p.pageviews ?? '—'}</TableCell>
                  <TableCell align="right">
                    <MobileStack gap={1} direction="row">
                      {canEdit && p.status === 'published' && (
                        <Tooltip title={p.analytics_as_of ? `Last synced ${p.analytics_as_of.slice(0, 10)}` : 'Sync analytics'}>
                          <span>
                            <IconButton size="small" onClick={() => handleSyncAnalytics(p)} disabled={syncingId === p.id}>
                              {syncingId === p.id ? <CircularProgress size={16} /> : <SyncIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canEdit && <MobileButton size="small" onClick={() => openEdit(p)}>Edit</MobileButton>}
                      {canEdit && <MobileButton size="small" color="error" onClick={() => handleDelete(p)}>Delete</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!posts.length && (
                <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No blog posts yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'New'} blog post</DialogTitle>
        <DialogContent>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab value="write" label="Write" />
            <Tab value="seo" label="SEO & Publishing" />
          </Tabs>

          {tab === 'write' && (
            <>
              <MobileTextField fullWidth label="Title" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} />
              <MobileTextField
                fullWidth
                label="Slug"
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }}
                helperText={`ethertrack.in/blog/${form.slug || 'your-slug-here'}`}
              />
              <MobileTextField fullWidth label="Excerpt" multiline rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} helperText="Short summary shown on the blog listing page and social shares" />
              <MobileTextField
                fullWidth
                label="Content"
                multiline
                rows={14}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                helperText="Markdown or HTML — whatever your publishing pipeline expects"
                sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
              />
              <MobileStack gap={1.5} direction="row" flexWrap="wrap">
                <MobileTextField
                  fullWidth
                  select
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                />
                <MobileTextField
                  fullWidth
                  select
                  label="Author"
                  value={form.author_employee_id}
                  onChange={(e) => setForm({ ...form, author_employee_id: e.target.value })}
                  options={[{ value: '', label: '— Unassigned —' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
                />
              </MobileStack>
              <MobileTextField fullWidth label="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <MobileTextField fullWidth label="Cover image URL" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
            </>
          )}

          {tab === 'seo' && (
            <>
              <MobileTextField
                fullWidth
                select
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
              />
              <MobileStack gap={1.5} direction="row" flexWrap="wrap">
                <MobileTextField fullWidth type="date" label="Scheduled date" InputLabelProps={{ shrink: true }} value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                <MobileTextField fullWidth type="date" label="Published date" InputLabelProps={{ shrink: true }} value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} helperText="Leave blank to auto-set when you mark it Published" />
              </MobileStack>
              <MobileTextField fullWidth label="Published URL" value={form.published_url} onChange={(e) => setForm({ ...form, published_url: e.target.value })} />
              <MobileTextField fullWidth type="number" label="View count (manual, from GA4)" value={form.view_count} onChange={(e) => setForm({ ...form, view_count: e.target.value })} />
              <MobileTextField
                fullWidth
                label="SEO title"
                value={form.seo_title}
                onChange={(e) => setForm({ ...form, seo_title: e.target.value.slice(0, 70) })}
                helperText={`${form.seo_title.length}/70 characters — Google truncates beyond ~60-70`}
              />
              <MobileTextField
                fullWidth
                label="SEO description"
                multiline
                rows={2}
                value={form.seo_description}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value.slice(0, 160) })}
                helperText={`${form.seo_description.length}/160 characters`}
              />
              <MobileTextField fullWidth label="Internal notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </>
          )}

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