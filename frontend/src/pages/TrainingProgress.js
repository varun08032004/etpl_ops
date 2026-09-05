import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, Tabs, Tab, Accordion, AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, ArrowBack, School,
  MenuBook, TrendingUp, Assignment,
  ExpandMore, Quiz, Verified
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import { Money } from '../components/Money';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileTextField,
  MobileDialog, MobileActionButtons, MobileStack, MobileFormGrid,
  ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

export default function TrainingProgress() {
  const { employeeId } = useParams();
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [employee, setEmployee] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);

  const load = useCallback(async () => {
    const { data: emp } = await client.get(`/api/employees/${employeeId}`);
    setEmployee(emp.employee);
    const { data: prog } = await client.get(`/training/employees/${employeeId}/progress`);
    setAssignments(prog.assignments);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  if (!employee) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>Loading…</Box>;

  return (
    <Box>
      <MobilePageHeader>
<Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>{employee.full_name}</Typography>
          <Typography sx={{ color: 'text.secondary' }}>{employee.employee_code} · {employee.work_email}</Typography>
        </Box>
        <MobileButton variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/training/employees')}>Back</MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 3 }}>
        <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Department</Typography>
            <Typography>{employee.department_name || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Designation</Typography>
            <Typography>{employee.designation || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Status</Typography>
            <StatusChip status={employee.status} />
          </Box>
        </MobileStack>
      </MobilePaper>

      <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Programmes" />
        <Tab label="Courses" />
        <Tab label="Assessments" />
        <Tab label="Certificates" />
      </Tabs>

      {selectedTab === 0 && (
        <MobilePaper>
          <MobileStack direction="row" gap={3} sx={{ flexWrap: 'wrap', mb: 3 }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="caption" color="text.secondary">Total Assignments</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{assignments.length}</Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="caption" color="text.secondary">In Progress</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {assignments.filter(a => a.status === 'in_progress').length}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="caption" color="text.secondary">Completed</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                {assignments.filter(a => a.status === 'completed').length}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="caption" color="text.secondary">Overdue</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                {assignments.filter(a => a.status === 'overdue').length}
              </Typography>
            </Box>
          </MobileStack>
        </MobilePaper>
      )}

      {selectedTab === 1 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Programme</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Lessons</TableCell>
                  <TableCell>Assessments</TableCell>
                  <TableCell>Avg Score</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.filter(a => a.programme_id).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell><Typography variant="body2">{a.programme_title}</Typography></TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="figure">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" />
                      </Box>
                    </TableCell>
                    <TableCell className="figure">{a.lessons_completed || 0}/{a.lessons_total || 0}</TableCell>
                    <TableCell className="figure">{a.assessments_completed || 0}/{a.assessments_total || 0}</TableCell>
                    <TableCell className="figure">{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</TableCell>
                    <TableCell className="figure">{a.started_at?.slice(0, 10) || '—'}</TableCell>
                    <TableCell className="figure">{a.completed_at?.slice(0, 10) || '—'}</TableCell>
                    <TableCell>
                      <IconButton size="small"><Visibility fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {selectedTab === 2 && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Lessons</TableCell>
                  <TableCell>Assessments</TableCell>
                  <TableCell>Avg Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.filter(a => a.course_id).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell><Typography variant="body2">{a.course_title}</Typography></TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="figure"><Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" /></TableCell>
                    <TableCell className="figure">{a.lessons_completed || 0}/{a.lessons_total || 0}</TableCell>
                    <TableCell className="figure">{a.assessments_completed || 0}/{a.assessments_total || 0}</TableCell>
                    <TableCell className="figure">{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {selectedTab === 3 && (
        <MobilePaper>
          {assignments.flatMap(a => a.assessments || []).length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>No assessment attempts yet</Box>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Assessment</TableCell>
                    <TableCell>Attempt</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Passed</TableCell>
                    <TableCell>Submitted</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.flatMap(a => (a.assessments || []).map(at => ({ ...at, programme_title: a.programme_title, course_title: a.course_title }))).map((at) => (
                    <TableRow key={at.id} hover>
                      <TableCell>{at.assessment_title}</TableCell>
                      <TableCell className="figure">#{at.attempt_number}</TableCell>
                      <TableCell><StatusChip status={at.status} /></TableCell>
                      <TableCell className="figure">{at.score_pct?.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Chip label={at.passed ? 'Passed' : 'Failed'} size="small" color={at.passed ? 'success' : 'error'} variant="outlined" />
                      </TableCell>
                      <TableCell className="figure">{at.submitted_at?.slice(0, 16) || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {selectedTab === 4 && (
        <MobilePaper>
          {assignments.flatMap(a => a.certificates || []).length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>No certificates issued yet</Box>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Certificate</TableCell>
                    <TableCell>Programme</TableCell>
                    <TableCell>Issued</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.flatMap(a => (a.certificates || []).map(c => ({ ...c, programme_title: a.programme_title }))).map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Verified sx={{ color: 'success.main', fontSize: 24 }} />
                          <Typography variant="body2">{c.certificate_number}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{c.programme_title}</TableCell>
                      <TableCell className="figure">{c.issued_at?.slice(0, 10)}</TableCell>
                      <TableCell><Chip label={c.status} size="small" variant="outlined" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}
    </Box>
  );
}