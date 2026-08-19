import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Chip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
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

const STATUS_COLOR = { pending_self: 'default', pending_manager: 'warning', pending_acknowledgement: 'info', closed: 'success' };

function CycleList({ onOpenCycle }) {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const canManage = ['owner', 'admin', 'hr'].includes(staff?.role);
  const [cycles, setCycles] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => client.get('/performance/cycles').then(({ data }) => setCycles(data.cycles)).catch(() => setCycles([])), []);
  useEffect(() => { load(); }, [load]);

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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Performance</Typography>
        {canManage && <MobileButton variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New review cycle</MobileButton>}
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
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
                    <MobileStack gap={1} direction="row">
                      {canManage && c.status === 'draft' && <MobileButton size="small" onClick={(e) => { e.stopPropagation(); activate(c.id); }}>Activate</MobileButton>}
                      {canManage && c.status === 'active' && <MobileButton size="small" color="error" onClick={(e) => { e.stopPropagation(); close(c.id); }}>Close</MobileButton>}
                    </MobileStack>
                  </TableCell>
                </TableRow>
              ))}
              {!cycles.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No review cycles yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New review cycle</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Name" placeholder="e.g. H1 FY26" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <MobileTextField fullWidth type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <MobileTextField fullWidth type="date" label="End date" InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={saving || !form.name || !form.start_date || !form.end_date}>{saving ? 'Creating…' : 'Create'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

function CycleDetail({ cycle, onBack }) {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [scores, setScores] = useState({});
  const [selected, setSelected] = useState(null);
  const [goals, setGoals] = useState([]);
  const [selfForm, setSelfForm] = useState({ self_assessment: '', self_rating: '' });
  const [managerForm, setManagerForm] = useState({ manager_assessment: '', manager_rating: '' });
  const [newGoal, setNewGoal] = useState({ title: '', weight_percent: '' });

  const load = useCallback(() => client.get('/performance/reviews', { params: { review_cycle_id: cycle.id } }).then(({ data }) => setReviews(data.reviews)), [cycle.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!reviews.length) return;
    const employeeIds = reviews.map((r) => r.employee_id).join(',');
    client.get('/monitoring/score-summary', {
      params: { employee_ids: employeeIds, from: cycle.start_date?.slice(0, 10), to: cycle.end_date?.slice(0, 10) },
    })
      .then(({ data }) => setScores(data.scores || {}))
      .catch(() => setScores({}));
  }, [reviews, cycle.start_date, cycle.end_date]);

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
      <MobileButton startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }} variant="text">All cycles</MobileButton>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>{cycle.name}</Typography>
          <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary', mt: 0.5 }}>
            Monitoring score pulled from desktop agent for {cycle.start_date?.slice(0, 10)} → {cycle.end_date?.slice(0, 10)}
          </Typography>
        </Box>
      </MobilePageHeader>

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table>
            <TableHead>
              <TableRow><TableCell>Employee</TableCell><TableCell align="right">Self rating</TableCell><TableCell align="right">Manager rating</TableCell><TableCell align="right">Final</TableCell><TableCell align="right">Monitoring score</TableCell><TableCell>Status</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {reviews.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => openReview(r)}>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell align="right" className="figure">{r.self_rating ?? '—'}</TableCell>
                  <TableCell align="right" className="figure">{r.manager_rating ?? '—'}</TableCell>
                  <TableCell align="right" className="figure">{r.final_rating ?? '—'}</TableCell>
                  <TableCell align="right">
                    {scores[r.employee_id]
                      ? <Chip size="small" label={scores[r.employee_id].score} color={scores[r.employee_id].score >= 85 ? 'success' : scores[r.employee_id].score >= 70 ? 'primary' : scores[r.employee_id].score >= 50 ? 'warning' : 'error'} />
                      : <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>—</Typography>}
                  </TableCell>
                  <TableCell><Chip size="small" label={r.status.replace('_', ' ')} color={STATUS_COLOR[r.status]} /></TableCell>
                </TableRow>
              ))}
              {!reviews.length && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No reviews initialized — activate the cycle first.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selected?.full_name} — {cycle.name}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary', mb: 1 }}>Goals</Typography>
          {goals.map((g) => (
            <Box key={g.id} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{g.title}{g.weight_percent ? ` (${g.weight_percent}%)` : ''}</Typography>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{g.progress_percent}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={g.progress_percent} sx={{ my: 0.5 }} />
              {(isSelf || isManager || isHR) && (
                <MobileTextField
                  size="small"
                  type="number"
                  label="Update progress %"
                  defaultValue={g.progress_percent}
                  onBlur={(e) => updateGoalProgress(g, Math.max(0, Math.min(100, Number(e.target.value))))}
                />
              )}
            </Box>
          ))}
          {(isSelf || isHR) && (
            <MobileFormGrid sx={{ mt: 2 }}>
              <MobileTextField size="small" label="New goal" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} />
              <MobileTextField size="small" type="number" label="Weight %" value={newGoal.weight_percent} onChange={(e) => setNewGoal({ ...newGoal, weight_percent: e.target.value })} />
              <MobileButton onClick={addGoal} disabled={!newGoal.title}>Add</MobileButton>
            </MobileFormGrid>
          )}

          <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary', mb: 1, mt: 2 }}>Self-assessment</Typography>
          <MobileTextField fullWidth multiline rows={3} value={selfForm.self_assessment} disabled={!isSelf}
            onChange={(e) => setSelfForm({ ...selfForm, self_assessment: e.target.value })} sx={{ mb: 1 }} />
          <MobileTextField type="number" label="Self rating (1-5)" value={selfForm.self_rating} disabled={!isSelf}
            onChange={(e) => setSelfForm({ ...selfForm, self_rating: e.target.value })} sx={{ mb: 2, width: isMobile ? '100%' : 180 }} />
          {isSelf && <MobileButton variant="outlined" onClick={submitSelf} sx={{ mb: 3 }}>Submit self-assessment</MobileButton>}

          <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary', mb: 1, mt: isSelf ? 0 : 3 }}>Manager assessment</Typography>
          <MobileTextField fullWidth multiline rows={3} value={managerForm.manager_assessment} disabled={!isManager && !isHR}
            onChange={(e) => setManagerForm({ ...managerForm, manager_assessment: e.target.value })} sx={{ mb: 1 }} />
          <MobileTextField type="number" label="Manager rating (1-5)" value={managerForm.manager_rating} disabled={!isManager && !isHR}
            onChange={(e) => setManagerForm({ ...managerForm, manager_rating: e.target.value })} sx={{ mb: 2, width: isMobile ? '100%' : 180 }} />
          {(isManager || isHR) && <MobileButton variant="outlined" onClick={submitManager}>Submit manager assessment</MobileButton>}

          {isSelf && selected?.status === 'pending_acknowledgement' && (
            <Alert severity="info" sx={{ mt: 3 }} action={<MobileButton size="small" onClick={acknowledge}>Acknowledge</MobileButton>}>
              Your manager has submitted their rating — please acknowledge.
            </Alert>
          )}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setSelected(null)}>Close</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

export default function Performance() {
  const [selectedCycle, setSelectedCycle] = useState(null);
  return selectedCycle
    ? <CycleDetail cycle={selectedCycle} onBack={() => setSelectedCycle(null)} />
    : <CycleList onOpenCycle={setSelectedCycle} />;
}