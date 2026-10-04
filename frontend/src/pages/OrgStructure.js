import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, Collapse, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  MobileDialog,
  MobileStack,
  MobileCardGrid,
  MobileButton,
  MobileTextField,
  useMobile,
} from '../components/MobileResponsive';

// Default tier labels (will be overridden by API data)
const DEFAULT_TIERS = [
  { name: 'Managing Director / Executive Director', display_order: 0, color: '#7c3aed' },
  { name: 'Director(s)', display_order: 10, color: '#6d28d9' },
  { name: 'CEO', display_order: 20, color: '#5b21b6' },
  { name: 'Department Head (HOD)', display_order: 30, color: '#3730a3' },
  { name: 'Senior Management', display_order: 40, color: '#1e40af' },
  { name: 'Management', display_order: 50, color: '#0f766e' },
  { name: 'Employee', display_order: 60, color: '#166534' },
];

function TierRow({ title, people, color = 'primary.main', isMobile, canEdit, onEdit }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: isMobile ? 2 : 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </Typography>
        {canEdit && onEdit && (
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <MobileStack gap={isMobile ? 1 : 1.5}>
        {people.map((p) => (
          <MobilePaper key={p.id} sx={{ px: isMobile ? 1.5 : 2, py: isMobile ? 1 : 1, borderLeft: '3px solid', borderColor: color, minWidth: isMobile ? 'auto' : 160, width: isMobile ? '100%' : 'auto' }}>
            <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600 }}>{p.employee_name || p.email}</Typography>
            <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>{p.email}</Typography>
          </MobilePaper>
        ))}
        {!people.length && (
          <MobilePaper sx={{ px: isMobile ? 1.5 : 2, py: isMobile ? 1 : 1, borderLeft: '3px solid', borderColor: color, minWidth: isMobile ? 'auto' : 160, width: isMobile ? '100%' : 'auto', opacity: 0.5 }}>
            <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontStyle: 'italic' }}>No one assigned</Typography>
          </MobilePaper>
        )}
      </MobileStack>
    </Box>
  );
}

function TeamRow({ team, canEdit, onEdit, onDelete, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState(null);

  const toggle = async () => {
    if (!expanded && !members) {
      const { data } = await client.get(`/teams/${team.id}`);
      setMembers(data.members);
    }
    setExpanded(!expanded);
  };

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1, mt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.82rem', fontWeight: 600 }}>{team.name}</Typography>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>
            Team head: {team.head_name || 'Unassigned'} · {team.employee_count} employee{team.employee_count === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {canEdit && (
            <>
              <IconButton size="small" onClick={() => onEdit(team)}><EditIcon fontSize="inherit" /></IconButton>
              <IconButton size="small" onClick={() => onDelete(team)}><DeleteOutlineIcon fontSize="inherit" /></IconButton>
            </>
          )}
          <IconButton size="small" onClick={toggle}>
            {expanded ? <ExpandLessIcon fontSize="inherit" /> : <ExpandMoreIcon fontSize="inherit" />}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, pl: isMobile ? 0.5 : 1 }}>
          {members?.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4, flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem' }}>{m.full_name}</Typography>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>{m.designation || '—'}</Typography>
            </Box>
          ))}
          {members?.length === 0 && <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'text.secondary' }}>No employees on this team yet.</Typography>}
        </Box>
      </Collapse>
    </Box>
  );
}

function DepartmentCard({ dept, teams, canEdit, onEditDept, onDeleteDept, onAddTeam, onEditTeam, onDeleteTeam, isMobile }) {
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
    <MobilePaper sx={{ minWidth: isMobile ? '100%' : 280, flex: isMobile ? '0 0 100%' : '1 1 280px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}>{dept.name}</Typography>
            {dept.status !== 'active' && <Chip size="small" label={dept.status} variant="outlined" />}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
            {dept.code && <Chip size="small" label={dept.code} className="figure" sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem' }} />}
            {dept.cost_center && <Chip size="small" label={`CC: ${dept.cost_center}`} variant="outlined" sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem' }} />}
          </Box>
          {dept.description && <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary', mb: 0.5 }}>{dept.description}</Typography>}
        </Box>
        {canEdit && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => onEditDept(dept)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => onDeleteDept(dept)}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        )}
      </Box>

      <Box sx={{ mt: isMobile ? 1 : 1.5, mb: 1 }}>
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Department Head</Typography>
        <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{dept.head_name || 'Unassigned'}</Typography>
      </Box>

      {(dept.location || dept.budget) && (
        <Box sx={{ display: 'flex', gap: isMobile ? 2 : 3, mb: 1, flexWrap: 'wrap' }}>
          {dept.location && (
            <Box>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Location</Typography>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{dept.location}</Typography>
            </Box>
          )}
          {dept.budget && (
            <Box>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Budget</Typography>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }} className="figure">₹{Number(dept.budget).toLocaleString('en-IN')}</Typography>
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: isMobile ? 1 : 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Chip size="small" label={`${dept.employee_count} employee${dept.employee_count === 1 ? '' : 's'}`} variant="outlined" />
        <IconButton size="small" onClick={toggle}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: isMobile ? 1 : 1.5, borderTop: '1px solid', borderColor: 'divider', pt: isMobile ? 1 : 1.5 }}>
          <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'text.secondary', mb: 0.5 }}>Employees in this department</Typography>
          {members?.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{m.full_name}</Typography>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>{m.designation || '—'}</Typography>
            </Box>
          ))}
          {members?.length === 0 && <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>No employees assigned yet.</Typography>}

          <Divider sx={{ mt: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Teams
            </Typography>
            {canEdit && (
              <IconButton size="small" onClick={() => onAddTeam(dept)}><GroupAddIcon fontSize="inherit" /></IconButton>
            )}
          </Box>
          {teams.map((t) => (
            <TeamRow key={t.id} team={t} canEdit={canEdit} onEdit={onEditTeam} onDelete={onDeleteTeam} isMobile={isMobile} />
          ))}
          {!teams.length && <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'text.secondary' }}>No teams in this department yet.</Typography>}
        </Box>
      </Collapse>
    </MobilePaper>
  );
}

