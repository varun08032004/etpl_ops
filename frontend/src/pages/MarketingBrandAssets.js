import { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, IconButton, Tooltip, ToggleButtonGroup, ToggleButton, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import InsertLinkOutlinedIcon from '@mui/icons-material/InsertLinkOutlined';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const ASSET_TYPES = ['logo', 'brand_guideline', 'template', 'photo', 'video', 'presentation', 'one_pager', 'press_kit', 'other'];
const TYPE_LABEL = { brand_guideline: 'Brand guideline', one_pager: 'One-pager', press_kit: 'Press kit' };

const emptyForm = { title: '', asset_type: 'logo', external_url: '', description: '', tags: '' };

export default function MarketingBrandAssets() {
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;
  const canDelete = staff?.role === 'owner';

  const [assets, setAssets] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('link'); // 'link' | 'upload'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    const params = typeFilter ? { asset_type: typeFilter } : {};
    client.get('/marketing/brand-assets', { params }).then(({ data }) => setAssets(data.assets)).catch(() => setAssets([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter]);

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
    setSource('link');
    setFile(null);
    setError('');
    setOpen(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({
      title: a.title, asset_type: a.asset_type, external_url: a.external_url || '',
      description: a.description || '', tags: (a.tags || []).join(', '),
    });
    setSource(a.document_id ? 'upload' : 'link');
    setFile(null);
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (source === 'upload' && !editingId && !file) {
      setError('Choose a file to upload, or switch to "Link" instead');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // 1. Create/update the asset's metadata row first.
      const payload = { ...form, external_url: source === 'link' ? form.external_url : '' };
      let asset;
      if (editingId) {
        ({ data: { asset } } = await client.put(`/marketing/brand-assets/${editingId}`, payload));
      } else {
        ({ data: { asset } } = await client.post('/marketing/brand-assets', payload));
      }

      // 2. If a new file was picked, upload it via the existing Documents module,
      //    then link it back onto the asset.
      if (source === 'upload' && file) {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', form.title);
        fd.append('doc_type', form.asset_type);
        fd.append('entity_type', 'marketing_asset');
        fd.append('entity_id', asset.id);
        const { data: { document } } = await client.post('/documents', fd);
        await client.put(`/marketing/brand-assets/${asset.id}`, { document_id: document.id });
        setUploading(false);
      }

      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleOpenFile = async (a) => {
    try {
      const { data } = await client.get(`/documents/${a.document_id}/download`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to open file');
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/brand-assets/${a.id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Brand Assets</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Logo pack, brand guidelines, templates, and press kit — one link for the whole team to reuse.
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add asset</Button>}
      </Box>

      <TextField
        select size="small" label="Filter type" value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)} sx={{ mb: 2, minWidth: 200 }}
      >
        <MenuItem value="">All types</MenuItem>
        {ASSET_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{TYPE_LABEL[t] || t}</MenuItem>)}
      </TextField>

      <Grid container spacing={2}>
        {assets.map((a) => (
          <Grid item xs={12} sm={6} md={4} key={a.id}>
            <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {a.asset_type === 'photo' || a.asset_type === 'video' || a.asset_type === 'logo' ? (
                  <ImageOutlinedIcon sx={{ color: 'primary.main' }} />
                ) : (
                  <DescriptionOutlinedIcon sx={{ color: 'primary.main' }} />
                )}
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }} noWrap>{a.title}</Typography>
              </Box>
              <Chip size="small" label={TYPE_LABEL[a.asset_type] || a.asset_type} sx={{ textTransform: 'capitalize', width: 'fit-content' }} />
              {a.description && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{a.description}</Typography>}
              {!!(a.tags && a.tags.length) && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {a.tags.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                </Box>
              )}
              {a.document_file_name && (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>File: {a.document_file_name}</Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 1 }}>
                {a.external_url ? (
                  <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} href={a.external_url} target="_blank" rel="noopener noreferrer">
                    Open
                  </Button>
                ) : a.document_id ? (
                  <Button size="small" endIcon={<UploadFileOutlinedIcon sx={{ fontSize: 14 }} />} onClick={() => handleOpenFile(a)}>
                    Open file
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
        ))}
        {!assets.length && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              No brand assets added yet. {canEdit ? 'Add your logo pack or guidelines above.' : ''}
            </Paper>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} brand asset</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" margin="normal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth select label="Type" margin="normal" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
            {ASSET_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{TYPE_LABEL[t] || t}</MenuItem>)}
          </TextField>

          <ToggleButtonGroup fullWidth exclusive size="small" value={source} onChange={(e, v) => v && setSource(v)} sx={{ mt: 2 }}>
            <ToggleButton value="link"><InsertLinkOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />Link</ToggleButton>
            <ToggleButton value="upload"><UploadFileOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />Upload file</ToggleButton>
          </ToggleButtonGroup>

          {source === 'link' ? (
            <TextField fullWidth label="Link (Drive, Canva, Figma, etc.)" margin="normal" value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} />
          ) : (
            <Box sx={{ mt: 2 }}>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button fullWidth variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => fileInputRef.current?.click()}>
                {file ? file.name : 'Choose file (max 20MB)'}
              </Button>
              {editingId && !file && (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                  Leave empty to keep the currently attached file.
                </Typography>
              )}
              {uploading && <LinearProgress sx={{ mt: 1 }} />}
            </Box>
          )}

          <TextField fullWidth label="Description" margin="normal" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField fullWidth label="Tags (comma separated)" margin="normal" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.title}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}