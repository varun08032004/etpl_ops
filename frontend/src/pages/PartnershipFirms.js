import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
  IconButton, List, ListItem, ListItemText, Divider, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CloseIcon from '@mui/icons-material/Close';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const STAGE_COLOR = {
  prospect: 'default', contacted: 'info', meeting_scheduled: 'info', demo_done: 'primary',
  partnership_discussion: 'warning', active_partner: 'success', dormant: 'default', dead: 'error',
};
const STAGES = Object.keys(STAGE_COLOR);
const FIRM_TYPES = ['ca_firm', 'audit_firm', 'esg_consultancy', 'law_firm', 'other'];
const SERVICES = ['brsr', 'ghg', 'tcfd', 'cdp', 'gri', 'iso14064', 'other'];
const FIRM_SIZES = ['small', 'mid', 'large', 'unknown'];
const SOURCES = ['cold_outreach', 'referral', 'event', 'linkedin', 'inbound', 'other'];
const ACTIVITY_TYPES = ['cold_call', 'follow_up_call', 'email', 'meeting', 'demo', 'other'];

const emptyFirm = {
  firm_name: '', firm_type: 'ca_firm', city: '', services_offered: [], firm_size: 'unknown',
  contact_name: '', designation: '', email: '', phone: '', stage: 'prospect', source: 'cold_outreach',
  assigned_bde: '', website: '', notes: '',
};
const emptyActivity = { activity_type: 'cold_call', activity_date: '', outcome: '', next_follow_up_date: '' };

const FIRM_TYPE_LABEL = { ca_firm: 'CA firm', audit_firm: 'Audit firm', esg_consultancy: 'ESG consultancy', law_firm: 'Law firm' };

