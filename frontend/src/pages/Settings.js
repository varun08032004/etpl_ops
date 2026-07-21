import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';

function ComplianceRatesTab() {
  const [settings, setSettings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const load = () => client.get('/settings/compliance').then(({ data }) => setSettings(data.settings)).catch(() => setSettings([]));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setError('');
    try {
      await client.put(`/settings/compliance/${editing.key}`, { value });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2.5 }}>
        These drive real statutory payroll calculations (EPF/ESIC thresholds, disbursal deadlines, F&F windows).
        Changing one changes every payroll run from this point forward — verify with your CA before editing.
      </Alert>
      <Paper>
        <Table>
          <TableHead><TableRow><TableCell>Setting</TableCell><TableCell>Value</TableCell><TableCell>Note</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
          <TableBody>
            {settings.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="figure">{s.key}</TableCell>
                <TableCell className="figure" sx={{ fontWeight: 600 }}>{s.value}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{s.note}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => { setEditing(s); setValue(s.value); setError(''); }}><EditIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit {editing?.key}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>{editing?.note}</Typography>
          <TextField fullWidth label="Value" value={value} onChange={(e) => setValue(e.target.value)} margin="normal" autoFocus />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function PTSlabsTab() {
  const [slabs, setSlabs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ id: null, state: '', gross_from: '', gross_to: '', monthly_amount: '', applies_in_february_override: '' });
  const [error, setError] = useState('');

  const load = () => client.get('/settings/pt-slabs').then(({ data }) => setSlabs(data.slabs)).catch(() => setSlabs([]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ id: null, state: '', gross_from: '', gross_to: '', monthly_amount: '', applies_in_february_override: '' }); setError(''); setDialogOpen(true); };
  const openEdit = (s) => { setForm({ ...s }); setError(''); setDialogOpen(true); };

  const save = async () => {
    setError('');
    try {
      const payload = { ...form };
      delete payload.id;
      if (form.id) await client.put(`/settings/pt-slabs/${form.id}`, payload);
      else await client.post('/settings/pt-slabs', payload);
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this PT slab?')) return;
    await client.delete(`/settings/pt-slabs/${id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add PT slab</Button>
      </Box>
      <Paper>
        <Table>
          <TableHead>
            <TableRow><TableCell>State</TableCell><TableCell align="right">Gross from</TableCell><TableCell align="right">Gross to</TableCell><TableCell align="right">Monthly PT</TableCell><TableCell align="right">Feb override</TableCell><TableCell align="right"></TableCell></TableRow>
          </TableHead>
          <TableBody>
            {slabs.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.state}</TableCell>
                <TableCell align="right" className="figure">₹{Number(s.gross_from).toLocaleString('en-IN')}</TableCell>
                <TableCell align="right" className="figure">{s.gross_to ? `₹${Number(s.gross_to).toLocaleString('en-IN')}` : '—'}</TableCell>
                <TableCell align="right" className="figure">₹{Number(s.monthly_amount).toLocaleString('en-IN')}</TableCell>
                <TableCell align="right" className="figure">{s.applies_in_february_override ? `₹${Number(s.applies_in_february_override).toLocaleString('en-IN')}` : '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(s.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!slabs.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No PT slabs configured yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{form.id ? 'Edit' : 'New'} PT slab</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="State" margin="normal" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <TextField fullWidth type="number" label="Gross from (₹/month)" margin="normal" value={form.gross_from} onChange={(e) => setForm({ ...form, gross_from: e.target.value })} />
          <TextField fullWidth type="number" label="Gross to (blank = no upper limit)" margin="normal" value={form.gross_to} onChange={(e) => setForm({ ...form, gross_to: e.target.value })} />
          <TextField fullWidth type="number" label="Monthly PT amount (₹)" margin="normal" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} />
          <TextField fullWidth type="number" label="February override (optional)" margin="normal" value={form.applies_in_february_override} onChange={(e) => setForm({ ...form, applies_in_february_override: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function TaxSlabsTab() {
  const [slabs, setSlabs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ id: null, regime: 'new', fiscal_year: '', income_from: '', income_to: '', rate_percent: '', standard_deduction: '', cess_percent: '' });
  const [error, setError] = useState('');

  const load = () => client.get('/settings/tax-slabs').then(({ data }) => setSlabs(data.slabs)).catch(() => setSlabs([]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ id: null, regime: 'new', fiscal_year: '', income_from: '', income_to: '', rate_percent: '', standard_deduction: '', cess_percent: '' }); setError(''); setDialogOpen(true); };
  const openEdit = (s) => { setForm({ ...s }); setError(''); setDialogOpen(true); };

  const save = async () => {
    setError('');
    try {
      const payload = { ...form };
      delete payload.id;
      if (form.id) await client.put(`/settings/tax-slabs/${form.id}`, payload);
      else await client.post('/settings/tax-slabs', payload);
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this tax slab?')) return;
    await client.delete(`/settings/tax-slabs/${id}`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add tax slab</Button>
      </Box>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>FY</TableCell><TableCell>Regime</TableCell><TableCell align="right">From</TableCell><TableCell align="right">To</TableCell>
              <TableCell align="right">Rate</TableCell><TableCell align="right">Std deduction</TableCell><TableCell align="right">Cess</TableCell><TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slabs.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="figure">{s.fiscal_year}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{s.regime}</TableCell>
                <TableCell align="right" className="figure">₹{Number(s.income_from).toLocaleString('en-IN')}</TableCell>
                <TableCell align="right" className="figure">{s.income_to ? `₹${Number(s.income_to).toLocaleString('en-IN')}` : '—'}</TableCell>
                <TableCell align="right" className="figure">{s.rate_percent}%</TableCell>
                <TableCell align="right" className="figure">₹{Number(s.standard_deduction).toLocaleString('en-IN')}</TableCell>
                <TableCell align="right" className="figure">{s.cess_percent}%</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(s.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!slabs.length && <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No tax slabs configured yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{form.id ? 'Edit' : 'New'} tax slab</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Regime" margin="normal" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })}>
            <MenuItem value="new">New regime</MenuItem>
            <MenuItem value="old">Old regime</MenuItem>
          </TextField>
          <TextField fullWidth label="Fiscal year (e.g. FY2026-27)" margin="normal" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })} />
          <TextField fullWidth type="number" label="Income from (₹)" margin="normal" value={form.income_from} onChange={(e) => setForm({ ...form, income_from: e.target.value })} />
          <TextField fullWidth type="number" label="Income to (blank = no upper limit)" margin="normal" value={form.income_to} onChange={(e) => setForm({ ...form, income_to: e.target.value })} />
          <TextField fullWidth type="number" label="Rate (%)" margin="normal" value={form.rate_percent} onChange={(e) => setForm({ ...form, rate_percent: e.target.value })} />
          <TextField fullWidth type="number" label="Standard deduction (₹)" margin="normal" value={form.standard_deduction} onChange={(e) => setForm({ ...form, standard_deduction: e.target.value })} />
          <TextField fullWidth type="number" label="Cess (%)" margin="normal" value={form.cess_percent} onChange={(e) => setForm({ ...form, cess_percent: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function GeneralTab() {
  const [settings, setSettings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const load = () => client.get('/settings/app').then(({ data }) => setSettings(data.settings)).catch(() => setSettings([]));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setError('');
    try {
      await client.put(`/settings/app/${editing.key}`, { value });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  return (
    <Box>
      <Paper>
        <Table>
          <TableHead><TableRow><TableCell>Setting</TableCell><TableCell>Value</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
          <TableBody>
            {settings.map((s) => (
              <TableRow key={s.key}>
                <TableCell>{s.label}</TableCell>
                <TableCell className="figure" sx={{ fontWeight: 600 }}>{s.value ?? '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => { setEditing(s); setValue(s.value ?? ''); setError(''); }}><EditIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit {editing?.label}</DialogTitle>
        <DialogContent>
          {editing?.type === 'enum' ? (
            <TextField fullWidth select label="Value" value={value} onChange={(e) => setValue(e.target.value)} margin="normal">
              {editing.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
          ) : (
            <TextField fullWidth type="number" label="Value" value={value} onChange={(e) => setValue(e.target.value)} margin="normal" autoFocus />
          )}
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Settings() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Settings</Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="General" />
        <Tab label="Compliance rates" />
        <Tab label="Professional Tax slabs" />
        <Tab label="Income Tax slabs" />
      </Tabs>
      {tab === 0 && <GeneralTab />}
      {tab === 1 && <ComplianceRatesTab />}
      {tab === 2 && <PTSlabsTab />}
      {tab === 3 && <TaxSlabsTab />}
    </Box>
  );
}