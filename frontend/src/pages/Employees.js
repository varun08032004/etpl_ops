import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, MenuItem, Tabs, Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import Money from '../components/Money';

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', work_email: '', date_of_joining: '', employment_type: 'full_time' });
  const [saving, setSaving] = useState(false);

  const load = async (q) => {
    const { data } = await client.get('/employees', { params: q ? { search: q } : {} });
    setEmployees(data.employees);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await client.post('/employees', form);
      setOpen(false);
      setForm({ full_name: '', work_email: '', date_of_joining: '', employment_type: 'full_time' });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">People</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add employee</Button>
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
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Work email" value={form.work_email} onChange={(e) => setForm({ ...form, work_email: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Date of joining" InputLabelProps={{ shrink: true }}
                value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Employment type" value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
                {['full_time', 'part_time', 'contract', 'intern'].map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.full_name || !form.date_of_joining}>
            {saving ? 'Saving…' : 'Add employee'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EmployeeDetail() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    client.get(`/employees/${id}`).then(({ data }) => setEmployee(data.employee));
  }, [id]);

  if (!employee) return null;

  return (
    <Box>
      <Typography variant="h5">{employee.full_name}</Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>{employee.employee_code} · {employee.work_email}</Typography>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Compensation" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3, maxWidth: 560 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Status</Typography><StatusChip status={employee.status} /></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Employment type</Typography><Typography sx={{ textTransform: 'capitalize' }}>{employee.employment_type?.replace('_', ' ')}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Date of joining</Typography><Typography className="figure">{employee.date_of_joining?.slice(0, 10)}</Typography></Grid>
            <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Phone</Typography><Typography>{employee.phone || '—'}</Typography></Grid>
          </Grid>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3, maxWidth: 560 }}>
          {employee.ctc_annual ? (
            <Grid container spacing={2}>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Annual CTC</Typography><Money amount={employee.ctc_annual} size="1.1rem" /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly basic</Typography><Money amount={employee.basic_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Monthly HRA</Typography><Money amount={employee.hra_monthly} /></Grid>
              <Grid item xs={6}><Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Other allowances</Typography><Money amount={employee.other_allowances_monthly} /></Grid>
            </Grid>
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>No compensation on file, or you don't have permission to view it.</Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}

export { EmployeeList, EmployeeDetail };
