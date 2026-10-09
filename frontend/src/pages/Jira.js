import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Chip, Tabs, Tab, Grid, IconButton, Tooltip, Divider, FormControl,
  InputLabel, Select, Badge, Avatar, CircularProgress, Snackbar,
  Drawer, List, ListItem, ListItemText, ListItemIcon, Accordion, AccordionSummary,
  AccordionDetails, ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails,
  Popover, Menu, MenuItem as MuiMenuItem, Checkbox, FormControlLabel,
  Stepper, Step, StepLabel, TextareaAutosize, Slider, Switch
} from '@mui/material';
import {
  Add, Edit, Delete, ArrowRight, ExpandMore, DragIndicator,
  Search, FilterList, RocketLaunch, BugReport, Assignment,
  Article, ViewColumn, ViewList, Comment, Timer, AttachFile,
  Link, Visibility, StarBorder, Star, Settings, DirectionsRun,
  Flag, MoreVert, ChevronLeft, ChevronRight, Close,
  PersonAdd, FormatAlignLeft, FormatListBulleted, Dashboard,
  ReportProblem, AssignmentTurnedIn, Sync, Download, Upload,
  Key, Tag, VerifiedUser, History, TaskAlt, FilterAlt,
  Speed, Timeline, PieChart, TrendingUp, ShowChart
} from '@mui/icons-material';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper, MobilePageHeader, MobileButton, MobileTextField,
  MobileDialog, MobileActionButtons, MobileFormGrid, ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const STATUS_CATEGORY_COLOR = {
  to_do: 'info',
  in_progress: 'warning',
  done: 'success',
};

const PRIORITY_COLOR = {
  lowest: 'default',
  low: 'info',
  medium: 'warning',
  high: 'error',
  highest: 'error',
};

const TYPE_ICON = {
  epic: RocketLaunch,
  story: Article,
  task: Assignment,
  bug: BugReport,
  subtask: ArrowRight,
  incident: ReportProblem,
  problem: AssignmentTurnedIn,
  change: Sync,
  service_request: VerifiedUser,
  sprint: DirectionsRun,
};

const LINK_TYPE_LABELS = {
  blocks: 'blocks',
  blocked_by: 'is blocked by',
  relates_to: 'relates to',
  duplicates: 'duplicates',
  duplicated_by: 'is duplicated by',
  clones: 'clones',
  cloned_from: 'is cloned from',
};