export default function OrgStructure() {
  const isMobile = useMobile();
  const { staff: me } = useAuth();
  const canEdit = ['owner', 'admin'].includes(me?.role);

  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [staffByTier, setStaffByTier] = useState({});
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [message, setMessage] = useState(null);

  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({
    id: null, name: '', description: '', head_employee_id: '', granted_roles: [],
    code: '', cost_center: '', location: '', budget: '', status: 'active', parent_department_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ id: null, name: '', department_id: '', team_head_id: '' });
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');

  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm] = useState({ name: '', display_order: 0, description: '', color: '#6366f1', icon: '' });
  const [tierSaving, setTierSaving] = useState(false);
  const [tierError, setTierError] = useState('');

  const load = () => {
    client.get('/org-hierarchy-tiers').then(({ data }) => {
      const sortedTiers = data.tiers.sort((a, b) => a.display_order - b.display_order);
      setTiers(sortedTiers);
      const byTier = {};
      sortedTiers.forEach(t => byTier[t.id] = []);
      setStaffByTier(byTier);
    }).catch(() => {});

    client.get('/staff-accounts').then(({ data }) => {
      // Will populate staffByTier after designations loaded
    }).catch(() => {});

    client.get('/departments').then(({ data }) => setDepartments(data.departments)).catch(() => {});
    client.get('/teams').then(({ data }) => setTeams(data.teams)).catch(() => {});
    client.get('/employees').then(({ data }) => setEmployees(data.employees)).catch(() => {});
    client.get('/designations').then(({ data }) => setDesignations(data.designations)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // Populate staffByTier when staff and designations are loaded
  useEffect(() => {
    if (!tiers.length) return;
    client.get('/staff-accounts').then(({ data }) => {
      const byTier = {};
      tiers.forEach(t => byTier[t.id] = []);
      
      for (const s of data.staff) {
        if (!s.employee_id) continue;
        const emp = employees.find(e => e.id === s.employee_id);
        if (!emp) continue;
        
        let tierId = null;
        if (emp.designation_id) {
          const des = designations.find(d => d.id === emp.designation_id);
          if (des?.tier_id) tierId = des.tier_id;
        }
        
        // Fallback: map by role
        if (!tierId) {
          if (s.role === 'owner') {
            tierId = tiers.find(t => t.name.includes('Managing Director'))?.id;
          } else if (s.role === 'admin') {
            tierId = tiers.find(t => t.name === 'CEO')?.id;
          } else if (s.role === 'hr') {
            tierId = tiers.find(t => t.name === 'Department Head (HOD)')?.id;
          }
        }
        
        // Default to Employee tier
        if (!tierId) {
          tierId = tiers.find(t => t.name === 'Employee')?.id;
        }
        
        if (tierId && byTier[tierId]) {
          byTier[tierId].push({ ...s, employee_name: emp.full_name });
        }
      }
      setStaffByTier(byTier);
    }).catch(() => {});
  }, [tiers, employees, designations]);

  const teamsForDept = (deptId) => teams.filter((t) => t.department_id === deptId);

  const openNewDept = () => {
    setDeptForm({ id: null, name: '', description: '', head_employee_id: '', granted_roles: [], code: '', cost_center: '', location: '', budget: '', status: 'active', parent_department_id: '' });
    setError('');
    setDeptDialogOpen(true);
  };
  const openEditDept = (dept) => {
    setDeptForm({
      id: dept.id, name: dept.name, description: dept.description || '', head_employee_id: dept.head_employee_id || '',
      granted_roles: dept.granted_roles || [],
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
        granted_roles: deptForm.granted_roles || [],
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

  const openNewTeam = (dept) => {
    setTeamForm({ id: null, name: '', department_id: dept.id, team_head_id: '' });
    setTeamError('');
    setTeamDialogOpen(true);
  };
  const openEditTeam = (team) => {
    setTeamForm({ id: team.id, name: team.name, department_id: team.department_id, team_head_id: team.team_head_id || '' });
    setTeamError('');
    setTeamDialogOpen(true);
  };

  const saveTeam = async () => {
    setTeamSaving(true);
    setTeamError('');
    try {
      const payload = {
        name: teamForm.name,
        department_id: teamForm.department_id,
        team_head_id: teamForm.team_head_id || null,
      };
      if (teamForm.id) {
        await client.put(`/teams/${teamForm.id}`, payload);
      } else {
        await client.post('/teams', payload);
      }
      setTeamDialogOpen(false);
      load();
    } catch (err) {
      setTeamError(err.response?.data?.error || 'Failed to save team');
    } finally {
      setTeamSaving(false);
    }
  };

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return;
    try {
      const { data } = await client.delete(`/teams/${team.id}`);
      if (data.pending) {
        setMessage({ severity: 'info', text: data.message });
      } else {
        load();
      }
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to delete team' });
    }
  };

  const openTierDialog = (tier) => {
    if (tier) {
      setEditingTier(tier);
      setTierForm({
        name: tier.name,
        display_order: tier.display_order,
        description: tier.description || '',
        color: tier.color || '#6366f1',
        icon: tier.icon || '',
      });
    } else {
      setEditingTier(null);
      setTierForm({ name: '', display_order: 0, description: '', color: '#6366f1', icon: '' });
    }
    setTierError('');
    setTierDialogOpen(true);
  };

  const saveTier = async () => {
    setTierSaving(true);
    setTierError('');
    try {
      if (editingTier) {
        await client.put(`/org-hierarchy-tiers/${editingTier.id}`, tierForm);
      } else {
        await client.post('/org-hierarchy-tiers', tierForm);
      }
      setTierDialogOpen(false);
      load();
    } catch (err) {
      setTierError(err.response?.data?.error || 'Failed to save tier');
    } finally {
      setTierSaving(false);
    }
  };

  const teamHeadCandidates = teamForm.department_id
    ? employees.filter((e) => e.department_id === teamForm.department_id)
    : employees;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Org Structure</Typography>
        {canEdit && <MobileButton variant="contained" size="small" startIcon={<AddIcon />} onClick={openNewDept}>Add department</MobileButton>}
      </MobilePageHeader>

      {message && <Alert severity={message.severity} sx={{ mb: 3 }}>{message.text}</Alert>}

      {/* Hierarchy Tiers — Editable org chart levels */}
      <MobilePaper sx={{ mb: isMobile ? 2 : 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Organization Hierarchy
          </Typography>
          {canEdit && (
            <MobileButton variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => openTierDialog(null)}>
              Add Tier
            </MobileButton>
          )}
        </Box>
        {tiers.map((tier) => (
          <TierRow
            key={tier.id}
            title={tier.name}
            people={staffByTier[tier.id] || []}
            color={tier.color}
            isMobile={isMobile}
            canEdit={canEdit}
            onEdit={() => openTierDialog(tier)}
          />
        ))}
        {tiers.length === 0 && (
          <Typography sx={{ textAlign: 'center', color: 'text.secondary', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
            No hierarchy tiers configured.
          </Typography>
        )}
      </MobilePaper>

      {/* Departments, each with a head, and — expanded — its teams with team heads, and employees below that. */}
      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5, textAlign: 'center' }}>
        Departments
      </Typography>
      <MobileCardGrid sx={{ gap: isMobile ? 1.5 : 2.5 }}>
        {departments.map((d) => (
          <DepartmentCard
            key={d.id} dept={d} teams={teamsForDept(d.id)} canEdit={canEdit}
            onEditDept={openEditDept} onDeleteDept={deleteDept}
            onAddTeam={openNewTeam} onEditTeam={openEditTeam} onDeleteTeam={deleteTeam}
            isMobile={isMobile}
          />
        ))}
        {!departments.length && (
          <MobilePaper sx={{ width: '100%' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.75rem' : '0.85rem', width: '100%', textAlign: 'center', py: 4 }}>
              No departments yet.{canEdit ? ' Click "Add department" to create your first one.' : ''}
            </Typography>
          </MobilePaper>
        )}
      </MobileCardGrid>

      {/* ── department dialog ──────────────────────────────────────────── */}
      <MobileDialog open={deptDialogOpen} onClose={() => setDeptDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{deptForm.id ? 'Edit department' : 'New department'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
            <MobileTextField fullWidth label="Code" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })} helperText="e.g. ENGTECH" />
            <MobileTextField fullWidth label="Description" multiline rows={2} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Department head"
              value={deptForm.head_employee_id}
              onChange={(e) => setDeptForm({ ...deptForm, head_employee_id: e.target.value })}
              options={[{ value: '', label: 'Unassigned' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
            <MobileTextField
              fullWidth
              select
              label="Parent department"
              value={deptForm.parent_department_id}
              onChange={(e) => setDeptForm({ ...deptForm, parent_department_id: e.target.value })}
              helperText="Optional — for a sub-team under another department"
              options={[{ value: '', label: 'None (top-level)' }, ...departments.filter((d) => d.id !== deptForm.id).map((d) => ({ value: d.id, label: d.name }))]}
            />
            <MobileTextField fullWidth label="Cost center" value={deptForm.cost_center} onChange={(e) => setDeptForm({ ...deptForm, cost_center: e.target.value.toUpperCase() })} helperText="e.g. ENG" />
            <MobileTextField fullWidth label="Location" value={deptForm.location} onChange={(e) => setDeptForm({ ...deptForm, location: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Status"
              value={deptForm.status}
              onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}
              options={['active', 'inactive', 'planned'].map((s) => ({ value: s, label: s }))}
            />
            <MobileTextField fullWidth type="number" label="Annual budget (₹)" value={deptForm.budget} onChange={(e) => setDeptForm({ ...deptForm, budget: e.target.value })} />
            <TextField
              fullWidth select label="Grants access to" value={deptForm.granted_roles}
              SelectProps={{ multiple: true }}
              onChange={(e) => setDeptForm({ ...deptForm, granted_roles: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
              helperText="Every employee in this department gets these modules automatically"
            >
              <MenuItem value="finance">Finance (Sales, Accounting, Invoices, Payroll expenses, Finance)</MenuItem>
              <MenuItem value="accounting_hod">Accounting — HOD tier</MenuItem>
              <MenuItem value="hr">HR (People, Attendance, Org Structure, leave approvals)</MenuItem>
              <MenuItem value="legal_hod">Legal — HOD tier (Registrations, Compliance)</MenuItem>
              <MenuItem value="compliance_hod">Compliance — HOD tier</MenuItem>
              <MenuItem value="marketing_hod">Marketing — HOD tier</MenuItem>
              <MenuItem value="sales_hod">Sales — HOD tier</MenuItem>
              <MenuItem value="product_hod">Product — HOD tier</MenuItem>
            </TextField>
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setDeptDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={saveDept} disabled={saving || !deptForm.name}>
            {saving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* ── team dialog ────────────────────────────────────────────────── */}
      <MobileDialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{teamForm.id ? 'Edit team' : 'New team'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
            <MobileTextField
              fullWidth
              select
              label="Department"
              value={teamForm.department_id}
              onChange={(e) => setTeamForm({ ...teamForm, department_id: e.target.value, team_head_id: '' })}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Team head"
              value={teamForm.team_head_id}
              onChange={(e) => setTeamForm({ ...teamForm, team_head_id: e.target.value })}
              options={[{ value: '', label: 'Unassigned' }, ...teamHeadCandidates.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
          </MobileFormGrid>
          {teamError && <Alert severity="error" sx={{ mt: 1 }}>{teamError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setTeamDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={saveTeam} disabled={teamSaving || !teamForm.name || !teamForm.department_id}>
            {teamSaving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* ── tier dialog ────────────────────────────────────────────────────── */}
      <MobileDialog open={tierDialogOpen} onClose={() => setTierDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingTier ? 'Edit tier' : 'New tier'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Name" value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} required />
            <MobileTextField fullWidth type="number" label="Display order (lower = higher)" value={tierForm.display_order} onChange={(e) => setTierForm({ ...tierForm, display_order: parseInt(e.target.value) || 0 })} />
            <MobileTextField fullWidth label="Description" multiline rows={2} value={tierForm.description} onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })} />
            <MobileTextField fullWidth label="Color (hex)" value={tierForm.color} onChange={(e) => setTierForm({ ...tierForm, color: e.target.value })} helperText="e.g. #7c3aed" />
            <MobileTextField fullWidth label="Icon (optional)" value={tierForm.icon} onChange={(e) => setTierForm({ ...tierForm, icon: e.target.value })} helperText="Material icon name, e.g. 'account_circle'" />
          </MobileFormGrid>
          {tierError && <Alert severity="error" sx={{ mt: 1 }}>{tierError}</Alert>}
          {editingTier?.is_system && <Alert severity="info" sx={{ mt: 1 }}>System tier — name cannot be changed via API.</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setTierDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={saveTier} disabled={tierSaving || !tierForm.name}>
            {tierSaving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}