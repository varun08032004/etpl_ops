import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Chip, IconButton, Tooltip,
  Tabs, Tab, Accordion, AccordionSummary, AccordionDetails, LinearProgress, CircularProgress,
  Alert, Divider, Avatar, Stack, Rating, TextField, FormControl, FormLabel, FormHelperText,
  Collapse
} from '@mui/material';
import {
  ArrowBack, School, MenuBook, TrendingUp,
  Assignment, Verified, Schedule,
  Warning, Quiz, Visibility,
  ExpandMore, PlayCircle, Description, Build,
  CheckCircle, HourglassEmpty, ContentCopy, LibraryBooks,
  Download, ChevronRight, Feedback
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePageHeader, MobilePaper, MobileButton, MobileStack,
  ResponsiveTableContainer, useMobile
} from '../components/MobileResponsive';

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
    <Paper sx={{ height: '100%', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700 }}>{value}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.main` }}>
          <Icon sx={{ fontSize: 24 }} />
        </Box>
      </Box>
    </Paper>
  );
}

function ContentStatusChip({ status }) {
  const icons = {
    NOT_AUTHORED: HourglassEmpty,
    DRAFT: Description,
    IN_REVIEW: Warning,
    AUTHORED: CheckCircle,
    PUBLISHED: Verified,
  };
  const colors = {
    NOT_AUTHORED: 'default',
    DRAFT: 'info',
    IN_REVIEW: 'warning',
    AUTHORED: 'primary',
    PUBLISHED: 'success',
  };
  const Icon = icons[status] || HourglassEmpty;
  return (
    <Chip
      icon={<Icon fontSize="small" />}
      label={status.replace('_', ' ')}
      size="small"
      color={colors[status] || 'default'}
      variant="outlined"
      sx={{ fontWeight: 500 }}
    />
  );
}

function LessonRow({ lesson, index, progress, onLessonClick }) {
  const isCompleted = progress?.completed_lessons?.includes(lesson.id);
  const isInProgress = progress?.in_progress_lessons?.includes(lesson.id);
  const progressPct = progress?.lesson_progress?.[lesson.id] || 0;
  
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
          <Chip icon={<CheckCircle fontSize="small" />} label={`${progressPct}%`} size="small" color="primary" variant="outlined" />
        ) : (
          <Chip icon={<HourglassEmpty fontSize="small" />} label="Not Started" size="small" variant="outlined" />
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

function ModuleAccordion({ module, employeeProgress, onLessonClick, onDownloadModule }) {
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
            <Tooltip title="Download Module">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDownloadModule?.(module); }}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
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
                  progress={employeeProgress}
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

function CourseCard({ course, employeeProgress, onLessonClick, onDownloadCourse, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const { modules = [], content_summary = {} } = course;
  
  const tierColor = TIER_COLORS[course.tier] || 'primary';
  const completedLessons = modules.flatMap(m => m.lessons || []).filter(l => employeeProgress?.completed_lessons?.includes(l.id)).length;
  const totalLessons = modules.flatMap(m => m.lessons || []).length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const handleViewCourse = (e) => {
    e.stopPropagation();
    navigate(`/training/courses/${course.id}`);
  };

  return (
    <Paper sx={{ mb: 2 }} variant="outlined">
      <Paper 
        sx={{ p: 2, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
        elevation={0}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 280 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
            <LinearProgress variant="determinate" value={progressPct} color="primary" sx={{ width: 150, height: 6 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40 }}>{progressPct}%</Typography>
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                <ChevronRight sx={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download Course">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDownloadCourse?.(course); }}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Course Details">
              <IconButton size="small" color="primary" onClick={handleViewCourse}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
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
              employeeProgress={employeeProgress}
              onLessonClick={onLessonClick}
              onDownloadModule={() => onDownloadCourse?.(course, module)}
            />
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

// Pilot Feedback Form Component
function PilotFeedbackForm({ lessonId }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    rating: 0,
    q1_relevant: 0,
    q2_understandable: 0,
    q3_useful: 0,
    q4_difficulty: 0,
    q5_applicable: 0,
    unclear_text: '',
    improvement_text: '',
    unnecessary_text: '',
    missing_text: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.rating === 0) {
      alert('Please provide an overall rating');
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/training/pilot-feedback', {
        lesson_id: lessonId,
        ...formData,
      });
      setSubmitted(true);
      setSubmitting(false);
    } catch (err) {
      console.error('Feedback submit error:', err);
      alert('Failed to submit feedback: ' + (err.response?.data?.error || err.message));
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Thank you for your feedback!</Typography>
        <Typography variant="body2" color="text.secondary">Your feedback has been submitted and will help improve the Carbon Academy.</Typography>
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Overall Rating</Typography>
        <Rating
          name="rating"
          value={formData.rating}
          onChange={(e, v) => handleChange('rating', v)}
          precision={0.5}
          max={5}
          size="large"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Detailed Feedback</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <FormLabel>1. Was the content relevant to your role?</FormLabel>
            <Rating
              name="q1_relevant"
              value={formData.q1_relevant}
              onChange={(e, v) => handleChange('q1_relevant', v)}
              precision={1}
              max={5}
            />
          </FormControl>
          <FormControl fullWidth size="small">
            <FormLabel>2. Was the lesson understandable?</FormLabel>
            <Rating
              name="q2_understandable"
              value={formData.q2_understandable}
              onChange={(e, v) => handleChange('q2_understandable', v)}
              precision={1}
              max={5}
            />
          </FormControl>
          <FormControl fullWidth size="small">
            <FormLabel>3. Was the practical exercise useful?</FormLabel>
            <Rating
              name="q3_useful"
              value={formData.q3_useful}
              onChange={(e, v) => handleChange('q3_useful', v)}
              precision={1}
              max={5}
            />
          </FormControl>
          <FormControl fullWidth size="small">
            <FormLabel>4. Was the difficulty appropriate?</FormLabel>
            <Rating
              name="q4_difficulty"
              value={formData.q4_difficulty}
              onChange={(e, v) => handleChange('q4_difficulty', v)}
              precision={1}
              max={5}
            />
          </FormControl>
          <FormControl fullWidth size="small">
            <FormLabel>5. Could you apply this knowledge to your work?</FormLabel>
            <Rating
              name="q5_applicable"
              value={formData.q5_applicable}
              onChange={(e, v) => handleChange('q5_applicable', v)}
              precision={1}
              max={5}
            />
          </FormControl>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Additional Comments (Optional)</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="What was unclear?"
            value={formData.unclear_text}
            onChange={(e) => handleChange('unclear_text', e.target.value)}
            placeholder="What concepts or sections were unclear?"
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="What should be improved?"
            value={formData.improvement_text}
            onChange={(e) => handleChange('improvement_text', e.target.value)}
            placeholder="How could this lesson be improved?"
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="What content was unnecessary?"
            value={formData.unnecessary_text}
            onChange={(e) => handleChange('unnecessary_text', e.target.value)}
            placeholder="Was there content that wasn't needed?"
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="What content was missing?"
            value={formData.missing_text}
            onChange={(e) => handleChange('missing_text', e.target.value)}
            placeholder="What topics should be added?"
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <MobileButton onClick={() => setSubmitted(false)} disabled={submitted}>Close</MobileButton>
        <MobileButton
          variant="contained"
          type="submit"
          disabled={submitting || formData.rating === 0}
          startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <Feedback />}
        >
          {submitting ? 'Submitting...' : submitted ? 'Feedback Submitted' : 'Submit Feedback'}
        </MobileButton>
      </Box>
    </form>
  );
}
;
 
export default function TrainingProgrammeDetail() {
  const { id } = useParams();
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [employeeProgress, setEmployeeProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState(null);
  const [lessonMaterials, setLessonMaterials] = useState([]);
  const [lessonExercises, setLessonExercises] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [programmeData, progress] = await Promise.all([
        client.get(`/training/programmes/${id}`),
        staff.employee_id ? client.get(`/training/employees/${staff.employee_id}/progress`) : Promise.resolve({ data: { rows: [] } })
      ]);
      setData(programmeData.data);
      
      // Build progress map for this programme
      const progMap = {};
      if (progress.data.rows) {
        const programmeLessons = new Set();
        // Collect all lesson IDs in this programme
        if (programmeData.data.courses) {
          for (const course of programmeData.data.courses) {
            if (course.modules) {
              for (const module of course.modules) {
                if (module.lessons) {
                  module.lessons.forEach(l => programmeLessons.add(l.id));
                }
              }
            }
          }
        }
        
        const completed = progress.data.rows
          .filter(l => l.status === 'completed' && programmeLessons.has(l.lesson_id))
          .map(l => l.lesson_id);
        const inProgress = progress.data.rows
          .filter(l => l.status === 'in_progress' && programmeLessons.has(l.lesson_id))
          .map(l => l.lesson_id);
        const lessonProgress = {};
        progress.data.rows
          .filter(l => programmeLessons.has(l.lesson_id))
          .forEach(l => {
            lessonProgress[l.lesson_id] = l.progress_pct;
          });
        
        progMap[programmeData.data.programme.id] = { 
          completed_lessons: completed, 
          in_progress_lessons: inProgress, 
          lesson_progress: lessonProgress 
        };
      }
      setEmployeeProgress(progMap);
    } catch (err) {
      console.error('[TrainingProgrammeDetail] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, staff.employee_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLessonClick = async (lesson) => {
    setActiveLesson(lesson);
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

  const handleDownloadCourse = async (course) => {
    try {
      const response = await client.get(`/training/courses/${course.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${course.code}-${course.title.replace(/\s+/g, '-')}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download course error:', err);
      alert('Failed to download course');
    }
  };

  const handleDownloadModule = async (course, module) => {
    try {
      const response = await client.get(`/training/modules/${module.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${course.code}-${module.code}-${module.title.replace(/\s+/g, '-')}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download module error:', err);
      alert('Failed to download module');
    }
  };

  const handleDownloadProgramme = async () => {
    try {
      const response = await client.get(`/training/programmes/${programme.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${programme.code}-${programme.title.replace(/\s+/g, '-')}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download programme error:', err);
      alert('Failed to download programme');
    }
  };

  const handleEnrollInPilot = async () => {
    try {
      if (!staff.employee_id) {
        alert('No employee record linked to your account');
        return;
      }

      // Check if pilot cohort exists for this programme
      const { data: cohorts } = await client.get('/training/pilot-cohorts', {
        params: { programme_id: programme.id }
      });

      if (!cohorts.cohorts || cohorts.cohorts.length === 0) {
        alert('No active pilot cohort available for this programme');
        return;
      }

      const cohort = cohorts.cohorts[0]; // Use first active cohort

      // Add employee to cohort
      await client.post(`/training/pilot-cohorts/${cohort.id}/members`, {
        employee_ids: [staff.employee_id]
      });

      alert('Successfully enrolled in pilot cohort! You now have access to all courses.');
      fetchData();
    } catch (err) {
      console.error('Enroll in pilot error:', err);
      alert('Failed to enroll in pilot: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!data) return <Alert severity="error">Failed to load programme</Alert>;

  const { programme, courses } = data;
  const progProgress = employeeProgress[programme.id] || {};

  // Find next lesson for "Continue Learning"
  let continueLesson = null;
  for (const course of courses) {
    if (course.modules) {
      for (const module of course.modules) {
        if (module.lessons) {
          for (const lesson of module.lessons) {
            if (lesson.is_required && (!progProgress.completed_lessons?.includes(lesson.id) && !progProgress.in_progress_lessons?.includes(lesson.id))) {
              continueLesson = { ...lesson, module_title: module.title, course_title: course.title };
              break;
            }
          }
          if (continueLesson) break;
        }
      }
      if (continueLesson) break;
    }
  }

  return (
    <Box>
      <MobilePageHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <LibraryBooks sx={{ fontSize: 24 }} />
            </Avatar>
            <Box>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 700 }}>{programme.title}</Typography>
              <Typography variant="body2" color="text.secondary">{programme.code} • {programme.duration_weeks} weeks • {programme.total_estimated_hours}h</Typography>
            </Box>
          </Box>
          <MobileButton variant="outlined" startIcon={<Download />} onClick={handleDownloadProgramme}>
            Download Programme
          </MobileButton>
          <MobileButton variant="contained" startIcon={<LibraryBooks />} onClick={handleEnrollInPilot}>
            Enroll in Pilot
          </MobileButton>
          <MobileButton variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/training/programmes')}>
            Back to Programmes
          </MobileButton>
        </Box>
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
                <Typography variant="body2" color="text.secondary">{continueLesson.course_title} → {continueLesson.module_title}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>{continueLesson.title}</strong>
                  <span sx={{ mx: 1 }}>•</span>
                  <span>{continueLesson.lesson_type.replace('_', ' ')}</span>
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
              onClick={() => handleLessonClick(continueLesson)}
            >
              Resume Lesson
            </MobileButton>
          </Box>
        </MobilePaper>
      )}

      {/* Programme Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Courses" value={courses.length} icon={MenuBook} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total Lessons" value={courses.reduce((sum, c) => sum + (c.content_summary?.total || 0), 0)} icon={Description} color="info" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Authored" value={courses.reduce((sum, c) => sum + (c.content_summary?.authored || 0), 0)} icon={CheckCircle} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Your Progress" value={`${Object.values(employeeProgress).reduce((sum, p) => {
            const total = courses.reduce((s, c) => s + (c.content_summary?.total || 0), 0);
            const completed = p.completed_lessons?.length || 0;
            return sum + (total > 0 ? Math.round((completed / total) * 100) : 0);
          }, 0) / courses.length || 0}%`} icon={TrendingUp} color="warning" />
        </Grid>
      </Grid>

      {/* Courses List */}
      <MobilePaper>
        {courses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <School sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>No Courses Yet</Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              This programme doesn't have any courses configured yet.
            </Typography>
          </Box>
        ) : (
          <Box>
            {courses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                employeeProgress={progProgress}
                onLessonClick={handleLessonClick}
                onDownloadCourse={handleDownloadCourse}
                navigate={navigate}
              />
            ))}
          </Box>
        )}
      </MobilePaper>

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

          {/* Pilot Feedback Section */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 2, border: '1px solid', borderColor: 'info.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Feedback sx={{ color: 'info.main', fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Pilot Feedback</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Help us improve the Carbon Academy! Your feedback on this lesson will help shape the final programme.
            </Typography>
            <PilotFeedbackForm lessonId={activeLesson.id} />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <MobileButton onClick={() => setActiveLesson(null)}>Close</MobileButton>
            <MobileButton
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={() => {
                // Mark lesson complete
                client.post(`/training/lessons/${activeLesson.id}/complete`)
                  .then(() => {
                    setActiveLesson(null);
                    fetchData();
                  })
                  .catch(err => alert('Failed to mark complete: ' + (err.response?.data?.error || err.message)));
              }}
            >
              Mark Complete
            </MobileButton>
          </Box>
        </Paper>
      )}
    </Box>
  );
}