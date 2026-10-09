import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Chip, Grid, IconButton, Tooltip, Divider, List, ListItem, ListItemText,
  ListItemIcon, ListItemSecondaryAction, Avatar, Badge, TextareaAutosize, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileActionButtons,
  MobileFormGrid,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const openWorkspaceChat = (workspaceId) => {
  window.location.href = `/workspaces/${workspaceId}/chat`;
};

export default function Workspaces() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [docs, setDocs] = useState([]);
  const [members, setMembers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wsDialog, setWsDialog] = useState(false);
  const [editingWs, setEditingWs] = useState(null);
  const [wsForm, setWsForm] = useState({ name: '', description: '', department_id: '', team_id: '', is_public: false });
  const [wsSaving, setWsSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [docDialog, setDocDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docForm, setDocForm] = useState({ title: '', content: '' });
  const [docSaving, setDocSaving] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [memberForm, setMemberForm] = useState({ employee_id: '', role: 'editor' });
  const [memberSaving, setMemberSaving] = useState(false);
  const [error, setError] = useState('');

  const loadWorkspaces = useCallback(async () => {
    try {
      const { data } = await client.get('/workspaces');
      setWorkspaces(data.workspaces);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  }, []);

  const loadWorkspaceDetail = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      const { data } = await client.get(`/workspaces/${workspaceId}`);
      setSelectedWorkspace(data.workspace);
      setMembers(data.members);
      setDocs(data.docs);
    } catch (err) {
      console.error('Failed to load workspace detail:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    const { data } = await client.get('/employees', { params: { status: 'active' } });
    setEmployees(data.employees);
  }, []);

  const loadDepartments = useCallback(async () => {
    const { data } = await client.get('/departments');
    setDepartments(data.departments);
  }, []);

  const loadTeams = useCallback(async () => {
    const { data } = await client.get('/teams');
    setTeams(data.teams);
  }, []);

  useEffect(() => { loadWorkspaces(); loadEmployees(); loadDepartments(); loadTeams(); }, [loadWorkspaces, loadEmployees, loadDepartments, loadTeams]);

  const handleWorkspaceClick = (ws) => {
    setSelectedWorkspace(ws);
    loadWorkspaceDetail(ws.id);
  };

  const openCreateWorkspace = () => {
    setEditingWs(null);
    setWsForm({ name: '', description: '', department_id: '', team_id: '', is_public: false });
    setWsDialog(true);
  };

  const closeWsDialog = () => { setWsDialog(false); setEditingWs(null); setError(''); };

  const handleWsSave = async () => {
    if (!wsForm.name.trim()) { setError('Name is required'); return; }
    setWsSaving(true);
    setError('');
    try {
      if (editingWs) {
        await client.put(`/workspaces/${editingWs.id}`, wsForm);
      } else {
        await client.post('/workspaces', wsForm);
      }
      closeWsDialog();
      loadWorkspaces();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save workspace');
    } finally {
      setWsSaving(false);
    }
  };

  const handleDeleteWorkspace = async (ws) => {
    if (!window.confirm(`Delete workspace "${ws.name}"?`)) return;
    try { await client.delete(`/workspaces/${ws.id}`); if (selectedWorkspace?.id === ws.id) setSelectedWorkspace(null); loadWorkspaces(); }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete'); }
  };

  const openCreateDoc = () => {
    setEditingDoc(null);
    setDocForm({ title: '', content: '' });
    setDocDialog(true);
  };

  const openEditDoc = (doc) => {
    setEditingDoc(doc);
    setDocForm({ title: doc.title, content: doc.content?.text || '' });
    setDocDialog(true);
  };

  const closeDocDialog = () => { setDocDialog(false); setEditingDoc(null); };

  const handleDocSave = async () => {
    if (!docForm.title.trim()) return;
    setDocSaving(true);
    try {
      const payload = { title: docForm.title, content: { text: docForm.content, version: Date.now() } };
      if (editingDoc) {
        await client.put(`/workspaces/${selectedWorkspace.id}/docs/${editingDoc.id}`, payload);
      } else {
        await client.post(`/workspaces/${selectedWorkspace.id}/docs`, payload);
      }
      closeDocDialog();
      loadWorkspaceDetail(selectedWorkspace.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save document');
    } finally {
      setDocSaving(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    try { await client.delete(`/workspaces/${selectedWorkspace.id}/docs/${doc.id}`); loadWorkspaceDetail(selectedWorkspace.id); }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete'); }
  };

  const openAddMember = () => {
    setMemberForm({ employee_id: '', role: 'editor' });
    setMemberDialog(true);
  };

  const handleAddMember = async () => {
    if (!memberForm.employee_id) return;
    setMemberSaving(true);
    try {
      await client.post(`/workspaces/${selectedWorkspace.id}/members`, memberForm);
      setMemberDialog(false);
      loadWorkspaceDetail(selectedWorkspace.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    } finally {
      setMemberSaving(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!window.confirm(`Remove ${member.full_name}?`)) return;
    try { await client.delete(`/workspaces/${selectedWorkspace.id}/members/${member.employee_id}`); loadWorkspaceDetail(selectedWorkspace.id); }
    catch (err) { alert(err.response?.data?.error || 'Failed to remove'); }
  };

  const getRoleColor = (role) => role === 'owner' ? 'primary' : role === 'editor' ? 'success' : role === 'viewer' ? 'info' : 'default';

const openWorkspaceChat = (workspaceId) => {
  window.location.href = `/workspaces/${workspaceId}/chat`;
};

  if (!staff.employee_id) {
    return <Box sx={{ textAlign: 'center', py: 8 }}><Typography variant="h5" color="text.secondary">No employee record linked</Typography></Box>;
  }

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Workspaces</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Team spaces for docs, notes & collaboration</Typography>
      </MobilePageHeader>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreateWorkspace}>
          New Workspace
        </MobileButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {selectedWorkspace ? (
        <WorkspaceDetail
          workspace={selectedWorkspace}
          members={members}
          docs={docs}
          employees={employees}
          loading={loading}
          onBack={() => setSelectedWorkspace(null)}
          onAddMember={openAddMember}
          onCreateDoc={openCreateDoc}
          onEditDoc={openEditDoc}
          onDeleteDoc={handleDeleteDoc}
          onRemoveMember={handleRemoveMember}
          docDialog={docDialog}
          setDocDialog={setDocDialog}
          editingDoc={editingDoc}
          docForm={docForm}
          setDocForm={setDocForm}
          docSaving={docSaving}
          handleDocSave={handleDocSave}
          memberDialog={memberDialog}
          setMemberDialog={setMemberDialog}
          memberForm={memberForm}
          setMemberForm={setMemberForm}
          memberSaving={memberSaving}
          handleAddMember={handleAddMember}
          getRoleColor={getRoleColor}
        />
      ) : (
        <MobilePaper>
          {workspaces.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>No Workspaces Yet</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Create a workspace to start collaborating with your team.
              </Typography>
              <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreateWorkspace} sx={{ mt: 2 }}>
                Create Workspace
              </MobileButton>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {workspaces.map((ws) => (
                <Grid item xs={12} sm={6} lg={4} key={ws.id}>
                  <MobilePaper sx={{ height: '100%', p: 2, cursor: 'pointer' }} onClick={() => handleWorkspaceClick(ws)}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{ws.name}</Typography>
                      <Chip size="small" label={ws.my_role} color={getRoleColor(ws.my_role)} variant="outlined" />
                    </Box>
                    {ws.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ws.description}</Typography>}
                    <Divider sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', gap: 2, fontSize: '0.75rem', color: 'text.secondary' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PeopleIcon fontSize="16" /> {ws.member_count || 0} members</Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><DescriptionIcon fontSize="16" /> {ws.doc_count || 0} docs</Box>
                    </Box>
                    {ws.department_name && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        {ws.department_name} {ws.team_name && `· ${ws.team_name}`}
                      </Typography>
                    )}
                  </MobilePaper>
                </Grid>
              ))}
            </Grid>
          )}
        </MobilePaper>
      )}

      <MobileDialog open={wsDialog} onClose={closeWsDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingWs ? 'Edit Workspace' : 'New Workspace'}</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField fullWidth label="Name" value={wsForm.name} onChange={(e) => setWsForm({ ...wsForm, name: e.target.value })} required />
            <TextField fullWidth multiline rows={3} label="Description" value={wsForm.description} onChange={(e) => setWsForm({ ...wsForm, description: e.target.value })} sx={{ mt: 1 }} />
            <MobileTextField select label="Department (optional)" value={wsForm.department_id} onChange={(e) => setWsForm({ ...wsForm, department_id: e.target.value })} options={departments.map(d => ({ value: d.id, label: d.name }))} />
            <MobileTextField select label="Team (optional)" value={wsForm.team_id} onChange={(e) => setWsForm({ ...wsForm, team_id: e.target.value })} options={teams.map(t => ({ value: t.id, label: t.name }))} />
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" id="is_public" checked={wsForm.is_public} onChange={(e) => setWsForm({ ...wsForm, is_public: e.target.checked })} />
              <label htmlFor="is_public" style={{ marginLeft: 8 }}>Public (visible to all employees)</label>
            </Box>
          </MobileFormGrid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={closeWsDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleWsSave} disabled={wsSaving}>
            {wsSaving ? 'Saving…' : editingWs ? 'Save Changes' : 'Create Workspace'}
          </Button>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={docDialog} onClose={closeDocDialog} maxWidth="lg" fullWidth>
        <DialogTitle>{editingDoc ? 'Edit Document' : 'New Document'}</DialogTitle>
        <DialogContent>
          <MobileTextField fullWidth label="Title" value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} required />
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">Content (Markdown supported)</Typography>
            <TextareaAutosize
              fullWidth
              rows={15}
              value={docForm.content}
              onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
              placeholder="Start writing... # Heading\n## Subheading\n- Bullet points\n**Bold** *Italic*"
              style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 1.6 }}
            />
          </Box>
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={closeDocDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleDocSave} disabled={docSaving}>
            {docSaving ? 'Saving…' : editingDoc ? 'Save Changes' : 'Create Document'}
          </Button>
        </MobileActionButtons>
      </MobileDialog>

      <MobileDialog open={memberDialog} onClose={() => setMemberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Member</DialogTitle>
        <DialogContent>
          <MobileFormGrid>
            <MobileTextField
              select label="Employee" value={memberForm.employee_id}
              onChange={(e) => setMemberForm({ ...memberForm, employee_id: e.target.value })}
              options={employees.map(e => ({ value: e.id, label: `${e.full_name} (${e.employee_code})` }))}
              required
            />
            <MobileTextField
              select label="Role" value={memberForm.role}
              onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
              options={[
                { value: 'viewer', label: 'Viewer (read only)' },
                { value: 'editor', label: 'Editor (read/write)' },
                { value: 'owner', label: 'Owner (full access)' },
              ]}
            />
          </MobileFormGrid>
        </DialogContent>
        <MobileActionButtons>
          <Button onClick={() => setMemberDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember} disabled={memberSaving || !memberForm.employee_id}>
            {memberSaving ? 'Adding…' : 'Add Member'}
          </Button>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}

