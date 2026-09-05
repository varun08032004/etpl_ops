// eslint-disable-next-line react/jsx-props-no-spreading
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, IconButton, Tooltip, LinearProgress, CircularProgress,
  Divider, Avatar, Stack, Drawer, AppBar, Toolbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, FormLabel, InputLabel, Select, MenuItem, Alert,
  Tabs, Tab, Accordion, AccordionSummary, AccordionDetails, Collapse, Grid, List, ListItem,
  ListItemIcon, ListItemText, ListItemButton, Card, CardContent, CardActions, Snackbar,
  Table, TableCell, TableRow
} from '@mui/material';
import {
  ArrowBack, School, MenuBook, Assignment, Verified, Schedule,
  Warning, Quiz, ExpandMore, PlayCircle, Description, Build,
  CheckCircle, HourglassEmpty, ContentCopy, LibraryBooks,
  Download, ChevronRight, ChevronLeft, RadioButtonChecked, RadioButtonUnchecked,
  Fullscreen, FullscreenExit, Menu as MenuIcon, Close, Edit, Save, UploadFile,
  PictureAsPdf, Code, Article, NavigateNext, NavigateBefore, Bookmark, BookmarkAdded,
  Settings, Refresh, Visibility, VisibilityOff, DragIndicator, Delete
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { MobilePageHeader, useMobile } from '../components/MobileResponsive';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const toolbarContainerStyle = { display: 'flex', alignItems: 'center', width: '100%', gap: 1 };
const mobileMenuButtonStyle = { mr: 1, display: { xs: 'flex', sm: 'none' } };
const titleSectionStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: 2 };
const actionSectionStyle = { display: 'flex', gap: 1 };

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

const LESSON_TYPE_LABELS = {
  video: 'Video',
  document: 'Reading',
  external_resource: 'External',
  practical_exercise: 'Exercise',
  assessment: 'Assessment',
};

const CONTENT_STATUS_COLORS = {
  NOT_AUTHORED: 'default',
  DRAFT: 'info',
  IN_REVIEW: 'warning',
  AUTHORED: 'primary',
  PUBLISHED: 'success',
};

function formatDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function JsonContent({ data }) {
  return (
    <SyntaxHighlighter language="json" style={oneDark} showLineNumbers>
      {JSON.stringify(data, null, 2)}
    </SyntaxHighlighter>
  );
}

