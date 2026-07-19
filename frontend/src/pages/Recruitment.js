import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField,
  MenuItem, Alert, Chip, IconButton, Link as MuiLink,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import client from '../api/client';
import StatusChip from '../components/StatusChip';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const SOURCES = ['linkedin', 'naukri', 'referral', 'walk_in', 'other'];

const emptyJobForm = {
  title: '', department_id: '', team_id: '', employment_type: 'full_time', description: '',
  location: '', experience_min_years: '', experience_max_years: '', salary_range_min: '', salary_range_max: '',
  openings_count: 1, linkedin_url: '', naukri_url: '',
};

function JobList({ onOpenJob }) {
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyJobForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/recruitment/jobs').then(({ data }) => setJobs(data.jobs)).catch(() => setJobs([]));
  useEffect(() => {
    load();
    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const { linkedin_url, naukri_url, ...rest } = form;
      const external_links = {};
      if (linkedin_url) external_links.linkedin = linkedin_url;
      if (naukri_url) external_links.naukri = naukri_url;
      await client.post('/recruitment/jobs', { ...rest, external_links: Object.keys(external_links).length ? external_links : undefined });
      setOpen(false);
      setForm(emptyJobForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create job posting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Recruitment</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New job posting</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        LinkedIn and Naukri don't offer open self-serve posting APIs — post the role there manually, then paste the
        listing URL here so it's one click away, and tag each candidate's <code>source</code> so you can see which
        channel actually converts.
      </Alert>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Role</TableCell><TableCell>Department</TableCell><TableCell>Type</TableCell>
              <TableCell align="right">Applicants</TableCell><TableCell align="right">Openings</TableCell><TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpenJob(j.id)}>
                <TableCell>{j.title}</TableCell>
                <TableCell>{j.department_name || '—'}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{j.employment_type?.replace('_', ' ')}</TableCell>
                <TableCell align="right" className="figure">{j.applicant_count}</TableCell>
                <TableCell align="right" className="figure">{j.filled_count}/{j.openings_count}</TableCell>
                <TableCell><StatusChip status={j.status} /></TableCell>
              </TableRow>
            ))}
            {!jobs.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No job postings yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New job posting</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Role title" value={form.title} onChange={set('title')} /></Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Department" value={form.department_id} onChange={set('department_id')}>
                <MenuItem value="">Unassigned</MenuItem>
                {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Employment type" value={form.employment_type} onChange={set('employment_type')}>
                {EMPLOYMENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}><TextField fullWidth label="Location" value={form.location} onChange={set('location')} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Openings" value={form.openings_count} onChange={set('openings_count')} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Experience min (yrs)" value={form.experience_min_years} onChange={set('experience_min_years')} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Experience max (yrs)" value={form.experience_max_years} onChange={set('experience_max_years')} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Salary min (₹/yr)" value={form.salary_range_min} onChange={set('salary_range_min')} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Salary max (₹/yr)" value={form.salary_range_max} onChange={set('salary_range_max')} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline rows={3} label="Description" value={form.description} onChange={set('description')} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="LinkedIn posting URL" value={form.linkedin_url} onChange={set('linkedin_url')} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Naukri posting URL" value={form.naukri_url} onChange={set('naukri_url')} /></Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.title}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function JobDetail({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState({ full_name: '', email: '', phone: '', source: 'linkedin', current_company: '', expected_ctc: '', notice_period_days: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hireOpen, setHireOpen] = useState(null); // application object being hired
  const [hireDate, setHireDate] = useState('');
  const [message, setMessage] = useState(null);

  const load = () => client.get(`/recruitment/jobs/${jobId}`).then(({ data }) => { setJob(data.job); setApplications(data.applications); });
  useEffect(() => { load(); }, [jobId]);

  const addCandidate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post(`/recruitment/jobs/${jobId}/applications`, { candidate: candidateForm });
      setAddOpen(false);
      setCandidateForm({ full_name: '', email: '', phone: '', source: 'linkedin', current_company: '', expected_ctc: '', notice_period_days: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add candidate');
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (application, stage) => {
    if (stage === 'hired') { setHireOpen(application); return; }
    if (stage === 'rejected') {
      const reason = window.prompt('Rejection reason (optional):') || '';
      await client.put(`/recruitment/applications/${application.id}/stage`, { stage, rejection_reason: reason });
    } else {
      await client.put(`/recruitment/applications/${application.id}/stage`, { stage });
    }
    load();
  };

  const confirmHire = async () => {
    if (!hireDate) return;
    try {
      const { data } = await client.post(`/recruitment/applications/${hireOpen.id}/hire`, { date_of_joining: hireDate });
      setMessage({ severity: 'success', text: data.message });
      setHireOpen(null);
      setHireDate('');
      load();
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to hire candidate' });
    }
  };

  if (!job) return null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>All job postings</Button>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5">{job.title}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
            {job.department_name || 'Unassigned'} · {job.filled_count}/{job.openings_count} filled
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {job.external_links?.linkedin && (
            <Button size="small" variant="outlined" endIcon={<OpenInNewIcon fontSize="small" />} component={MuiLink} href={job.external_links.linkedin} target="_blank">LinkedIn</Button>
          )}
          {job.external_links?.naukri && (
            <Button size="small" variant="outlined" endIcon={<OpenInNewIcon fontSize="small" />} component={MuiLink} href={job.external_links.naukri} target="_blank">Naukri</Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add candidate</Button>
        </Box>
      </Box>

      {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Candidate</TableCell><TableCell>Source</TableCell><TableCell>Current company</TableCell>
              <TableCell align="right">Expected CTC</TableCell><TableCell align="right">Notice (days)</TableCell>
              <TableCell>Stage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {applications.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.full_name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{a.email}</Typography>
                </TableCell>
                <TableCell><Chip size="small" label={a.source} variant="outlined" /></TableCell>
                <TableCell>{a.current_company || '—'}</TableCell>
                <TableCell align="right" className="figure">{a.expected_ctc ? `₹${Number(a.expected_ctc).toLocaleString('en-IN')}` : '—'}</TableCell>
                <TableCell align="right" className="figure">{a.notice_period_days ?? '—'}</TableCell>
                <TableCell>
                  <TextField select size="small" value={a.stage} onChange={(e) => moveStage(a, e.target.value)} sx={{ minWidth: 130 }}>
                    {STAGES.map((s) => <MenuItem key={s} value={s} disabled={a.stage === 'hired' && s !== 'hired'}>{s}</MenuItem>)}
                  </TextField>
                </TableCell>
              </TableRow>
            ))}
            {!applications.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No candidates yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add candidate</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full name" margin="normal" value={candidateForm.full_name} onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })} />
          <TextField fullWidth label="Email" margin="normal" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} />
          <TextField fullWidth label="Phone" margin="normal" value={candidateForm.phone} onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
          <TextField fullWidth select label="Source" margin="normal" value={candidateForm.source} onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}>
            {SOURCES.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Current company" margin="normal" value={candidateForm.current_company} onChange={(e) => setCandidateForm({ ...candidateForm, current_company: e.target.value })} />
          <TextField fullWidth type="number" label="Expected CTC (₹/yr)" margin="normal" value={candidateForm.expected_ctc} onChange={(e) => setCandidateForm({ ...candidateForm, expected_ctc: e.target.value })} />
          <TextField fullWidth type="number" label="Notice period (days)" margin="normal" value={candidateForm.notice_period_days} onChange={(e) => setCandidateForm({ ...candidateForm, notice_period_days: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addCandidate} disabled={saving || !candidateForm.full_name}>{saving ? 'Adding…' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(hireOpen)} onClose={() => setHireOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Hire {hireOpen?.full_name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 1 }}>Creates an employee record from this candidate. Finish compensation and bank details afterwards via Edit.</Alert>
          <TextField fullWidth type="date" label="Date of joining" InputLabelProps={{ shrink: true }} margin="normal" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHireOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmHire} disabled={!hireDate}>Confirm hire</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Recruitment() {
  const [selectedJobId, setSelectedJobId] = useState(null);
  return selectedJobId
    ? <JobDetail jobId={selectedJobId} onBack={() => setSelectedJobId(null)} />
    : <JobList onOpenJob={setSelectedJobId} />;
}