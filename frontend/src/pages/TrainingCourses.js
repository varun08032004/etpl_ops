import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, Tabs, Tab, TextField, InputAdornment
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, Archive, DragIndicator,
  School, MenuBook, Settings,
  ArrowBack
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

const emptyForm = { title: '', code: '', description: '', duration_hours: '', passing_score_pct: '', is_mandatory: true, display_order: 0, status: 'placeholder' };

export default function TrainingCourses() {
  const { programmeId } = useParams();
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [courses, setCourses] = useState([]);
  const [programme, setProgramme] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await client.get(`/training/programmes/${programmeId}`);
    setProgramme(data.programme);
    setCourses(data.courses || []);
  }, [programmeId]);

  useEffect(() => { load(); }, [load]);

  const getFilteredCourses = () => {
    let filtered = [...courses].sort((a, b) => a.display_order - b.display_order);
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchLower) ||
        c.code?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      );
    }
    if (selectedTab === 1) filtered = filtered.filter(c => ['published', 'active'].includes(c.status));
    else if (selectedTab === 2) filtered = filtered.filter(c => ['draft', 'placeholder', 'ready_for_review'].includes(c.status));
    else if (selectedTab === 3) filtered = filtered.filter(c => c.status === 'archived');
    return filtered;
  };

  const resetForm = () => { setForm({ ...emptyForm, display_order: courses.length }); setEditId(null); setError(''); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (c) => {
    setForm({ ...c, display_order: c.display_order });
    setEditId(c.id);
    setError('');
    setOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await client.put(`/training/courses/${editId}`, form);
      } else {
        await client.post(`/training/programmes/${programmeId}/courses`, form);
      }
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (id, newOrder) => {
    try {
      await client.post(`/training/courses/${id}/reorder`, { new_order: newOrder });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reorder');
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this course?')) return;
    try {
      const { data: [c] } = await client.get(`/training/courses/${id}`);
      await client.put(`/training/courses/${id}`, { ...c, status: 'archived' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to archive');
    }
  };

  const setFormValue = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>{programme?.title || 'Courses'}</Typography>
          <Typography sx={{ color: 'text.secondary' }}>{programme?.code}</Typography>
        </Box>
        <MobileStack gap={1} direction="row">
          <MobileButton variant="outlined" startIcon={<Add />} onClick={openCreate}>Add Course</MobileButton>
          <MobileButton variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/training/programmes')}>Back</MobileButton>
        </MobileStack>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileTextField
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
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
                <TableCell>Course</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Duration (hrs)</TableCell>
                <TableCell>Modules</TableCell>
                <TableCell>Assessments</TableCell>
                <TableCell>Mandatory</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getFilteredCourses()
                .map((c, idx) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MenuBook sx={{ color: 'primary.main', fontSize: 22 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.title}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.description}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell className="figure">{c.code || '—'}</TableCell>
                    <TableCell><StatusChip status={c.status} /></TableCell>
                    <TableCell className="figure">{c.display_order}</TableCell>
                    <TableCell className="figure">{c.duration_hours || '—'}</TableCell>
                    <TableCell className="figure">{c.module_count || 0}</TableCell>
                    <TableCell className="figure">{c.assessment_count || 0}</TableCell>
                    <TableCell>
                      <Chip label={c.is_mandatory ? 'Yes' : 'No'} size="small" color={c.is_mandatory ? 'primary' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Manage Modules">
                        <IconButton size="small" onClick={() => navigate(`/training/courses/${c.id}/modules`)}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                      {staff.role === 'owner' && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(c)}><Edit fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Reorder">
                            <IconButton size="small" onClick={() => { const newOrder = prompt('New order:', c.display_order); if (newOrder !== null) handleReorder(c.id, parseInt(newOrder)); }}><DragIndicator fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Archive">
                            <IconButton size="small" color="warning" onClick={() => handleArchive(c.id)}><Archive fontSize="small" /></IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {getFilteredCourses().length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    {selectedTab === 3 
                      ? 'No archived courses.' 
                      : 'No courses yet. Click "Add Course" to create the first one.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? 'Edit Course' : 'Add Course'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={setFormValue('title')} required />
            <MobileTextField fullWidth label="Code (e.g. CA-FUND)" value={form.code} onChange={setFormValue('code')} helperText="Unique within programme" />
            <MobileTextField fullWidth label="Description" multiline rows={3} value={form.description} onChange={setFormValue('description')} />
            <MobileTextField fullWidth type="number" step="0.5" label="Duration (hours)" value={form.duration_hours} onChange={setFormValue('duration_hours')} />
            <MobileTextField fullWidth type="number" step="0.01" label="Passing Score %" value={form.passing_score_pct} onChange={setFormValue('passing_score_pct')} />
            <MobileTextField fullWidth type="number" label="Display Order" value={form.display_order} onChange={setFormValue('display_order')} />
            <MobileTextField fullWidth select label="Status" value={form.status} onChange={setFormValue('status')} options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))} />
            <Box sx={{ gridColumn: '1 / -1' }}>
              <label>
                <input type="checkbox" checked={form.is_mandatory} onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })} />
                <span style={{ marginLeft: 8 }}>Mandatory for programme completion</span>
              </label>
            </Box>
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