import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, IconButton, Button, List, ListItem, ListItemText,
  Chip, Divider, Alert, TextareaAutosize, Tooltip, Avatar, TextField, AppBar,
  Toolbar, InputBase, MenuItem, Menu, Badge, Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import DownloadIcon from '@mui/icons-material/Download';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileActionButtons,
  useMobile,
} from '../components/MobileResponsive';

export default function MyNotes() {
  const isMobile = useMobile();
const [notes, setNotes] = useState([]);
const [loading, setLoading] = useState(true);
const [editingNote, setEditingNote] = useState(null);
const [isCreating, setIsCreating] = useState(false);
const [form, setForm] = useState({ title: '', content: '', is_pinned: false });
const [saving, setSaving] = useState(false);
const [search, setSearch] = useState('');
const [error, setError] = useState('');
const [fullscreen, setFullscreen] = useState(false);
const [anchorEl, setAnchorEl] = useState(null);
const [menuNote, setMenuNote] = useState(null);

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await client.get('/notes');
      setNotes(data.notes);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleNewNote = () => {
    setEditingNote(null);
    setIsCreating(true);
    setForm({ title: '', content: '', is_pinned: false });
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setIsCreating(false);
    setForm({ title: note.title, content: note.content || '', is_pinned: note.is_pinned });
  };

  const handleCancel = () => {
    setEditingNote(null);
    setIsCreating(false);
    setForm({ title: '', content: '', is_pinned: false });
    setError('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingNote) {
        await client.put(`/notes/${editingNote.id}`, form);
      } else {
        await client.post('/notes', form);
      }
      handleCancel();
      loadNotes();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await client.delete(`/notes/${note.id}`);
      loadNotes();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete note');
    }
  };

  const handlePin = async (note) => {
    try {
      await client.put(`/notes/${note.id}`, { is_pinned: !note.is_pinned });
      loadNotes();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update note');
    }
  };

  const handleMenuOpen = (event, note) => {
    setAnchorEl(event.currentTarget);
    setMenuNote(note);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuNote(null);
  };

  const handleDuplicate = async (note) => {
    try {
      await client.post('/notes', {
        title: note.title + ' (copy)',
        content: note.content,
        is_pinned: false
      });
      loadNotes();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to duplicate note');
    }
    handleMenuClose();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><div>Loading…</div></Box>;

  // If editing, show full-page editor
  if (editingNote || isCreating) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <AppBar position="sticky" elevation={0} sx={{ backgroundColor: 'background.paper', borderBottom: 1, borderColor: 'divider', zIndex: 1200 }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={handleCancel} edge="start" color="inherit" aria-label="Back">
                <CloseIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                {editingNote ? 'Edit Note' : 'New Note'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={fullscreen ? 'Exit full screen' : 'Full screen'}>
                <IconButton onClick={() => setFullscreen(!fullscreen)} color="inherit">
                  {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
              <MobileButton variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} size="medium">
                {saving ? 'Saving…' : 'Save'}
              </MobileButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Editor */}
        <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 2 : 4, bgcolor: 'background.default' }}>
          <Box sx={{ maxWidth: fullscreen ? '100%' : '900px', mx: 'auto', width: '100%' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
                required
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    padding: '12px 0',
                    borderBottom: 'none',
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    fontWeight: 500,
                  },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 0,
                    '& fieldset': { border: 'none' },
                    '&:hover fieldset': { border: 'none' },
                    '&.Mui-focused fieldset': { border: 'none' },
                  },
                }}
                InputProps={{
                  disableUnderline: true,
                  startAdornment: <PushPinIcon color={form.is_pinned ? 'primary' : 'action'} sx={{ mr: 1, cursor: 'pointer' }} onClick={() => setForm({ ...form, is_pinned: !form.is_pinned })} />
                }}
              />
              {form.is_pinned && <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><PushPinIcon fontSize="14" /> Pinned</Typography>}
            </Box>

            <Divider sx={{ mb: 2, opacity: 0.2 }} />

            <Box sx={{ mb: 2 }}>
              <TextareaAutosize
                fullWidth
                rows={50}
                minRows={50}
                label=""
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Start writing..."
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
                  fontSize: '16px',
                  lineHeight: 1.8,
                  padding: '24px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  minHeight: 'calc(100vh - 280px)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </Box>

            <Divider sx={{ mt: 4, opacity: 0.2 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Tooltip title="Bold"><IconButton size="small"><FormatBoldIcon /></IconButton></Tooltip>
                <Tooltip title="Italic"><IconButton size="small"><FormatItalicIcon /></IconButton></Tooltip>
                <Tooltip title="Bullet list"><IconButton size="small"><FormatListBulletedIcon /></IconButton></Tooltip>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
                <Box>Created: {editingNote?.created_at ? formatDateTime(editingNote.created_at) : 'Now'}</Box>
                <Box>Updated: {formatDateTime(new Date().toISOString())}</Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // List view
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <AppBar position="sticky" elevation={0} sx={{ backgroundColor: 'background.paper', borderBottom: 1, borderColor: 'divider', zIndex: 1200 }}>
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>My Notes</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon color="action" /> }}
              sx={{ width: 320 }}
            />
            <MobileButton variant="contained" startIcon={<AddIcon />} onClick={handleNewNote}>
              New Note
            </MobileButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 2 : 4, bgcolor: 'background.default' }}>
        <Box sx={{ maxWidth: '900px', mx: 'auto', width: '100%' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

          {filteredNotes.length === 0 ? (
            <MobilePaper sx={{ textAlign: 'center', py: 6 }}>
              <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom>{search ? 'No matching notes' : 'No Notes Yet'}</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                {search ? 'Try a different search term.' : 'Create your first note to get started. Notes are private to you.'}
              </Typography>
              {!search && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={handleNewNote} sx={{ mt: 2 }}>Create Note</MobileButton>}
            </MobilePaper>
          ) : (
            <List sx={{ width: '100%' }}>
              {filteredNotes.map((note) => (
                <Box key={note.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <ListItem
                    onClick={() => handleEditNote(note)}
                    sx={{ cursor: 'pointer', py: 2, px: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={note.is_pinned ? 'Unpin' : 'Pin to top'}>
                          <IconButton edge="end" aria-label="pin" onClick={(e) => { e.stopPropagation(); handlePin(note); }} color={note.is_pinned ? 'primary' : 'action'}>
                            <PushPinIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); handleEditNote(note); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More">
                          <IconButton edge="end" aria-label="more" onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, note); }}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>{note.title}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              {note.is_pinned && <Badge badgeContent="Pinned" color="primary" size="small" icon={<PushPinIcon fontSize="12" />} />}
                              <Typography variant="caption" color="text.secondary">
                                Created: {formatDateTime(note.created_at)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Updated: {formatDateTime(note.updated_at)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box>
                          {note.content && (
                            <Typography variant="body1" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.6, mb: 1 }}>
                              {note.content}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { handleDuplicate(menuNote); handleMenuClose(); }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon fontSize="small" /> Duplicate
          </Box>
        </MenuItem>
        <MenuItem onClick={() => { handleDelete(menuNote); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon fontSize="small" color="error" /> Delete
          </Box>
        </MenuItem>
        <MenuItem onClick={() => { window.open(`/api/notes/${menuNote.id}/download`); handleMenuClose(); }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DownloadIcon fontSize="small" /> Download as .txt
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}