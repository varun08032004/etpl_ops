import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardHeader,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Tooltip, Tabs, Tab, Alert, Divider
} from '@mui/material';
import {
  School, People, TrendingUp,
  Assignment, Verified, Schedule,
  Warning, MenuBook, Quiz,
  Visibility, Edit, Delete,
  Add, Download, FilterList,
  ArrowDownward, ArrowUpward
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileStack, MobileButton,
  ResponsiveTableContainer
} from '../components/MobileResponsive';
import { useMobile } from '../components/MobileResponsive';

const STATUS_COLORS = {
  draft: 'default',
  placeholder: 'default',
  ready_for_review: 'info',
  published: 'success',
  active: 'primary',
  archived: 'default',
};

function StatCard({ title, value, icon: Icon, color = 'primary', subtitle }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700 }}>{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.main` }}>
            <Icon sx={{ fontSize: 28 }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function TrainingCommandCenter() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [stats, setStats] = useState(null);
  const [programmePerformance, setProgrammePerformance] = useState([]);
  const [deptPerformance, setDeptPerformance] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [overview, programmes, depts, activity] = await Promise.all([
        client.get('/training/reports/overview'),
        client.get('/training/programmes?status=active'),
        client.get('/training/reports/overview').then(r => r.data.departments),
        client.get('/training/assignments?limit=20').then(r => r.data.assignments),
      ]);
      setStats(overview.data.overview);
      setProgrammePerformance(overview.data.programmes || []);
      setDeptPerformance(depts || []);
      setRecentActivity(activity || []);
    } catch (err) {
      console.error('[TrainingCommandCenter] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>Loading…</Box>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Training Command Center</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Real-time overview of EtherTrack Learning & Development
        </Typography>
      </MobilePageHeader>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Employees"
            value={stats?.total_employees || 0}
            icon={People}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Employees in Training"
            value={stats?.employees_in_training || 0}
            icon={School}
            color="info"
            subtitle={`${stats?.total_employees ? Math.round((stats.employees_in_training / stats.total_employees) * 100) : 0}% of workforce`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Avg Completion"
            value={`${stats?.avg_completion_pct || 0}%`}
            icon={TrendingUp}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Completed Programmes"
            value={stats?.completed_programmes || 0}
            icon={Verified}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Overdue Training"
            value={stats?.overdue_count || 0}
            icon={Schedule}
            color="error"
            subtitle="Requires attention"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="At-Risk Employees"
            value={stats?.at_risk_count || 0}
            icon={Warning}
            color="warning"
            subtitle="In progress but past due"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Avg Assessment Score"
            value={`${stats?.avg_assessment_score || 0}%`}
            icon={Quiz}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Active Programmes"
            value={programmePerformance.filter(p => p.assigned > 0).length}
            icon={MenuBook}
            color="primary"
          />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <MobilePaper>
            <CardHeader
              title="Programme Performance"
              action={
                <Tooltip title="Export">
                  <IconButton size="small"><Download /></IconButton>
                </Tooltip>
              }
            />
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
                  {programmePerformance.map((p) => (
                    <TableRow key={p.title} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MenuBook sx={{ color: 'primary.main', fontSize: 20 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.title}</Typography>
                            <Typography variant="caption" color="text.secondary">{p.code}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right" className="figure">{p.assigned}</TableCell>
                      <TableCell align="right" className="figure">
                        <Chip label={p.completed} size="small" color="success" variant="outlined" />
                      </TableCell>
                      <TableCell align="right" className="figure">{p.avg_progress || 0}%</TableCell>
                      <TableCell align="right" className="figure">{p.avg_score || 0}%</TableCell>
                    </TableRow>
                  ))}
                  {!programmePerformance.length && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No active programmes yet. Create your first programme to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <MobilePaper>
            <CardHeader title="Department Performance" />
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
                  {deptPerformance.map((d) => (
                    <TableRow key={d.department} hover>
                      <TableCell>{d.department}</TableCell>
                      <TableCell align="right" className="figure">{d.total_employees}</TableCell>
                      <TableCell align="right" className="figure">{d.completed}</TableCell>
                      <TableCell align="right" className="figure">{d.avg_progress || 0}%</TableCell>
                      <TableCell align="right" className="figure">
                        <Chip label={d.overdue} size="small" color={d.overdue > 0 ? 'error' : 'success'} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!deptPerformance.length && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No department data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Grid>

        <Grid item xs={12}>
          <MobilePaper>
            <CardHeader title="Recent Training Activity" />
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Programme / Course</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentActivity.slice(0, 10).map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.employee_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.employee_code}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={a.programme_title || a.course_title || 'Training'}
                          size="small"
                          variant="outlined"
                          color={a.programme_id ? 'primary' : 'info'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{a.programme_title || a.course_title || '—'}</Typography>
                      </TableCell>
                      <TableCell className="figure">
                        {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => window.open(`/employees/${a.employee_id}`, '_blank')}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!recentActivity.length && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No recent training activity
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </MobilePaper>
        </Grid>
      </Grid>
    </Box>
  );
}