function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <Typography variant="h4" sx={{ mt: 3, mb: 1, fontWeight: 700 }}>{children}</Typography>,
        h2: ({ children }) => <Typography variant="h5" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>{children}</Typography>,
        h3: ({ children }) => <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>{children}</Typography>,
        p: ({ children }) => <Typography variant="body1" sx={{ mt: 1, mb: 1, lineHeight: 1.8 }}>{children}</Typography>,
        code: ({ children }) => <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.2, borderRadius: 1 }}>{children}</Typography>,
        pre: ({ children }) => <SyntaxHighlighter language="text" style={oneDark} showLineNumbers>{children.props.children}</SyntaxHighlighter>,
        blockquote: ({ children }) => <Box sx={{ borderLeft: '4px solid', borderColor: 'primary.main', pl: 2, my: 2, color: 'text.secondary' }}>{children}</Box>,
        ul: ({ children }) => <Box sx={{ ml: 3, mt: 1 }}>{children}</Box>,
        ol: ({ children }) => <Box sx={{ ml: 3, mt: 1 }}>{children}</Box>,
        li: ({ children }) => <Typography variant="body1" sx={{ mt: 0.5, lineHeight: 1.7 }}>{children}</Typography>,
        table: ({ children }) => <Box sx={{ overflowX: 'auto', my: 2 }}><Table size="small">{children}</Table></Box>,
        th: ({ children }) => <TableCell sx={{ fontWeight: 600, bgcolor: 'primary.light' }}>{children}</TableCell>,
        td: ({ children }) => <TableCell>{children}</TableCell>,
        tr: ({ children }) => <TableRow>{children}</TableRow>,
        a: ({ href, children }) => <Typography variant="body2" color="primary" component="a" href={href} target="_blank" rel="noopener">{children}</Typography>,
        hr: () => <Divider sx={{ my: 3 }} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function LessonContentViewer({ lesson, onComplete, onStart, progress, isAdmin, onLessonChange }) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [contentType, setContentType] = useState('markdown');
  const pdfRef = useRef(null);

  const isCompleted = progress?.completed_lessons?.includes(lesson.id);
  const isInProgress = progress?.in_progress_lessons?.includes(lesson.id);
  const progressPct = progress?.lesson_progress?.[lesson.id] || 0;

  const content = lesson.content || {};
  const hasJsonContent = content.format === 'json' && content.data;
  const hasMarkdownContent = content.text || (content.format === 'markdown' && content.text);
  const hasPdfContent = content.format === 'pdf' && content.pdf_url;

  const LessonIcon = LESSON_TYPE_ICONS[lesson.lesson_type] || Description;
  const TierColor = TIER_COLORS[lesson.tier] || 'primary';

  const handleContentSwitch = (type) => {
    if (type === 'json' && hasJsonContent) setContentType('json');
    else if (type === 'markdown' && hasMarkdownContent) setContentType('markdown');
    else if (type === 'pdf' && hasPdfContent) setContentType('pdf');
  };

  if (!lesson) return null;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: 'background.default' }}>
      <Box sx={{ 
        p: { xs: 2, sm: 3 }, 
        borderBottom: 1, 
        borderColor: 'divider',
        position: 'sticky', 
        top: 0, 
        zIndex: 10,
        bgcolor: 'background.paper'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Chip
              icon={<LessonIcon fontSize="small" />}
              label={LESSON_TYPE_LABELS[lesson.lesson_type] || lesson.lesson_type}
              size="small"
              color={TierColor}
              variant="outlined"
            />
            <Chip
              label={lesson.code || ''}
              size="small"
              variant="outlined"
              color="default"
            />
            <Chip
              label={(lesson.content_status || 'NOT_AUTHORED').replace('_', ' ')}
              size="small"
              variant="outlined"
              color={CONTENT_STATUS_COLORS[lesson.content_status] || 'default'}
            />
            <Typography variant="body2" color="text.secondary">{formatDuration(lesson.duration_minutes)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {hasJsonContent && (
              <Button
                size="small"
                variant={contentType === 'json' ? 'contained' : 'outlined'}
                startIcon={<Code fontSize="small" />}
                onClick={() => handleContentSwitch('json')}
              >
                JSON
              </Button>
            )}
            {hasMarkdownContent && (
              <Button
                size="small"
                variant={contentType === 'markdown' ? 'contained' : 'outlined'}
                startIcon={<Article fontSize="small" />}
                onClick={() => handleContentSwitch('markdown')}
              >
                Markdown
              </Button>
            )}
            {hasPdfContent && (
              <Button
                size="small"
                variant={contentType === 'pdf' ? 'contained' : 'outlined'}
                startIcon={<PictureAsPdf fontSize="small" />}
                onClick={() => handleContentSwitch('pdf')}
              >
                PDF
              </Button>
            )}
            <Button
              size="small"
              variant={showFullscreen ? 'contained' : 'outlined'}
              startIcon={showFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              onClick={() => setShowFullscreen(!showFullscreen)}
            >
              {showFullscreen ? 'Exit' : 'Focus'}
            </Button>
          </Box>
        </Box>
        <Typography variant="h4" sx={{ mt: 2, mb: 0.5, fontWeight: 700, lineHeight: 1.3 }}>
          {lesson.title}
        </Typography>
        {lesson.description && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {lesson.description}
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}>
        {hasJsonContent && contentType === 'json' && (
          <Card sx={{ maxWidth: '900px', mx: 'auto', width: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>JSON Content</Typography>
              <JsonContent data={content.data} />
            </CardContent>
          </Card>
        )}

        {hasMarkdownContent && contentType === 'markdown' && (
          <Card sx={{ maxWidth: '900px', mx: 'auto', width: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <MarkdownContent content={content.text} />
            </CardContent>
          </Card>
        )}

        {hasPdfContent && contentType === 'pdf' && (
          <Card sx={{ maxWidth: '100%', mx: 'auto', width: '100%', height: '70vh' }}>
            <CardContent sx={{ p: 0, height: '100%' }}>
              <iframe
                ref={pdfRef}
                src={content.pdf_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={lesson.title}
              />
            </CardContent>
          </Card>
        )}

        {(!hasJsonContent && !hasMarkdownContent && !hasPdfContent) && (
          <Card sx={{ maxWidth: '900px', mx: 'auto', width: '100%' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <LibraryBooks sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>No Content Available</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                This lesson doesn't have any content yet. Admins can add Markdown, JSON, or PDF content.
              </Typography>
              {isAdmin && (
                <Button variant="contained" startIcon={<Edit fontSize="small" />} onClick={() => window.open(`/admin/lessons/${lesson.id}/edit`, '_blank')}>
                  Add Content
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      <Box sx={{ 
        p: { xs: 2, sm: 3 }, 
        borderTop: 1, 
        borderColor: 'divider',
        position: 'sticky', 
        bottom: 0,
        zIndex: 10,
        bgcolor: 'background.paper'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<NavigateBefore fontSize="small" />}
              disabled={!lesson.prev_lesson_id}
              onClick={() => lesson.prev_lesson_id && onLessonChange(lesson.prev_lesson_id)}
            >
              Previous
            </Button>
            <Button
              variant="outlined"
              endIcon={<NavigateNext fontSize="small" />}
              disabled={!lesson.next_lesson_id}
              onClick={() => lesson.next_lesson_id && onLessonChange(lesson.next_lesson_id)}
            >
              Next
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isCompleted ? (
              <Chip icon={<CheckCircle fontSize="small" />} label="Completed" color="success" variant="filled" size="small" />
            ) : isInProgress ? (
              <Chip icon={<RadioButtonChecked fontSize="small" />} label={`${progressPct}%`} color="primary" variant="filled" size="small" />
            ) : (
              <>
                <Button variant="outlined" startIcon={<PlayCircle fontSize="small" />} onClick={onStart} disabled={isInProgress}>
                  Start Lesson
                </Button>
                <Button variant="contained" startIcon={<CheckCircle fontSize="small" />} onClick={onComplete} disabled={isCompleted}>
                  Mark Complete
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function ContentStatusChip({ status }) {
  const safeStatus = status || 'NOT_AUTHORED';
  const icons = { NOT_AUTHORED: HourglassEmpty, DRAFT: Edit, IN_REVIEW: Visibility, AUTHORED: Article, PUBLISHED: CheckCircle };
  const colors = { NOT_AUTHORED: 'default', DRAFT: 'info', IN_REVIEW: 'warning', AUTHORED: 'primary', PUBLISHED: 'success' };
  const Icon = icons[safeStatus] || HourglassEmpty;
  return <Chip icon={<Icon fontSize="small" />} label={safeStatus.replace('_', ' ')} size="small" color={colors[safeStatus] || 'default'} variant="outlined" sx={{ fontWeight: 500 }} />;
}

function ModuleSidebar({ modules, activeLessonId, onLessonClick, progress, courseId, isAdmin }) {
  const [expandedModules, setExpandedModules] = useState(modules.map((_, i) => i === 0));
  const isMobile = useMobile();

  const toggleModule = (index) => {
    setExpandedModules(prev => prev.map((exp, i) => i === index ? !exp : exp));
  };

  const getLessonStatus = (lesson) => {
    if (progress?.completed_lessons?.includes(lesson.id)) return 'completed';
    if (progress?.in_progress_lessons?.includes(lesson.id)) return 'in_progress';
    return 'not_started';
  };

  const ModuleItem = ({ module, moduleIndex }) => {
    const isExpanded = expandedModules[moduleIndex];
    const completedCount = module.lessons?.filter(l => progress?.completed_lessons?.includes(l.id)).length || 0;
    const totalCount = module.lessons?.length || 0;

    return (
      <Box sx={{ mb: 1 }}>
        <Accordion expanded={isExpanded} onChange={() => toggleModule(moduleIndex)} disabled={!isExpanded && isMobile} sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, px: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={600} noWrap>{module.code || `M${module.display_order + 1}`}</Typography>
                <Typography variant="subtitle2" fontWeight={500} color="text.primary" noWrap>{module.title}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={`${completedCount}/${totalCount}`} size="small" variant="outlined" color={completedCount === totalCount && totalCount > 0 ? 'success' : 'default'} />
                {isAdmin && (
                  <Tooltip title="Manage Module">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(`/admin/modules/${module.id}/edit`, '_blank'); }}>
                      <Settings fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 1, px: 1 }}>
            <List dense disablePadding>
              {module.lessons?.map((lesson, lessonIndex) => {
                const status = getLessonStatus(lesson);
                const isActive = activeLessonId === lesson.id;
                return (
                  <ListItem key={lesson.id} disablePadding sx={{ borderLeft: isActive ? `3px solid ${(theme) => theme.palette.primary.main}` : '3px solid transparent', ml: 1, borderRadius: 1, bgcolor: isActive ? 'primary.50' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}>
                    <ListItemButton
                      onClick={() => onLessonClick(lesson)}
                      sx={{ px: 1, py: 0.5, minHeight: 36, borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: status === 'completed' ? 'success.main' : status === 'in_progress' ? 'primary.main' : 'text.secondary' }}>
                        {status === 'completed' ? <CheckCircle fontSize="small" /> : status === 'in_progress' ? <RadioButtonChecked fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" noWrap>{lesson.title}</Typography>}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.2 }}>
                            <Chip label={lesson.code || ''} size="small" variant="outlined" color="default" />
                            <Typography variant="caption" color="text.secondary">{formatDuration(lesson.duration_minutes)}</Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                    {isAdmin && (
                      <Tooltip title="Edit Lesson">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(`/admin/lessons/${lesson.id}/edit`, '_blank'); }} sx={{ mr: 1 }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width: { xs: 0, sm: 380 },
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: { xs: 'none', sm: 'flex' },
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
      }}
    >
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Course Contents</Typography>
          <Typography variant="caption" color="text.secondary">Click a lesson to start learning</Typography>
        </Box>
        {modules?.map((module, index) => (
          <ModuleItem key={module.id} module={module} moduleIndex={index} />
        ))}
      </Box>
    </Drawer>
  );
}

function MobileDrawer({ modules, activeLessonId, onLessonClick, progress, open, onClose, isAdmin }) {
  const [expandedModules, setExpandedModules] = useState(modules.map((_, i) => i === 0));

  const toggleModule = (index) => {
    setExpandedModules(prev => prev.map((exp, i) => i === index ? !exp : exp));
  };

  const getLessonStatus = (lesson) => {
    if (progress?.completed_lessons?.includes(lesson.id)) return 'completed';
    if (progress?.in_progress_lessons?.includes(lesson.id)) return 'in_progress';
    return 'not_started';
  };

  return (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: true }} sx={{ width: 320 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={700}>Course Contents</Typography>
        <IconButton onClick={onClose}><Close /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {modules?.map((module, index) => {
          const isExpanded = expandedModules[index];
          const completedCount = module.lessons?.filter(l => progress?.completed_lessons?.includes(l.id)).length || 0;
          const totalCount = module.lessons?.length || 0;
          return (
            <Box key={module.id} sx={{ mb: 1 }}>
              <Accordion expanded={isExpanded} onChange={() => toggleModule(index)} sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 44, px: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={600} noWrap>{module.code || `M${module.display_order + 1}`}</Typography>
                      <Typography variant="subtitle2" fontWeight={500} noWrap>{module.title}</Typography>
                    </Box>
                    <Chip label={`${completedCount}/${totalCount}`} size="small" variant="outlined" color={completedCount === totalCount && totalCount > 0 ? 'success' : 'default'} />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pb: 1, px: 1 }}>
                  <List dense disablePadding>
                    {module.lessons?.map((lesson) => {
                      const status = getLessonStatus(lesson);
                      const isActive = activeLessonId === lesson.id;
                      return (
                        <ListItem key={lesson.id} disablePadding sx={{ borderLeft: isActive ? `3px solid ${(theme) => theme.palette.primary.main}` : '3px solid transparent', ml: 1, borderRadius: 1, bgcolor: isActive ? 'primary.50' : 'transparent' }}>
                          <ListItemButton onClick={() => { onLessonClick(lesson); onClose(); }} sx={{ px: 1, py: 0.5, minHeight: 36, borderRadius: 1 }}>
                            <ListItemIcon sx={{ minWidth: 32, color: status === 'completed' ? 'success.main' : status === 'in_progress' ? 'primary.main' : 'text.secondary' }}>
                              {status === 'completed' ? <CheckCircle fontSize="small" /> : status === 'in_progress' ? <RadioButtonChecked fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                            </ListItemIcon>
                            <ListItemText
                              primary={<Typography variant="body2" noWrap>{lesson.title}</Typography>}
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.2 }}>
                                  <Chip label={lesson.code || ''} size="small" variant="outlined" color="default" />
                                  <Typography variant="caption" color="text.secondary">{formatDuration(lesson.duration_minutes)}</Typography>
                                </Box>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Box>
          );
        })}
      </Box>
    </Drawer>
  );
}

function AdminContentEditor({ lesson, onSave, onClose }) {
  const [format, setFormat] = useState(lesson.content?.format || 'markdown');
  const [markdownContent, setMarkdownContent] = useState(lesson.content?.text || '');
  const [jsonContent, setJsonContent] = useState(lesson.content?.data ? JSON.stringify(lesson.content.data, null, 2) : '');
  const [pdfUrl, setPdfUrl] = useState(lesson.content?.pdf_url || '');
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleJsonChange = (e) => {
    const val = e.target.value;
    setJsonContent(val);
    try { JSON.parse(val); setError(''); } catch { setError('Invalid JSON'); }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files allowed'); return; }
    setPdfFile(file);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);
    setUploading(true);
    try {
      const res = await client.post('/training/lessons/upload-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPdfUrl(res.data.url);
      setFormat('pdf');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    let content = { format };
    if (format === 'markdown') content.text = markdownContent;
    else if (format === 'json') { try { content.data = JSON.parse(jsonContent); } catch { setError('Invalid JSON'); return; } }
    else if (format === 'pdf') content.pdf_url = pdfUrl;

    await onSave(lesson.id, content);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth sx={{ maxHeight: '90vh' }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Typography variant="h6">Edit Lesson Content: {lesson.title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflow: 'auto', p: 2 }}>
        <Tabs value={format} onChange={(_, v) => setFormat(v)} sx={{ mb: 2 }}>
          <Tab label="Markdown" icon={<Article />} disabled={!lesson.content?.text && format !== 'markdown'} />
          <Tab label="JSON" icon={<Code />} />
          <Tab label="PDF" icon={<PictureAsPdf />} disabled={!pdfUrl && format !== 'pdf'} />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {format === 'markdown' && (
          <TextField
            multiline
            rows={30}
            fullWidth
            value={markdownContent}
            onChange={(e) => setMarkdownContent(e.target.value)}
            placeholder="Enter markdown content..."
            sx={{ fontFamily: 'monospace', fontSize: 14 }}
          />
        )}

        {format === 'json' && (
          <TextField
            multiline
            rows={30}
            fullWidth
            value={jsonContent}
            onChange={handleJsonChange}
            placeholder="Enter JSON content..."
            sx={{ fontFamily: 'monospace', fontSize: 14 }}
            error={!!error}
            helperText={error}
          />
        )}

        {format === 'pdf' && (
          <Box>
            {pdfUrl ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Current PDF:</Typography>
                <iframe src={pdfUrl} style={{ width: '100%', height: 400, border: '1px solid', borderColor: 'divider' }} title="PDF Preview" />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No PDF uploaded</Typography>
            )}
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} hidden id="pdf-upload" />
            <Button variant="contained" startIcon={<UploadFile />} onClick={() => document.getElementById('pdf-upload').click()} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={format === 'json' && error}>
          <Save /> Save Content
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TrainingCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);
  const [employeeProgress, setEmployeeProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminEditorOpen, setAdminEditorOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const isAdmin = staff?.role === 'owner' || staff?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [courseData, progress] = await Promise.all([
        client.get(`/training/courses/${courseId}`),
        staff.employee_id ? client.get(`/training/employees/${staff.employee_id}/progress`) : Promise.resolve({ data: { rows: [] } })
      ]);
      setCourse(courseData.data.course);
      setModules(courseData.data.course.modules || []);
      
      const progMap = {};
      if (progress.data.rows) {
        const courseLessons = new Set();
        if (courseData.data.course.modules) {
          for (const module of courseData.data.course.modules) {
            if (module.lessons) module.lessons.forEach(l => courseLessons.add(l.id));
          }
        }
        const completed = progress.data.rows.filter(l => l.status === 'completed' && courseLessons.has(l.lesson_id)).map(l => l.lesson_id);
        const inProgress = progress.data.rows.filter(l => l.status === 'in_progress' && courseLessons.has(l.lesson_id)).map(l => l.lesson_id);
        const lessonProgress = {};
        progress.data.rows.filter(l => courseLessons.has(l.lesson_id)).forEach(l => { lessonProgress[l.lesson_id] = l.progress_pct; });
        progMap[courseId] = { completed_lessons: completed, in_progress_lessons: inProgress, lesson_progress: lessonProgress };
      }
      setEmployeeProgress(progMap);

      // Auto-select first incomplete required lesson
      if (!activeLesson && courseData.data.course.modules) {
        for (const module of courseData.data.course.modules) {
          if (module.lessons) {
            for (const lesson of module.lessons) {
              if (lesson.is_required && !progMap[courseId]?.completed_lessons?.includes(lesson.id)) {
                setActiveLesson(lesson);
                break;
              }
            }
            if (activeLesson) break;
          }
        }
        // Fallback to first lesson
        if (!activeLesson && courseData.data.course.modules[0]?.lessons?.[0]) {
          setActiveLesson(courseData.data.course.modules[0].lessons[0]);
        }
      }
    } catch (err) {
      console.error('[TrainingCourseDetail] fetch error:', err);
      setError(err.response?.data?.error || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [courseId, staff.employee_id, activeLesson]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const progProgress = employeeProgress[courseId] || {};

  const handleLessonClick = async (lesson) => {
    setActiveLesson(lesson);
    if (staff.employee_id && !progProgress.in_progress_lessons?.includes(lesson.id)) {
      try { await client.post(`/training/lessons/${lesson.id}/start`); fetchData(); } catch {}
    }
  };

  const handleStartLesson = async (lesson) => {
    try { await client.post(`/training/lessons/${lesson.id}/start`); fetchData(); } catch (err) { showSnackbar(err.response?.data?.error || 'Failed to start lesson', 'error'); }
  };

  const handleCompleteLesson = async (lesson) => {
    try { await client.post(`/training/lessons/${lesson.id}/complete`); fetchData(); showSnackbar('Lesson marked complete!', 'success'); } catch (err) { showSnackbar(err.response?.data?.error || 'Failed to complete lesson', 'error'); }
  };

  const handleLessonChange = (lessonId) => {
    const lesson = modules.flatMap(m => m.lessons || []).find(l => l.id === lessonId);
    if (lesson) handleLessonClick(lesson);
  };

  const handleAdminSave = async (lessonId, content) => {
    console.log('[AdminSave] Saving content for lesson:', lessonId, content);
    try {
      const res = await client.put(`/training/lessons/${lessonId}`, { content });
      console.log('[AdminSave] Response:', res.data);
      fetchData();
      setAdminEditorOpen(false);
      showSnackbar('Content saved successfully', 'success');
    } catch (err) {
      console.error('[AdminSave] Error:', err.response?.data || err.message);
      showSnackbar(err.response?.data?.error || 'Failed to save', 'error');
    }
  };

  const showSnackbar = (message, severity) => setSnackbar({ open: true, message, severity });

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={48} /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  if (!course) return <Alert severity="error" sx={{ m: 3 }}>Course not found</Alert>;

  return (
    <>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="fixed" sx={{ zIndex: 1300, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Box sx={toolbarContainerStyle}>
            <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} sx={{ mr: 1 }}><ArrowBack /></IconButton>
            <IconButton edge="start" color="inherit" onClick={() => setMobileDrawerOpen(true)} sx={mobileMenuButtonStyle}><MenuIcon /></IconButton>
            <Box sx={titleSectionStyle}>
              <Avatar sx={{ bgcolor: `${TIER_COLORS[course.tier]?.main || 'primary.main'}`, width: 40, height: 40 }}>
                <LibraryBooks sx={{ fontSize: 20 }} />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.title}</Typography>
                <Typography variant="caption" color="text.secondary">{course.code} • {TIER_LABELS[course.tier] || course.tier} • {course.total_hours || course.duration_hours}h</Typography>
              </Box>
            </Box>
<Box sx={actionSectionStyle}>
              <Tooltip title="Download Course"><IconButton onClick={() => window.open(`/api/training/courses/${courseId}/download`, '_blank')}><Download /></IconButton></Tooltip>
              {isAdmin && (
                <Tooltip title="Admin: Manage Course"><IconButton onClick={() => window.open(`/admin/courses/${courseId}/edit`, '_blank')}><Settings /></IconButton></Tooltip>
              )}
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <ModuleSidebar
        modules={modules}
        activeLessonId={activeLesson?.id}
        onLessonClick={handleLessonClick}
        progress={progProgress}
        courseId={courseId}
        isAdmin={isAdmin}
      />

      <MobileDrawer
        modules={modules}
        activeLessonId={activeLesson?.id}
        onLessonClick={handleLessonClick}
        progress={progProgress}
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        isAdmin={isAdmin}
      />

      <Box sx={{ flex: 1, pt: 64, pl: { xs: 0, sm: 380 }, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <LessonContentViewer
          lesson={activeLesson}
          onComplete={handleCompleteLesson}
          onStart={handleStartLesson}
          progress={progProgress}
          isAdmin={isAdmin}
          onLessonChange={handleLessonChange}
        />

        {isAdmin && activeLesson && (
          <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100 }}>
            <Tooltip title="Edit Lesson Content">
              <Button variant="contained" size="small" startIcon={<Edit />} onClick={() => setAdminEditorOpen(true)}>
                Edit Content
              </Button>
            </Tooltip>
          </Box>
        )}
      </Box>

      <AdminContentEditor
        lesson={activeLesson}
        open={adminEditorOpen}
        onClose={() => setAdminEditorOpen(false)}
        onSave={handleAdminSave}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ flex: 1 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </>
  );
}