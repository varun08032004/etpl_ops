import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, MenuItem, Tabs, Tab, Stepper, Step, StepLabel, Alert, Switch, FormControlLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import Money from '../components/Money';
import { useAuth } from '../context/AuthContext';
import { Checkbox } from '@mui/material';

const STEPS = ['Personal', 'Employment', 'Compensation', 'Documents'];
const INDIAN_STATES = ['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Telangana', 'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Other'];

const emptyForm = {
  full_name: '', personal_email: '', work_email: '', phone: '', date_of_birth: '',
  city: '', state: 'Maharashtra', pan_number: '',
  date_of_joining: '', employment_type: 'full_time',
  ctc_annual: '', basic_monthly: '', hra_monthly: '', other_allowances_monthly: '', da_monthly: '',
  tax_regime: 'new', pf_applicable: true,
  bank_account_number: '', bank_ifsc: '',
};

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [resumeFile, setResumeFile] = useState(null);
  const [offerLetterFile, setOfferLetterFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async (q) => {
    const { data } = await client.get('/employees', { params: q ? { search: q } : {} });
    setEmployees(data.employees);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setResumeFile(null);
    setOfferLetterFile(null);
    setStep(0);
    setError('');
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/employees', form);
      const employeeId = data.employee.id;

      const uploads = [];
      if (resumeFile) {
        const fd = new FormData();
        fd.append('file', resumeFile);
        fd.append('title', `${form.full_name} — Resume`);
        fd.append('doc_type', 'resume');
        fd.append('entity_type', 'employee');
        fd.append('entity_id', employeeId);
        uploads.push(client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
      }
      if (offerLetterFile) {
        const fd = new FormData();
        fd.append('file', offerLetterFile);
        fd.append('title', `${form.full_name} — Offer Letter`);
        fd.append('doc_type', 'offer_letter');
        fd.append('entity_type', 'employee');
        fd.append('entity_id', employeeId);
        uploads.push(client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
      }
      if (uploads.length) await Promise.all(uploads);

      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">People</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setOpen(true); }}>Add employee</Button>
      </Box>

      <TextField
        fullWidth placeholder="Search by name, code, or email" value={search} onChange={handleSearch}
        size="small" sx={{ mb: 2, maxWidth: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id} component={Link} to={`/employees/${e.id}`}
                sx={{ cursor: 'pointer', textDecoration: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.full_name}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{e.work_email}</Typography>
                </TableCell>
                <TableCell className="figure">{e.employee_code}</TableCell>
                <TableCell>{e.department || '—'}</TableCell>
                <TableCell>{e.designation || '—'}</TableCell>
                <TableCell className="figure">{e.date_of_joining?.slice(0, 10)}</TableCell>
                <TableCell><StatusChip status={e.status} /></TableCell>
              </TableRow>
            ))}
            {!employees.length && (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No employees yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add employee</DialogTitle>
        <DialogContent>
          <Stepper activeStep={step} sx={{ mb: 3, mt: 1 }}>
            {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {step === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Full name" value={form.full_name} onChange={set('full_name')} required /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Personal email" value={form.personal_email} onChange={set('personal_email')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Work email" value={form.work_email} onChange={set('work_email')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Phone" value={form.phone} onChange={set('phone')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="date" label="Date of birth" InputLabelProps={{ shrink: true }} value={form.date_of_birth} onChange={set('date_of_birth')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="City" value={form.city} onChange={set('city')} /></Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="State (for Professional Tax)" value={form.state} onChange={set('state')}>
                  {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}><TextField fullWidth label="PAN number" value={form.pan_number} onChange={set('pan_number')} /></Grid>
            </Grid>
          )}

          {step === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth type="date" label="Date of joining" InputLabelProps={{ shrink: true }}
                  value={form.date_of_joining} onChange={set('date_of_joining')} required />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Employment type" value={form.employment_type} onChange={set('employment_type')}>
                  {['full_time', 'part_time', 'contract', 'intern'].map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}><TextField fullWidth label="Bank account number" value={form.bank_account_number} onChange={set('bank_account_number')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Bank IFSC" value={form.bank_ifsc} onChange={set('bank_ifsc')} /></Grid>
            </Grid>
          )}

          {step === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 1 }}>This drives payroll — leave blank only for contractors paid outside payroll.</Alert>
              </Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Annual CTC (₹)" value={form.ctc_annual} onChange={set('ctc_annual')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Monthly Basic (₹)" value={form.basic_monthly} onChange={set('basic_monthly')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Monthly DA (₹)" value={form.da_monthly} onChange={set('da_monthly')} helperText="Dearness Allowance — used in the 50% wage cap check" /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Monthly HRA (₹)" value={form.hra_monthly} onChange={set('hra_monthly')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Other allowances (₹)" value={form.other_allowances_monthly} onChange={set('other_allowances_monthly')} /></Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Tax regime" value={form.tax_regime} onChange={set('tax_regime')}>
                  <MenuItem value="new">New regime</MenuItem>
                  <MenuItem value="old">Old regime</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Switch checked={form.pf_applicable} onChange={(e) => setForm({ ...form, pf_applicable: e.target.checked })} />} label="EPF applicable for this employee" />
              </Grid>
            </Grid>
          )}

          {step === 3 && (
            <Box>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
                Optional at this stage — you can also attach these later from the employee's profile or the Documents page.
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} fullWidth>
                  {resumeFile ? resumeFile.name : 'Upload resume'}
                  <input type="file" hidden onChange={(e) => setResumeFile(e.target.files[0])} />
                </Button>
              </Box>
              <Box>
                <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} fullWidth>
                  {offerLetterFile ? offerLetterFile.name : 'Upload offer letter'}
                  <input type="file" hidden onChange={(e) => setOfferLetterFile(e.target.files[0])} />
                </Button>
              </Box>
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          {step < STEPS.length - 1 && (
            <Button variant="contained" onClick={() => setStep(step + 1)} disabled={step === 0 && !form.full_name}>
              Next
            </Button>
          )}
          {step === STEPS.length - 1 && (
            <Button variant="contained" onClick={handleCreate} disabled={saving || !form.full_name || !form.date_of_joining}>
              {saving ? 'Creating…' : 'Create employee'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EmployeeDetail() {
  const { id } = useParams();
  const { staff } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState(0);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState([]);

  const canEdit = ['owner', 'admin', 'hr'].includes(staff?.role);

  const loadDocs = () => client.get('/documents', { params: { entity_type: 'employee', entity_id: id } }).then(({ data }) => setDocs(data.documents));

  const loadEmployee = () => client.get(`/employees/${id}`).then(({ data }) => setEmployee(data.employee));
  const loadChecklist = () => client.get(`/automation/checklist/${id}`).then(({ data }) => setChecklist(data.items)).catch(() => setChecklist([]));

  useEffect(() => {
    loadEmployee();
    loadDocs();
    loadChecklist();
  }, [id]);

  const toggleChecklistItem = async (itemId) => {
    await client.post(`/automation/checklist/${itemId}/toggle`);
    loadChecklist();
  };

  const handleDownload = async (doc) => {
    const { data } = await client.get(`/documents/${doc.id}/download`);
    window.open(data.url, '_blank');
  };

  const handleQuickUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', `${employee.full_name} — ${docType.replace('_', ' ')}`);
      fd.append('doc_type', docType);
      fd.append('entity_type', 'employee');
      fd.append('entity_id', id);
      await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadDocs();
    } finally {
      setUploading(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      full_name: employee.full_name || '', personal_email: employee.personal_email || '',
      work_email: employee.work_email || '', phone: employee.phone || '',
      city: employee.city || '', state: employee.state || '', pan_number: employee.pan_number || '',
      employment_type: employee.employment_type || 'full_time', status: employee.status || 'active',
      bank_account_number: employee.bank_account_number || '', bank_ifsc: employee.bank_ifsc || '',
      ctc_annual: employee.ctc_annual || '', basic_monthly: employee.basic_monthly || '',
      da_monthly: employee.da_monthly || '', hra_monthly: employee.hra_monthly || '',
      other_allowances_monthly: employee.other_allowances_monthly || '',
      tax_regime: employee.tax_regime || 'new', pf_applicable: employee.pf_applicable !== false,
    });
    setError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      await client.put(`/employees/${id}`, editForm);
      setEditOpen(false);
      loadEmployee();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const setEdit = (key) => (e) => setEditForm({ ...editForm, [key]: e.target.value });

  if (!employee) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{employee.full_name}</Typography>
          <Typography sx={{ color: 'text.secondary' }}>{employee.employee_code} · {employee.work_email}</Typography>
        </Box>
        {canEdit && <Button variant="outlined" startIcon={<EditIcon />} onClick={openEdit}>Edit</Button>}
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Compensation" />
        <Tab label="Documents" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3, maxWidth: 560 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Status</Typography><StatusChip status={employee.status} /></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Employment type</Typography><Typography sx={{ textTransform: 'capitalize' }}>{employee.employment_type?.replace('_', ' ')}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Date of joining</Typography><Typography className="figure">{employee.date_of_joining?.slice(0, 10)}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Phone</Typography><Typography>{employee.phone || '—'}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>State</Typography><Typography>{employee.state || '—'}</Typography></Grid>
          </Grid>

          {checklist.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
                Onboarding checklist ({checklist.filter((c) => c.is_done).length}/{checklist.length})
              </Typography>
              {checklist.map((item) => (
                <Box key={item.id} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox size="small" checked={item.is_done} onChange={() => toggleChecklistItem(item.id)} disabled={!canEdit} />
                  <Typography sx={{ fontSize: '0.85rem', textDecoration: item.is_done ? 'line-through' : 'none', color: item.is_done ? 'text.secondary' : 'text.primary' }}>
                    {item.title}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3, maxWidth: 560 }}>
          {employee.ctc_annual ? (
            <Grid container spacing={2}>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Annual CTC</Typography><Money amount={employee.ctc_annual} size="1.1rem" /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly basic</Typography><Money amount={employee.basic_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly DA</Typography><Money amount={employee.da_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly HRA</Typography><Money amount={employee.hra_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Other allowances</Typography><Money amount={employee.other_allowances_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Tax regime</Typography><Typography sx={{ textTransform: 'capitalize' }}>{employee.tax_regime}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>EPF applicable</Typography><Typography>{employee.pf_applicable ? 'Yes' : 'No'}</Typography></Grid>
            </Grid>
          ) : (
            <Alert severity="warning">
              No compensation on file — this employee won't be included correctly in payroll runs until this is filled in via Edit.
            </Alert>
          )}
        </Paper>
      )}

      {tab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={uploading}>
              Upload resume
              <input type="file" hidden onChange={(e) => handleQuickUpload(e, 'resume')} />
            </Button>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={uploading}>
              Upload offer letter
              <input type="file" hidden onChange={(e) => handleQuickUpload(e, 'offer_letter')} />
            </Button>
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Title</TableCell><TableCell>Type</TableCell><TableCell>Uploaded</TableCell><TableCell align="right"></TableCell></TableRow>
              </TableHead>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell><StatusChip status={d.doc_type} /></TableCell>
                    <TableCell className="figure">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<DownloadIcon fontSize="small" />} onClick={() => handleDownload(d)}>Download</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!docs.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No documents yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {editForm && (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit {employee.full_name}</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1, mb: 1 }}>Personal & employment</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}><TextField fullWidth label="Full name" value={editForm.full_name} onChange={setEdit('full_name')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Work email" value={editForm.work_email} onChange={setEdit('work_email')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Phone" value={editForm.phone} onChange={setEdit('phone')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="City" value={editForm.city} onChange={setEdit('city')} /></Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="State" value={editForm.state} onChange={setEdit('state')}>
                  {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}><TextField fullWidth label="PAN number" value={editForm.pan_number} onChange={setEdit('pan_number')} /></Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Employment type" value={editForm.employment_type} onChange={setEdit('employment_type')}>
                  {['full_time', 'part_time', 'contract', 'intern'].map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Status" value={editForm.status} onChange={setEdit('status')}>
                  {['active', 'on_leave', 'notice_period', 'exited'].map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}><TextField fullWidth label="Bank account number" value={editForm.bank_account_number} onChange={setEdit('bank_account_number')} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Bank IFSC" value={editForm.bank_ifsc} onChange={setEdit('bank_ifsc')} /></Grid>
            </Grid>

            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 3, mb: 1 }}>Compensation</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}><TextField fullWidth type="number" label="Annual CTC (₹)" value={editForm.ctc_annual} onChange={setEdit('ctc_annual')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Monthly Basic (₹)" value={editForm.basic_monthly} onChange={setEdit('basic_monthly')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Monthly DA (₹)" value={editForm.da_monthly} onChange={setEdit('da_monthly')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Monthly HRA (₹)" value={editForm.hra_monthly} onChange={setEdit('hra_monthly')} /></Grid>
              <Grid item xs={6}><TextField fullWidth type="number" label="Other allowances (₹)" value={editForm.other_allowances_monthly} onChange={setEdit('other_allowances_monthly')} /></Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Tax regime" value={editForm.tax_regime} onChange={setEdit('tax_regime')}>
                  <MenuItem value="new">New regime</MenuItem>
                  <MenuItem value="old">Old regime</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Switch checked={editForm.pf_applicable} onChange={(e) => setEditForm({ ...editForm, pf_applicable: e.target.checked })} />} label="EPF applicable" />
              </Grid>
            </Grid>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export { EmployeeList, EmployeeDetail };