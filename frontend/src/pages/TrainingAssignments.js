import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, TextField, InputAdornment,
  FormControl, Select
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, Archive, PersonAdd,
  ArrowBack, FilterList
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
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TrainingAssignments() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', programme_id: '', course_id: '', department_id: '' });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ programme_id: '', course_id: '', employee_id: '', department_id: '', start_date: '', due_date: '', assign_to: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = { ...filters };
    if (search) params.search = search;
    const { data } = await client.get('/training/assignments', { params });
    setAssignments(data.assignments);
  }, [filters, search]);

  useEffect(() => {
    load();
    client.get('/employees?status=active').then(({ data }) => setEmployees(data.employees));
    client.get('/training/programmes?status=active').then(({ data }) => setProgrammes(data.programmes));
    client.get('/training/courses?status=active').then(({ data }) => setCourses(data.courses));
    client.get('/departments').then(({ data }) => setDepartments(data.departments));
  }, [load]);

  const resetForm = () => { setForm({ programme_id: '', course_id: '', employee_id: '', department_id: '', start_date: '', due_date: '', assign_to: '' }); setError(''); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/training/assignments', form);
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this assignment?')) return;
    try {
      await client.post(`/training/assignments/${id}/cancel`, { reason: 'Cancelled by admin' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const setFormValue = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const setFilter = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value }); load({ ...filters, [key]: e.target.value }); };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Assignments</Typography>
        <MobileButton variant="contained" startIcon={<Add />} onClick={openCreate}>Assign Training</MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileTextField
            placeholder="Search assignments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={filters.status} onChange={setFilter('status')} label="Status" displayEmpty>
                <MenuItem value="">All Statuses</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={filters.programme_id} onChange={setFilter('programme_id')} label="Programme" displayEmpty>
                <MenuItem value="">All Programmes</MenuItem>
                {programmes.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={filters.course_id} onChange={setFilter('course_id')} label="Course" displayEmpty>
                <MenuItem value="">All Courses</MenuItem>
                {courses.map(c => <MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={filters.department_id} onChange={setFilter('department_id')} label="Department" displayEmpty>
                <MenuItem value="">All Departments</MenuItem>
                {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Programme / Course</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Assigned By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.employee_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.employee_code} · {a.department_name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{a.programme_title || a.course_title}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.programme_title ? 'Programme' : 'Course'}</Typography>
                  </TableCell>
                  <TableCell><StatusChip status={a.status} /></TableCell>
                  <TableCell className="figure">{a.assigned_at?.slice(0, 10)}</TableCell>
                  <TableCell className="figure">{a.start_date || '—'}</TableCell>
                  <TableCell className="figure">{a.due_date || '—'}</TableCell>
                  <TableCell className="figure">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" />
                    </Box>
                  </TableCell>
                  <TableCell>{a.assigned_by_email}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Progress">
                      <IconButton size="small" onClick={() => window.open(`/training/employees/${a.employee_id}/progress`, '_blank')}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {['owner', 'admin', 'hr'].includes(staff.role) && a.status !== 'cancelled' && (
                      <Tooltip title="Cancel Assignment">
                        <IconButton size="small" color="error" onClick={() => handleCancel(a.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!assignments.length && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No assignments found. Click "Assign Training" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Assign Training</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <FormControl fullWidth sx={{ gridColumn: '1 / -1' }}>
              <Select label="Assign Type" value={form.programme_id ? 'programme' : 'course'} onChange={(e) => setForm({ ...form, programme_id: e.target.value === 'programme' ? form.programme_id : '', course_id: e.target.value === 'course' ? form.course_id : '' })} displayEmpty>
                <MenuItem value="programme">Training Programme</MenuItem>
                <MenuItem value="course">Single Course</MenuItem>
              </Select>
            </FormControl>
            {form.programme_id || (!form.programme_id && !form.course_id) ? (
              <FormControl fullWidth sx={{ gridColumn: '1 / -1' }}>
                <Select label="Programme" value={form.programme_id} onChange={setFormValue('programme_id')} displayEmpty>
                  <MenuItem value="">Select Programme</MenuItem>
                  {programmes.map(p => <MenuItem key={p.id} value={p.id}>{p.title} ({p.code})</MenuItem>)}
                </Select>
              </FormControl>
            ) : null}
            {form.course_id || (!form.programme_id && !form.course_id) ? (
              <FormControl fullWidth sx={{ gridColumn: '1 / -1' }}>
                <Select label="Course" value={form.course_id} onChange={setFormValue('course_id')} displayEmpty>
                  <MenuItem value="">Select Course</MenuItem>
                  {courses.map(c => <MenuItem key={c.id} value={c.id}>{c.title} ({c.code})</MenuItem>)}
                </Select>
              </FormControl>
            ) : null}
            <FormControl fullWidth sx={{ gridColumn: '1 / -1' }}>
              <Select label="Assign To" value={form.assign_to} onChange={(e) => setForm({ ...form, assign_to: e.target.value, employee_id: '', department_id: '' })} displayEmpty>
                <MenuItem value="">Select Assign Type</MenuItem>
                <MenuItem value="employee">Individual Employee</MenuItem>
                <MenuItem value="department">Entire Department</MenuItem>
              </Select>
            </FormControl>
            {form.assign_to === 'employee' && (
              <FormControl fullWidth sx={{ gridColumn: '1 / -1' }}>
                <Select label="Employee" value={form.employee_id} onChange={setFormValue('employee_id')} displayEmpty>
                  <MenuItem value="">Select Employee</MenuItem>
                  {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {form.assign_to === 'department' && (
              <FormControl fullWidth sx={{ gridColumn: '1 / -1' }}>
                <Select label="Department" value={form.department_id} onChange={setFormValue('department_id')} displayEmpty>
                  <MenuItem value="">Select Department</MenuItem>
                  {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <MobileTextField fullWidth type="date" label="Start Date" value={form.start_date} onChange={setFormValue('start_date')} InputLabelProps={{ shrink: true }} />
            <MobileTextField fullWidth type="date" label="Due Date" value={form.due_date} onChange={setFormValue('due_date')} InputLabelProps={{ shrink: true }} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleSubmit} disabled={saving || (!form.programme_id && !form.course_id) || (!form.employee_id && !form.department_id)}>
            {saving ? 'Assigning…' : 'Assign'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}