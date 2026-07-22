import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, IconButton, Avatar, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VerifiedIcon from '@mui/icons-material/Verified';
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
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;
  const canDelete = staff?.role === 'owner';

  const [accounts, setAccounts] = useState([]);
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

  const handleDelete = async (a) => {
    if (!window.confirm(`Remove "${a.display_name}" (${PLATFORM_META[a.platform]?.label})? This cannot be undone.`)) return;
    await client.delete(`/marketing/social-accounts/${a.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Socials</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Portfolio of every social/handle the company runs — followers, links, and ownership.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add account</Button>}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Accounts tracked</Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{totals.accounts}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Combined followers</Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }} className="figure">{formatCount(totals.followers)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {accounts.map((a) => {
          const meta = PLATFORM_META[a.platform] || PLATFORM_META.other;
          const Icon = meta.icon;
          return (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: meta.color, width: 40, height: 40 }}>
                    <Icon sx={{ fontSize: 22 }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }} noWrap>{a.display_name}</Typography>
                      {a.is_verified && <VerifiedIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }} noWrap>
                      {meta.label}{a.handle ? ` · ${a.handle}` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" label={a.status} color={STATUS_COLOR[a.status]} sx={{ textTransform: 'capitalize' }} />
                </Box>

                {a.bio && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{a.bio}</Typography>
                )}

                <Box sx={{ display: 'flex', gap: 3, mt: 0.5 }}>
                  <Box>
                    <Typography className="figure" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCount(a.followers_count)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Followers</Typography>
                  </Box>
                  <Box>
                    <Typography className="figure" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCount(a.following_count)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Following</Typography>
                  </Box>
                  <Box>
                    <Typography className="figure" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCount(a.posts_count)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Posts</Typography>
                  </Box>
                </Box>

                {a.owner_name && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Managed by {a.owner_name}</Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 1 }}>
                  {a.profile_url ? (
                    <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} href={a.profile_url} target="_blank" rel="noopener noreferrer">
                      Visit
                    </Button>
                  ) : <span />}
                  <Box>
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
              </Paper>
            </Grid>
          );
        })}
        {!accounts.length && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              No social accounts tracked yet. {canEdit ? 'Add your first one above.' : ''}
            </Paper>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} social account</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Platform" margin="normal" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {Object.entries(PLATFORM_META).map(([value, meta]) => (
              <MenuItem key={value} value={value}>{meta.label}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Display name" margin="normal" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <TextField fullWidth label="Handle (e.g. @ethertrack)" margin="normal" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
          <TextField fullWidth label="Profile URL" margin="normal" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth type="number" label="Followers" margin="normal" value={form.followers_count} onChange={(e) => setForm({ ...form, followers_count: e.target.value })} />
            <TextField fullWidth type="number" label="Following" margin="normal" value={form.following_count} onChange={(e) => setForm({ ...form, following_count: e.target.value })} />
            <TextField fullWidth type="number" label="Posts" margin="normal" value={form.posts_count} onChange={(e) => setForm({ ...form, posts_count: e.target.value })} />
          </Box>
          <TextField fullWidth select label="Status" margin="normal" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
          </TextField>
          <TextField fullWidth select label="Verified badge?" margin="normal" value={form.is_verified ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, is_verified: e.target.value === 'yes' })}>
            <MenuItem value="no">No</MenuItem>
            <MenuItem value="yes">Yes</MenuItem>
          </TextField>
          <TextField fullWidth label="Bio / tagline" margin="normal" multiline rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <TextField fullWidth type="date" label="Stats last updated" InputLabelProps={{ shrink: true }} margin="normal" value={form.last_stats_update} onChange={(e) => setForm({ ...form, last_stats_update: e.target.value })} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.display_name}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}