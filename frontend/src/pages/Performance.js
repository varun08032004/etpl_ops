import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, TextField,
  Alert, Chip, LinearProgress, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = { pending_self: 'default', pending_manager: 'warning', pending_acknowledgement: 'info', closed: 'success' };

function CycleList({ onOpenCycle }) {
  const { staff } = useAuth();
  const canManage = ['owner', 'admin', 'hr'].includes(staff?.role);
  const [cycles, setCycles] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => client.get('/performance/cycles').then(({ data }) => setCycles(data.cycles)).catch(() => setCycles([]));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await client.post('/performance/cycles', form);
      setOpen(false);
      setForm({ name: '', start_date: '', end_date: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create cycle');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id) => { await client.post(`/performance/cycles/${id}/activate`); load(); };
  const close = async (id) => {
    if (!window.confirm('Close this cycle? Ratings will be finalized.')) return;
    await client.post(`/performance/cycles/${id}/close`);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Performance</Typography>
        {canManage && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New review cycle</Button>}
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow><TableCell>Cycle</TableCell><TableCell>Period</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {cycles.map((c) => (
              <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpenCycle(c)}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="figure">{c.start_date?.slice(0, 10)} → {c.end_date?.slice(0, 10)}</TableCell>
                <TableCell><Chip size="small" label={c.status} color={c.status === 'active' ? 'success' : c.status === 'closed' ? 'default' : 'warning'} /></TableCell>
                <TableCell align="right">
                  {canManage && c.status === 'draft' && <Button size="small" onClick={(e) => { e.stopPropagation(); activate(c.id); }}>Activate</Button>}
                  {canManage && c.status === 'active' && <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); close(c.id); }}>Close</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!cycles.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No review cycles yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New review cycle</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" margin="normal" placeholder="e.g. H1 FY26" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} margin="normal" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <TextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} margin="normal" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name || !form.start_date || !form.end_date}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CycleDetail({ cycle, onBack }) {
  const { staff } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [selected, setSelected] = useState(null); // review being edited
  const [goals, setGoals] = useState([]);
  const [selfForm, setSelfForm] = useState({ self_assessment: '', self_rating: '' });
  const [managerForm, setManagerForm] = useState({ manager_assessment: '', manager_rating: '' });
  const [newGoal, setNewGoal] = useState({ title: '', weight_percent: '' });

  const load = () => client.get('/performance/reviews', { params: { review_cycle_id: cycle.id } }).then(({ data }) => setReviews(data.reviews));
  useEffect(() => { load(); }, [cycle.id]);

  const openReview = async (review) => {
    setSelected(review);
    setSelfForm({ self_assessment: review.self_assessment || '', self_rating: review.self_rating || '' });
    setManagerForm({ manager_assessment: review.manager_assessment || '', manager_rating: review.manager_rating || '' });
    const { data } = await client.get('/performance/goals', { params: { employee_id: review.employee_id, review_cycle_id: cycle.id } });
    setGoals(data.goals);
  };

  const isSelf = selected && staff?.employee_id === selected.employee_id;
  const isManager = selected && staff?.employee_id === selected.manager_id;
  const isHR = ['owner', 'admin', 'hr'].includes(staff?.role);

  const submitSelf = async () => {
    await client.put(`/performance/reviews/${selected.id}/self`, selfForm);
    load(); setSelected(null);
  };
  const submitManager = async () => {
    await client.put(`/performance/reviews/${selected.id}/manager`, managerForm);
    load(); setSelected(null);
  };
  const acknowledge = async () => {
    await client.post(`/performance/reviews/${selected.id}/acknowledge`);
    load(); setSelected(null);
  };
  const addGoal = async () => {
    if (!newGoal.title) return;
    await client.post('/performance/goals', { employee_id: selected.employee_id, review_cycle_id: cycle.id, ...newGoal });
    setNewGoal({ title: '', weight_percent: '' });
    const { data } = await client.get('/performance/goals', { params: { employee_id: selected.employee_id, review_cycle_id: cycle.id } });
    setGoals(data.goals);
  };
  const updateGoalProgress = async (goal, progress_percent) => {
    await client.put(`/performance/goals/${goal.id}`, { progress_percent, status: progress_percent >= 100 ? 'completed' : 'in_progress' });
    const { data } = await client.get('/performance/goals', { params: { employee_id: selected.employee_id, review_cycle_id: cycle.id } });
    setGoals(data.goals);
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>All cycles</Button>
      <Typography variant="h5" sx={{ mb: 3 }}>{cycle.name}</Typography>

      <Paper>
        <Table>
          <TableHead>
            <TableRow><TableCell>Employee</TableCell><TableCell align="right">Self rating</TableCell><TableCell align="right">Manager rating</TableCell><TableCell align="right">Final</TableCell><TableCell>Status</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {reviews.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => openReview(r)}>
                <TableCell>{r.full_name}</TableCell>
                <TableCell align="right" className="figure">{r.self_rating ?? '—'}</TableCell>
                <TableCell align="right" className="figure">{r.manager_rating ?? '—'}</TableCell>
                <TableCell align="right" className="figure">{r.final_rating ?? '—'}</TableCell>
                <TableCell><Chip size="small" label={r.status.replace('_', ' ')} color={STATUS_COLOR[r.status]} /></TableCell>
              </TableRow>
            ))}
            {!reviews.length && <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No reviews initialized — activate the cycle first.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selected?.full_name} — {cycle.name}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Goals</Typography>
          {goals.map((g) => (
            <Box key={g.id} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.85rem' }}>{g.title}{g.weight_percent ? ` (${g.weight_percent}%)` : ''}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{g.progress_percent}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={g.progress_percent} sx={{ my: 0.5 }} />
              {(isSelf || isManager || isHR) && (
                <TextField
                  size="small" type="number" label="Update progress %" sx={{ mt: 0.5, width: 160 }}
                  defaultValue={g.progress_percent}
                  onBlur={(e) => updateGoalProgress(g, Math.max(0, Math.min(100, Number(e.target.value))))}
                />
              )}
            </Box>
          ))}
          {(isSelf || isHR) && (
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <TextField size="small" label="New goal" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} sx={{ flex: 1 }} />
              <TextField size="small" type="number" label="Weight %" value={newGoal.weight_percent} onChange={(e) => setNewGoal({ ...newGoal, weight_percent: e.target.value })} sx={{ width: 100 }} />
              <Button onClick={addGoal} disabled={!newGoal.title}>Add</Button>
            </Box>
          )}

          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Self-assessment</Typography>
          <TextField fullWidth multiline rows={3} value={selfForm.self_assessment} disabled={!isSelf}
            onChange={(e) => setSelfForm({ ...selfForm, self_assessment: e.target.value })} sx={{ mb: 1 }} />
          <TextField type="number" label="Self rating (1-5)" value={selfForm.self_rating} disabled={!isSelf}
            onChange={(e) => setSelfForm({ ...selfForm, self_rating: e.target.value })} sx={{ mb: 2, width: 180 }} />
          {isSelf && <Button variant="outlined" onClick={submitSelf} sx={{ mb: 3 }}>Submit self-assessment</Button>}

          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1, mt: isSelf ? 0 : 3 }}>Manager assessment</Typography>
          <TextField fullWidth multiline rows={3} value={managerForm.manager_assessment} disabled={!isManager && !isHR}
            onChange={(e) => setManagerForm({ ...managerForm, manager_assessment: e.target.value })} sx={{ mb: 1 }} />
          <TextField type="number" label="Manager rating (1-5)" value={managerForm.manager_rating} disabled={!isManager && !isHR}
            onChange={(e) => setManagerForm({ ...managerForm, manager_rating: e.target.value })} sx={{ mb: 2, width: 180 }} />
          {(isManager || isHR) && <Button variant="outlined" onClick={submitManager}>Submit manager assessment</Button>}

          {isSelf && selected?.status === 'pending_acknowledgement' && (
            <Alert severity="info" sx={{ mt: 3 }} action={<Button size="small" onClick={acknowledge}>Acknowledge</Button>}>
              Your manager has submitted their rating — please acknowledge.
            </Alert>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Performance() {
  const [selectedCycle, setSelectedCycle] = useState(null);
  return selectedCycle
    ? <CycleDetail cycle={selectedCycle} onBack={() => setSelectedCycle(null)} />
    : <CycleList onOpenCycle={setSelectedCycle} />;
}