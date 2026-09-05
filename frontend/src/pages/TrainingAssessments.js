import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, Tabs, Tab, TextField, InputAdornment,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, Archive, DragIndicator,
  ExpandMore, School, MenuBook,
  Article, VideoLibrary, Link,
  Assignment, Quiz,
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

const LESSON_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Document' },
  { value: 'external_resource', label: 'External Resource' },
  { value: 'practical_exercise', label: 'Practical Exercise' },
  { value: 'assessment', label: 'Assessment' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'placeholder', label: 'Placeholder' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'published', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function TrainingAssessments() {
  const { courseId, moduleId, programmeId } = useParams();
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [assessments, setAssessments] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', passing_score_pct: '', max_attempts: 3, time_limit_minutes: '', randomize_questions: true, randomize_options: true, show_correct_answers: false, show_explanations: false, status: 'draft' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let url = '/training/assessments';
    if (courseId) url = `/training/courses/${courseId}/assessments`;
    else if (moduleId) url = `/training/modules/${moduleId}/assessments`;
    else if (programmeId) url = `/training/programmes/${programmeId}/final-assessment`;
    const { data } = await client.get(url);
    setAssessments(data.assessments);
  }, [courseId, moduleId, programmeId]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ title: '', description: '', passing_score_pct: '', max_attempts: 3, time_limit_minutes: '', randomize_questions: true, randomize_options: true, show_correct_answers: false, show_explanations: false, status: 'draft' }); setEditId(null); setError(''); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (a) => { setForm({ ...a }); setEditId(a.id); setError(''); setOpen(true); };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await client.put(`/training/assessments/${editId}`, form);
      } else if (courseId) {
        await client.post(`/training/courses/${courseId}/assessments`, form);
      } else if (moduleId) {
        await client.post(`/training/modules/${moduleId}/assessments`, form);
      } else if (programmeId) {
        await client.post(`/training/programmes/${programmeId}/final-assessment`, form);
      }
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this assessment?')) return;
    try {
      const { data: [a] } = await client.get(`/training/assessments/${id}`);
      await client.put(`/training/assessments/${id}`, { ...a, status: 'archived' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to archive');
    }
  };

  const setFormValue = (key) => (e) => {
    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [key]: value });
  };

  const getParentTitle = () => {
    if (courseId) return 'Course Assessments';
    if (moduleId) return 'Module Assessments';
    if (programmeId) return 'Final Assessment';
    return 'Assessments';
  };

  const getBackUrl = () => {
    if (courseId) return `/training/courses/${courseId}`;
    if (moduleId) return `/training/modules/${moduleId}`;
    if (programmeId) return `/training/programmes/${programmeId}`;
    return '/training/programmes';
  };

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>{getParentTitle()}</Typography>
        </Box>
        <MobileStack gap={1} direction="row">
          {staff.role === 'owner' && <MobileButton variant="contained" startIcon={<Add />} onClick={openCreate}>Create Assessment</MobileButton>}
          <MobileButton variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(getBackUrl())}>Back</MobileButton>
        </MobileStack>
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Assessment</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Passing %</TableCell>
                <TableCell>Max Attempts</TableCell>
                <TableCell>Time Limit</TableCell>
                <TableCell>Questions</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.description}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={a.course_id ? 'Course' : a.module_id ? 'Module' : 'Final'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell><StatusChip status={a.status} /></TableCell>
                  <TableCell className="figure">{a.passing_score_pct || '—'}</TableCell>
                  <TableCell className="figure">{a.max_attempts || 'Unlimited'}</TableCell>
                  <TableCell className="figure">{a.time_limit_minutes ? `${a.time_limit_minutes} min` : 'No limit'}</TableCell>
                  <TableCell className="figure">{a.question_count || 0}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Manage Questions">
                      <IconButton size="small" onClick={() => navigate(`/training/assessments/${a.id}/questions`)}><Quiz fontSize="small" /></IconButton>
                    </Tooltip>
                    {staff.role === 'owner' && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(a)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Archive">
                          <IconButton size="small" color="warning" onClick={() => handleArchive(a.id)}><Archive fontSize="small" /></IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!assessments.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No assessments yet. {staff.role === 'owner' ? 'Click "Create Assessment" to add one.' : ''}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? 'Edit Assessment' : 'Create Assessment'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Title" value={form.title} onChange={setFormValue('title')} required />
            <MobileTextField fullWidth label="Description" multiline rows={3} value={form.description} onChange={setFormValue('description')} />
            <MobileTextField fullWidth type="number" step="0.01" label="Passing Score %" value={form.passing_score_pct} onChange={setFormValue('passing_score_pct')} />
            <MobileTextField fullWidth type="number" label="Max Attempts" value={form.max_attempts} onChange={setFormValue('max_attempts')} />
            <MobileTextField fullWidth type="number" label="Time Limit (minutes)" value={form.time_limit_minutes} onChange={setFormValue('time_limit_minutes')} placeholder="Leave blank for no limit" />
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <label><input type="checkbox" checked={form.randomize_questions} onChange={setFormValue('randomize_questions')} /> Randomize Questions</label>
              <label><input type="checkbox" checked={form.randomize_options} onChange={setFormValue('randomize_options')} /> Randomize Options</label>
              <label><input type="checkbox" checked={form.show_correct_answers} onChange={setFormValue('show_correct_answers')} /> Show Correct Answers After Submit</label>
              <label><input type="checkbox" checked={form.show_explanations} onChange={setFormValue('show_explanations')} /> Show Explanations</label>
            </Box>
            <MobileTextField fullWidth select label="Status" value={form.status} onChange={setFormValue('status')} options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))} />
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