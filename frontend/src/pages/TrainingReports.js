import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Alert, Chip, IconButton, Tooltip, Tabs, Tab, Grid,
  FormControl, Select, MenuItem, TextField, InputAdornment
} from '@mui/material';
import {
  Search, ArrowBack, FilterList,
  Download, Assessment, TrendingUp,
  People, Schedule, Warning,
  Visibility
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileStack, ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const REPORT_TYPES = [
  { id: 'overview', label: 'Overview', icon: Assessment },
  { id: 'employee', label: 'Employee Report', icon: People },
  { id: 'programme', label: 'Programme Report', icon: Assessment },
  { id: 'department', label: 'Department Report', icon: People },
  { id: 'overdue', label: 'Overdue Report', icon: Schedule },
  { id: 'assessment', label: 'Assessment Report', icon: Assessment },
];

export default function TrainingReports() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [reportType, setReportType] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ programme_id: '', department_id: '', employee_id: '' });
  const [programmes, setProgrammes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const loadReferenceData = useCallback(async () => {
    const [progs, depts, emps] = await Promise.all([
      client.get('/training/programmes?status=active'),
      client.get('/departments'),
      client.get('/employees?status=active'),
    ]);
    setProgrammes(progs.data.programmes);
    setDepartments(depts.data.departments);
    setEmployees(emps.data.employees);
  }, []);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);

  const runReport = async (type) => {
    setLoading(true);
    setReportType(type);
    try {
      let url = `/training/reports/${type}`;
      const params = new URLSearchParams();
      if (filters.programme_id) params.append('programme_id', filters.programme_id);
      if (filters.department_id) params.append('department_id', filters.department_id);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if ([...params].length) url += `?${params.toString()}`;
      const { data: res } = await client.get(url);
      setData(res);
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runReport(reportType); }, [reportType, filters]);

  const setFilter = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value }); };

  const renderContent = () => {
    if (!data) return <Box sx={{ textAlign: 'center', py: 8 }}>Select a report type</Box>;

    switch (reportType) {
      case 'overview':
        return (
          <Box>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} lg={3}>
                <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Total Employees</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{data.overview?.total_employees || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Employees in Training</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{data.overview?.employees_in_training || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Avg Completion</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{data.overview?.avg_completion_pct || 0}%</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Overdue</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>{data.overview?.overdue_count || 0}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} lg={7}>
                <Paper elevation={2} sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Programme Performance</Typography>
                  <ResponsiveTableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Programme</TableCell>
                          <TableCell align="right">Assigned</TableCell>
                          <TableCell align="right">Completed</TableCell>
                          <TableCell align="right">Avg Progress</TableCell>
                          <TableCell align="right">Avg Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.programmes?.map((p) => (
                          <TableRow key={p.title} hover>
                            <TableCell>{p.title}</TableCell>
                            <TableCell align="right">{p.assigned}</TableCell>
                            <TableCell align="right"><Chip label={p.completed} size="small" color="success" variant="outlined" /></TableCell>
                            <TableCell align="right">{p.avg_progress || 0}%</TableCell>
                            <TableCell align="right">{p.avg_score || 0}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} lg={5}>
                <Paper elevation={2} sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Department Performance</Typography>
                  <ResponsiveTableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Department</TableCell>
                          <TableCell align="right">Employees</TableCell>
                          <TableCell align="right">Completed</TableCell>
                          <TableCell align="right">Avg Progress</TableCell>
                          <TableCell align="right">Overdue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.departments?.map((d) => (
                          <TableRow key={d.department} hover>
                            <TableCell>{d.department}</TableCell>
                            <TableCell align="right">{d.total_employees}</TableCell>
                            <TableCell align="right">{d.completed}</TableCell>
                            <TableCell align="right">{d.avg_progress || 0}%</TableCell>
                            <TableCell align="right"><Chip label={d.overdue} size="small" color={d.overdue > 0 ? 'error' : 'success'} variant="outlined" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTableContainer>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      case 'overdue':
        return (
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Overdue Training Assignments</Typography>
            {data.overdue?.length === 0 ? (
              <Alert severity="success">No overdue training assignments!</Alert>
            ) : (
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Programme / Course</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Days Overdue</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.overdue.map((o) => (
                      <TableRow key={o.id} hover>
                        <TableCell>{o.full_name} ({o.employee_code})</TableCell>
                        <TableCell>{o.department}</TableCell>
                        <TableCell>{o.programme_title || o.course_title}</TableCell>
                        <TableCell><StatusChip status={o.status} /></TableCell>
                        <TableCell>{o.due_date?.slice(0, 10)}</TableCell>
                        <TableCell>
                          <Chip label={Math.ceil((new Date() - new Date(o.due_date)) / (1000 * 60 * 60 * 24))} size="small" color="error" variant="outlined" />
                        </TableCell>
                        <TableCell><IconButton size="small"><Visibility fontSize="small" /></IconButton></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            )}
          </Paper>
        );

      case 'programme':
        return (
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Programme Detail Report</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Programme</TableCell>
                    <TableCell>Assigned</TableCell>
                    <TableCell>In Progress</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Failed</TableCell>
                    <TableCell>Avg Progress</TableCell>
                    <TableCell>Avg Score</TableCell>
                    <TableCell>Completion Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.programmes?.map((p) => (
                    <TableRow key={p.title} hover>
                      <TableCell>{p.title}</TableCell>
                      <TableCell>{p.assigned}</TableCell>
                      <TableCell>{p.in_progress}</TableCell>
                      <TableCell><Chip label={p.completed} size="small" color="success" variant="outlined" /></TableCell>
                      <TableCell><Chip label={p.failed} size="small" color="error" variant="outlined" /></TableCell>
                      <TableCell>{p.avg_progress || 0}%</TableCell>
                      <TableCell>{p.avg_score || 0}%</TableCell>
                      <TableCell>{p.assigned ? Math.round((p.completed / p.assigned) * 100) : 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </Paper>
        );

      case 'department':
        return (
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Department Detail Report</Typography>
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Department</TableCell>
                    <TableCell>Total Employees</TableCell>
                    <TableCell>In Training</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Overdue</TableCell>
                    <TableCell>Avg Progress</TableCell>
                    <TableCell>Avg Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.departments?.map((d) => (
                    <TableRow key={d.department} hover>
                      <TableCell>{d.department}</TableCell>
                      <TableCell>{d.total_employees}</TableCell>
                      <TableCell>{d.in_training}</TableCell>
                      <TableCell><Chip label={d.completed} size="small" color="success" variant="outlined" /></TableCell>
                      <TableCell><Chip label={d.overdue} size="small" color={d.overdue > 0 ? 'error' : 'success'} variant="outlined" /></TableCell>
                      <TableCell>{d.avg_progress || 0}%</TableCell>
                      <TableCell>{d.avg_score || 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </Paper>
        );

      case 'employee':
        return (
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Employee Training Report</Typography>
            {data.assignments?.length === 0 ? (
              <Alert severity="info">No training assignments for this employee</Alert>
            ) : (
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Programme / Course</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Progress</TableCell>
                      <TableCell>Avg Score</TableCell>
                      <TableCell>Assigned</TableCell>
                      <TableCell>Due</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.assignments.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell>{a.employee_name} ({a.employee_code})</TableCell>
                        <TableCell>{a.programme_title || a.course_title}</TableCell>
                        <TableCell><StatusChip status={a.status} /></TableCell>
                        <TableCell><Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" /></TableCell>
                        <TableCell>{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</TableCell>
                        <TableCell>{a.assigned_at?.slice(0, 10)}</TableCell>
                        <TableCell>{a.due_date?.slice(0, 10) || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            )}
          </Paper>
        );

      default:
        return <Box>Report type not implemented</Box>;
    }
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Reports</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Generate and export training analytics</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 3 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={reportType} onChange={(e) => runReport(e.target.value)} label="Report Type" displayEmpty>
                {REPORT_TYPES.map(r => <MenuItem key={r.id} value={r.id}><r.icon sx={{ mr: 1, fontSize: 18 }} /> {r.label}</MenuItem>)}
              </Select>
            </FormControl>
            {['employee'].includes(reportType) && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select value={filters.employee_id} onChange={setFilter('employee_id')} label="Employee" displayEmpty>
                  <MenuItem value="">All Employees</MenuItem>
                  {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {['programme'].includes(reportType) && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select value={filters.programme_id} onChange={setFilter('programme_id')} label="Programme" displayEmpty>
                  <MenuItem value="">All Programmes</MenuItem>
                  {programmes.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {['department'].includes(reportType) && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select value={filters.department_id} onChange={setFilter('department_id')} label="Department" displayEmpty>
                  <MenuItem value="">All Departments</MenuItem>
                  {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <MobileButton variant="outlined" startIcon={<Download />} disabled={loading} onClick={() => { /* export logic */ }}>
              Export CSV
            </MobileButton>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      {renderContent()}
    </Box>
  );
}