import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, TextField, InputAdornment,
  FormControl, Select, Tabs, Tab
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, Archive, PersonAdd,
  ArrowBack, FilterList
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileDialog, MobileActionButtons, MobileStack, MobileFormGrid,
  ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const STATUS_OPTIONS = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TrainingEmployees() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  const load = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (deptFilter) params.department_id = deptFilter;
    const { data } = await client.get('/training/assignments', { params });
    const empMap = new Map();
    data.assignments.forEach(a => {
      if (!empMap.has(a.employee_id)) empMap.set(a.employee_id, { ...a, assignments: [] });
      empMap.get(a.employee_id).assignments.push(a);
    });
    setEmployees(Array.from(empMap.values()));
  }, [search, statusFilter, deptFilter]);

  useEffect(() => { load(); }, [load]);

  const getOverallProgress = (emp) => {
    if (!emp.assignments.length) return 0;
    const total = emp.assignments.reduce((sum, a) => sum + (a.progress_pct || 0), 0);
    return Math.round(total / emp.assignments.length);
  };

  const getOverdueCount = (emp) => emp.assignments.filter(a => a.status === 'overdue').length;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Employees</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>View all employees with their training progress</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack direction="column" gap={2} sx={{ mb: 2 }}>
          <MobileTextField
            placeholder="Search employees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Assignment Status" displayEmpty>
                <MenuItem value="">All Statuses</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} label="Department" displayEmpty>
                <MenuItem value="">All Departments</MenuItem>
                {employees.map(e => <MenuItem key={e.department_id} value={e.department_id}>{e.department_name}</MenuItem>)}
              </Select>
            </FormControl>
          </MobileStack>
        </MobileStack>
      </MobilePaper>

      <MobilePaper>
        <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tab label="All Employees" />
          <Tab label="In Training" />
          <Tab label="Completed" />
          <Tab label="Overdue" />
        </Tabs>

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
              {employees
                .filter(emp => {
                  if (selectedTab === 1) return emp.assignments.some(a => ['assigned', 'in_progress'].includes(a.status));
                  if (selectedTab === 2) return emp.assignments.some(a => a.status === 'completed');
                  if (selectedTab === 3) return emp.assignments.some(a => a.status === 'overdue');
                  return true;
                })
                .map((emp) => (
                  <TableRow key={emp.employee_id} hover component={Link} to={`/training/employees/${emp.employee_id}/progress`}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.employee_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{emp.employee_code}</Typography>
                    </TableCell>
                    <TableCell>{emp.department_name || '—'}</TableCell>
                    <TableCell className="figure">{emp.assignments.filter(a => !['cancelled', 'completed'].includes(a.status)).length}</TableCell>
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
                    <TableCell className="figure">{emp.assignments[0]?.last_activity_at?.slice(0, 10) || '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              {!employees.length && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No employees with training assignments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>
    </Box>
  );
}