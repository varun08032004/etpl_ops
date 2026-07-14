import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = { owner: 'Founder' };
const roleLabel = (role) => ROLE_LABELS[role] || (role?.charAt(0).toUpperCase() + role?.slice(1));

function TierRow({ title, people, color = 'primary.main' }) {
  if (!people.length) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
        {people.map((p) => (
          <Paper key={p.id} sx={{ px: 2, py: 1, borderLeft: '3px solid', borderColor: color, minWidth: 160 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.employee_name || p.email}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{p.email}</Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

function DepartmentCard({ dept, canEdit, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState(null);

  const toggle = async () => {
    if (!expanded && !members) {
      const { data } = await client.get(`/departments/${dept.id}`);
      setMembers(data.members);
    }
    setExpanded(!expanded);
  };

  return (
    <Paper sx={{ p: 2.5, minWidth: 260, flex: '1 1 260px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{dept.name}</Typography>
            {dept.status !== 'active' && <Chip size="small" label={dept.status} variant="outlined" />}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, mb: 0.5 }}>
            {dept.code && <Chip size="small" label={dept.code} className="figure" sx={{ fontSize: '0.7rem' }} />}
            {dept.cost_center && <Chip size="small" label={`CC: ${dept.cost_center}`} variant="outlined" sx={{ fontSize: '0.7rem' }} />}
          </Box>
          {dept.description && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>{dept.description}</Typography>}
        </Box>
        {canEdit && (
          <Box>
            <IconButton size="small" onClick={() => onEdit(dept)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => onDelete(dept)}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 1.5, mb: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Head</Typography>
        <Typography sx={{ fontSize: '0.85rem' }}>{dept.head_name || 'Unassigned'}</Typography>
      </Box>

      {(dept.location || dept.budget) && (
        <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
          {dept.location && (
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Location</Typography>
              <Typography sx={{ fontSize: '0.8rem' }}>{dept.location}</Typography>
            </Box>
          )}
          {dept.budget && (
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Budget</Typography>
              <Typography sx={{ fontSize: '0.8rem' }} className="figure">₹{Number(dept.budget).toLocaleString('en-IN')}</Typography>
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
        <Chip size="small" label={`${dept.employee_count} employee${dept.employee_count === 1 ? '' : 's'}`} variant="outlined" />
        <IconButton size="small" onClick={toggle}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1.5, borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
          {members?.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.8rem' }}>{m.full_name}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{m.designation || '—'}</Typography>
            </Box>
          ))}
          {members?.length === 0 && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No employees assigned yet.</Typography>}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function OrgStructure() {
  const { staff: me } = useAuth();
  const canEdit = ['owner', 'admin'].includes(me?.role);

  const [staffByRole, setStaffByRole] = useState({ owner: [], admin: [], hr: [] });
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState(null);

  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({
    id: null, name: '', description: '', head_employee_id: '',
    code: '', cost_center: '', location: '', budget: '', status: 'active', parent_department_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    client.get('/staff-accounts').then(({ data }) => {
      const byRole = { owner: [], admin: [], hr: [] };
      for (const s of data.staff) {
        if (byRole[s.role]) byRole[s.role].push(s);
      }
      setStaffByRole(byRole);
    }).catch(() => {});
    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
    client.get('/employees').then(({ data }) => setEmployees(data.employees)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const openNewDept = () => {
    setDeptForm({ id: null, name: '', description: '', head_employee_id: '', code: '', cost_center: '', location: '', budget: '', status: 'active', parent_department_id: '' });
    setError('');
    setDeptDialogOpen(true);
  };
  const openEditDept = (dept) => {
    setDeptForm({
      id: dept.id, name: dept.name, description: dept.description || '', head_employee_id: dept.head_employee_id || '',
      code: dept.code || '', cost_center: dept.cost_center || '', location: dept.location || '',
      budget: dept.budget || '', status: dept.status || 'active', parent_department_id: dept.parent_department_id || '',
    });
    setError('');
    setDeptDialogOpen(true);
  };

  const saveDept = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: deptForm.name, description: deptForm.description,
        head_employee_id: deptForm.head_employee_id || null,
        code: deptForm.code || null, cost_center: deptForm.cost_center || null,
        location: deptForm.location || null, budget: deptForm.budget || null,
        status: deptForm.status, parent_department_id: deptForm.parent_department_id || null,
      };
      if (deptForm.id) {
        await client.put(`/departments/${deptForm.id}`, payload);
      } else {
        await client.post('/departments', payload);
      }
      setDeptDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = async (dept) => {
    if (!window.confirm(`Delete "${dept.name}"?`)) return;
    try {
      const { data } = await client.delete(`/departments/${dept.id}`);
      if (data.pending) {
        setMessage({ severity: 'info', text: data.message });
      } else {
        load();
      }
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to delete department' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Org Structure</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNewDept}>Add department</Button>}
      </Box>

      {message && <Alert severity={message.severity} sx={{ mb: 3 }}>{message.text}</Alert>}

      <Paper sx={{ p: 4, mb: 4 }}>
        <TierRow title="Founder" people={staffByRole.owner} color="primary.main" />
        <TierRow title="Admin" people={staffByRole.admin} color="secondary.main" />
        <TierRow title="HR" people={staffByRole.hr} color="info.main" />

        {(staffByRole.owner.length + staffByRole.admin.length + staffByRole.hr.length === 0) && (
          <Typography sx={{ textAlign: 'center', color: 'text.secondary', fontSize: '0.85rem' }}>
            No Founder/Admin/HR logins found yet.
          </Typography>
        )}
      </Paper>

      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5, textAlign: 'center' }}>
        Departments
      </Typography>
      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
        {departments.map((d) => (
          <DepartmentCard key={d.id} dept={d} canEdit={canEdit} onEdit={openEditDept} onDelete={deleteDept} />
        ))}
        {!departments.length && (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', width: '100%', textAlign: 'center', py: 4 }}>
            No departments yet.{canEdit ? ' Click "Add department" to create your first one.' : ''}
          </Typography>
        )}
      </Box>

      <Dialog open={deptDialogOpen} onClose={() => setDeptDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{deptForm.id ? 'Edit department' : 'New department'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={7}>
              <TextField fullWidth label="Name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={5}>
              <TextField fullWidth label="Code" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })} helperText="e.g. ENGTECH" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={2} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Department head" value={deptForm.head_employee_id} onChange={(e) => setDeptForm({ ...deptForm, head_employee_id: e.target.value })}>
                <MenuItem value="">Unassigned</MenuItem>
                {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Parent department" value={deptForm.parent_department_id} onChange={(e) => setDeptForm({ ...deptForm, parent_department_id: e.target.value })} helperText="Optional — for a sub-team under another department">
                <MenuItem value="">None (top-level)</MenuItem>
                {departments.filter((d) => d.id !== deptForm.id).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Cost center" value={deptForm.cost_center} onChange={(e) => setDeptForm({ ...deptForm, cost_center: e.target.value.toUpperCase() })} helperText="e.g. ENG" />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Location" value={deptForm.location} onChange={(e) => setDeptForm({ ...deptForm, location: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth select label="Status" value={deptForm.status} onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}>
                {['active', 'inactive', 'planned'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="number" label="Annual budget (₹)" value={deptForm.budget} onChange={(e) => setDeptForm({ ...deptForm, budget: e.target.value })} />
            </Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveDept} disabled={saving || !deptForm.name}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}