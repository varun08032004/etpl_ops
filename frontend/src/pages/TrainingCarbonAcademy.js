import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardHeader,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Tooltip, Tabs, Tab, Alert, Divider,
  Accordion, AccordionSummary, AccordionDetails,
  LinearProgress, CircularProgress, Collapse,
  ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails,
  ExpansionPanelActions
} from '@mui/material';
import {
  School, MenuBook, TrendingUp,
  Assignment, Verified, Schedule,
  Warning, Quiz, Visibility,
  Edit, Delete, Add, Download,
  ArrowDownward, ArrowUpward, ExpandMore,
  RadioButtonChecked, RadioButtonUnchecked,
  PlayCircle, Description, Build,
  CheckCircle, HourglassEmpty, Block,
  ContentCopy, LibraryBooks
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileStack, MobileButton,
  ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

const STATUS_COLORS = {
  NOT_AUTHORED: 'default',
  DRAFT: 'info',
  IN_REVIEW: 'warning',
  AUTHORED: 'primary',
  PUBLISHED: 'success',
};

const STATUS_ICONS = {
  NOT_AUTHORED: HourglassEmpty,
  DRAFT: Description,
  IN_REVIEW: Warning,
  AUTHORED: CheckCircle,
  PUBLISHED: Verified,
};

const TIER_COLORS = {
  foundation: 'info',
  professional: 'primary',
  india_ether_track: 'warning',
  capstone: 'success',
};

const TIER_LABELS = {
  foundation: 'Foundation Core',
  professional: 'Professional Carbon Core',
  india_ether_track: 'India + EtherTrack Core',
  capstone: 'Capstone',
};

const LESSON_TYPE_ICONS = {
  video: PlayCircle,
  document: Description,
  external_resource: Visibility,
  practical_exercise: Build,
  assessment: Quiz,
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

function ContentStatusChip({ status }) {
  const Icon = STATUS_ICONS[status] || HourglassEmpty;
  return (
    <Chip
      icon={<Icon fontSize="small" />}
      label={status.replace('_', ' ')}
      size="small"
      color={STATUS_COLORS[status] || 'default'}
      variant="outlined"
      sx={{ fontWeight: 500 }}
    />
  );
}

function LessonRow({ lesson, index, employeeProgress, onLessonClick }) {
  const isCompleted = employeeProgress?.completed_lessons?.includes(lesson.id);
  const isInProgress = employeeProgress?.in_progress_lessons?.includes(lesson.id);
  const progressPct = employeeProgress?.lesson_progress?.[lesson.id] || 0;
  
  const Icon = LESSON_TYPE_ICONS[lesson.lesson_type] || Description;
  const duration = lesson.duration_minutes ? `${lesson.duration_minutes} min` : '—';
  
  return (
    <TableRow key={lesson.id} hover onClick={() => onLessonClick?.(lesson)} style={{ cursor: onLessonClick ? 'pointer' : 'default' }}>
      <TableCell sx={{ width: '40px', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">{index + 1}</Typography>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{lesson.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {lesson.code} • {lesson.lesson_type.replace('_', ' ')} • {duration}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <ContentStatusChip status={lesson.content_status} />
      </TableCell>
      <TableCell>
        {isCompleted ? (
          <Chip icon={<CheckCircle fontSize="small" />} label="Completed" size="small" color="success" variant="outlined" />
        ) : isInProgress ? (
          <Chip icon={<RadioButtonChecked fontSize="small" />} label={`${progressPct}%`} size="small" color="primary" variant="outlined" />
        ) : (
          <Chip icon={<RadioButtonUnchecked fontSize="small" />} label="Not Started" size="small" variant="outlined" />
        )}
      </TableCell>
      <TableCell>
        <Tooltip title="View Lesson">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onLessonClick?.(lesson); }}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function ModuleAccordion({ module, courseCode, employeeProgress, onLessonClick }) {
  const [expanded, setExpanded] = useState(false);
  const { lessons = [], content_summary = {} } = module;
  
  const completedCount = lessons.filter(l => employeeProgress?.completed_lessons?.includes(l.id)).length;
  const inProgressCount = lessons.filter(l => employeeProgress?.in_progress_lessons?.includes(l.id)).length;
  const totalCount = lessons.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{ mb: 1 }} variant="outlined">
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 }}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200, flex: 1 }}>
            <MenuBook sx={{ color: 'primary.main', fontSize: 22 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {module.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {module.code} • {module.description}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Lessons:</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{completedCount} / {totalCount}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 100 }}>
              <Typography variant="caption" color="text.secondary">Content:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Chip label={`${content_summary.authored || 0}`} size="small" variant="outlined" color="primary" sx={{ height: 20, fontSize: '0.65rem' }} />
                <Chip label={`${content_summary.published || 0}`} size="small" variant="outlined" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                <Chip label={`${content_summary.not_authored || 0}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
              </Box>
            </Box>
            <LinearProgress variant="determinate" value={progressPct} color="primary" sx={{ width: 120, height: 6 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40 }}>{progressPct}%</Typography>
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>#</TableCell>
                <TableCell>Lesson</TableCell>
                <TableCell>Content Status</TableCell>
                <TableCell>Your Progress</TableCell>
                <TableCell sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lessons.map((lesson, idx) => (
                <LessonRow 
                  key={lesson.id} 
                  lesson={lesson} 
                  index={idx} 
                  employeeProgress={employeeProgress}
                  onLessonClick={onLessonClick}
                />
              ))}
            </TableBody>
          </Table>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

function CourseCard({ course, employeeProgress, onLessonClick }) {
  const [expanded, setExpanded] = useState(false);
  const { modules = [], content_summary = {} } = course;
  
  const tierColor = TIER_COLORS[course.tier] || 'primary';
  const completedLessons = modules.flatMap(m => m.lessons || []).filter(l => employeeProgress?.completed_lessons?.includes(l.id)).length;
  const totalLessons = modules.flatMap(m => m.lessons || []).length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <Card sx={{ mb: 2 }} variant="outlined">
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={course.code}
              size="small"
              color={tierColor}
              variant="outlined"
              icon={<School fontSize="small" />}
            />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0 }}>{course.title}</Typography>
            <Chip label={TIER_LABELS[course.tier] || course.tier} size="small" variant="filled" color={tierColor} />
          </Box>
        }
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MenuBook fontSize="small" color="action" />
              <Typography variant="caption">{modules.length} Modules</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Description fontSize="small" color="action" />
              <Typography variant="caption">{content_summary.total} Lessons</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Schedule fontSize="small" color="action" />
              <Typography variant="caption">{course.total_hours || course.duration_hours}h Total</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PlayCircle fontSize="small" color="action" />
              <Typography variant="caption">{course.total_instructional_hours || 0}h Instructional</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Build fontSize="small" color="action" />
              <Typography variant="caption">{course.total_practical_hours || 0}h Practical</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Quiz fontSize="small" color="action" />
              <Typography variant="caption">{course.total_assessment_hours || 0}h Assessment</Typography>
            </Box>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress variant="determinate" value={progressPct} color="primary" sx={{ width: 150, height: 6 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40 }}>{progressPct}%</Typography>
          </Box>
        }
      />
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Content Authoring Status</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                icon={<CheckCircle fontSize="small" />} 
                label={`${content_summary.authored} Authored`} 
                size="small" 
                color="primary" 
                variant="outlined" 
              />
              <Chip 
                icon={<Verified fontSize="small" />} 
                label={`${content_summary.published} Published`} 
                size="small" 
                color="success" 
                variant="outlined" 
              />
              <Chip 
                icon={<HourglassEmpty fontSize="small" />} 
                label={`${content_summary.not_authored} Not Authored`} 
                size="small" 
                variant="outlined" 
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {content_summary.total} total lessons • {Math.round((content_summary.authored / content_summary.total) * 100) || 0}% authored
            </Typography>
          </Box>
          {modules.map(module => (
            <ModuleAccordion 
              key={module.id} 
              module={module} 
              courseCode={course.code}
              employeeProgress={employeeProgress}
              onLessonClick={onLessonClick}
            />
          ))}
        </CardContent>
      </Collapse>
    </Card>
  );
}

export default function TrainingCarbonAcademy() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [employeeProgress, setEmployeeProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('all');
  const [activeLesson, setActiveLesson] = useState(null);
  const [lessonMaterials, setLessonMaterials] = useState([]);
  const [lessonExercises, setLessonExercises] = useState([]);

  const fetchData = async () => {
    try {
      const [curriculum, progress] = await Promise.all([
        client.get('/training/carbon-academy'),
        staff.employee_id ? client.get('/training/my-training') : Promise.resolve({ data: { assignments: [] } })
      ]);
      setData(curriculum.data);
      
      const progMap = {};
      if (progress.data.assignments) {
        for (const a of progress.data.assignments) {
          if (a.programme_id === curriculum.data.programme?.id) {
            const { data: lessonProg } = await client.get(`/training/employees/${staff.employee_id}/progress`).catch(() => ({ data: { rows: [] } }));
            const completed = lessonProg.rows?.filter(l => l.status === 'completed').map(l => l.lesson_id) || [];
            const inProgress = lessonProg.rows?.filter(l => l.status === 'in_progress').map(l => l.lesson_id) || [];
            const lessonProgress = {};
            lessonProg.rows?.forEach(l => {
              lessonProgress[l.lesson_id] = l.progress_pct;
            });
            progMap[a.id] = { completed_lessons: completed, in_progress_lessons: inProgress, lesson_progress: lessonProgress };
          }
        }
      }
      setEmployeeProgress(progMap);
    } catch (err) {
      console.error('[TrainingCarbonAcademy] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleLessonClick = async (lesson) => {
    setActiveLesson(lesson);
    try {
      const [materials, exercises] = await Promise.all([
        client.get(`/api/training/lessons/${lesson.id}/materials`),
        client.get(`/api/training/lessons/${lesson.id}/exercises`),
      ]);
      setLessonMaterials(materials.data.materials);
      setLessonExercises(exercises.data.exercises);
    } catch (err) {
      console.error('Lesson load error:', err);
    }
  };

  const getEmployeeProgressForCourse = (courseId) => {
    const assignment = Object.values(employeeProgress).find(p => true);
    return assignment || {};
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!data) return <Alert severity="error">Failed to load Carbon Academy curriculum</Alert>;

  const { programme, tiers } = data;
  const tierKeys = Object.keys(tiers).filter(k => selectedTier === 'all' || selectedTier === k);

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>EtherTrack Carbon Academy</Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
            Complete curriculum hierarchy — {programme?.total_estimated_hours || 119.5}h • 16 Courses • 49 Modules • 147 Lessons
          </Typography>
        </Box>
        <MobileStack gap={1} direction="row">
          <MobileButton variant="outlined" startIcon={<Download />}>Export Curriculum</MobileButton>
        </MobileStack>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 3 }}>
        <Tabs value={selectedTier} onChange={(e, v) => setSelectedTier(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tab label="All Tiers" />
          <Tab label="Foundation Core" />
          <Tab label="Professional Carbon Core" />
          <Tab label="India + EtherTrack Core" />
          <Tab label="Capstone" />
        </Tabs>
      </MobilePaper>

      <Grid container spacing={3}>
        {tierKeys.map(tierKey => {
          const tier = tiers[tierKey];
          return (
            <Grid item xs={12} lg={6} key={tierKey}>
              <MobilePaper>
                <CardHeader
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={tier.label}
                        size="small"
                        color={TIER_COLORS[tierKey]}
                        variant="filled"
                        icon={<LibraryBooks fontSize="small" />}
                      />
                    </Box>
                  }
                  subheader={
                    <Typography variant="caption" color="text.secondary">
                      {tier.courses.length} Courses • {tier.courses.reduce((sum, c) => sum + (c.content_summary?.total || 0), 0)} Lessons
                    </Typography>
                  }
                />
                <Divider />
                <Box sx={{ p: 1 }}>
                  {tier.courses.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      employeeProgress={getEmployeeProgressForCourse(course.id)}
                      onLessonClick={handleLessonClick}
                    />
                  ))}
                </Box>
              </MobilePaper>
            </Grid>
          );
        })}
      </Grid>

      {/* Lesson Detail Modal */}
      {activeLesson && (
        <Paper elevation={24} sx={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90vw', maxWidth: 900, maxHeight: '85vh', overflow: 'auto', zIndex: 1300, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {(() => {
                const Icon = LESSON_TYPE_ICONS[activeLesson.lesson_type];
                return Icon ? <Icon sx={{ color: 'primary.main', fontSize: 28 }} /> : null;
              })()}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeLesson.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeLesson.course_code} → {activeLesson.module_code} → {activeLesson.code}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ContentStatusChip status={activeLesson.content_status} />
              <IconButton onClick={() => setActiveLesson(null)}><ExpandMore sx={{ transform: 'rotate(180deg)' }} /></IconButton>
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body1">{activeLesson.description || 'No description available'}</Typography>
            {activeLesson.content?.text && (
              <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {activeLesson.content.text}
              </Typography>
            )}
            {!activeLesson.content?.text && activeLesson.content_status === 'NOT_AUTHORED' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Content Not Yet Authored</strong><br />
                This lesson is part of the defined curriculum but educational content has not been authored yet.
                Content authoring is in progress. Please check back later.
              </Alert>
            )}
            {activeLesson.content?.video_url && (
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

          {lessonMaterials.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Materials</Typography>
              {lessonMaterials.map((m) => {
                const MaterialIcon = LESSON_TYPE_ICONS[m.material_type] || Description;
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <MobileButton onClick={() => setActiveLesson(null)}>Close</MobileButton>
          </Box>
        </Paper>
      )}
    </Box>
  );
}