export default function PartnershipFirms() {
  const { staff } = useAuth();
  const [isPartnershipsHead, setIsPartnershipsHead] = useState(false);
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isPartnershipsHead;
  const canConvert = ['owner', 'admin', 'finance'].includes(staff?.role) || isPartnershipsHead;
  const canDelete = staff?.role === 'owner';

  const [firms, setFirms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stageFilter, setStageFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyFirm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFirm, setDetailFirm] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const [loggingActivity, setLoggingActivity] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    const params = stageFilter ? { stage: stageFilter } : {};
    client.get('/partnerships/firms', { params }).then(({ data }) => setFirms(data.firms)).catch(() => setFirms([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [stageFilter]);

  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsPartnershipsHead(!!(dept?.isHOD && dept?.departmentName === 'Partnerships'));
      })
      .catch(() => setIsPartnershipsHead(false));
  }, [staff?.role]);

  const totals = firms.reduce((acc, f) => {
    acc.total++;
    if (f.stage === 'active_partner') acc.active++;
    if (['prospect', 'contacted', 'meeting_scheduled', 'demo_done', 'partnership_discussion'].includes(f.stage)) acc.inPipeline++;
    return acc;
  }, { total: 0, active: 0, inPipeline: 0 });

  const openCreate = () => { setEditingId(null); setForm(emptyFirm); setError(''); setOpen(true); };
  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({
      firm_name: f.firm_name, firm_type: f.firm_type, city: f.city || '', services_offered: f.services_offered || [],
      firm_size: f.firm_size, contact_name: f.contact_name || '', designation: f.designation || '',
      email: f.email || '', phone: f.phone || '', stage: f.stage, source: f.source, assigned_bde: f.assigned_bde || '',
      website: f.website || '', notes: f.notes || '',
    });
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/partnerships/firms/${editingId}`, form);
      else await client.post('/partnerships/firms', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (f) => {
    if (!window.confirm(`Convert "${f.firm_name}" into a CRM record?`)) return;
    try {
      await client.post(`/partnerships/firms/${f.id}/convert`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert');
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Delete "${f.firm_name}"? This cannot be undone.`)) return;
    await client.delete(`/partnerships/firms/${f.id}`);
    load();
  };

  const openDetail = async (f) => {
    setDetailFirm(f);
    setActivityForm(emptyActivity);
    setDetailOpen(true);
    try {
      const { data } = await client.get(`/partnerships/firms/${f.id}`);
      setDetailFirm(data.firm);
      setActivities(data.activities);
    } catch {
      setActivities([]);
    }
  };

  const handleLogActivity = async () => {
    setLoggingActivity(true);
    try {
      await client.post('/partnerships/activities', { ...activityForm, firm_id: detailFirm.id });
      const { data } = await client.get(`/partnerships/firms/${detailFirm.id}`);
      setActivities(data.activities);
      setActivityForm(emptyActivity);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to log activity');
    } finally {
      setLoggingActivity(false);
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await client.post('/partnerships/firms/import-csv', fd);
      setImportResult(data);
      load();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Partner Firms</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            CA firms, audit firms, and ESG consultancies your BDE is chasing — BRSR/GHG/TCFD/CDP/GRI is the referral wedge.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => { setImportResult(null); setImportOpen(true); }}>Import CSV</Button>}
          {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add firm</Button>}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total tracked</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{totals.total}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>In pipeline</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{totals.inPipeline}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Active partners</Typography>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }} className="figure">{totals.active}</Typography>
        </Paper>
      </Box>

      <TextField select size="small" label="Filter stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} sx={{ mb: 2, minWidth: 200 }}>
        <MenuItem value="">All stages</MenuItem>
        {STAGES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</MenuItem>)}
      </TextField>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Firm</TableCell>
              <TableCell>Services</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>BDE</TableCell>
              <TableCell>Next follow-up</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {firms.map((f) => (
              <TableRow key={f.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.firm_name}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{FIRM_TYPE_LABEL[f.firm_type] || f.firm_type}{f.city ? ` · ${f.city}` : ''}</Typography>
                </TableCell>
                <TableCell>
                  {(f.services_offered || []).map((s) => <Chip key={s} size="small" label={s.toUpperCase()} sx={{ mr: 0.5, mb: 0.5 }} />)}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>
                  {f.contact_name && <div>{f.contact_name}{f.designation ? ` (${f.designation})` : ''}</div>}
                  {f.phone && <div>{f.phone}</div>}
                </TableCell>
                <TableCell><Chip size="small" label={f.stage.replace(/_/g, ' ')} color={STAGE_COLOR[f.stage]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{f.bde_name || '—'}</TableCell>
                <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>
                  {f.next_follow_up_date ? f.next_follow_up_date.slice(0, 10) : '—'}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openDetail(f)}><VisibilityOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>
                  {canConvert && f.stage === 'active_partner' && !f.converted_party_id && (
                    <Button size="small" onClick={() => handleConvert(f)}>Convert</Button>
                  )}
                  {canEdit && <Button size="small" onClick={() => openEdit(f)}>Edit</Button>}
                  {canDelete && <Button size="small" color="error" onClick={() => handleDelete(f)}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!firms.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No firms tracked yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Add/Edit firm dialog ─────────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit' : 'Add'} firm</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Firm name" margin="normal" value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })} />
          <TextField fullWidth select label="Firm type" margin="normal" value={form.firm_type} onChange={(e) => setForm({ ...form, firm_type: e.target.value })}>
            {FIRM_TYPES.map((t) => <MenuItem key={t} value={t}>{FIRM_TYPE_LABEL[t] || t}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="City" margin="normal" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <TextField
            fullWidth select label="Services offered" margin="normal" SelectProps={{ multiple: true }}
            value={form.services_offered} onChange={(e) => setForm({ ...form, services_offered: e.target.value })}
          >
            {SERVICES.map((s) => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Firm size" margin="normal" value={form.firm_size} onChange={(e) => setForm({ ...form, firm_size: e.target.value })}>
            {FIRM_SIZES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Contact name" margin="normal" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <TextField fullWidth label="Designation" margin="normal" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          <TextField fullWidth label="Email" margin="normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField fullWidth label="Phone" margin="normal" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField fullWidth select label="Stage" margin="normal" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Source" margin="normal" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {SOURCES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
          <TextField fullWidth select label="Assigned BDE" margin="normal" value={form.assigned_bde} onChange={(e) => setForm({ ...form, assigned_bde: e.target.value })}>
            <MenuItem value="">— Unassigned (you) —</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Website" margin="normal" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.firm_name}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Firm detail + activity timeline ─────────────────────────────── */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {detailFirm?.firm_name}
          <IconButton onClick={() => setDetailOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {detailFirm && (
            <>
              <Chip size="small" label={detailFirm.stage?.replace(/_/g, ' ')} color={STAGE_COLOR[detailFirm.stage]} sx={{ textTransform: 'capitalize', mb: 2 }} />
              {canEdit && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>Log a call / catch-up</Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <TextField select label="Type" size="small" sx={{ minWidth: 150 }} value={activityForm.activity_type} onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}>
                      {ACTIVITY_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>)}
                    </TextField>
                    <TextField type="date" label="Date" size="small" InputLabelProps={{ shrink: true }} value={activityForm.activity_date} onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })} />
                    <TextField type="date" label="Next follow-up" size="small" InputLabelProps={{ shrink: true }} value={activityForm.next_follow_up_date} onChange={(e) => setActivityForm({ ...activityForm, next_follow_up_date: e.target.value })} />
                  </Box>
                  <TextField fullWidth multiline rows={2} label="Outcome / notes" size="small" sx={{ mt: 1.5 }} value={activityForm.outcome} onChange={(e) => setActivityForm({ ...activityForm, outcome: e.target.value })} />
                  <Button sx={{ mt: 1 }} variant="contained" size="small" onClick={handleLogActivity} disabled={loggingActivity}>
                    {loggingActivity ? 'Logging…' : 'Log activity'}
                  </Button>
                </Paper>
              )}

              <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>Activity history</Typography>
              <List dense disablePadding>
                {activities.map((a, i) => (
                  <Box key={a.id}>
                    <ListItem disableGutters>
                      <ListItemText
                        primary={`${a.activity_type.replace(/_/g, ' ')} — ${a.activity_date?.slice(0, 10)}`}
                        secondary={a.outcome || 'No notes'}
                        primaryTypographyProps={{ sx: { textTransform: 'capitalize', fontWeight: 600, fontSize: '0.85rem' } }}
                        secondaryTypographyProps={{ sx: { fontSize: '0.78rem' } }}
                      />
                      {a.next_follow_up_date && <Chip size="small" label={`Next: ${a.next_follow_up_date.slice(0, 10)}`} />}
                    </ListItem>
                    {i < activities.length - 1 && <Divider component="li" />}
                  </Box>
                ))}
                {!activities.length && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>No activity logged yet.</Typography>}
              </List>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── CSV import dialog ────────────────────────────────────────────── */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Import firms from CSV</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
            Columns: firm_name, firm_type, city, services_offered (pipe-separated, e.g. brsr|ghg), contact_name, designation, email, phone, stage, website, notes.
            Only firm_name is required — everything else is optional.
          </Typography>
          <input ref={fileInputRef} type="file" accept=".csv" />
          {importing && <LinearProgress sx={{ mt: 2 }} />}
          {importResult && !importResult.error && (
            <Alert severity={importResult.skipped ? 'warning' : 'success'} sx={{ mt: 2 }}>
              Imported {importResult.imported}, skipped {importResult.skipped}.
              {!!importResult.errors?.length && (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {importResult.errors.slice(0, 5).map((e, i) => <li key={i} style={{ fontSize: '0.75rem' }}>{e}</li>)}
                </Box>
              )}
            </Alert>
          )}
          {importResult?.error && <Alert severity="error" sx={{ mt: 2 }}>{importResult.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleImport} disabled={importing}>{importing ? 'Importing…' : 'Import'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}