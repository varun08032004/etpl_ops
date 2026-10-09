import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Chip, Tabs, Tab, Grid, IconButton, Tooltip, Divider, FormControl,
  InputLabel, Select, Badge, Avatar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import BugReportIcon from '@mui/icons-material/BugReport';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ArticleIcon from '@mui/icons-material/Article';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewListIcon from '@mui/icons-material/ViewList';
import Assignment from '@mui/icons-material/Assignment';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileActionButtons,
  MobileFormGrid,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const STATUS_COLOR = {
  backlog: 'default',
  todo: 'info',
  in_progress: 'warning',
  in_review: 'primary',
  done: 'success',
  cancelled: 'error',
};

const PRIORITY_COLOR = {
  lowest: 'default',
  low: 'info',
  medium: 'warning',
  high: 'error',
  highest: 'error',
};

const TYPE_ICON = {
  task: AssignmentIcon,
  bug: BugReportIcon,
  story: ArticleIcon,
  epic: RocketLaunchIcon,
  subtask: ArrowRightIcon,
};

const STATUS_ORDER = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];

export default function Tasks() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('board'); // board, list, backlog
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskDialog, setTaskDialog] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    project_id: '', sprint_id: '', parent_task_id: '', title: '', description: '',
    type: 'task', priority: 'medium', status: 'backlog', assignee_id: '', reporter_id: '',
    story_points: '', due_date: '', original_estimate: '', remaining_estimate: '',
    component_ids: [], label_ids: [], fix_version_ids: [], affects_version_ids: []
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [projectDialog, setProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({ department_id: '', team_id: '', name: '', key_prefix: '', description: '', project_lead_id: '', project_type: 'software' });
  const [projectSaving, setProjectSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [components, setComponents] = useState([]);
  const [labels, setLabels] = useState([]);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    const { data } = await client.get('/tasks/projects');
    setProjects(data.projects);
  }, []);

  const loadProjectData = useCallback(async (projectId) => {
    if (!projectId) return;
    const [{ data: sprintsData }, { data: compData }, { data: labelData }, { data: verData }] = await Promise.all([
      client.get('/tasks/sprints', { params: { project_id: projectId } }),
      client.get(`/tasks/projects/${projectId}/components`),
      client.get(`/tasks/projects/${projectId}/labels`),
      client.get(`/tasks/projects/${projectId}/versions`),
    ]);
    setSprints(sprintsData.sprints);
    setComponents(compData.components);
    setLabels(labelData.labels);
    setVersions(verData.versions);
  }, []);

  const loadTasks = useCallback(async () => {
    if (!selectedProject) { setTasks([]); return; }
    setLoading(true);
    try {
      const params = { project_id: selectedProject };
      if (selectedSprint !== 'all') params.sprint_id = selectedSprint;
      if (search) params.search = search;
      const { data } = await client.get('/tasks/tasks', { params });
      setTasks(data.tasks);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedSprint, search]);

  const loadDepartments = useCallback(async () => {
    const { data } = await client.get('/departments');
    setDepartments(data.departments);
  }, []);

  const loadTeams = useCallback(async () => {
    const { data } = await client.get('/teams');
    setTeams(data.teams);
  }, []);

  const loadEmployees = useCallback(async () => {
    const { data } = await client.get('/employees', { params: { status: 'active' } });
    setEmployees(data.employees);
  }, []);

  useEffect(() => { loadProjects(); loadDepartments(); loadTeams(); loadEmployees(); }, [loadProjects, loadDepartments, loadTeams, loadEmployees]);
  useEffect(() => { loadProjectData(selectedProject); }, [selectedProject, loadProjectData]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleProjectChange = (project) => {
    setSelectedProject(project?.id || null);
    setSelectedSprint('all');
    setSearch('');
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({
      project_id: selectedProject || '', sprint_id: '', parent_task_id: '', title: '', description: '',
      type: 'task', priority: 'medium', status: 'backlog', assignee_id: '', reporter_id: staff.employee_id || '',
      story_points: '', due_date: '', original_estimate: '', remaining_estimate: '',
      component_ids: [], label_ids: [], fix_version_ids: [], affects_version_ids: []
    });
    setTaskError('');
    setTaskDialog(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      project_id: task.project_id, sprint_id: task.sprint_id || '', parent_task_id: task.parent_task_id || '',
      title: task.title, description: task.description || '', type: task.type, priority: task.priority,
      status: task.status, assignee_id: task.assignee_id || '', reporter_id: task.reporter_id || '',
      story_points: task.story_points || '', due_date: task.due_date || '',
      original_estimate: task.original_estimate || '', remaining_estimate: task.remaining_estimate || '',
      component_ids: task.components?.map(c => c.id) || [],
      label_ids: task.labels?.map(l => l.id) || [],
      fix_version_ids: task.fix_versions?.map(v => v.id) || [],
      affects_version_ids: task.affects_versions?.map(v => v.id) || []
    });
    setTaskError('');
    setTaskDialog(true);
  };

  const closeTaskDialog = () => { setTaskDialog(false); setEditingTask(null); setTaskError(''); };

  const handleTaskSave = async () => {
    if (!taskForm.title.trim()) { setTaskError('Title is required'); return; }
    if (!taskForm.project_id) { setTaskError('Project is required'); return; }
    setTaskSaving(true);
    setTaskError('');
    try {
      const payload = { ...taskForm };
      if (editingTask) {
        await client.put(`/tasks/tasks/${editingTask.id}`, payload);
      } else {
        await client.post('/tasks/tasks', payload);
      }
      closeTaskDialog();
      loadTasks();
    } catch (err) {
      setTaskError(err.response?.data?.error || 'Failed to save task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Delete ${task.issue_key}?`)) return;
    try { await client.delete(`/tasks/tasks/${task.id}`); loadTasks(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete'); }
  };

  const handleCreateProject = async () => {
    if (!projectForm.name.trim() || !projectForm.key_prefix.trim() || !projectForm.department_id) return;
    setProjectSaving(true);
    try { await client.post('/tasks/projects', projectForm); setProjectDialog(false); setProjectForm({ department_id: '', team_id: '', name: '', key_prefix: '', description: '', project_lead_id: '', project_type: 'software' }); loadProjects(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to create project'); }
    finally { setProjectSaving(false); }
  };

  // Group tasks by status for board view
  const tasksByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {});

  if (!staff.employee_id) {
    return <Box sx={{ textAlign: 'center', py: 8 }}><Typography variant="h5" color="text.secondary">No employee record linked</Typography></Box>;
  }

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Tasks</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Jira-like task tracker with sprints, boards, backlog</Typography>
      </MobilePageHeader>

      {/* Top Bar */}
      <MobilePaper sx={{ mb: 2, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>Project</InputLabel>
              <Select value={selectedProject || ''} label="Project" onChange={(e) => handleProjectChange(e.target.value ? projects.find(p => p.id === e.target.value) : null)}>
                <MenuItem value="">Select Project</MenuItem>
                {projects.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Badge badgeContent={p.key_prefix} color="primary" variant="dot" sx={{ mr: 1 }} />
                      {p.name}
                      {p.department_name && <Typography variant="caption" color="text.secondary"> · {p.department_name}</Typography>}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Sprint</InputLabel>
              <Select value={selectedSprint} label="Sprint" onChange={(e) => setSelectedSprint(e.target.value)} disabled={!selectedProject}>
                <MenuItem value="all">All Sprints</MenuItem>
                {sprints.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} {s.status && <Chip size="small" label={s.status} variant="outlined" />}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField size="small" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon color="action" /> }} fullWidth />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Board View"><IconButton onClick={() => setView('board')} sx={{ bgcolor: view === 'board' ? 'primary.main' : 'transparent', color: view === 'board' ? 'white' : 'inherit' }}><ViewColumnIcon /></IconButton></Tooltip>
              <Tooltip title="List View"><IconButton onClick={() => setView('list')} sx={{ bgcolor: view === 'list' ? 'primary.main' : 'transparent', color: view === 'list' ? 'white' : 'inherit' }}><ViewListIcon /></IconButton></Tooltip>
              <Tooltip title="Backlog"><IconButton onClick={() => setView('backlog')} sx={{ bgcolor: view === 'backlog' ? 'primary.main' : 'transparent', color: view === 'backlog' ? 'white' : 'inherit' }}><RocketLaunchIcon /></IconButton></Tooltip>
            </Box>
          </Grid>
          <Grid item>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
              <MobileButton variant="outlined" startIcon={<AddIcon />} onClick={() => setProjectDialog(true)}>New Project</MobileButton>
              <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreateTask} disabled={!selectedProject}>Create Task</MobileButton>
            </Box>
          </Grid>
        </Grid>
      </MobilePaper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* BOARD VIEW - Kanban */}
      {view === 'board' && (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, minHeight: 500 }}>
          {STATUS_ORDER.map(status => {
            const statusTasks = tasksByStatus[status] || [];
            return (
              <Paper key={status} sx={{ minWidth: 300, maxWidth: 340, flexShrink: 0, height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: STATUS_COLOR[status] }}>
                    {status.replace('_', ' ')} <Badge badgeContent={statusTasks.length} color={STATUS_COLOR[status]} />
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                  {statusTasks.map((task, index) => (
                    <Paper key={task.id} elevation={1} sx={{ mb: 1, p: 1.5, cursor: 'pointer', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 } }} onClick={() => openEditTask(task)}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>{task.issue_key}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.title}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip size="small" label={task.type} icon={TYPE_ICON[task.type]} variant="outlined" />
                            <Chip size="small" label={task.priority} color={PRIORITY_COLOR[task.priority]} variant="outlined" />
                            {task.story_points && <Chip size="small" label={`${task.story_points} SP`} variant="outlined" />}
                          </Box>
                          {task.assignee_name && (
                            <Avatar size="24" src={task.assignee_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee_name)}&background=random` : undefined} sx={{ mt: 1 }} alt={task.assignee_name} />
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                  {statusTasks.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <DragIndicatorIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
                      <Typography variant="caption">Drop tasks here</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assignee</TableCell>
                  <TableCell>Sprint</TableCell>
                  <TableCell>Story Pts</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.length > 0 ? (
                  tasks.map((task) => {
                    const IconComponent = TYPE_ICON[task.type];
                    return (
                      <TableRow key={task.id} hover onClick={() => openEditTask(task)}>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'primary.main' }}>{task.issue_key}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          {IconComponent && <IconComponent fontSize="16" sx={{ mr: 1, verticalAlign: 'middle' }} />}{task.title}
                        </TableCell>
                        <TableCell><Chip size="small" label={task.type} /></TableCell>
                        <TableCell><Chip size="small" label={task.priority} color={PRIORITY_COLOR[task.priority]} /></TableCell>
                        <TableCell><Chip size="small" label={task.status.replace('_', ' ')} color={STATUS_COLOR[task.status]} /></TableCell>
                        <TableCell>{task.assignee_name || 'Unassigned'}</TableCell>
                        <TableCell>{task.sprint_name || '—'}</TableCell>
                        <TableCell className="figure">{task.story_points || '—'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditTask(task); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <>
                    {!loading && <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No tasks. Create a project and add tasks!</TableCell></TableRow>}
                    {loading && <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>Loading…</TableCell></TableRow>}
                  </>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* BACKLOG VIEW */}
      {view === 'backlog' && (
        <MobilePaper>
          <Typography variant="h6" sx={{ mb: 2 }}>Backlog — Tasks without sprint</Typography>
          {tasks.filter(t => !t.sprint_id).length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Backlog is empty</Typography>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell><TableCell>Title</TableCell><TableCell>Type</TableCell>
                    <TableCell>Priority</TableCell><TableCell>Assignee</TableCell><TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
{tasks.filter(t => !t.sprint_id).map((task) => {
                      const IconComponent = TYPE_ICON[task.type];
                      return (
                        <TableRow key={task.id} hover onClick={() => openEditTask(task)}>
                          <TableCell sx={{ fontWeight: 600 }}>{task.issue_key}</TableCell>
                          <TableCell>{IconComponent && <IconComponent fontSize="16" sx={{ mr: 1 }} />}{task.title}</TableCell>
                      <TableCell><Chip size="small" label={task.type} /></TableCell>
                      <TableCell><Chip size="small" label={task.priority} color={PRIORITY_COLOR[task.priority]} /></TableCell>
                      <TableCell>{task.assignee_name || 'Unassigned'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditTask(task); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {/* Task Dialog */}
      <MobileDialog open={taskDialog} onClose={closeTaskDialog} maxWidth="lg" fullWidth>
        <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField select label="Project" value={taskForm.project_id} onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value, sprint_id: '' })} options={projects.map(p => ({ value: p.id, label: `${p.key_prefix} - ${p.name}` }))} required disabled={editingTask} />
            <MobileTextField select label="Sprint" value={taskForm.sprint_id} onChange={(e) => setTaskForm({ ...taskForm, sprint_id: e.target.value })} options={sprints.map(s => ({ value: s.id, label: s.name }))} />
            <MobileTextField fullWidth label="Title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
            <TextField fullWidth multiline rows={4} label="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} sx={{ mt: 1 }} />
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="type-label">Type</InputLabel>
              <Select labelId="type-label" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>
                <MenuItem value="task">Task</MenuItem>
                <MenuItem value="bug">Bug</MenuItem>
                <MenuItem value="story">Story</MenuItem>
                <MenuItem value="epic">Epic</MenuItem>
                <MenuItem value="subtask">Subtask</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="priority-label">Priority</InputLabel>
              <Select labelId="priority-label" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <MenuItem value="lowest">Lowest</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="highest">Highest</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="status-label">Status</InputLabel>
              <Select labelId="status-label" value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
                <MenuItem value="backlog">Backlog</MenuItem>
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="in_review">In Review</MenuItem>
                <MenuItem value="done">Done</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <MobileTextField select label="Assignee" value={taskForm.assignee_id} onChange={(e) => setTaskForm({ ...taskForm, assignee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: e.full_name }))} />
            <MobileTextField select label="Components" value={taskForm.component_ids.join(',')} onChange={(e) => setTaskForm({ ...taskForm, component_ids: e.target.value ? e.target.value.split(',') : [] })} options={components.map(c => ({ value: c.id, label: c.name }))} SelectProps={{ multiple: true, renderValue: (selected) => selected.map(s => components.find(c => c.id === s)?.name).join(', ') }} />
            <MobileTextField select label="Labels" value={taskForm.label_ids.join(',')} onChange={(e) => setTaskForm({ ...taskForm, label_ids: e.target.value ? e.target.value.split(',') : [] })} options={labels.map(l => ({ value: l.id, label: l.name }))} SelectProps={{ multiple: true, renderValue: (selected) => selected.map(s => labels.find(l => l.id === s)?.name).join(', ') }} />
            <MobileTextField select label="Fix Versions" value={taskForm.fix_version_ids.join(',')} onChange={(e) => setTaskForm({ ...taskForm, fix_version_ids: e.target.value ? e.target.value.split(',') : [] })} options={versions.map(v => ({ value: v.id, label: v.name }))} SelectProps={{ multiple: true, renderValue: (selected) => selected.map(s => versions.find(v => v.id === s)?.name).join(', ') }} />
            <MobileTextField type="number" label="Story Points" value={taskForm.story_points} onChange={(e) => setTaskForm({ ...taskForm, story_points: e.target.value })} />
            <MobileTextField type="number" label="Original Estimate (h)" value={taskForm.original_estimate} onChange={(e) => setTaskForm({ ...taskForm, original_estimate: e.target.value })} />
            <MobileTextField type="number" label="Remaining Estimate (h)" value={taskForm.remaining_estimate} onChange={(e) => setTaskForm({ ...taskForm, remaining_estimate: e.target.value })} />
            <MobileTextField type="date" label="Due Date" InputLabelProps={{ shrink: true }} value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={closeTaskDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleTaskSave} disabled={taskSaving}>{taskSaving ? 'Saving…' : editingTask ? 'Save Changes' : 'Create Task'}</Button>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={projectDialog} onClose={() => setProjectDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Project</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField select label="Department" value={projectForm.department_id} onChange={(e) => setProjectForm({ ...projectForm, department_id: e.target.value })} options={departments.map(d => ({ value: d.id, label: d.name }))} required />
            <MobileTextField select label="Team (optional)" value={projectForm.team_id} onChange={(e) => setProjectForm({ ...projectForm, team_id: e.target.value })} options={teams.map(t => ({ value: t.id, label: t.name }))} />
            <MobileTextField fullWidth label="Name" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} required />
            <MobileTextField fullWidth label="Key Prefix (e.g. FIN, HR, ENG)" value={projectForm.key_prefix.toUpperCase()} onChange={(e) => setProjectForm({ ...projectForm, key_prefix: e.target.value.toUpperCase() })} required />
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="ptype-label">Project Type</InputLabel>
              <Select labelId="ptype-label" value={projectForm.project_type} onChange={(e) => setProjectForm({ ...projectForm, project_type: e.target.value })}>
                <MenuItem value="software">Software</MenuItem>
                <MenuItem value="business">Business</MenuItem>
                <MenuItem value="service_desk">Service Desk</MenuItem>
              </Select>
            </FormControl>
            <MobileTextField select label="Project Lead (optional)" value={projectForm.project_lead_id} onChange={(e) => setProjectForm({ ...projectForm, project_lead_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: e.full_name }))} />
            <TextField fullWidth multiline rows={3} label="Description" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} sx={{ mt: 1 }} />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setProjectDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateProject} disabled={projectSaving}>{projectSaving ? 'Creating…' : 'Create Project'}</Button>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}