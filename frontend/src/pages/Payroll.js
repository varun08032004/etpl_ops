import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField, MenuItem, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import Money from '../components/Money';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Payroll() {
  const [runs, setRuns] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const now = new Date();
  const [form, setForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [detail, setDetail] = useState(null);

  // Not built as its own list endpoint yet — the backend has GET /payroll/runs/:id.
  // Adjust once you add a GET /payroll/runs list endpoint (small addition to routes/payroll.js).
  const load = () => client.get('/payroll/runs').then(({ data }) => setRuns(data.payrollRuns || [])).catch(() => setRuns([]));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/payroll/runs', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create run');
    } finally {
      setSaving(false);
    }
  };

  const handleDisburse = async (id) => {
    if (!window.confirm('This will trigger real bank transfers via RazorpayX. Continue?')) return;
    await client.post(`/payroll/runs/${id}/disburse`);
    load();
  };

  const openDetail = async (id) => {
    const { data } = await client.get(`/payroll/runs/${id}`);
    setDetail(data);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Payroll</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New payroll run</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Period</TableCell>
              <TableCell align="right">Gross</TableCell>
              <TableCell align="right">Deductions</TableCell>
              <TableCell align="right">Net</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id} hover onClick={() => openDetail(r.id)} sx={{ cursor: 'pointer' }}>
                <TableCell>{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                <TableCell align="right"><Money amount={r.total_gross} /></TableCell>
                <TableCell align="right"><Money amount={r.total_deductions} /></TableCell>
                <TableCell align="right"><Money amount={r.total_net} /></TableCell>
                <TableCell><StatusChip status={r.status} /></TableCell>
                <TableCell align="right">
                  {r.status === 'draft' && (
                    <Button size="small" onClick={(e) => { e.stopPropagation(); handleDisburse(r.id); }}>Disburse</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!runs.length && (
              <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                No payroll runs yet. (Also: add a <code>GET /api/payroll/runs</code> list endpoint — see note in this file.)
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {detail && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 2 }}>{MONTHS[detail.run.period_month - 1]} {detail.run.period_year} — breakdown</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Employee</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">PF</TableCell><TableCell align="right">PT</TableCell><TableCell align="right">LOP days</TableCell><TableCell align="right">Net</TableCell><TableCell>Status</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {detail.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.full_name}</TableCell>
                  <TableCell align="right"><Money amount={it.gross_pay} /></TableCell>
                  <TableCell align="right"><Money amount={it.pf_deduction} /></TableCell>
                  <TableCell align="right"><Money amount={it.professional_tax} /></TableCell>
                  <TableCell align="right" className="figure">{it.loss_of_pay_days}</TableCell>
                  <TableCell align="right"><Money amount={it.net_pay} /></TableCell>
                  <TableCell><StatusChip status={it.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New payroll run</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5, width: 320 }}>
            <Grid item xs={6}>
              <TextField fullWidth select label="Month" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="number" label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Alert severity="info" sx={{ mt: 2 }}>Computed from attendance + each employee's CTC breakup on file. Review before disbursing — disbursal triggers real payouts.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create run'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
