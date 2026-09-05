import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Tooltip, Tabs, Tab, Alert, Grid, Accordion, AccordionSummary,
  AccordionDetails, LinearProgress, CircularProgress, FormControl, Select, MenuItem,
  InputAdornment
} from '@mui/material';
import {
  People, TrendingUp, Assignment, School, Schedule,
  Warning, Verified, Visibility, ExpandMore, FilterList
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileStack, ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

export default function TrainingManagerDashboard() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await client.get('/training/reports/manager-dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Manager dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getOverallProgress = (emp) => {
    if (!emp.assignments.length) return 0;
    const total = emp.assignments.reduce((sum, a) => sum + (a.progress_pct || 0), 0);
    return Math.round(total / emp.assignments.length);
  };

  const getOverdueCount = (emp) => emp.assignments.filter(a => a.status === 'overdue').length;

  const filterAssignments = (assignments) => {
    if (!statusFilter) return assignments;
    return assignments.filter(a => a.status === statusFilter);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const { team, summary } = data || { team: [], summary: { total: 0, in_training: 0, completed: 0, overdue: 0, avg_progress: 0 } };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Team Training Dashboard</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Monitor your team's Carbon Academy progress</Typography>
      </MobilePageHeader>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Team Size</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{summary.total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">In Training</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{summary.in_training}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Completed</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{summary.completed}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Overdue</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>{summary.overdue}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Assignment Status" displayEmpty>
                {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      <MobilePaper>
        <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tab label="Team Overview" icon={<People />} />
          <Tab label="In Training" icon={<TrendingUp />} />
          <Tab label="Completed" icon={<Verified />} />
          <Tab label="Overdue" icon={<Warning />} />
        </Tabs>

        {selectedTab === 0 && (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Active Assignments</TableCell>
                  <TableCell>Overall Progress</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Overdue</TableCell>
                  <TableCell>Last Activity</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {team.map((emp) => (
                  <TableRow key={emp.employee_id} hover component="a" href={`/training/employees/${emp.employee_id}/progress`}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{emp.employee_code}</Typography>
                    </TableCell>
                    <TableCell>{emp.department || '—'}</TableCell>
                    <TableCell className="figure">{filterAssignments(emp.assignments).filter(a => !['cancelled', 'completed'].includes(a.status)).length}</TableCell>
                    <TableCell className="figure">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={`${getOverallProgress(emp)}%`} size="small" variant="outlined" />
                      </Box>
                    </TableCell>
                    <TableCell className="figure">
                      <Chip label={emp.assignments.filter(a => a.status === 'completed').length} size="small" color="success" variant="outlined" />
                    </TableCell>
                    <TableCell className="figure">
                      <Chip label={getOverdueCount(emp)} size="small" color={getOverdueCount(emp) > 0 ? 'error' : 'success'} variant="outlined" />
                    </TableCell>
                    <TableCell className="figure">{emp.assignments[0]?.last_activity_at?.slice(0, 10) || emp.assignments[0]?.assigned_at?.slice(0, 10) || '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => window.location.href = `/training/employees/${emp.employee_id}/progress`}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!team.length && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      No team members with training assignments yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}

        {selectedTab === 1 && (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Programme / Course</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Lessons</TableCell>
                  <TableCell>Assessments</TableCell>
                  <TableCell>Avg Score</TableCell>
                  <TableCell>Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {team.flatMap(emp => 
                  filterAssignments(emp.assignments)
                    .filter(a => ['assigned', 'in_progress'].includes(a.status))
                    .map(a => ({ ...a, employee_name: emp.full_name, employee_code: emp.employee_code, department: emp.department }))
                ).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.employee_name} ({a.employee_code})</TableCell>
                    <TableCell>{a.department || '—'}</TableCell>
                    <TableCell>{a.programme_title || a.course_title}</TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="figure">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" />
                      </Box>
                    </TableCell>
                    <TableCell className="figure">{a.lessons_completed || 0}/{a.lessons_total || 0}</TableCell>
                    <TableCell className="figure">{a.assessments_completed || 0}/{a.assessments_total || 0}</TableCell>
                    <TableCell className="figure">{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</TableCell>
                    <TableCell className="figure">{a.due_date?.slice(0, 10) || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}

        {selectedTab === 2 && (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Programme / Course</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Avg Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {team.flatMap(emp => 
                  filterAssignments(emp.assignments)
                    .filter(a => a.status === 'completed')
                    .map(a => ({ ...a, employee_name: emp.full_name, employee_code: emp.employee_code, department: emp.department }))
                ).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.employee_name} ({a.employee_code})</TableCell>
                    <TableCell>{a.department || '—'}</TableCell>
                    <TableCell>{a.programme_title || a.course_title}</TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="figure"><Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" /></TableCell>
                    <TableCell className="figure"><Chip label={`${a.lessons_completed || 0}/${a.lessons_total || 0}`} size="small" color="success" variant="outlined" /></TableCell>
                    <TableCell className="figure">{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}

        {selectedTab === 3 && (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Programme / Course</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Days Overdue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {team.flatMap(emp => 
                  filterAssignments(emp.assignments)
                    .filter(a => a.status === 'overdue')
                    .map(a => ({ ...a, employee_name: emp.full_name, employee_code: emp.employee_code, department: emp.department }))
                ).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.employee_name} ({a.employee_code})</TableCell>
                    <TableCell>{a.department || '—'}</TableCell>
                    <TableCell>{a.programme_title || a.course_title}</TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="figure"><Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" /></TableCell>
                    <TableCell className="figure">{a.due_date?.slice(0, 10)}</TableCell>
                    <TableCell className="figure">
                      <Chip label={Math.ceil((new Date() - new Date(a.due_date)) / (1000 * 60 * 60 * 24))} size="small" color="error" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}
      </MobilePaper>
    </Box>
  );
}