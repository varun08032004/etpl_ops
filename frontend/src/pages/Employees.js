import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, MenuItem, Tabs, Tab, Stepper, Step, StepLabel, Alert, Switch, FormControlLabel,
  Autocomplete,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RestoreIcon from '@mui/icons-material/Restore';
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
  department_id: '', team_id: '', designation_title: '', manager_id: '',
  ctc_annual: '', basic_monthly: '', hra_monthly: '', other_allowances_monthly: '', da_monthly: '',
  tax_regime: 'new', pf_applicable: true,
  bank_account_number: '', bank_ifsc: '',
};

// Resolves a free-typed designation title to an id — finds an existing one
// by title or creates it, so the employee form doesn't need a separate
// "manage designations" screen. Returns null if left blank.
async function resolveDesignationId(title, departmentId) {
  if (!title || !title.trim()) return null;
  const { data } = await client.post('/designations', { title: title.trim(), department_id: departmentId || null });
  return data.designation.id;
}

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [resumeFile, setResumeFile] = useState(null);
  const [offerLetterFile, setOfferLetterFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [quickTeamOpen, setQuickTeamOpen] = useState(false);
  const [quickTeamName, setQuickTeamName] = useState('');
  const [quickTeamSaving, setQuickTeamSaving] = useState(false);

  const load = async (q) => {
    const { data } = await client.get('/employees', { params: q ? { search: q } : {} });
    setEmployees(data.employees);
  };

  useEffect(() => {
    load();
    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
    client.get('/teams').then(({ data }) => setTeams(data.teams)).catch(() => {});
    client.get('/designations').then(({ data }) => setDesignations(data.designations)).catch(() => {});
  }, []);

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

  // Department picked first → Team dropdown scopes to that department →
  // Designation is a free-typed / existing-title field. Changing department
  // clears whatever team was picked, since a team belongs to exactly one department.
  const handleDepartmentChange = (e) => {
    setForm({ ...form, department_id: e.target.value, team_id: '' });
  };

  const teamsInDepartment = teams.filter((t) => t.department_id === form.department_id);
  const selectedDepartment = departments.find((d) => d.id === form.department_id);
  const showNoTeamsPrompt = form.department_id && teamsInDepartment.length === 0;
  const showNoModuleAccessHint = form.department_id && (!selectedDepartment?.granted_roles || selectedDepartment.granted_roles.length === 0);

  const createQuickTeam = async () => {
    if (!quickTeamName.trim()) return;
    setQuickTeamSaving(true);
    try {
      const { data } = await client.post('/teams', { name: quickTeamName.trim(), department_id: form.department_id });
      const { data: teamsData } = await client.get('/teams');
      setTeams(teamsData.teams);
      setForm((f) => ({ ...f, team_id: data.team.id }));
      setQuickTeamOpen(false);
      setQuickTeamName('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create team');
    } finally {
      setQuickTeamSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const designation_id = await resolveDesignationId(form.designation_title, form.department_id);
      const { department_id, team_id, designation_title, manager_id, ...rest } = form;
      const payload = {
        ...rest,
        department_id: department_id || null,
        team_id: team_id || null,
        designation_id,
        manager_id: manager_id || null,
      };

      const { data } = await client.post('/employees', payload);
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
              <TableCell>Team</TableCell>
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
                <TableCell>{e.team || '—'}</TableCell>
                <TableCell>{e.designation || '—'}</TableCell>
                <TableCell className="figure">{e.date_of_joining?.slice(0, 10)}</TableCell>
                <TableCell><StatusChip status={e.status} /></TableCell>
              </TableRow>
            ))}
            {!employees.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No employees yet.</TableCell></TableRow>
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

              {/* Ordering intentionally mirrors the org chart: Department first,
                  then Team (scoped to that department), then Designation. */}
              <Grid item xs={12}>
                <TextField fullWidth select label="Department" value={form.department_id} onChange={handleDepartmentChange}>
                  <MenuItem value="">Unassigned</MenuItem>
                  {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth select label="Team" value={form.team_id} onChange={set('team_id')}
                  disabled={!form.department_id}
                  helperText={!form.department_id ? 'Pick a department first' : (teamsInDepartment.find((t) => t.id === form.team_id)?.head_name ? `Team head: ${teamsInDepartment.find((t) => t.id === form.team_id).head_name}` : undefined)}
                >
                  <MenuItem value="">No team / department-level</MenuItem>
                  {teamsInDepartment.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>

              {showNoTeamsPrompt && (
                <Grid item xs={12}>
                  <Alert severity="info" action={<Button size="small" onClick={() => setQuickTeamOpen(true)}>Create a team</Button>}>
                    {selectedDepartment?.name} has no teams yet. You can add {form.full_name || 'this employee'} directly
                    at the department level (leave Team blank), or create a team now.
                  </Alert>
                </Grid>
              )}
              {showNoModuleAccessHint && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    {selectedDepartment?.name} doesn't grant self-service access to any extra modules yet (Finance/HR/Legal
                    pages) — everyone in it currently only sees their own self-service portal. Set this once, for the
                    whole department, in <strong>Org Structure → Edit department → "Grants access to"</strong> — it'll
                    apply to every employee here automatically, including this one.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={6}>
                <Autocomplete
                  freeSolo
                  options={designations.map((d) => d.title)}
                  value={form.designation_title}
                  onInputChange={(e, val) => setForm({ ...form, designation_title: val })}
                  renderInput={(params) => <TextField {...params} fullWidth label="Designation" helperText="Type a new title or pick an existing one" />}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth select label="Reports to (manager)" value={form.manager_id} onChange={set('manager_id')}>
                  <MenuItem value="">No manager set</MenuItem>
                  {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
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

      <Dialog open={quickTeamOpen} onClose={() => setQuickTeamOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New team in {selectedDepartment?.name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth autoFocus label="Team name" margin="normal" value={quickTeamName}
            onChange={(e) => setQuickTeamName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createQuickTeam(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickTeamOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createQuickTeam} disabled={quickTeamSaving || !quickTeamName.trim()}>
            {quickTeamSaving ? 'Creating…' : 'Create & select'}
          </Button>
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
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [message, setMessage] = useState(null);

  const [exitOpen, setExitOpen] = useState(false);
  const [exitForm, setExitForm] = useState({ exit_date: '', reason: '' });
  const [exiting, setExiting] = useState(false);
  const [reinstating, setReinstating] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '', role: 'employee' });
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  const canEdit = ['owner', 'admin', 'hr'].includes(staff?.role);
  const canExit = ['owner', 'admin', 'hr'].includes(staff?.role);
  const canReinstate = ['owner', 'admin', 'hr'].includes(staff?.role);

  const loadDocs = () => client.get('/documents', { params: { entity_type: 'employee', entity_id: id } }).then(({ data }) => setDocs(data.documents));
  const loadEmployee = () => client.get(`/employees/${id}`).then(({ data }) => setEmployee(data.employee));
  const loadChecklist = () => client.get(`/automation/checklist/${id}`).then(({ data }) => setChecklist(data.items)).catch(() => setChecklist([]));

  useEffect(() => {
    loadEmployee();
    loadDocs();
    loadChecklist();
    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
    client.get('/teams').then(({ data }) => setTeams(data.teams)).catch(() => {});
    client.get('/designations').then(({ data }) => setDesignations(data.designations)).catch(() => {});
    client.get('/employees').then(({ data }) => setAllEmployees(data.employees)).catch(() => {});
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
      employment_type: employee.employment_type || 'full_time',
      department_id: employee.department_id || '', team_id: employee.team_id || '',
      designation_id: employee.designation_id || '', manager_id: employee.manager_id || '',
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

  // Changing department in the Edit dialog clears whatever team was set,
  // same as the Add-employee flow — a team belongs to exactly one department.
  const setEditDepartment = (e) => setEditForm({ ...editForm, department_id: e.target.value, team_id: '' });
  const editTeamsInDepartment = teams.filter((t) => t.department_id === editForm?.department_id);

  const setEdit = (key) => (e) => setEditForm({ ...editForm, [key]: e.target.value });

  const handleExit = async () => {
    setExiting(true);
    setMessage(null);
    try {
      const { data } = await client.post(`/employees/${id}/exit`, exitForm);
      if (data.pending) {
        setMessage({ severity: 'info', text: data.message });
      } else {
        setMessage({ severity: 'success', text: `${employee.full_name} has been exited.` });
        loadEmployee();
      }
      setExitOpen(false);
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to process exit' });
    } finally {
      setExiting(false);
    }
  };

  // Undo an accidental exit — immediate for owner/admin/hr, no approval step,
  // since this is correcting a mistake rather than a new destructive action.
  // Also flips their old login back on if they had one.
  const handleReinstate = async () => {
    setReinstating(true);
    setMessage(null);
    try {
      const { data } = await client.post(`/employees/${id}/reinstate`);
      const loginNote = data.reactivated_login ? ` Their login (${data.reactivated_login.email}) was reactivated too.` : '';
      setMessage({ severity: 'success', text: `${employee.full_name} has been reinstated.${loginNote}` });
      loadEmployee();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to reinstate employee' });
    } finally {
      setReinstating(false);
    }
  };

  const openCreateLogin = () => {
    const suggested = employee.work_email || '';
    setLoginForm({ email: suggested, password: '', role: 'employee' });
    setLoginError('');
    setLoginOpen(true);
  };

  const handleCreateLogin = async () => {
    setCreatingLogin(true);
    setLoginError('');
    try {
      await client.post('/staff-accounts', { ...loginForm, employee_id: id });
      setLoginOpen(false);
      loadEmployee();
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Failed to create login');
    } finally {
      setCreatingLogin(false);
    }
  };

  if (!employee) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{employee.full_name}</Typography>
          <Typography sx={{ color: 'text.secondary' }}>{employee.employee_code} · {employee.work_email}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {employee.status === 'exited' ? (
            canReinstate && (
              <Button variant="outlined" color="success" startIcon={<RestoreIcon />} onClick={handleReinstate} disabled={reinstating}>
                {reinstating ? 'Reinstating…' : 'Reinstate'}
              </Button>
            )
          ) : (
            <>
              {canEdit && (
                employee.linked_staff_account
                  ? <Button size="small" variant="outlined" disabled sx={{ fontSize: '0.75rem' }}>
                      Login linked: {employee.linked_staff_account.email}
                    </Button>
                  : <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} onClick={openCreateLogin}>Create login</Button>
              )}
              {canEdit && <Button variant="outlined" startIcon={<EditIcon />} onClick={openEdit}>Edit</Button>}
              {canExit && (
                <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={() => { setExitForm({ exit_date: '', reason: '' }); setExitOpen(true); }}>
                  Exit
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
      {employee.status === 'exited' && (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          Exited on {employee.date_of_exit?.slice(0, 10)}{employee.exit_reason ? ` — ${employee.exit_reason}` : ''}
          {canReinstate ? ' — click "Reinstate" above if this was a mistake.' : ''}
        </Alert>
      )}

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
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Department</Typography><Typography>{departments.find((d) => d.id === employee.department_id)?.name || '—'}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Team</Typography><Typography>{teams.find((t) => t.id === employee.team_id)?.name || '—'}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Designation</Typography><Typography>{designations.find((d) => d.id === employee.designation_id)?.title || '—'}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Reports to</Typography><Typography>{allEmployees.find((e) => e.id === employee.manager_id)?.full_name || '—'}</Typography></Grid>
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
                <TextField fullWidth select label="Status" value={editForm.status || employee.status} onChange={setEdit('status')}>
                  {['active', 'on_leave', 'notice_period'].map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Department" value={editForm.department_id} onChange={setEditDepartment}>
                  <MenuItem value="">Unassigned</MenuItem>
                  {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Team" value={editForm.team_id} onChange={setEdit('team_id')} disabled={!editForm.department_id}>
                  <MenuItem value="">No team / department-level</MenuItem>
                  {editTeamsInDepartment.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Designation" value={editForm.designation_id} onChange={setEdit('designation_id')}>
                  <MenuItem value="">Unassigned</MenuItem>
                  {designations.map((d) => <MenuItem key={d.id} value={d.id}>{d.title}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Reports to (manager)" value={editForm.manager_id} onChange={setEdit('manager_id')}>
                  <MenuItem value="">No manager set</MenuItem>
                  {allEmployees.filter((e) => e.id !== id).map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
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

      <Dialog open={exitOpen} onClose={() => setExitOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Exit {employee.full_name}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1 }}>
            This sets status to Exited and deactivates their login (if any). This does not delete their record —
            payroll and leave history are preserved, and it can be undone with "Reinstate" if it was a mistake.
            {staff?.role === 'admin' && ' As Admin, this will be sent to the Founder for approval before it takes effect.'}
          </Alert>
          <TextField fullWidth type="date" label="Exit date" InputLabelProps={{ shrink: true }} margin="normal"
            value={exitForm.exit_date} onChange={(e) => setExitForm({ ...exitForm, exit_date: e.target.value })} />
          <TextField fullWidth label="Reason" multiline rows={2} margin="normal"
            value={exitForm.reason} onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleExit} disabled={exiting || !exitForm.exit_date}>
            {exiting ? 'Processing…' : 'Confirm exit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create login for {employee.full_name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Email" margin="normal" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
          <TextField fullWidth label="Temporary password" margin="normal" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} helperText="Share this with them securely." />
          <TextField fullWidth select label="Role" margin="normal" value={loginForm.role} onChange={(e) => setLoginForm({ ...loginForm, role: e.target.value })}>
            {['admin', 'hr', 'finance', 'manager', 'employee'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          {loginError && <Alert severity="error" sx={{ mt: 1 }}>{loginError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateLogin} disabled={creatingLogin || !loginForm.email || !loginForm.password}>
            {creatingLogin ? 'Creating…' : 'Create login'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export { EmployeeList, EmployeeDetail };