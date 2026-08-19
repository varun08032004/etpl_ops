import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, IconButton, Avatar, Tooltip, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VerifiedIcon from '@mui/icons-material/Verified';
import SyncIcon from '@mui/icons-material/Sync';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import YouTubeIcon from '@mui/icons-material/YouTube';
import FacebookIcon from '@mui/icons-material/Facebook';
import PinterestIcon from '@mui/icons-material/Pinterest';
import LanguageIcon from '@mui/icons-material/Language';
import TagIcon from '@mui/icons-material/Tag';
import PublicIcon from '@mui/icons-material/Public';
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

const PLATFORM_META = {
  instagram: { label: 'Instagram', icon: InstagramIcon, color: '#E1306C' },
  twitter: { label: 'Twitter / X', icon: TagIcon, color: '#1DA1F2' },
  linkedin: { label: 'LinkedIn', icon: LinkedInIcon, color: '#0A66C2' },
  facebook: { label: 'Facebook', icon: FacebookIcon, color: '#1877F2' },
  youtube: { label: 'YouTube', icon: YouTubeIcon, color: '#FF0000' },
  tiktok: { label: 'TikTok', icon: PublicIcon, color: '#000000' },
  threads: { label: 'Threads', icon: TagIcon, color: '#000000' },
  pinterest: { label: 'Pinterest', icon: PinterestIcon, color: '#E60023' },
  website: { label: 'Website', icon: LanguageIcon, color: '#2FBF71' },
  other: { label: 'Other', icon: PublicIcon, color: '#888888' },
};

const STATUS_COLOR = { active: 'success', inactive: 'default', suspended: 'error' };