export default function Jira() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('all');
  const [issues, setIssues] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [components, setComponents] = useState([]);
  const [labels, setLabels] = useState([]);
  const [versions, setVersions] = useState([]);
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueDetail, setIssueDetail] = useState(null);
  const [issueDialog, setIssueDialog] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [issueForm, setIssueForm] = useState({});
  const [issueError, setIssueError] = useState('');
  const [projectDialog, setProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({
    key: '', name: '', description: '', project_type: 'software',
    lead_id: '', category_id: '', is_private: false
  });
  const [projectError, setProjectError] = useState('');
  const [projectSaving, setProjectSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [worklogForm, setWorklogForm] = useState({ time_spent: '', comment: '', started_at: new Date().toISOString().slice(0,16) });
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ target_issue_id: '', link_type: 'relates_to' });
  const [transitionDialog, setTransitionDialog] = useState(false);
  const [availableTransitions, setAvailableTransitions] = useState([]);
  const [selectedTransition, setSelectedTransition] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const showSnackbar = (message, severity = 'info') => setSnackbar({ open: true, message, severity });

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await client.get('/api/jira-projects');
      setProjects(data.projects || []);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load projects', 'error');
    }
  }, []);

  const loadProjectDetail = useCallback(async (projectId) => {
    try {
      const { data } = await client.get(`/api/jira-projects/${projectId}`);
      setProjectDetail(data);
      setSprints(data.versions || []);
      setComponents(data.components || []);
      setIssueTypes(data.issueTypes || []);
      setStatuses(data.statuses || []);
      loadLabels(projectId);
      loadVersions(projectId);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load project details', 'error');
    }
  }, []);

  const loadLabels = useCallback(async (projectId) => {
    try {
      const { data } = await client.get(`/api/jira-projects/${projectId}/labels`);
      setLabels(data.labels || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadVersions = useCallback(async (projectId) => {
    try {
      const { data } = await client.get(`/api/jira-projects/${projectId}/versions`);
      setVersions(data.versions || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadIssueTypesAndStatuses = useCallback(async () => {
    try {
      const [{ data: types }, { data: stats }, { data: pri }, { data: res }] = await Promise.all([
        client.get('/api/jira-issues/meta/issue-types'),
        client.get('/api/jira-issues/meta/statuses'),
        client.get('/api/jira-issues/meta/priorities'),
        client.get('/api/jira-issues/meta/resolutions'),
      ]);
      setIssueTypes(types.issueTypes || []);
      setStatuses(stats.statuses || []);
      setPriorities(pri.priorities || []);
      setResolutions(res.resolutions || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const { data } = await client.get('/employees', { params: { status: 'active' } });
      setEmployees(data.employees || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadIssues = useCallback(async () => {
    if (!selectedProject) { setIssues([]); return; }
    setLoading(true);
    try {
      const params = { project_id: selectedProject, limit: 200 };
      if (selectedSprint !== 'all') params.sprint_id = selectedSprint;
      if (search) params.search = search;
      const { data } = await client.get('/api/jira-issues', { params });
      setIssues(data.issues || []);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load issues', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedSprint, search]);

  useEffect(() => { loadProjects(); loadIssueTypesAndStatuses(); loadEmployees(); }, [loadProjects, loadIssueTypesAndStatuses, loadEmployees]);
  useEffect(() => { if (selectedProject) loadProjectDetail(selectedProject); }, [selectedProject, loadProjectDetail]);
  useEffect(() => { loadIssues(); }, [loadIssues]);

  const handleProjectChange = (project) => {
    setSelectedProject(project?.id || null);
    setSelectedSprint('all');
    setSearch('');
  };

  const resetIssueForm = () => setIssueForm({
    project_id: selectedProject || '', issue_type_id: '', summary: '', description: '',
    priority_id: '', assignee_id: '', reporter_id: staff.employee_id || '',
    parent_id: '', epic_id: '', sprint_id: '', story_points: '',
    original_estimate: '', remaining_estimate: '', due_date: '', start_date: '',
    fix_versions: [], affected_versions: [], components: [], labels: [],
    security_level_id: '', environment: ''
  });

  const openCreateIssue = () => {
    setEditingIssue(null);
    resetIssueForm();
    setIssueError('');
    setIssueDialog(true);
  };

  const openEditIssue = (issue) => {
    setEditingIssue(issue);
    setIssueForm({
      project_id: issue.project_id, issue_type_id: issue.issue_type_id, summary: issue.summary,
      description: issue.description || '', priority_id: issue.priority_id || '',
      assignee_id: issue.assignee_id || '', reporter_id: issue.reporter_id || '',
      parent_id: issue.parent_id || '', epic_id: issue.epic_id || '',
      sprint_id: issue.sprint_id || '', story_points: issue.story_points || '',
      original_estimate: issue.original_estimate || '', remaining_estimate: issue.remaining_estimate || '',
      due_date: issue.due_date ? issue.due_date.slice(0,10) : '',
      start_date: issue.start_date ? issue.start_date.slice(0,10) : '',
      fix_versions: issue.fix_versions || [], affected_versions: issue.affected_versions || [],
      components: issue.components || [], labels: issue.labels || [],
      security_level_id: issue.security_level_id || '', environment: issue.environment || ''
    });
    setIssueError('');
    setIssueDialog(true);
  };

  const closeIssueDialog = () => { setIssueDialog(false); setEditingIssue(null); setIssueError(''); };

  const handleIssueSave = async () => {
    if (!issueForm.summary.trim()) { setIssueError('Summary is required'); return; }
    if (!issueForm.issue_type_id) { setIssueError('Issue type is required'); return; }
    if (!issueForm.project_id) { setIssueError('Project is required'); return; }
    setSaving(true); setIssueError('');
    try {
      const payload = { ...issueForm, fix_versions: issueForm.fix_versions || [], affected_versions: issueForm.affected_versions || [], components: issueForm.components || [], labels: issueForm.labels || [] };
      if (editingIssue) {
        await client.put(`/api/jira-issues/${editingIssue.id}`, payload);
      } else {
        await client.post('/api/jira-issues', payload);
      }
      closeIssueDialog();
      loadIssues();
      showSnackbar(editingIssue ? 'Issue updated' : 'Issue created', 'success');
    } catch (err) {
      setIssueError(err.response?.data?.error || 'Failed to save issue');
    } finally { setSaving(false); }
  };

  const handleDeleteIssue = async (issue) => {
    if (!window.confirm(`Delete ${issue.issue_key}?`)) return;
    try { await client.delete(`/api/jira-issues/${issue.id}`); loadIssues(); showSnackbar('Issue deleted', 'success'); }
    catch (err) { showSnackbar(err.response?.data?.error || 'Failed to delete', 'error'); }
  };

  const loadIssueDetail = async (issueId) => {
    try {
      const { data } = await client.get(`/api/jira-issues/${issueId}`);
      setIssueDetail(data);
      setActiveTab(0);
    } catch (err) { console.error(err); showSnackbar('Failed to load issue', 'error'); }
  };

  const openIssueDetail = (issue) => { setSelectedIssue(issue); loadIssueDetail(issue.id); };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await client.post(`/api/jira-issues/${selectedIssue.id}/comments`, { body: commentText });
      setCommentText('');
      loadIssueDetail(selectedIssue.id);
    } catch (err) { showSnackbar('Failed to add comment', 'error'); }
  };

  const addWorklog = async () => {
    if (!worklogForm.time_spent) return;
    try {
      await client.post(`/api/jira-issues/${selectedIssue.id}/worklogs`, worklogForm);
      setWorklogForm({ time_spent: '', comment: '', started_at: new Date().toISOString().slice(0,16) });
      loadIssueDetail(selectedIssue.id);
    } catch (err) { showSnackbar('Failed to log work', 'error'); }
  };

  const addLink = async () => {
    if (!linkForm.target_issue_id || !linkForm.link_type) return;
    try {
      await client.post(`/api/jira-issues/${selectedIssue.id}/links`, linkForm);
      setLinkForm({ target_issue_id: '', link_type: 'relates_to' });
      setShowLinkDialog(false);
      loadIssueDetail(selectedIssue.id);
    } catch (err) { showSnackbar('Failed to create link', 'error'); }
  };

  const loadTransitions = async () => {
    try {
      const { data } = await client.get(`/api/jira-issues/${selectedIssue.id}/transitions`);
      setAvailableTransitions(data.transitions || []);
      setTransitionDialog(true);
    } catch (err) { showSnackbar('Failed to load transitions', 'error'); }
  };

  const executeTransition = async () => {
    if (!selectedTransition) return;
    try {
      await client.post(`/api/jira-issues/${selectedIssue.id}/transition`, { transition_id: selectedTransition });
      setTransitionDialog(false);
      loadIssueDetail(selectedIssue.id);
      loadIssues();
      showSnackbar('Status transitioned', 'success');
    } catch (err) { showSnackbar(err.response?.data?.error || 'Transition failed', 'error'); }
  };

  const handleCreateProject = async () => {
    if (!projectForm.key.trim() || !projectForm.name.trim()) { setProjectError('Key and Name are required'); return; }
    setProjectSaving(true); setProjectError('');
    try {
      await client.post('/api/jira-projects', projectForm);
      setProjectDialog(false);
      setProjectForm({ key: '', name: '', description: '', project_type: 'software', lead_id: '', category_id: '', is_private: false });
      loadProjects();
      showSnackbar('Project created', 'success');
    } catch (err) {
      setProjectError(err.response?.data?.error || 'Failed to create project');
    } finally { setProjectSaving(false); }
  };

  const handleAddWatcher = async (employeeId) => {
    try { await client.post(`/api/jira-issues/${selectedIssue.id}/watchers`, { employee_id: employeeId }); loadIssueDetail(selectedIssue.id); }
    catch (err) { showSnackbar('Failed to add watcher', 'error'); }
  };

  const handleVote = async () => {
    try { await client.post(`/api/jira-issues/${selectedIssue.id}/vote`); loadIssueDetail(selectedIssue.id); }
    catch (err) { showSnackbar('Failed to vote', 'error'); }
  };

  const handleRemoveWatcher = async (employeeId) => {
    try { await client.delete(`/api/jira-issues/${selectedIssue.id}/watchers/${employeeId}`); loadIssueDetail(selectedIssue.id); }
    catch (err) { showSnackbar('Failed to remove watcher', 'error'); }
  };

  const tasksByStatus = useMemo(() => {
    const grouped = {};
    (statuses || []).forEach(s => grouped[s.id] = []);
    issues.forEach(t => { if (grouped[t.status_id] !== undefined) grouped[t.status_id].push(t); });
    return grouped;
  }, [issues, statuses]);

  const statusOrder = useMemo(() => statuses.sort((a,b) => (a.order_index||0) - (b.order_index||0)), [statuses]);

  if (!staff.employee_id) {
    return <Box sx={{ textAlign: 'center', py: 8 }}><Typography variant="h5" color="text.secondary">No employee record linked</Typography></Box>;
  }

  return (
    <Box>
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({...snackbar, open: false})}
        ContentProps={{ 'aria-describedby': 'message-id' }}>
        <Alert onClose={() => setSnackbar({...snackbar, open: false})} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Jira</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Project & Issue Tracking</Typography>
      </MobilePageHeader>

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
                      <Badge badgeContent={p.key} color="primary" variant="dot" sx={{ mr: 1 }} />
                      {p.name} {p.category_name && <Typography variant="caption" color="text.secondary"> · {p.category_name}</Typography>}
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
                  <MenuItem key={s.id} value={s.id}>{s.name} {s.status && <Chip size="small" label={s.status} variant="outlined" />}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField size="small" placeholder="Search issues..." value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search color="action" /> }} fullWidth />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Board View"><IconButton onClick={() => setView('board')} sx={{ bgcolor: view === 'board' ? 'primary.main' : 'transparent', color: view === 'board' ? 'white' : 'inherit' }}><ViewColumn /></IconButton></Tooltip>
              <Tooltip title="List View"><IconButton onClick={() => setView('list')} sx={{ bgcolor: view === 'list' ? 'primary.main' : 'transparent', color: view === 'list' ? 'white' : 'inherit' }}><ViewList /></IconButton></Tooltip>
              <Tooltip title="Backlog"><IconButton onClick={() => setView('backlog')} sx={{ bgcolor: view === 'backlog' ? 'primary.main' : 'transparent', color: view === 'backlog' ? 'white' : 'inherit' }}><RocketLaunch /></IconButton></Tooltip>
              <Tooltip title="Sprints"><IconButton onClick={() => setView('sprints')} sx={{ bgcolor: view === 'sprints' ? 'primary.main' : 'transparent', color: view === 'sprints' ? 'white' : 'inherit' }}><DirectionsRun /></IconButton></Tooltip>
              <Tooltip title="Reports"><IconButton onClick={() => setView('reports')} sx={{ bgcolor: view === 'reports' ? 'primary.main' : 'transparent', color: view === 'reports' ? 'white' : 'inherit' }}><Dashboard /></IconButton></Tooltip>
            </Box>
          </Grid>
          <Grid item>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
              <MobileButton variant="outlined" startIcon={<Settings />} onClick={() => selectedProject && setProjectDialog(true)} disabled={!selectedProject}>Project Settings</MobileButton>
              <MobileButton variant="outlined" startIcon={<Add />} onClick={() => setProjectDialog(true)}>New Project</MobileButton>
              <MobileButton variant="contained" startIcon={<Add />} onClick={openCreateIssue} disabled={!selectedProject}>Create Issue</MobileButton>
            </Box>
          </Grid>
        </Grid>
      </MobilePaper>

      {projectError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProjectError('')}>{projectError}</Alert>}
      {issueError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setIssueError('')}>{issueError}</Alert>}

      {/* BOARD VIEW */}
      {view === 'board' && selectedProject && (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, minHeight: 500 }}>
          {statusOrder.map(status => {
            const statusIssues = tasksByStatus[status.id] || [];
            return (
              <Paper key={status.id} sx={{ minWidth: 300, maxWidth: 340, flexShrink: 0, height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: status.color + '15' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: status.color }}>
                    {status.name} <Badge badgeContent={statusIssues.length} color={STATUS_CATEGORY_COLOR[status.category] || 'default'} />
                  </Typography>
                  <Chip size="small" label={status.category.replace('_',' ')} color={STATUS_CATEGORY_COLOR[status.category] || 'default'} variant="outlined" />
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                  {statusIssues.map((issue, index) => (
                    <Paper key={issue.id} elevation={1} sx={{ mb: 1, p: 1.5, cursor: 'pointer', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 } }} onClick={() => openIssueDetail(issue)}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>{issue.issue_key}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{issue.summary}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            {issue.issue_type_name && <Chip size="small" label={issue.issue_type_name} icon={TYPE_ICON[issue.issue_type_id]} variant="outlined" />}
                            {issue.priority_name && <Chip size="small" label={issue.priority_name} color={PRIORITY_COLOR[issue.priority_id]} variant="outlined" />}
                            {issue.story_points && <Chip size="small" label={`${issue.story_points} SP`} variant="outlined" />}
                          </Box>
                          {issue.assignee_name && (
                            <Avatar size="24" src={issue.assignee_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(issue.assignee_name)}&background=random` : undefined} sx={{ mt: 1 }} alt={issue.assignee_name} />
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                  {statusIssues.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <DragIndicator sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
                      <Typography variant="caption">Drop issues here</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* LIST VIEW */}
      {view === 'list' && selectedProject && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell><TableCell>Summary</TableCell><TableCell>Type</TableCell>
                  <TableCell>Priority</TableCell><TableCell>Status</TableCell><TableCell>Assignee</TableCell>
                  <TableCell>Sprint</TableCell><TableCell>Story Pts</TableCell><TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issues.length > 0 ? (
                  issues.map((issue) => {
                    const IconComponent = TYPE_ICON[issue.issue_type_id];
                    return (
                      <TableRow key={issue.id} hover onClick={() => openIssueDetail(issue)}>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'primary.main' }}>{issue.issue_key}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          {IconComponent && <IconComponent fontSize="16" sx={{ mr: 1, verticalAlign: 'middle' }} />}{issue.summary}
                        </TableCell>
                        <TableCell><Chip size="small" label={issue.issue_type_name} /></TableCell>
                        <TableCell><Chip size="small" label={issue.priority_name} color={PRIORITY_COLOR[issue.priority_id]} /></TableCell>
                        <TableCell><Chip size="small" label={issue.status_name} color={STATUS_CATEGORY_COLOR[issue.status_category] || 'default'} /></TableCell>
                        <TableCell>{issue.assignee_name || 'Unassigned'}</TableCell>
                        <TableCell>{issue.sprint_name || '—'}</TableCell>
                        <TableCell className="figure">{issue.story_points || '—'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditIssue(issue); }}><Edit fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteIssue(issue); }}><Delete fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <>
                    {!loading && <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No issues. Create a project and add issues!</TableCell></TableRow>}
                    {loading && <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>}
                  </>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {/* BACKLOG VIEW */}
      {view === 'backlog' && selectedProject && (
        <MobilePaper>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Backlog — Issues without sprint</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Create Sprint"><IconButton onClick={() => { setView('sprints'); }}><Add /></IconButton></Tooltip>
            </Box>
          </Box>
          {issues.filter(t => !t.sprint_id).length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Backlog is empty</Typography>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell><TableCell>Summary</TableCell><TableCell>Type</TableCell>
                    <TableCell>Priority</TableCell><TableCell>Assignee</TableCell><TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issues.filter(t => !t.sprint_id).map((issue) => {
                    const IconComponent = TYPE_ICON[issue.issue_type_id];
                    return (
                      <TableRow key={issue.id} hover onClick={() => openIssueDetail(issue)}>
                        <TableCell sx={{ fontWeight: 600 }}>{issue.issue_key}</TableCell>
                        <TableCell>{IconComponent && <IconComponent fontSize="16" sx={{ mr: 1 }} />}{issue.summary}</TableCell>
                        <TableCell><Chip size="small" label={issue.issue_type_name} /></TableCell>
                        <TableCell><Chip size="small" label={issue.priority_name} color={PRIORITY_COLOR[issue.priority_id]} /></TableCell>
                        <TableCell>{issue.assignee_name || 'Unassigned'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditIssue(issue); }}><Edit fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteIssue(issue); }}><Delete fontSize="small" /></IconButton></Tooltip>
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

      {/* SPRINTS VIEW */}
      {view === 'sprints' && selectedProject && (
        <MobilePaper>
          <Typography variant="h6" sx={{ mb: 2 }}>Sprints</Typography>
          {sprints.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No sprints. Create one from Project Settings.</Typography>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell><TableCell>Status</TableCell><TableCell>Start</TableCell>
                    <TableCell>End</TableCell><TableCell>Goal</TableCell><TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sprints.map(sprint => (
                    <TableRow key={sprint.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{sprint.name}</TableCell>
                      <TableCell><Chip size="small" label={sprint.status} color={sprint.status === 'active' ? 'success' : sprint.status === 'completed' ? 'default' : 'warning'} /></TableCell>
                      <TableCell>{sprint.start_date || '—'}</TableCell>
                      <TableCell>{sprint.end_date || '—'}</TableCell>
                      <TableCell>{sprint.goal || '—'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Issues"><IconButton size="small" onClick={() => { setSelectedSprint(sprint.id); setView('board'); }}><Visibility fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {/* REPORTS VIEW */}
      {view === 'reports' && selectedProject && (
        <MobilePaper>
          <Typography variant="h6" sx={{ mb: 2 }}>Reports</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center', cursor: 'pointer' }}>
                <Speed fontSize={48} sx={{ color: 'primary.main', mb: 1 }} />
                <Typography variant="h6">Velocity Chart</Typography>
                <Typography variant="body2" color="text.secondary">Track team velocity across sprints</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center', cursor: 'pointer' }}>
                <Timeline fontSize={48} sx={{ color: 'secondary.main', mb: 1 }} />
                <Typography variant="h6">Sprint Burndown</Typography>
                <Typography variant="body2" color="text.secondary">Monitor sprint progress</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center', cursor: 'pointer' }}>
                <PieChart fontSize={48} sx={{ color: 'success.main', mb: 1 }} />
                <Typography variant="h6">Issue Statistics</Typography>
                <Typography variant="body2" color="text.secondary">Status, type, priority breakdown</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center', cursor: 'pointer' }}>
                <TrendingUp fontSize={48} sx={{ color: 'warning.main', mb: 1 }} />
                <Typography variant="h6">Control Chart</Typography>
                <Typography variant="body2" color="text.secondary">Cycle time & lead time analysis</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center', cursor: 'pointer' }}>
                <ShowChart fontSize={48} sx={{ color: 'info.main', mb: 1 }} />
                <Typography variant="h6">Cumulative Flow</Typography>
                <Typography variant="body2" color="text.secondary">Work in progress over time</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center', cursor: 'pointer' }}>
                <BugReport fontSize={48} sx={{ color: 'error.main', mb: 1 }} />
                <Typography variant="h6">Bug Report</Typography>
                <Typography variant="body2" color="text.secondary">Bug trends & resolution time</Typography>
              </Paper>
            </Grid>
          </Grid>
        </MobilePaper>
      )}

      {/* ISSUE DETAIL DRAWER */}
      <Drawer anchor="right" open={!!selectedIssue} onClose={() => { setSelectedIssue(null); setIssueDetail(null); }} variant="persistent" sx={{ width: isMobile ? '100%' : 700 }}>
        {selectedIssue && issueDetail && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>{selectedIssue.issue_key}</Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>{selectedIssue.summary}</Typography>
              </Box>
              <IconButton onClick={() => { setSelectedIssue(null); setIssueDetail(null); }}><Close /></IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                    <Tab label="Details" icon={<FormatAlignLeft />} />
                    <Tab label="Comments" icon={<Comment />} />
                    <Tab label="Activity" icon={<History />} />
                    <Tab label="Worklogs" icon={<Timer />} />
                    <Tab label="Attachments" icon={<AttachFile />} />
                    <Tab label="Links" icon={<Link />} />
                    <Tab label="Subtasks" icon={<TaskAlt />} />
                  </Tabs>

                  {activeTab === 0 && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">Type</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          {TYPE_ICON[issueDetail.issue.issue_type_id] && (() => {
                            const IconComponent = TYPE_ICON[issueDetail.issue.issue_type_id];
                            return <IconComponent fontSize={24} sx={{ color: issueDetail.issue.issue_type_color }} />;
                          })()}
                          <Typography variant="h6">{issueDetail.issue.issue_type_name}</Typography>
                        </Box>
                      </Paper>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip label={issueDetail.issue.status_name} color={STATUS_CATEGORY_COLOR[issueDetail.issue.status_category] || 'default'} size="small" />
                          <Typography variant="caption" color="text.secondary">({issueDetail.issue.status_category.replace('_',' ')})</Typography>
                        </Box>
                      </Paper>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">Priority</Typography>
                        <Chip label={issueDetail.issue.priority_name} color={PRIORITY_COLOR[issueDetail.issue.priority_id]} size="small" sx={{ mt: 0.5 }} />
                      </Paper>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">Assignee</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          {issueDetail.issue.assignee_name && (
                            <>
                              <Avatar size="32" src={issueDetail.issue.assignee_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(issueDetail.issue.assignee_name)}&background=random` : undefined} alt={issueDetail.issue.assignee_name} />
                              <Typography>{issueDetail.issue.assignee_name}</Typography>
                            </>
                          ) || <Typography color="text.secondary">Unassigned</Typography>}
                        </Box>
                      </Paper>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">Reporter</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          {issueDetail.issue.reporter_name && (
                            <>
                              <Avatar size="32" src={issueDetail.issue.reporter_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(issueDetail.issue.reporter_name)}&background=random` : undefined} alt={issueDetail.issue.reporter_name} />
                              <Typography>{issueDetail.issue.reporter_name}</Typography>
                            </>
                          ) || <Typography color="text.secondary">—</Typography>}
                        </Box>
                      </Paper>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">Sprint</Typography>
                        <Typography sx={{ mt: 0.5 }}>{issueDetail.issue.sprint_name || '—'}</Typography>
                      </Paper>
                      {issueDetail.issue.story_points && (
                        <Paper elevation={1} sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">Story Points</Typography>
                          <Typography variant="h6" sx={{ mt: 0.5 }}>{issueDetail.issue.story_points} SP</Typography>
                        </Paper>
                      )}
                      {issueDetail.issue.original_estimate && (
                        <Paper elevation={1} sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">Original Estimate</Typography>
                          <Typography variant="h6" sx={{ mt: 0.5 }}>{issueDetail.issue.original_estimate}h</Typography>
                        </Paper>
                      )}
                      {issueDetail.issue.time_spent && (
                        <Paper elevation={1} sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">Time Spent</Typography>
                          <Typography variant="h6" sx={{ mt: 0.5 }}>{issueDetail.issue.time_spent}h</Typography>
                        </Paper>
                      )}
                      {issueDetail.issue.due_date && (
                        <Paper elevation={1} sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">Due Date</Typography>
                          <Typography variant="h6" sx={{ mt: 0.5 }}>{new Date(issueDetail.issue.due_date).toLocaleDateString()}</Typography>
                        </Paper>
                      )}
                    </Box>
                  )}

                  {activeTab === 1 && (
                    <Box>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <TextareaAutosize
                          placeholder="Add a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          rows={3}
                          sx={{ flex: 1, mt: 0.5 }}
                        />
                        <Button variant="contained" startIcon={<Add />} onClick={addComment} disabled={!commentText.trim()}>Comment</Button>
                      </Box>
                      {issueDetail.comments.map(comment => (
                        <Paper key={comment.id} elevation={1} sx={{ mb: 1, p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar size="32" src={comment.author_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_name)}&background=random` : undefined} alt={comment.author_name} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{comment.author_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{new Date(comment.created_at).toLocaleString()}</Typography>
                              </Box>
                            </Box>
                            {comment.is_internal && <Chip size="small" label="Internal" color="warning" />}
                          </Box>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{comment.body}</Typography>
                        </Paper>
                      ))}
                    </Box>
                  )}

                  {activeTab === 2 && (
                    <Box>
                      {issueDetail.history.map(h => (
                        <Paper key={h.id} elevation={1} sx={{ mb: 1, p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar size="28" src={h.author_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(h.author_name)}&background=random` : undefined} alt={h.author_name} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{h.author_name || 'System'}</Typography>
                                <Typography variant="caption" color="text.secondary">{new Date(h.created_at).toLocaleString()}</Typography>
                              </Box>
                            </Box>
                            <Chip size="small" label={h.change_type} variant="outlined" />
                          </Box>
                          <Typography variant="body2">{h.description || `${h.field_changed}: ${h.old_value} → ${h.new_value}`}</Typography>
                        </Paper>
                      ))}
                    </Box>
                  )}

                  {activeTab === 3 && (
                    <Box>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Time Spent (h)</InputLabel>
                          <Select value={worklogForm.time_spent} label="Time Spent" onChange={(e) => setWorklogForm({...worklogForm, time_spent: e.target.value})}>
                            <MenuItem value={0.25}>0.25h</MenuItem>
                            <MenuItem value={0.5}>0.5h</MenuItem>
                            <MenuItem value={1}>1h</MenuItem>
                            <MenuItem value={2}>2h</MenuItem>
                            <MenuItem value={4}>4h</MenuItem>
                            <MenuItem value={8}>8h</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField size="small" placeholder="Comment" value={worklogForm.comment} onChange={(e) => setWorklogForm({...worklogForm, comment: e.target.value})} sx={{ flex: 1 }} />
                        <TextField size="small" type="datetime-local" value={worklogForm.started_at} onChange={(e) => setWorklogForm({...worklogForm, started_at: e.target.value})} InputLabelProps={{ shrink: true }} />
                        <Button variant="contained" startIcon={<Add />} onClick={addWorklog} disabled={!worklogForm.time_spent}>Log Work</Button>
                      </Box>
                      {issueDetail.worklogs.map(w => (
                        <Paper key={w.id} elevation={1} sx={{ mb: 1, p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar size="28" src={w.author_email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(w.author_name)}&background=random` : undefined} alt={w.author_name} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{w.author_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{new Date(w.started_at).toLocaleString()}</Typography>
                              </Box>
                            </Box>
                            <Chip size="small" label={`${w.time_spent}h`} color="primary" variant="outlined" />
                          </Box>
                          {w.comment && <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>"{w.comment}"</Typography>}
                        </Paper>
                      ))}
                    </Box>
                  )}

                  {activeTab === 4 && (
                    <Box>
                      {issueDetail.attachments.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No attachments</Typography>
                      ) : (
                        issueDetail.attachments.map(a => (
                          <Paper key={a.id} elevation={1} sx={{ mb: 1, p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AttachFile fontSize={32} color="action" />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.filename}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {(a.file_size / 1024).toFixed(1)} KB · {new Date(a.created_at).toLocaleString()}
                                </Typography>
                              </Box>
                              <Button size="small" variant="outlined">Download</Button>
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}

                  {activeTab === 5 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Issue Links</Typography>
                        <Button variant="outlined" startIcon={<Add />} onClick={() => setShowLinkDialog(true)}>Link Issue</Button>
                      </Box>
                      {issueDetail.links.map(link => (
                        <Paper key={link.id} elevation={1} sx={{ mb: 1, p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={LINK_TYPE_LABELS[link.link_type] || link.link_type} size="small" variant="outlined" />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>{link.target_key}</Typography>
                            <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>{link.target_summary}</Typography>
                            <Chip size="small" label={link.target_status} variant="outlined" />
                            <IconButton size="small" onClick={() => { /* delete link */ }}><Delete fontSize="small" /></IconButton>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  )}

                  {activeTab === 6 && (
                    <Box>
                      {issueDetail.subtasks.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No subtasks</Typography>
                      ) : (
                        issueDetail.subtasks.map(sub => (
                          <Paper key={sub.id} elevation={1} sx={{ mb: 1, p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>{sub.issue_key}</Typography>
                              <Typography variant="body2" sx={{ flex: 1 }}>{sub.summary}</Typography>
                              <Chip size="small" label={sub.status_name} color={STATUS_CATEGORY_COLOR[sub.status_category] || 'default'} />
                              <IconButton size="small" onClick={() => openIssueDetail(sub)}><Visibility fontSize="small" /></IconButton>
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Paper elevation={1} sx={{ p: 2, height: 'fit-content', position: 'sticky', top: 100 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Actions</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button variant="outlined" startIcon={<Edit />} fullWidth onClick={() => { setSelectedIssue(null); setIssueDetail(null); openEditIssue(selectedIssue); }}>Edit Issue</Button>
                      <Button variant="outlined" startIcon={<Flag />} fullWidth onClick={loadTransitions}>Transition</Button>
                      <Button variant="outlined" startIcon={<Visibility />} fullWidth onClick={handleVote}>Vote</Button>
                      <Button variant="outlined" startIcon={<PersonAdd />} fullWidth onClick={() => { /* add watcher */ }}>Add Watcher</Button>
                      <Divider sx={{ my: 1 }} />
                      <Button variant="outlined" color="error" startIcon={<Delete />} fullWidth onClick={() => { setSelectedIssue(null); setIssueDetail(null); handleDeleteIssue(selectedIssue); }}>Delete Issue</Button>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>Watchers</Typography>
                    {issueDetail.watchers.map(w => (
                      <Box key={w.employee_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Avatar size="28" src={w.email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(w.full_name)}&background=random` : undefined} alt={w.full_name} />
                        <Typography variant="body2" sx={{ flex: 1 }}>{w.full_name}</Typography>
                        <IconButton size="small" onClick={() => handleRemoveWatcher(w.employee_id)}><Close fontSize="small" /></IconButton>
                      </Box>
                    ))}
                    {issueDetail.votes.length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" sx={{ mb: 1 }}>Votes ({issueDetail.votes.length})</Typography>
                        {issueDetail.votes.map(v => (
                          <Box key={v.employee_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Avatar size="28" src={v.email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(v.full_name)}&background=random` : undefined} alt={v.full_name} />
                            <Typography variant="body2">{v.full_name}</Typography>
                          </Box>
                        ))}
                      </>
                    )}
<Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>Epic</Typography>
                    <>
                      {issueDetail.issue.epic_key && (
                        <Paper elevation={1} sx={{ p: 1, mb: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>{issueDetail.issue.epic_key}</Typography>
                          <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{issueDetail.issue.epic_summary}</Typography>
                        </Paper>
                      )}
                      {issueDetail.epicIssues.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Issues in this Epic</Typography>
                          {issueDetail.epicIssues.slice(0,5).map(epicIssue => (
                            <Paper key={epicIssue.id} elevation={1} sx={{ p: 1, mb: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>{epicIssue.issue_key}</Typography>
                              <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{epicIssue.summary}</Typography>
                              <Chip size="small" label={epicIssue.status_name} color={STATUS_CATEGORY_COLOR[epicIssue.status_category] || 'default'} />
                            </Paper>
                          ))}
                        </Box>
                      )}
                    </>
                    </Paper>
                  </Grid>
              </Grid>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ISSUE CREATE/EDIT DIALOG */}
      <MobileDialog open={issueDialog} onClose={closeIssueDialog} maxWidth="lg" fullWidth>
        <DialogTitle>{editingIssue ? 'Edit Issue' : 'Create Issue'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField select label="Project" value={issueForm.project_id} onChange={(e) => setIssueForm({...issueForm, project_id: e.target.value})} options={projects.map(p => ({ value: p.id, label: `${p.key} - ${p.name}` }))} required disabled={editingIssue} />
            <MobileTextField select label="Issue Type" value={issueForm.issue_type_id} onChange={(e) => setIssueForm({...issueForm, issue_type_id: e.target.value})} options={issueTypes.map(t => ({ value: t.id, label: t.name }))} required />
            <MobileTextField fullWidth label="Summary" value={issueForm.summary} onChange={(e) => setIssueForm({...issueForm, summary: e.target.value})} required />
            <TextField fullWidth multiline rows={4} label="Description" value={issueForm.description} onChange={(e) => setIssueForm({...issueForm, description: e.target.value})} sx={{ mt: 1 }} />
            <MobileTextField select label="Priority" value={issueForm.priority_id} onChange={(e) => setIssueForm({...issueForm, priority_id: e.target.value})} options={priorities.map(p => ({ value: p.id, label: p.name }))} />
            <MobileTextField select label="Status" value={issueForm.status_id} onChange={(e) => setIssueForm({...issueForm, status_id: e.target.value})} options={statuses.map(s => ({ value: s.id, label: s.name }))} />
            <MobileTextField select label="Assignee" value={issueForm.assignee_id} onChange={(e) => setIssueForm({...issueForm, assignee_id: e.target.value})} options={employees.map(e => ({ value: e.id, label: e.full_name }))} />
            <MobileTextField select label="Reporter" value={issueForm.reporter_id} onChange={(e) => setIssueForm({...issueForm, reporter_id: e.target.value})} options={employees.map(e => ({ value: e.id, label: e.full_name }))} />
            <MobileTextField select label="Parent Issue" value={issueForm.parent_id} onChange={(e) => setIssueForm({...issueForm, parent_id: e.target.value})} options={issues.filter(i => i.issue_type_id !== 'subtask').map(i => ({ value: i.id, label: `${i.issue_key} - ${i.summary}` }))} />
            <MobileTextField select label="Epic Link" value={issueForm.epic_id} onChange={(e) => setIssueForm({...issueForm, epic_id: e.target.value})} options={issues.filter(i => i.issue_type_id === 'epic').map(i => ({ value: i.id, label: `${i.issue_key} - ${i.summary}` }))} />
            <MobileTextField select label="Sprint" value={issueForm.sprint_id} onChange={(e) => setIssueForm({...issueForm, sprint_id: e.target.value})} options={sprints.map(s => ({ value: s.id, label: s.name }))} />
            <MobileTextField select multiple label="Components" value={issueForm.components} onChange={(e) => setIssueForm({...issueForm, components: e.target.value})} options={components.map(c => ({ value: c.id, label: c.name }))} renderValue={(selected) => selected.map(s => components.find(c => c.id === s)?.name).join(', ')} />
            <MobileTextField select multiple label="Labels" value={issueForm.labels} onChange={(e) => setIssueForm({...issueForm, labels: e.target.value})} options={labels.map(l => ({ value: l.id, label: l.name }))} renderValue={(selected) => selected.map(s => labels.find(l => l.id === s)?.name).join(', ')} />
            <MobileTextField select multiple label="Fix Versions" value={issueForm.fix_versions} onChange={(e) => setIssueForm({...issueForm, fix_versions: e.target.value})} options={versions.map(v => ({ value: v.id, label: v.name }))} renderValue={(selected) => selected.map(s => versions.find(v => v.id === s)?.name).join(', ')} />
            <MobileTextField select multiple label="Affects Versions" value={issueForm.affected_versions} onChange={(e) => setIssueForm({...issueForm, affected_versions: e.target.value})} options={versions.map(v => ({ value: v.id, label: v.name }))} renderValue={(selected) => selected.map(s => versions.find(v => v.id === s)?.name).join(', ')} />
            <MobileTextField type="number" label="Story Points" value={issueForm.story_points} onChange={(e) => setIssueForm({...issueForm, story_points: e.target.value})} step={0.5} min={0} max={1000} />
            <MobileTextField type="number" label="Original Estimate (h)" value={issueForm.original_estimate} onChange={(e) => setIssueForm({...issueForm, original_estimate: e.target.value})} step={0.5} min={0} max={10000} />
            <MobileTextField type="number" label="Remaining Estimate (h)" value={issueForm.remaining_estimate} onChange={(e) => setIssueForm({...issueForm, remaining_estimate: e.target.value})} step={0.5} min={0} max={10000} />
            <MobileTextField type="date" label="Due Date" value={issueForm.due_date} onChange={(e) => setIssueForm({...issueForm, due_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <MobileTextField type="date" label="Start Date" value={issueForm.start_date} onChange={(e) => setIssueForm({...issueForm, start_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <MobileTextField fullWidth label="Environment" value={issueForm.environment} onChange={(e) => setIssueForm({...issueForm, environment: e.target.value})} />
          </MobileFormGrid>
          {issueError && <Alert severity="error" sx={{ mt: 2 }}>{issueError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={closeIssueDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleIssueSave} disabled={saving}>{saving ? 'Saving…' : editingIssue ? 'Save Changes' : 'Create Issue'}</Button>
        </MobileActionButtons>
      </MobileDialog>

      {/* LINK ISSUE DIALOG */}
      <Dialog open={showLinkDialog} onClose={() => setShowLinkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Link Issue</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField select label="Target Issue" value={linkForm.target_issue_id} onChange={(e) => setLinkForm({...linkForm, target_issue_id: e.target.value})} options={issues.filter(i => i.id !== selectedIssue?.id).map(i => ({ value: i.id, label: `${i.issue_key} - ${i.summary}` }))} required />
            <MobileTextField select label="Link Type" value={linkForm.link_type} onChange={(e) => setLinkForm({...linkForm, link_type: e.target.value})} options={Object.entries(LINK_TYPE_LABELS).map(([k,v]) => ({ value: k, label: v }))} required />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setShowLinkDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={addLink}>Link</Button>
        </MobileActionButtons>
      </Dialog>

      {/* TRANSITION DIALOG */}
      <Dialog open={transitionDialog} onClose={() => setTransitionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Transition Issue</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>Select a transition to change the issue status:</Typography>
          {availableTransitions.map(t => (
            <Button key={t.id} variant="outlined" fullWidth startIcon={<ArrowRight />} onClick={() => { setSelectedTransition(t.id); executeTransition(); }} sx={{ mb: 1, justifyContent: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Chip size="small" label={t.from_name} color={t.from_color} variant="outlined" />
                <ArrowRight fontSize="small" />
                <Chip size="small" label={t.to_name} color={t.to_color} variant="outlined" />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{t.name}</Typography>
              </Box>
            </Button>
          ))}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setTransitionDialog(false)}>Cancel</Button>
        </MobileActionButtons>
      </Dialog>

      {/* PROJECT DIALOG */}
      <MobileDialog open={projectDialog} onClose={() => setProjectDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Project</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Key (e.g. PROJ, ENG)" value={projectForm.key.toUpperCase()} onChange={(e) => setProjectForm({...projectForm, key: e.target.value.toUpperCase()})} required />
            <MobileTextField fullWidth label="Name" value={projectForm.name} onChange={(e) => setProjectForm({...projectForm, name: e.target.value})} required />
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="ptype-label">Project Type</InputLabel>
              <Select labelId="ptype-label" value={projectForm.project_type} onChange={(e) => setProjectForm({...projectForm, project_type: e.target.value})}>
                <MenuItem value="software">Software</MenuItem>
                <MenuItem value="business">Business</MenuItem>
                <MenuItem value="service_desk">Service Desk</MenuItem>
              </Select>
            </FormControl>
            <MobileTextField select label="Category" value={projectForm.category_id} onChange={(e) => setProjectForm({...projectForm, category_id: e.target.value})} options={categories.map(c => ({ value: c.id, label: c.name }))} />
            <MobileTextField select label="Lead (optional)" value={projectForm.lead_id} onChange={(e) => setProjectForm({...projectForm, lead_id: e.target.value})} options={employees.map(e => ({ value: e.id, label: e.full_name }))} />
            <FormControl fullWidth sx={{ mt: 1 }}>
              <FormControlLabel control={<Switch checked={projectForm.is_private} onChange={(e) => setProjectForm({...projectForm, is_private: e.target.checked})} />} label="Private Project" />
            </FormControl>
            <TextField fullWidth multiline rows={3} label="Description" value={projectForm.description} onChange={(e) => setProjectForm({...projectForm, description: e.target.value})} sx={{ mt: 1 }} />
          </MobileFormGrid>
          {projectError && <Alert severity="error" sx={{ mt: 2 }}>{projectError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setProjectDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateProject} disabled={projectSaving}>{projectSaving ? 'Creating…' : 'Create Project'}</Button>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}