function WorkspaceDetail({
  workspace, members, docs, employees, loading,
  onBack, onAddMember, onCreateDoc, onEditDoc, onDeleteDoc, onRemoveMember,
  docDialog, setDocDialog, editingDoc, docForm, setDocForm, docSaving, handleDocSave,
  memberDialog, setMemberDialog, memberForm, setMemberForm, memberSaving, handleAddMember,
  getRoleColor,
}) {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const canEdit = ['owner', 'editor'].includes(workspace.my_role);
  const isOwner = workspace.my_role === 'owner';

  return (
    <Box>
      <MobilePaper sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <MobileButton variant="text" size="small" startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 1 }}>
              Back to Workspaces
            </MobileButton>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{workspace.name}</Typography>
            {workspace.description && <Typography variant="body2" color="text.secondary">{workspace.description}</Typography>}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {canEdit && (
              <MobileButton variant="contained" startIcon={<DescriptionIcon />} onClick={onCreateDoc}>
                New Doc
              </MobileButton>
            )}
            <MobileButton variant="contained" startIcon={<ChatIcon />} onClick={() => openWorkspaceChat(workspace.id)}>
              Chat
            </MobileButton>
            {isOwner && (
              <MobileButton variant="outlined" startIcon={<PersonAddIcon />} onClick={onAddMember}>
                Add Member
              </MobileButton>
            )}
            <MobileButton variant="outlined" startIcon={<ShareIcon />} onClick={() => navigator.share?.({ title: workspace.name, text: `Check out this workspace: ${workspace.name}` })}>
              Share
            </MobileButton>
          </Box>
        </Box>
      </MobilePaper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : docs.length === 0 ? (
        <MobilePaper sx={{ textAlign: 'center', py: 6 }}>
          <DescriptionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No Documents Yet</Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {canEdit ? 'Create your first document to start collaborating.' : 'Documents will appear here when members create them.'}
          </Typography>
          {canEdit && (
            <MobileButton variant="contained" startIcon={<AddIcon />} onClick={onCreateDoc} sx={{ mt: 2 }}>
              Create Document
            </MobileButton>
          )}
        </MobilePaper>
      ) : (
        <MobilePaper>
          <List>
            {docs.map((doc) => (
              <ListItem key={doc.id} divider onClick={() => onEditDoc(doc)} sx={{ cursor: 'pointer' }}>
                <ListItemIcon>
                  <DescriptionIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body1" sx={{ fontWeight: 500 }}>{doc.title}</Typography>}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        v{doc.version} • {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        by {doc.created_by_name || 'Unknown'}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditDoc(doc); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {isOwner && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="More">
                    <IconButton size="small"><MoreVertIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </MobilePaper>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>Members ({members.length})</Typography>
      <List>
        {members.map((m) => (
          <ListItem key={m.employee_id} divider>
            <ListItemIcon>
              <Avatar sx={{ width: 36, height: 36 }}>
                {m.full_name?.charAt(0)?.toUpperCase()}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body1" sx={{ fontWeight: 500 }}>{m.full_name}</Typography>}
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{m.work_email}</Typography>
                  <Chip size="small" label={m.role} color={getRoleColor(m.role)} />
                </Box>
              }
            />
            {isOwner && m.employee_id !== staff.employee_id && (
              <ListItemSecondaryAction>
                <Tooltip title="Remove">
                  <IconButton size="small" color="error" onClick={() => onRemoveMember(m)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );
}