function formatCount(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

const emptyForm = {
  platform: 'instagram', display_name: '', handle: '', profile_url: '', followers_count: '',
  following_count: '', posts_count: '', is_verified: false, status: 'active', bio: '',
  last_stats_update: '', notes: '',
};

export default function MarketingSocials() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;
  const canDelete = staff?.role === 'owner';

  const [accounts, setAccounts] = useState([]);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncError, setSyncError] = useState('');
  const SYNCABLE_PLATFORMS = ['instagram', 'twitter', 'youtube'];
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    client.get('/marketing/social-accounts').then(({ data }) => setAccounts(data.accounts)).catch(() => setAccounts([]));
  };
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

  const totals = accounts.reduce((acc, a) => ({
    followers: acc.followers + Number(a.followers_count || 0),
    accounts: acc.accounts + 1,
  }), { followers: 0, accounts: 0 });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({
      platform: a.platform, display_name: a.display_name, handle: a.handle || '',
      profile_url: a.profile_url || '', followers_count: a.followers_count ?? '',
      following_count: a.following_count ?? '', posts_count: a.posts_count ?? '',
      is_verified: !!a.is_verified, status: a.status, bio: a.bio || '',
      last_stats_update: a.last_stats_update?.slice(0, 10) || '', notes: a.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, followers_count: form.followers_count || 0, following_count: form.following_count || 0, posts_count: form.posts_count || 0 };
      if (editingId) {
        await client.put(`/marketing/social-accounts/${editingId}`, payload);
      } else {
        await client.post('/marketing/social-accounts', payload);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (a) => {
    setSyncingId(a.id);
    setSyncError('');
    try {
      await client.post(`/marketing/social-accounts/${a.id}/sync`);
      load();
    } catch (err) {
      setSyncError(`${a.display_name}: ${err.response?.data?.error || 'Sync failed'}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncError('');
    try {
      const { data } = await client.post('/marketing/social-accounts/sync-all');
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length) {
        setSyncError(failed.map((f) => `${f.display_name}: ${f.error}`).join(' · '));
      }
      load();
    } catch (err) {
      setSyncError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Remove "${a.display_name}" (${PLATFORM_META[a.platform]?.label})? This cannot be undone.`)) return;
    await client.delete(`/marketing/social-accounts/${a.id}`);
    load();
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Socials</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Portfolio of every social/handle the company runs — followers, links, and ownership.
          </Typography>
        </Box>
        <MobileStack gap={1} direction="row" flexWrap="wrap">
          {canEdit && (
            <MobileButton
              variant="outlined"
              startIcon={syncingAll ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={handleSyncAll}
              disabled={syncingAll}
            >
              {syncingAll ? 'Syncing…' : 'Sync all'}
            </MobileButton>
          )}
          {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add account</MobileButton>}
        </MobileStack>
      </MobilePageHeader>

      {syncError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSyncError('')}>{syncError}</Alert>}

      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Accounts tracked</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.5rem', fontWeight: 700 }}>{totals.accounts}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Combined followers</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.5rem', fontWeight: 700 }} className="figure">{formatCount(totals.followers)}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      <MobileCardGrid>
        {accounts.map((a) => {
          const meta = PLATFORM_META[a.platform] || PLATFORM_META.other;
          const Icon = meta.icon;
          return (
            <MobilePaper key={a.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Avatar sx={{ bgcolor: meta.color, width: 40, height: 40 }}>
                  <Icon sx={{ fontSize: 22 }} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: isMobile ? '0.85rem' : '0.95rem' }} noWrap>{a.display_name}</Typography>
                    {a.is_verified && <VerifiedIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                  </Box>
                  <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }} noWrap>
                    {meta.label}{a.handle ? ` · ${a.handle}` : ''}
                  </Typography>
                </Box>
                <Chip size="small" label={a.status} color={STATUS_COLOR[a.status]} sx={{ textTransform: 'capitalize' }} />
              </Box>

              {a.bio && (
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary', mb: 1 }}>{a.bio}</Typography>
              )}

              <MobileStack gap={3} direction="row" sx={{ mb: 1 }}>
                <Box>
                  <Typography className="figure" sx={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1.1rem' }}>{formatCount(a.followers_count)}</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.7rem', color: 'text.secondary' }}>Followers</Typography>
                </Box>
                <Box>
                  <Typography className="figure" sx={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1.1rem' }}>{formatCount(a.following_count)}</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.7rem', color: 'text.secondary' }}>Following</Typography>
                </Box>
                <Box>
                  <Typography className="figure" sx={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1.1rem' }}>{formatCount(a.posts_count)}</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.7rem', color: 'text.secondary' }}>Posts</Typography>
                </Box>
              </MobileStack>

              {a.owner_name && (
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Managed by {a.owner_name}</Typography>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 1 }}>
                {a.profile_url ? (
                  <MobileButton size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} href={a.profile_url} target="_blank" rel="noopener noreferrer">
                    Visit
                  </MobileButton>
                ) : <span />}
                <Box>
                  {canEdit && SYNCABLE_PLATFORMS.includes(a.platform) && (
                    <Tooltip title={a.last_stats_update ? `Last synced ${a.last_stats_update.slice(0, 10)}` : 'Sync live stats'}>
                      <span>
                        <IconButton size="small" onClick={() => handleSync(a)} disabled={syncingId === a.id}>
                          {syncingId === a.id ? <CircularProgress size={16} /> : <SyncIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {canEdit && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(a)}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(a)}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </MobilePaper>
          );
        })}
          {!accounts.length && (
            <MobilePaper sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
              No social accounts tracked yet. {canEdit ? 'Add your first one above.' : ''}
            </MobilePaper>
          )}
        </MobileCardGrid>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} social account</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField
              fullWidth
              select
              label="Platform"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              options={Object.entries(PLATFORM_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <MobileTextField fullWidth label="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <MobileTextField fullWidth label="Handle (e.g. @ethertrack)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
            <MobileTextField fullWidth label="Profile URL" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} />
            <MobileStack gap={1.5} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Followers" value={form.followers_count} onChange={(e) => setForm({ ...form, followers_count: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Following" value={form.following_count} onChange={(e) => setForm({ ...form, following_count: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Posts" value={form.posts_count} onChange={(e) => setForm({ ...form, posts_count: e.target.value })} />
            </MobileStack>
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
            <MobileTextField
              fullWidth
              select
              label="Verified badge?"
              value={form.is_verified ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, is_verified: e.target.value === 'yes' })}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            />
            <MobileTextField fullWidth label="Bio / tagline" multiline rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Stats last updated" InputLabelProps={{ shrink: true }} value={form.last_stats_update} onChange={(e) => setForm({ ...form, last_stats_update: e.target.value })} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.display_name}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}