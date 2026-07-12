import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import Money from '../components/Money';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MyProfile() {
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState(0);
  const [payslips, setPayslips] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [docs, setDocs] = useState([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notLinked, setNotLinked] = useState(false);

  const loadAll = async () => {
    try {
      const { data } = await client.get('/employees/me');
      setEmployee(data.employee);
      const [payslipRes, leaveRes, leaveTypesRes, docsRes] = await Promise.all([
        client.get('/payroll/me/payslips'),
        client.get('/employees/me/leave'),
        client.get('/employees/leave-types'),
        client.get('/documents', { params: { entity_type: 'employee' } }),
      ]);
      setPayslips(payslipRes.data.payslips);
      setLeaveRequests(leaveRes.data.leaveRequests);
      setLeaveTypes(leaveTypesRes.data.leaveTypes);
      setDocs(docsRes.data.documents);
    } catch (err) {
      if (err.response?.status === 404) setNotLinked(true);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleLeaveSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post(`/employees/${employee.id}/leave`, leaveForm);
      setLeaveOpen(false);
      setLeaveForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (doc) => {
    const { data } = await client.get(`/documents/${doc.id}/download`);
    window.open(data.url, '_blank');
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', `${employee.full_name} — Resume`);
    fd.append('doc_type', 'resume');
    fd.append('entity_type', 'employee');
    fd.append('entity_id', employee.id);
    await client.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    loadAll();
  };

  if (notLinked) {
    return (
      <Alert severity="warning">
        Your login isn't linked to an employee record yet — ask an admin to link it via the Team logins page so your profile, payslips, and leave balance show up here.
      </Alert>
    );
  }

  if (!employee) return null;

  return (
    <Box>
      <Typography variant="h5">My Profile</Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>{employee.employee_code} · {employee.designation || 'No designation set'} · {employee.department || 'No department set'}</Typography>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Compensation" />
        <Tab label="Payslips" />
        <Tab label="Leave" />
        <Tab label="Documents" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3, maxWidth: 560 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Full name</Typography><Typography>{employee.full_name}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Work email</Typography><Typography>{employee.work_email || '—'}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Phone</Typography><Typography>{employee.phone || '—'}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Date of joining</Typography><Typography className="figure">{employee.date_of_joining?.slice(0, 10)}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Status</Typography><StatusChip status={employee.status} /></Grid>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mt: 1 }}>Personal details are managed by HR — reach out to update anything here.</Alert>
            </Grid>
          </Grid>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3, maxWidth: 560 }}>
          {employee.ctc_annual ? (
            <Grid container spacing={2}>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Annual CTC</Typography><Money amount={employee.ctc_annual} size="1.2rem" /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Tax regime</Typography><Typography sx={{ textTransform: 'capitalize' }}>{employee.tax_regime}</Typography></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly Basic</Typography><Money amount={employee.basic_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly DA</Typography><Money amount={employee.da_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly HRA</Typography><Money amount={employee.hra_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Other allowances</Typography><Money amount={employee.other_allowances_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>EPF applicable</Typography><Typography>{employee.pf_applicable ? 'Yes' : 'No'}</Typography></Grid>
            </Grid>
          ) : (
            <Alert severity="warning">No compensation on file yet — contact HR.</Alert>
          )}
        </Paper>
      )}

      {tab === 2 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow><TableCell>Period</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Deductions</TableCell><TableCell align="right">Net</TableCell><TableCell>Status</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{MONTHS[p.period_month - 1]} {p.period_year}</TableCell>
                  <TableCell align="right"><Money amount={p.gross_pay} /></TableCell>
                  <TableCell align="right"><Money amount={Number(p.gross_pay) - Number(p.net_pay)} /></TableCell>
                  <TableCell align="right"><Money amount={p.net_pay} /></TableCell>
                  <TableCell><StatusChip status={p.run_status} /></TableCell>
                </TableRow>
              ))}
              {!payslips.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No payslips yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Chip label={`Annual leave: ${employee.leave_balance_annual ?? 0} days left`} variant="outlined" />
              <Chip label={`Sick leave: ${employee.leave_balance_sick ?? 0} days left`} variant="outlined" />
            </Box>
            <Button variant="contained" onClick={() => setLeaveOpen(true)}>Request leave</Button>
          </Box>
          <Paper>
            <Table>
              <TableHead>
                <TableRow><TableCell>Type</TableCell><TableCell>Dates</TableCell><TableCell>Days</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {leaveRequests.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.leave_type_name}</TableCell>
                    <TableCell className="figure">{l.start_date?.slice(0, 10)} → {l.end_date?.slice(0, 10)}</TableCell>
                    <TableCell className="figure">{l.num_days}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{l.reason || '—'}</TableCell>
                    <TableCell><StatusChip status={l.status} /></TableCell>
                  </TableRow>
                ))}
                {!leaveRequests.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No leave requests yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {tab === 4 && (
        <Box>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mb: 3 }}>
            Upload resume
            <input type="file" hidden onChange={handleResumeUpload} />
          </Button>
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

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Request leave</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Leave type" margin="normal" value={leaveForm.leave_type_id} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type_id: e.target.value })}>
            {leaveTypes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth type="date" label="Start date" margin="normal" InputLabelProps={{ shrink: true }} value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
          <TextField fullWidth type="date" label="End date" margin="normal" InputLabelProps={{ shrink: true }} value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
          <TextField fullWidth label="Reason" margin="normal" multiline rows={2} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLeaveSubmit} disabled={saving || !leaveForm.leave_type_id || !leaveForm.start_date || !leaveForm.end_date}>
            {saving ? 'Submitting…' : 'Submit request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}