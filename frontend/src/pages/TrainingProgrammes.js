import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, MenuItem, Alert, Chip, IconButton, Tooltip,
  Tabs, Tab
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, Archive, ContentCopy,
  School, MenuBook, Settings,
  Download
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileDialog, MobileActionButtons, MobileStack, MobileFormGrid,
  ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'placeholder', label: 'Placeholder' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'published', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const emptyForm = {
  title: '', code: '', description: '', duration_weeks: '',
  total_estimated_hours: '', passing_score_pct: '', certificate_template_id: '', status: 'placeholder',
};

export default function TrainingProgrammes() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [programmes, setProgrammes] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  const load = useCallback(async () => {
    const params = search ? { search } : {};
    const { data } = await client.get('/training/programmes', { params });
    setProgrammes(data.programmes);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => { setSearch(e.target.value); load(e.target.value); };

  const resetForm = () => { setForm(emptyForm); setEditId(null); setError(''); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (p) => {
    setForm({
      title: p.title || '', code: p.code || '', description: p.description || '',
      duration_weeks: p.duration_weeks || '', total_estimated_hours: p.total_estimated_hours || '',
      passing_score_pct: p.passing_score_pct || '', certificate_template_id: p.certificate_template_id || '',
      status: p.status || 'placeholder',
    });
    setEditId(p.id);
    setError('');
    setOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await client.put(`/training/programmes/${editId}`, form);
      } else {
        await client.post('/training/programmes', form);
      }
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save programme');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this programme? It will no longer be assignable.')) return;
    try {
      await client.post(`/training/programmes/${id}/archive`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to archive');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const { data: { programme } } = await client.get(`/training/programmes/${id}`);
      const newData = { ...programme, title: `${programme.title} (Copy)`, code: null, status: 'draft', id: undefined, created_at: undefined, updated_at: undefined, archived_at: undefined };
      await client.post('/training/programmes', newData);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to duplicate');
    }
  };

  const handleDownloadProgramme = async (programme) => {
    try {
      const response = await client.get(`/training/programmes/${programme.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${programme.code}-${programme.title.replace(/\s+/g, '-')}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download programme error:', err);
      alert('Failed to download programme');
    }
  };

  const setFormValue = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Programmes</Typography>
        <MobileButton variant="contained" startIcon={<Add />} onClick={openCreate}>Create Programme</MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileTextField
            placeholder="Search programmes…"
            value={search}
            onChange={handleSearch}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
        </MobileStack>
      </MobilePaper>

      <MobilePaper>
        <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tab label="All" />
          <Tab label="Active" />
          <Tab label="Draft / Placeholder" />
          <Tab label="Archived" />
        </Tabs>

        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Programme</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration (weeks)</TableCell>
                <TableCell>Courses</TableCell>
                <TableCell>Assignments</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {programmes
                .filter(p => {
                  if (selectedTab === 1) return ['published', 'active'].includes(p.status);
                  if (selectedTab === 2) return ['draft', 'placeholder', 'ready_for_review'].includes(p.status);
                  if (selectedTab === 3) return p.status === 'archived';
                  return true;
                })
                .map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <School sx={{ color: 'primary.main', fontSize: 22 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.title}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell className="figure">{p.code || '—'}</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                    <TableCell className="figure">{p.duration_weeks || '—'}</TableCell>
                    <TableCell className="figure">{p.course_count || 0}</TableCell>
                    <TableCell className="figure">{p.assignment_count || 0}</TableCell>
                    <TableCell className="figure">{p.created_at?.slice(0, 10)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Download Programme">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDownloadProgramme(p); }}>
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => navigate(`/training/programmes/${p.id}`)}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                      {staff.role === 'owner' && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(p)}><Edit fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicate">
                            <IconButton size="small" onClick={() => handleDuplicate(p.id)}><ContentCopy fontSize="small" /></IconButton>
                          </Tooltip>
                          {p.status !== 'archived' ? (
                            <Tooltip title="Archive">
                              <IconButton size="small" color="warning" onClick={() => handleArchive(p.id)}><Archive fontSize="small" /></IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => { if (window.confirm('Permanently delete?')) handleArchive(p.id); }}><Delete fontSize="small" /></IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {!programmes.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No programmes yet. Click "Create Programme" to start.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? 'Edit Programme' : 'Create Programme'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={setFormValue('title')} required />
            <MobileTextField fullWidth label="Code (e.g. CA-2026)" value={form.code} onChange={setFormValue('code')} helperText="Unique identifier" />
            <MobileTextField fullWidth label="Description" multiline rows={3} value={form.description} onChange={setFormValue('description')} />
            <MobileTextField fullWidth type="number" label="Duration (weeks)" value={form.duration_weeks} onChange={setFormValue('duration_weeks')} helperText="Leave blank if not yet defined" />
            <MobileTextField fullWidth type="number" step="0.5" label="Total Estimated Hours" value={form.total_estimated_hours} onChange={setFormValue('total_estimated_hours')} />
            <MobileTextField fullWidth type="number" step="0.01" label="Passing Score %" value={form.passing_score_pct} onChange={setFormValue('passing_score_pct')} />
            <MobileTextField fullWidth label="Certificate Template Document ID" value={form.certificate_template_id} onChange={setFormValue('certificate_template_id')} helperText="Optional: ID of document to use as certificate template" />
            <MobileTextField
              fullWidth select label="Status" value={form.status} onChange={setFormValue('status')}
              options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
            />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSubmit} disabled={saving || !form.title}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}