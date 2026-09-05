import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Alert, Chip, IconButton, Tooltip, Tabs, Tab, Accordion, AccordionSummary,
  AccordionDetails, LinearProgress, CircularProgress
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility,
  Search, ArrowBack, School,
  MenuBook, TrendingUp, Assignment,
  ExpandMore, Quiz, Verified,
  PlayCircle, CheckCircle, Schedule,
  Warning, VideoLibrary, Description,
  Link as MuiLink, Build, RadioButtonChecked,
  ArrowForward, PauseCircle, Download, History
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

const LESSON_TYPE_ICONS = {
  video: VideoLibrary,
  document: Description,
  external_resource: MuiLink,
  practical_exercise: Build,
  assessment: Quiz,
};

export default function TrainingMyTraining() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [assignments, setAssignments] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [continueLesson, setContinueLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [activeLesson, setActiveLesson] = useState(null);
  const [lessonMaterials, setLessonMaterials] = useState([]);
  const [lessonExercises, setLessonExercises] = useState([]);
  const [assessmentModal, setAssessmentModal] = useState({ open: false, assessment: null, assignmentId: null });

  const load = useCallback(async () => {
    if (!staff.employee_id) return;
    setLoading(true);
    try {
      const [myTraining, certs] = await Promise.all([
        client.get('/training/my-training'),
        client.get('/training/certificates', { params: { employee_id: staff.employee_id } }),
      ]);
      setAssignments(myTraining.data.assignments);
      setCertificates(certs.data.certificates);

      // Find the continue lesson
      const inProgress = myTraining.data.assignments
        .flatMap(a => a.next_lesson ? [{ ...a.next_lesson, assignmentId: a.id, programmeTitle: a.programme_title }] : []);
      if (inProgress.length) setContinueLesson(inProgress[0]);
    } catch (err) {
      console.error('MyTraining load error:', err);
    } finally {
      setLoading(false);
    }
  }, [staff.employee_id]);

  useEffect(() => { load(); }, [load]);

  const handleLessonClick = async (lesson, assignmentId) => {
    setActiveLesson({ ...lesson, assignmentId });
    try {
      const [materials, exercises] = await Promise.all([
        client.get(`/training/lessons/${lesson.id}/materials`),
        client.get(`/training/lessons/${lesson.id}/exercises`),
      ]);
      setLessonMaterials(materials.data.materials);
      setLessonExercises(exercises.data.exercises);
    } catch (err) {
      console.error('Lesson load error:', err);
    }
  };

  const handleStartLesson = async (lesson, assignmentId) => {
    try {
      await client.post(`/training/lessons/${lesson.id}/start`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start lesson');
    }
  };

  const handleCompleteLesson = async (lesson, assignmentId) => {
    try {
      await client.post(`/training/lessons/${lesson.id}/complete`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to complete lesson');
    }
  };

  const handleOpenAssessment = (assessment, assignmentId) => {
    setAssessmentModal({ open: true, assessment, assignmentId });
  };

  const handleCloseAssessment = () => {
    setAssessmentModal({ open: false, assessment: null, assignmentId: null });
  };

  const getLessonIcon = (type) => LESSON_TYPE_ICONS[type] || Description;

  const getProgressColor = (pct) => {
    if (pct >= 100) return 'success';
    if (pct >= 50) return 'warning';
    return 'primary';
  };

  if (!staff.employee_id) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary">No employee record linked</Typography>
        <Typography variant="body1" color="text.secondary">Please contact HR to link your account to an employee record.</Typography>
      </Box>
    );
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <MobilePageHeader>
          <Typography variant={isMobile ? 'h6' : 'h5'}>My Training</Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
            Welcome back, {staff.email?.split('@')[0]}! Continue your learning journey.
          </Typography>
        </MobilePageHeader>

      {/* Continue Learning Card */}
      {continueLesson && (
        <MobilePaper sx={{ mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
                <PlayCircle sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Continue Learning</Typography>
                <Typography variant="body2" color="text.secondary">{continueLesson.programmeTitle}</Typography>
<Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>{continueLesson.title}</strong>
                    <span sx={{ mx: 1 }}>•</span>
                    <span>{continueLesson.lesson_type}</span>
                    {continueLesson.duration_minutes && (
                      <>
                        <span sx={{ mx: 1 }}>•</span>
                        <span>{continueLesson.duration_minutes} min</span>
                      </>
                    )}
                  </Typography>
              </Box>
            </Box>
            <MobileButton
              variant="contained"
              size="large"
              startIcon={<PlayCircle />}
              onClick={() => handleLessonClick(continueLesson, continueLesson.assignmentId)}
            >
              Resume Lesson
            </MobileButton>
          </Box>
        </MobilePaper>
      )}

      <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
        <Tab label="Assigned Programmes" icon={<MenuBook />} />
        <Tab label="Assessments" icon={<Quiz />} />
        <Tab label="Certificates" icon={<Verified />} />
        <Tab label="History" icon={<History />} />
      </Tabs>

      {selectedTab === 0 && (
        <>
          {assignments.length === 0 ? (
            <MobilePaper>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <School sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>No Training Assigned</Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  You don't have any training programmes assigned yet. Your manager or HR will assign training when available.
                </Typography>
              </Box>
            </MobilePaper>
          ) : (
            <Grid container spacing={3}>
              {assignments.map((a) => (
                <Grid item xs={12} sm={6} lg={4} key={a.id}>
                  <MobilePaper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{a.programme_title || a.course_title}</Typography>
                        <StatusChip status={a.status} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">{a.programme_code || a.course_code}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Progress</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{a.progress_pct || 0}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={a.progress_pct || 0}
                          color={getProgressColor(a.progress_pct || 0)}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Lessons</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.lessons_completed || 0} / {a.lessons_total || 0}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Assessments</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.assessments_completed || 0} / {a.assessments_total || 0}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Avg Score</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Due</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: a.status === 'overdue' ? 'error.main' : 'text.primary' }}>
                            {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No deadline'}
                          </Typography>
                        </Grid>
                      </Grid>
                      <Box sx={{ mt: 'auto' }}>
                        <MobileButton
                          fullWidth
                          variant="contained"
                          startIcon={<Visibility />}
                          onClick={() => navigate(a.course_id ? `/training/courses/${a.course_id}` : `/training/programmes/${a.programme_id}`)}
                        >
                          View Details
                        </MobileButton>
                      </Box>
                    </Box>
                  </MobilePaper>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {selectedTab === 1 && (
        <MobilePaper>
          {assignments.flatMap(a => a.upcoming_assessments || []).length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Quiz sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>No Upcoming Assessments</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                You don't have any assessments available at the moment. Complete your lessons to unlock assessments.
              </Typography>
            </Box>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Assessment</TableCell>
                    <TableCell>Programme / Course</TableCell>
                    <TableCell>Time Limit</TableCell>
                    <TableCell>Max Attempts</TableCell>
                    <TableCell>Attempts Used</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.flatMap(a => (a.upcoming_assessments || []).map(as => ({ ...as, programmeTitle: a.programme_title, courseTitle: a.course_title }))).map((as) => (
                    <TableRow key={as.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{as.title}</Typography>
                      </TableCell>
                      <TableCell>{as.programmeTitle || as.courseTitle}</TableCell>
                      <TableCell className="figure">{as.time_limit_minutes ? `${as.time_limit_minutes} min` : 'No limit'}</TableCell>
                      <TableCell className="figure">{as.max_attempts || 'Unlimited'}</TableCell>
                      <TableCell className="figure">{as.attempts_used || 0}</TableCell>
                      <TableCell>
                        <MobileButton
                          variant="contained"
                          size="small"
                          startIcon={<Quiz />}
                          onClick={() => handleOpenAssessment(as, assignments.find(a => a.upcoming_assessments?.includes(as))?.id)}
                        >
                          Start Assessment
                        </MobileButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {selectedTab === 2 && (
        <MobilePaper>
          {certificates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Verified sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>No Certificates Yet</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Complete training programmes and pass assessments to earn certificates.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {certificates.map((c) => (
                <Grid item xs={12} sm={6} lg={4} key={c.id}>
                  <MobilePaper sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                    <Verified sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{c.programme_title}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.certificate_number}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>Issued: {c.issued_at?.slice(0, 10)}</Typography>
                    <Typography variant="caption" color="text.secondary">Programme v{c.programme_version}</Typography>
                    <Box sx={{ mt: 2 }}>
                      <MobileButton variant="outlined" startIcon={<Visibility />}>View</MobileButton>
                      <MobileButton variant="outlined" startIcon={<Download />}>Download</MobileButton>
                    </Box>
                  </MobilePaper>
                </Grid>
              ))}
            </Grid>
          )}
        </MobilePaper>
      )}

      {selectedTab === 3 && (
        <MobilePaper>
          <Typography variant="h6" sx={{ mb: 2 }}>Training History</Typography>
          {assignments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>No training history yet</Box>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Programme / Course</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Avg Score</TableCell>
                    <TableCell>Certificate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.programme_title || a.course_title}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.programme_code || a.course_code}</Typography>
                      </TableCell>
                      <TableCell><StatusChip status={a.status} /></TableCell>
                      <TableCell><Chip label={`${a.progress_pct || 0}%`} size="small" variant="outlined" /></TableCell>
                      <TableCell className="figure">{a.completed_at?.slice(0, 10) || '—'}</TableCell>
                      <TableCell className="figure">{a.average_score_pct ? `${a.average_score_pct}%` : '—'}</TableCell>
                      <TableCell>
                        {certificates.find(c => c.programme_id === a.programme_id) ? (
                          <Chip label="Earned" size="small" color="success" variant="outlined" icon={<Verified />} />
                        ) : (
                          <Chip label="Not Earned" size="small" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {/* Lesson Detail Modal */}
      {activeLesson && (
        <Dialog open={!!activeLesson} onClose={() => setActiveLesson(null)} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(() => {
                  const Icon = getLessonIcon(activeLesson.lesson_type);
                  return Icon ? <Icon sx={{ color: 'primary.main', fontSize: 28 }} /> : null;
                })()}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeLesson.title}</Typography>
                  <Typography variant="caption" color="text.secondary">Module: {activeLesson.module_title}</Typography>
                </Box>
              </Box>
              <Chip label={activeLesson.lesson_type} size="small" variant="outlined" />
            </Box>
          </DialogTitle>
          <DialogContent sx={{ maxHeight: '70vh', overflow: 'auto' }}>
            {activeLesson.content && (
              <Box sx={{ p: 2, mb: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="body1">{activeLesson.description || 'No description'}</Typography>
                {activeLesson.content.text && <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{activeLesson.content.text}</Typography>}
                {activeLesson.content.video_url && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">Video:</Typography>
                    <iframe
                      src={activeLesson.content.video_url}
                      width="100%"
                      height="315"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </Box>
                )}
              </Box>
            )}
            {lessonMaterials.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Materials</Typography>
                {lessonMaterials.map((m) => {
                  const MaterialIcon = getLessonIcon(m.material_type);
                  return (
                    <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: 1, borderColor: 'divider' }}>
                      <MaterialIcon sx={{ color: 'primary.main' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{m.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{m.material_type} • {m.file_size_bytes ? `${Math.round(m.file_size_bytes / 1024)} KB` : m.external_url ? 'External' : ''}</Typography>
                      </Box>
                      <MobileButton size="small" startIcon={<Visibility />} onClick={() => window.open(`/api/documents/${m.id}/download`, '_blank')}>Open</MobileButton>
                    </Box>
                  );
                })}
              </Box>
            )}
            {lessonExercises.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Exercises</Typography>
                {lessonExercises.map((e) => (
                  <Paper key={e.id} elevation={1} sx={{ p: 2, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{e.title}</Typography>
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{e.instructions}</Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={e.exercise_type} size="small" />
                      {e.estimated_hours && <Chip label={`${e.estimated_hours} hrs`} size="small" />}
                      {e.is_graded && <Chip label="Graded" size="small" color="primary" />}
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <MobileButton onClick={() => setActiveLesson(null)}>Close</MobileButton>
            {activeLesson.status !== 'completed' && (
              <MobileButton
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={() => handleCompleteLesson(activeLesson, activeLesson.assignmentId)}
              >
                Mark Complete
              </MobileButton>
            )}
          </DialogActions>
        </Dialog>
      )}
      {assessmentModal.open && assessmentModal.assessment && (
        <Dialog open={assessmentModal.open} onClose={handleCloseAssessment} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Typography variant="h6">{assessmentModal.assessment.title}</Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Quiz sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>Start Assessment</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                {assessmentModal.assessment.description || 'This assessment will test your knowledge of the course material.'}
              </Typography>
              <Grid container spacing={3} justifyContent="center" sx={{ mt: 3 }}>
                <Grid item>
                  <Paper elevation={2} sx={{ p: 2, minWidth: 150, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Questions</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{assessmentModal.assessment.question_count || '?'}</Typography>
                  </Paper>
                </Grid>
                <Grid item>
                  <Paper elevation={2} sx={{ p: 2, minWidth: 150, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Time Limit</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {assessmentModal.assessment.time_limit_minutes ? `${assessmentModal.assessment.time_limit_minutes} min` : 'No limit'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item>
                  <Paper elevation={2} sx={{ p: 2, minWidth: 150, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Passing Score</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {assessmentModal.assessment.passing_score_pct ? `${assessmentModal.assessment.passing_score_pct}%` : 'Not set'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item>
                  <Paper elevation={2} sx={{ p: 2, minWidth: 150, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Max Attempts</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {assessmentModal.assessment.max_attempts || 'Unlimited'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
                <strong>Important:</strong> Once started, the timer cannot be paused. Ensure you have a stable internet connection
                and enough time to complete the assessment. Your answers will be auto-saved as you progress.
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions>
            <MobileButton onClick={handleCloseAssessment}>Cancel</MobileButton>
            <MobileButton
              variant="contained"
              startIcon={<PlayCircle />}
              onClick={() => {
                handleCloseAssessment();
                navigate(`/training/assessments/${assessmentModal.assessment.id}/start`);
              }}
            >
              Start Assessment
            </MobileButton>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}