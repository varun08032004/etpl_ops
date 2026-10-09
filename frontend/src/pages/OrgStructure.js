import { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, TextField, MenuItem, Alert, Collapse, Divider,
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

// Default tier labels (will be overridden by API data) — matches 056_final_org_structure.sql
const DEFAULT_TIERS = [
  { name: 'Founder', display_order: 0, color: '#7c3aed' },
  { name: 'Managing Director', display_order: 10, color: '#6d28d9' },
  { name: 'Director(s)', display_order: 20, color: '#5b21b6' },
  { name: 'CEO', display_order: 30, color: '#3730a3' },
];

function TierRow({ title, people, color = 'primary.main', isMobile, canEdit, onEdit, onAssign, tierId }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: isMobile ? 2 : 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {canEdit && onEdit && (
            <IconButton size="small" onClick={onEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          {canEdit && onAssign && tierId && (
            <IconButton size="small" onClick={() => onAssign(tierId)}>
              <GroupAddIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
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
      <Collapse in={expanded} unmountOnExit>
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

      <Collapse in={expanded} unmountOnExit>
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
  const [tierDeleting, setTierDeleting] = useState(false);

  // Employee assignment via code
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: '', tier_id: '' });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const load = async () => {
    try {
      console.log('[Load] Starting...');
      const [{ data: tiersData }, { data: deptsData }, { data: teamsData }, { data: empsData }, { data: desigsData }, { data: staffData }] = await Promise.all([
        client.get('/org-hierarchy-tiers'),
        client.get('/departments'),
        client.get('/teams'),
        client.get('/employees'),
        client.get('/designations'),
        client.get('/staff-accounts'),
      ]);
      
      const sortedTiers = tiersData.tiers.sort((a, b) => a.display_order - b.display_order);
      console.log('[Load] Tiers:', sortedTiers.map(t => ({ id: t.id, name: t.name, order: t.display_order })));
      console.log('[Load] Employees:', empsData.employees.map(e => ({ id: e.id, code: e.employee_code, name: e.full_name, desig_id: e.designation_id })));
      console.log('[Load] Designations:', desigsData.designations.map(d => ({ id: d.id, title: d.title, tier_id: d.tier_id })));
      console.log('[Load] Staff:', staffData.staff.map(s => ({ id: s.id, role: s.role, employee_id: s.employee_id })));
      
      setTiers(sortedTiers);
      setDepartments(deptsData.departments);
      setTeams(teamsData.teams);
      setEmployees(empsData.employees);
      setDesignations(desigsData.designations);
      
      // Build staffByTier immediately
      const byTier = {};
      sortedTiers.forEach(t => byTier[t.id] = []);
      
      for (const s of staffData.staff) {
        if (!s.employee_id) continue;
        const emp = empsData.employees.find(e => e.id === s.employee_id);
        if (!emp) continue;
        
        let tierId = null;
        let tierSource = 'none';
        if (emp.designation_id) {
          const des = desigsData.designations.find(d => d.id === emp.designation_id);
          if (des?.tier_id) {
            tierId = des.tier_id;
            tierSource = 'designation';
          }
        }
        
        // Fallback: map by role (ONLY if no designation tier)
        if (!tierId) {
          if (s.role === 'owner') {
            tierId = sortedTiers.find(t => t.name === 'Founder')?.id;
            tierSource = 'role:owner';
          } else if (s.role === 'admin') {
            tierId = sortedTiers.find(t => t.name === 'CEO')?.id;
            tierSource = 'role:admin';
          } else if (s.role === 'hr') {
            tierId = sortedTiers.find(t => t.name.includes('HOD'))?.id;
            tierSource = 'role:hr';
          }
        }
        
        // Default to Employee tier
        if (!tierId) {
          tierId = sortedTiers.find(t => t.name === 'Employee')?.id;
          tierSource = 'default:employee';
        }
        
        console.log(`[Load] Staff mapping: ${s.email} (role=${s.role}) -> emp=${emp.employee_code} ${emp.full_name} -> desig=${emp.designation_id} -> tierId=${tierId} (${tierSource})`);
        
        if (tierId && byTier[tierId]) {
          byTier[tierId].push({ ...s, employee_name: emp.full_name });
        }
      }
      setStaffByTier(byTier);
      console.log('[Load] staffByTier:', Object.keys(byTier).map(k => ({ tier: k, count: byTier[k].length, people: byTier[k].map(p => p.employee_name) })));
      console.log('[Load] State updated');
    } catch (err) {
      console.error('[Load] Failed:', err);
    }
  };

  useEffect(() => { load(); }, []);

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

  const handleDeleteTier = async () => {
    if (!editingTier) return;
    if (!window.confirm(`Delete tier "${editingTier.name}"? This cannot be undone.`)) return;
    setTierDeleting(true);
    try {
      await client.delete(`/org-hierarchy-tiers/${editingTier.id}`);
      setTierDialogOpen(false);
      load();
    } catch (err) {
      setTierError(err.response?.data?.error || 'Failed to delete tier');
    } finally {
      setTierDeleting(false);
    }
  };

  const openAssignDialog = (tierId) => {
    setAssignForm({ employee_id: '', tier_id: tierId });
    setAssignError('');
    setAssignDialogOpen(true);
  };

  const handleAssignEmployee = async () => {
    setAssignSaving(true);
    setAssignError('');
    try {
      const { employee_id, tier_id } = assignForm;
      console.log('[Assign] Starting:', { employee_id, tier_id });
      if (!employee_id || !tier_id) {
        setAssignError('Employee and tier are required');
        return;
      }
      // Get employee details
      const { data: empData } = await client.get(`/employees/${employee_id}`);
      console.log('[Assign] Employee data:', empData);
      const emp = empData.employee;
      if (!emp) {
        setAssignError('Employee not found');
        return;
      }
      // Get designation or create one with tier
      let desId = emp.designation_id;
      if (!desId) {
        // Create a designation with the tier
        const { data: desData } = await client.post('/designations', {
          title: `${emp.full_name} - Auto`,
          tier_id: tier_id,
        });
        console.log('[Assign] Created designation:', desData);
        desId = desData.designation.id;
      } else {
        // Update existing designation with tier
        const { data: desUpdateData } = await client.put(`/designations/${desId}`, { tier_id: tier_id });
        console.log('[Assign] Updated designation:', desUpdateData);
      }
      // Update employee with designation
      const { data: empUpdateData } = await client.put(`/employees/${emp.id}`, { designation_id: desId });
      console.log('[Assign] Updated employee:', empUpdateData);
      setAssignDialogOpen(false);
      await load();
      console.log('[Assign] Done, reloaded');
    } catch (err) {
      console.error('[Assign] Error:', err);
      setAssignError(err.response?.data?.error || err.message || 'Failed to assign employee');
    } finally {
      setAssignSaving(false);
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

      {/* Custom Org Structure: MD → Directors → Founder/CEO → Departments */}
      <Box sx={{ mb: isMobile ? 3 : 5 }}>
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2, textAlign: 'center' }}>
          Organization Hierarchy
        </Typography>

        {/* Level 1: Managing Director (centered) */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: isMobile ? 2 : 3 }}>
          {(() => {
            const mdTier = tiers.find(t => t.name === 'Managing Director');
            const mdPeople = mdTier ? (staffByTier[mdTier.id] || []) : [];
            return mdPeople.map((p) => (
              <MobilePaper key={p.id} sx={{ px: isMobile ? 2 : 3, py: isMobile ? 1.5 : 2, borderLeft: '4px solid', borderColor: mdTier?.color || '#6d28d9', minWidth: isMobile ? '90%' : 280, maxWidth: isMobile ? '100%' : 320, textAlign: 'center', boxShadow: 3 }}>
                <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>Managing Director</Typography>
                <Typography sx={{ fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: 600 }}>{p.employee_name}</Typography>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{p.email}</Typography>
              </MobilePaper>
            ));
          })()}
        </Box>

        {/* Connector line */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: isMobile ? 1 : 2 }}>
          <Box sx={{ width: 2, height: isMobile ? 24 : 32, backgroundColor: 'divider' }} />
        </Box>

        {/* Level 2: Directors (3 cards horizontal) */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 1.5 : 2, flexWrap: 'wrap', mb: isMobile ? 2 : 3 }}>
          {(() => {
            const dirTier = tiers.find(t => t.name === 'Director(s)');
            const dirPeople = dirTier ? (staffByTier[dirTier.id] || []) : [];
            return dirPeople.map((p) => (
              <MobilePaper key={p.id} sx={{ px: isMobile ? 1.5 : 2, py: isMobile ? 1 : 1.5, borderLeft: '4px solid', borderColor: dirTier?.color || '#5b21b6', minWidth: isMobile ? '140px' : 180, maxWidth: isMobile ? '100%' : 220, textAlign: 'center', boxShadow: 2 }}>
                <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>Director</Typography>
                <Typography sx={{ fontSize: isMobile ? '0.8rem' : '0.95rem', fontWeight: 600 }}>{p.employee_name}</Typography>
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>{p.email}</Typography>
              </MobilePaper>
            ));
          })()}
        </Box>

        {/* Connector line */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: isMobile ? 1 : 2 }}>
          <Box sx={{ width: 2, height: isMobile ? 24 : 32, backgroundColor: 'divider' }} />
        </Box>

        {/* Level 3: Founder (centered) and CEO (if assigned) */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 2 : 3, flexWrap: 'wrap', mb: isMobile ? 2 : 3 }}>
          {/* Founder (also shows CEO if same person) */}
          {(() => {
            const founderTier = tiers.find(t => t.name === 'Founder');
            const founderPeople = founderTier ? (staffByTier[founderTier.id] || []) : [];
            return founderPeople.map((p) => {
              // Check if this person is also CEO
              const ceoTier = tiers.find(t => t.name === 'CEO');
              const ceoPeople = ceoTier ? (staffByTier[ceoTier.id] || []) : [];
              const isAlsoCEO = ceoPeople.some(cp => cp.id === p.id);
              return (
                <MobilePaper key={p.id} sx={{ px: isMobile ? 2 : 3, py: isMobile ? 1.5 : 2, borderLeft: '4px solid', borderColor: founderTier?.color || '#7c3aed', minWidth: isMobile ? '90%' : 280, maxWidth: isMobile ? '100%' : 320, textAlign: 'center', boxShadow: 3 }}>
                  <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                    Founder{isAlsoCEO ? ' & CEO' : ''}
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: 600 }}>{p.employee_name}</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{p.email}</Typography>
                </MobilePaper>
              );
            });
          })()}
          {/* CEO (only if different person) */}
          {(() => {
            const ceoTier = tiers.find(t => t.name === 'CEO');
            const ceoPeople = ceoTier ? (staffByTier[ceoTier.id] || []) : [];
            const founderTier = tiers.find(t => t.name === 'Founder');
            const founderPeople = founderTier ? (staffByTier[founderTier.id] || []) : [];
            const founderIds = new Set(founderPeople.map(p => p.id));
            return ceoPeople
              .filter(p => !founderIds.has(p.id)) // Don't duplicate if same as Founder
              .map((p) => (
                <MobilePaper key={p.id} sx={{ px: isMobile ? 2 : 3, py: isMobile ? 1.5 : 2, borderLeft: '4px solid', borderColor: ceoTier?.color || '#3730a3', minWidth: isMobile ? '90%' : 280, maxWidth: isMobile ? '100%' : 320, textAlign: 'center', boxShadow: 2 }}>
                  <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>CEO</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: 600 }}>{p.employee_name}</Typography>
                  <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{p.email}</Typography>
                </MobilePaper>
              ));
          })()}
        </Box>

        {/* Add tier buttons for empty tiers (edit mode) */}
        {canEdit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            {tiers
              .filter(t => ['Founder', 'Managing Director', 'Director(s)'].includes(t.name)) // CEO never shown - Varun is Founder & CEO
              .map((tier) => {
                const people = staffByTier[tier.id] || [];
                if (people.length === 0) {
                  return (
                    <MobileButton key={tier.id} variant="outlined" size="small" startIcon={<GroupAddIcon />} onClick={() => openAssignDialog(tier.id)}>
                      Add {tier.name}
                    </MobileButton>
                  );
                }
                return null;
              })}
          </Box>
        )}
      </Box>

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
        <DialogContent dividers sx={{ pt: 2 }}>
          <MobileFormGrid sx={{ mb: 2 }}>
            <MobileTextField fullWidth label="Name" value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} required />
            <MobileTextField fullWidth type="number" label="Display order (lower = higher)" value={tierForm.display_order} onChange={(e) => setTierForm({ ...tierForm, display_order: parseInt(e.target.value) || 0 })} />
            <MobileTextField fullWidth label="Description" multiline rows={2} value={tierForm.description} onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })} />
            <MobileTextField fullWidth label="Color (hex)" value={tierForm.color} onChange={(e) => setTierForm({ ...tierForm, color: e.target.value })} helperText="e.g. #7c3aed" />
            <MobileTextField fullWidth label="Icon (optional)" value={tierForm.icon} onChange={(e) => setTierForm({ ...tierForm, icon: e.target.value })} helperText="Material icon name, e.g. 'account_circle'" />
          </MobileFormGrid>
          {tierError && <Alert severity="error" sx={{ mb: 2 }}>{tierError}</Alert>}
          {editingTier?.is_system && <Alert severity="info" sx={{ mb: 2 }}>System tier — name cannot be changed via API.</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setTierDialogOpen(false)}>Cancel</MobileButton>
          {editingTier && !editingTier.is_system && (
            <MobileButton variant="outlined" color="error" onClick={handleDeleteTier} disabled={tierDeleting}>
              {tierDeleting ? 'Deleting…' : 'Delete'}
            </MobileButton>
          )}
          <MobileButton variant="contained" onClick={saveTier} disabled={tierSaving || !tierForm.name}>
            {tierSaving ? 'Saving…' : 'Save'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>

      {/* ── assign employee to tier dialog ───────────────────────────────── */}
      <MobileDialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Employee to Tier</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <MobileFormGrid sx={{ mb: 2 }}>
            <MobileTextField
              fullWidth
              select
              label="Employee"
              value={assignForm.employee_id}
              onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
              options={employees.filter(e => e.status !== 'exited').map(e => ({ value: e.id, label: `${e.employee_code} — ${e.full_name}` }))}
              required
            />
            <MobileTextField
              fullWidth
              select
              label="Tier"
              value={assignForm.tier_id}
              onChange={(e) => setAssignForm({ ...assignForm, tier_id: e.target.value })}
              options={tiers.map(t => ({ value: t.id, label: t.name }))}
              required
            />
          </MobileFormGrid>
          {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setAssignDialogOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleAssignEmployee} disabled={assignSaving || !assignForm.employee_id || !assignForm.tier_id}>
            {assignSaving ? 'Assigning…' : 'Assign'}
          </MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}