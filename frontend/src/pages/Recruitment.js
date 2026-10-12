import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Alert, Chip, Link as MuiLink,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  ResponsiveTableContainer,
  MobileCardGrid,
  MobileButton,
  MobileTextField,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const SOURCES = ['linkedin', 'naukri', 'referral', 'walk_in', 'other'];
const JOB_STATUSES = [
  { value: 'published', label: 'Published (visible on careers)' },
  { value: 'draft', label: 'Draft (internal only)' },
  { value: 'closed', label: 'Closed' },
];

const emptyJobForm = {
  title: '', department_id: '', team_id: '', employment_type: 'full_time', description: '',
  location: '', experience_required: 'yes', experience_min_years: '', experience_max_years: '', salary_range_min: '', salary_range_max: '',
  openings_count: 1, linkedin_url: '', naukri_url: '', status: 'published',
};

function JobList({ onOpenJob }) {
  const isMobile = useMobile();
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState(emptyJobForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => client.get('/recruitment/jobs').then(({ data }) => setJobs(data.jobs)).catch(() => setJobs([])), []);
  useEffect(() => {
    load();
    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
  }, [load]);

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

  const handleEditClick = (job) => {
    setEditingJob(job);
    setForm({
      title: job.title,
      department_id: job.department_id || '',
      team_id: job.team_id || '',
      employment_type: job.employment_type || 'full_time',
      description: job.description || '',
      location: job.location || '',
      experience_required: job.experience_required || 'yes',
      experience_min_years: job.experience_min_years || '',
      experience_max_years: job.experience_max_years || '',
      salary_range_min: job.salary_range_min || '',
      salary_range_max: job.salary_range_max || '',
      openings_count: job.openings_count || 1,
      linkedin_url: job.external_links?.linkedin || '',
      naukri_url: job.external_links?.naukri || '',
      status: job.status || 'published',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingJob) return;
    setSaving(true);
    setError('');
    try {
      const { linkedin_url, naukri_url, ...rest } = form;
      const external_links = {};
      if (linkedin_url) external_links.linkedin = linkedin_url;
      if (naukri_url) external_links.naukri = naukri_url;
      await client.patch(`/recruitment/jobs/${editingJob.id}`, { ...rest, external_links: Object.keys(external_links).length ? external_links : undefined });
      setEditOpen(false);
      setEditingJob(null);
      setForm(emptyJobForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update job posting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Recruitment</Typography>
        <MobileButton variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setForm(emptyJobForm); setOpen(true); }}>New job posting</MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          LinkedIn and Naukri don't offer open self-serve posting APIs — post the role there manually, then paste the
          listing URL here so it's one click away, and tag each candidate's <code>source</code> so you can see which
          channel actually converts.
        </Alert>
      </MobilePaper>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Role</TableCell><TableCell>Department</TableCell><TableCell>Type</TableCell>
                <TableCell align="right">Applicants</TableCell><TableCell align="right">Openings</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id} hover>
                  <TableCell>{j.title}</TableCell>
                  <TableCell>{j.department_name || '—'}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{j.employment_type?.replace('_', ' ')}</TableCell>
                  <TableCell align="right" className="figure">{j.applicant_count}</TableCell>
                  <TableCell align="right" className="figure">{j.filled_count}/{j.openings_count}</TableCell>
                  <TableCell><StatusChip status={j.status} /></TableCell>
                  <TableCell>
                    <MobileButton size="small" onClick={(e) => { e.stopPropagation(); handleEditClick(j); }}>
                      Edit
                    </MobileButton>
                    <MobileButton size="small" variant="text" color="primary" onClick={(e) => { e.stopPropagation(); onOpenJob(j.id); }}>
                      Candidates
                    </MobileButton>
                  </TableCell>
                </TableRow>
              ))}
              {!jobs.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No job postings yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* New Job Dialog */}
      <MobileDialog open={open} onClose={() => { setOpen(false); setForm(emptyJobForm); }} maxWidth="sm" fullWidth>
        <DialogTitle>New job posting</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Role title" value={form.title} onChange={set('title')} />
            <MobileTextField
              fullWidth
              select
              label="Department"
              value={form.department_id}
              onChange={set('department_id')}
              options={[{ value: '', label: 'Unassigned' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Employment type"
              value={form.employment_type}
              onChange={set('employment_type')}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            />
            <MobileTextField fullWidth label="Location" value={form.location} onChange={set('location')} />
            <MobileTextField fullWidth type="number" label="Openings" value={form.openings_count} onChange={set('openings_count')} />
            <MobileTextField
              fullWidth
              select
              label="Experience required?"
              value={form.experience_required}
              onChange={set('experience_required')}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No (Freshers)' }]}
            />
            {form.experience_required === 'yes' && (
              <>
                <MobileTextField fullWidth type="number" label="Experience min (yrs)" value={form.experience_min_years} onChange={set('experience_min_years')} />
                <MobileTextField fullWidth type="number" label="Experience max (yrs)" value={form.experience_max_years} onChange={set('experience_max_years')} />
              </>
            )}
            <MobileTextField fullWidth type="number" label="Salary min (₹/yr)" value={form.salary_range_min} onChange={set('salary_range_min')} />
            <MobileTextField fullWidth type="number" label="Salary max (₹/yr)" value={form.salary_range_max} onChange={set('salary_range_max')} />
            <MobileTextField fullWidth multiline rows={3} label="Description" value={form.description} onChange={set('description')} />
            <MobileTextField fullWidth label="LinkedIn posting URL" value={form.linkedin_url} onChange={set('linkedin_url')} />
            <MobileTextField fullWidth label="Naukri posting URL" value={form.naukri_url} onChange={set('naukri_url')} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={set('status')}
              options={JOB_STATUSES}
            />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => { setOpen(false); setForm(emptyJobForm); }}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={saving || !form.title}>{saving ? 'Creating…' : 'Create'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* Edit Job Dialog */}
      <MobileDialog open={editOpen} onClose={() => { setEditOpen(false); setEditingJob(null); setForm(emptyJobForm); }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit job posting</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Role title" value={form.title} onChange={set('title')} />
            <MobileTextField
              fullWidth
              select
              label="Department"
              value={form.department_id}
              onChange={set('department_id')}
              options={[{ value: '', label: 'Unassigned' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Employment type"
              value={form.employment_type}
              onChange={set('employment_type')}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            />
            <MobileTextField fullWidth label="Location" value={form.location} onChange={set('location')} />
            <MobileTextField fullWidth type="number" label="Openings" value={form.openings_count} onChange={set('openings_count')} />
            <MobileTextField
              fullWidth
              select
              label="Experience required?"
              value={form.experience_required}
              onChange={set('experience_required')}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No (Freshers)' }]}
            />
            {form.experience_required === 'yes' && (
              <>
                <MobileTextField fullWidth type="number" label="Experience min (yrs)" value={form.experience_min_years} onChange={set('experience_min_years')} />
                <MobileTextField fullWidth type="number" label="Experience max (yrs)" value={form.experience_max_years} onChange={set('experience_max_years')} />
              </>
            )}
            <MobileTextField fullWidth type="number" label="Salary min (₹/yr)" value={form.salary_range_min} onChange={set('salary_range_min')} />
            <MobileTextField fullWidth type="number" label="Salary max (₹/yr)" value={form.salary_range_max} onChange={set('salary_range_max')} />
            <MobileTextField fullWidth multiline rows={3} label="Description" value={form.description} onChange={set('description')} />
            <MobileTextField fullWidth label="LinkedIn posting URL" value={form.linkedin_url} onChange={set('linkedin_url')} />
            <MobileTextField fullWidth label="Naukri posting URL" value={form.naukri_url} onChange={set('naukri_url')} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={form.status}
              onChange={set('status')}
              options={JOB_STATUSES}
            />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => { setEditOpen(false); setEditingJob(null); setForm(emptyJobForm); }}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleUpdate} disabled={saving || !form.title || !editingJob}>{saving ? 'Updating…' : 'Save changes'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

function JobDetail({ jobId, onBack }) {
  const isMobile = useMobile();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(null);
  const [candidateForm, setCandidateForm] = useState({ full_name: '', email: '', phone: '', source: 'linkedin', current_company: '', expected_ctc: '', notice_period_days: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hireOpen, setHireOpen] = useState(null);
  const [hireDate, setHireDate] = useState('');
  const [message, setMessage] = useState(null);

  const load = useCallback(() => client.get(`/recruitment/jobs/${jobId}`).then(({ data }) => { setJob(data.job); setApplications(data.applications || []); }), [jobId]);
  useEffect(() => { load(); }, [load]);

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

  const openDetail = (app) => setDetailOpen(app);
  const closeDetail = () => setDetailOpen(null);

  if (!job) return null;

  return (
    <Box>
      <MobileButton startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }} variant="text">All job postings</MobileButton>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>{job.title}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
            {job.department_name || 'Unassigned'} · {job.filled_count}/{job.openings_count} filled
          </Typography>
        </Box>
        <MobileStack gap={1} direction="row">
          {job.external_links?.linkedin && (
            <MobileButton size="small" variant="outlined" endIcon={<OpenInNewIcon fontSize="small" />} component={MuiLink} href={job.external_links.linkedin} target="_blank">LinkedIn</MobileButton>
          )}
          {job.external_links?.naukri && (
            <MobileButton size="small" variant="outlined" endIcon={<OpenInNewIcon fontSize="small" />} component={MuiLink} href={job.external_links.naukri} target="_blank">Naukri</MobileButton>
          )}
          <MobileButton variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add candidate</MobileButton>
        </MobileStack>
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Candidate</TableCell><TableCell>Source</TableCell><TableCell>Current company</TableCell>
                <TableCell align="right">Expected CTC</TableCell><TableCell align="right">Notice (days)</TableCell>
                <TableCell>Stage</TableCell><TableCell>Applied</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.875rem' }}>{a.full_name}</Typography>
                    <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>{a.email}</Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={a.source} variant="outlined" /></TableCell>
                  <TableCell>{a.current_company || '—'}</TableCell>
                  <TableCell align="right" className="figure">{a.expected_ctc ? `₹${Number(a.expected_ctc).toLocaleString('en-IN')}` : '—'}</TableCell>
                  <TableCell align="right" className="figure">{a.notice_period_days ?? '—'}</TableCell>
                  <TableCell>
                    <MobileTextField
                      select
                      size="small"
                      value={a.stage}
                      onChange={(e) => moveStage(a, e.target.value)}
                      options={STAGES.map((s) => ({ value: s, label: s, disabled: a.stage === 'hired' && s !== 'hired' }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(a.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {!applications.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No candidates yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      {/* Application Detail Dialog */}
      {detailOpen && (
        <MobileDialog open={Boolean(detailOpen)} onClose={closeDetail} maxWidth="md" fullWidth>
          <DialogTitle>{detailOpen.full_name} — Application Details</DialogTitle>
          <DialogContent>
            <MobileFormGrid sx={{ mt: 0.5 }}>
              <MobileTextField fullWidth label="Full name" value={detailOpen.full_name} disabled />
              <MobileTextField fullWidth label="Email" value={detailOpen.email} disabled />
              <MobileTextField fullWidth label="Phone" value={detailOpen.phone || '—'} disabled />
              <MobileTextField fullWidth label="Source" value={detailOpen.source} disabled />
              <MobileTextField fullWidth label="Current company" value={detailOpen.current_company || '—'} disabled />
              <MobileTextField fullWidth label="Expected CTC (₹/yr)" value={detailOpen.expected_ctc ? `₹${Number(detailOpen.expected_ctc).toLocaleString('en-IN')}` : '—'} disabled />
              <MobileTextField fullWidth label="Notice period (days)" value={detailOpen.notice_period_days ?? '—'} disabled />
              <MobileTextField fullWidth label="Stage" value={detailOpen.stage} disabled />
              <MobileTextField fullWidth label="Applied on" value={new Date(detailOpen.applied_at).toLocaleString('en-IN')} disabled />
              {detailOpen.resume_url && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Resume</Typography>
                  <MuiLink href={detailOpen.resume_url} target="_blank" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <OpenInNewIcon fontSize="small" /> Open Resume
                  </MuiLink>
                </Box>
              )}
              {detailOpen.linkedin && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>LinkedIn</Typography>
                  <MuiLink href={detailOpen.linkedin} target="_blank" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <OpenInNewIcon fontSize="small" /> Open Profile
                  </MuiLink>
                </Box>
              )}
              {detailOpen.portfolio && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Portfolio</Typography>
                  <MuiLink href={detailOpen.portfolio} target="_blank" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <OpenInNewIcon fontSize="small" /> Open Portfolio
                  </MuiLink>
                </Box>
              )}
              {detailOpen.cover_letter && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Cover Letter</Typography>
                  <Typography variant="body" sx={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', p: 2, borderRadius: 1, border: '1px solid var(--brd)' }}>
                    {detailOpen.cover_letter}
                  </Typography>
                </Box>
              )}
            </MobileFormGrid>
          </DialogContent>
          <MobileActionButtons>
            <MobileButton onClick={closeDetail}>Close</MobileButton>
          </MobileActionButtons>
        </MobileDialog>
      )}

      <MobileDialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add candidate</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Full name" value={candidateForm.full_name} onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })} />
            <MobileTextField fullWidth label="Email" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} />
            <MobileTextField fullWidth label="Phone" value={candidateForm.phone} onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Source"
              value={candidateForm.source}
              onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
              options={SOURCES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            />
            <MobileTextField fullWidth label="Current company" value={candidateForm.current_company} onChange={(e) => setCandidateForm({ ...candidateForm, current_company: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Expected CTC (₹/yr)" value={candidateForm.expected_ctc} onChange={(e) => setCandidateForm({ ...candidateForm, expected_ctc: e.target.value })} />
            <MobileTextField fullWidth type="number" label="Notice period (days)" value={candidateForm.notice_period_days} onChange={(e) => setCandidateForm({ ...candidateForm, notice_period_days: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setAddOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={addCandidate} disabled={saving || !candidateForm.full_name}>{saving ? 'Adding…' : 'Add'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={Boolean(hireOpen)} onClose={() => setHireOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Hire {hireOpen?.full_name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 1 }}>Creates an employee record from this candidate. Finish compensation and bank details afterwards via Edit.</Alert>
          <MobileTextField fullWidth type="date" label="Date of joining" InputLabelProps={{ shrink: true }} value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setHireOpen(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={confirmHire} disabled={!hireDate}>Confirm hire</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

export default function Recruitment() {
  const [selectedJobId, setSelectedJobId] = useState(null);
  return selectedJobId
    ? <JobDetail jobId={selectedJobId} onBack={() => setSelectedJobId(null)} />
    : <JobList onOpenJob={setSelectedJobId} />;
}