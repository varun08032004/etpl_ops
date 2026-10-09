import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, List, ListItemButton, ListItemText, ListItemAvatar,
  IconButton, TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Chip, Avatar, Tooltip, Divider,
  CircularProgress, InputAdornment, Popover, Menu, AppBar, Toolbar,
} from '@mui/material';
import {
  Send, AttachFile, Photo, Delete, Edit, MoreVert, Search,
  PersonAdd, EmojiEmotions, CloseOutlined, Reply, ArrowBack,
} from '@mui/icons-material';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { MobileButton, useMobile } from '../components/MobileResponsive';

const EMOJI_CATEGORIES = {
  people: ['👍', '❤️', '😊', '😂', '😭', '🙏', '👏', '🤝', '💪', '🙌', '🤞', '✌️', '🤟', '👋', '🤚', '🖐️', '✋', '🤙', '💅', '🤳'],
  nature: ['🌸', '🌻', '🌲', '🌳', '🌴', '🌵', '🌿', '☘️', '🍀', '🌞', '🌙', '⭐', '🌈', '☁️', '⚡', '❄️', '🔥', '💧', '🌊', '🌪️'],
  food: ['🍎', '🍌', '🍕', '🍔', '🍟', '🌮', '🍜', '🍣', '🍰', '☕', '🍵', '🍺', '🍷', '🥂', '🥤', '🍦', '🍩', '🍪', '🥑', '🥕'],
  activity: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🥋', '🏹', '🎣', '🏂', '⛷️', '🏊', '🚴', '🏃', '🧘', '🎮', '🎯'],
  objects: ['💻', '📱', '🖥️', '⌨️', '🖱️', '💾', '📷', '📸', '📹', '🎥', '🎧', '🔊', '📻', '📺', '🕹️', '💡', '🔦', '🔋', '🪫', '🔌'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '✨', '⚡', '💥', '💫', '⭐', '🌟', '✅', '❌', '❓', '❗', '💯'],
  flags: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇨🇳', '🇮🇳', '🇧🇷', '🇲🇽', '🇷🇺', '🇰🇷', '🇮🇹', '🇪🇸'],
};

const QUICK_REACTIONS = ['👍', '❤️', '😊', '😂', '😭', '🙏', '👏', '🔥', '💯', '🎉'];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diff = new Date() - date;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFullTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkspaceChat({ workspaceId: workspaceIdProp, onClose }) {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const navigate = useNavigate();
  const params = useParams();
  const workspaceId = workspaceIdProp ?? params.workspaceId ?? params.id;

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null); // ID only
  const [convDetail, setConvDetail] = useState(null); // full conversation object
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [attachmentIds, setAttachmentIds] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState('people');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMessage, setMenuMessage] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newConvDialog, setNewConvDialog] = useState(false);
  const [newConvSearch, setNewConvSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRowRef = useRef(null);

  const myEmployeeId = staff?.employee_id;

  const handleClose = () => {
    if (onClose) onClose();
    else navigate(-1);
  };

  // ---------- helpers ----------
  const getOtherMember = useCallback(
    (conv) => conv?.members?.find((m) => m.employee_id !== myEmployeeId),
    [myEmployeeId]
  );

  const getConvName = useCallback(
    (conv) => {
      if (!conv) return '';
      if (conv.type === 'direct') return getOtherMember(conv)?.full_name || 'Unknown';
      return conv.name || '';
    },
    [getOtherMember]
  );

  const isMyMessage = (message) => message.sender_id === staff?.id;

  // ---------- data loading ----------
  const loadConversations = useCallback(async () => {
    try {
      // workspace_id is sent so the backend can scope the list; ignored if unsupported
      const { data } = await client.get('/chat/conversations', {
        params: workspaceId ? { workspace_id: workspaceId } : undefined,
      });
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [workspaceId]);

  const loadEmployees = useCallback(async () => {
    try {
      const { data } = await client.get('/employees', { params: { status: 'active' } });
      setEmployees(data.employees || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, []);

  const refreshMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const { data } = await client.get(`/chat/conversations/${conversationId}`);
      setConvDetail(data.conversation);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const saveDraft = useCallback(async (conversationId, content, ids = []) => {
    try {
      await client.put(`/chat/conversations/${conversationId}/draft`, {
        content,
        attachment_ids: ids,
      });
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load a conversation (messages + draft) whenever the selected ID changes
  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setNewMessage('');
    setAttachmentIds([]);

    if (!selectedConvId) {
      setMessages([]);
      setConvDetail(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshMessages(selectedConvId);
      try {
        const { data } = await client.get(`/chat/conversations/${selectedConvId}/draft`);
        if (!cancelled && data.draft) {
          setNewMessage(data.draft.content || '');
          setAttachmentIds(data.draft.attachment_ids || []);
        }
      } catch (err) {
        // no draft is fine
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedConvId, refreshMessages]);

  // Auto-save draft
  useEffect(() => {
    if (!selectedConvId || editingMessage) return undefined;
    if (!newMessage && !attachmentIds.length) return undefined;
    const timer = setTimeout(() => saveDraft(selectedConvId, newMessage, attachmentIds), 1000);
    return () => clearTimeout(timer);
  }, [newMessage, attachmentIds, selectedConvId, editingMessage, saveDraft]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load employees when the new-conversation dialog opens
  useEffect(() => {
    if (newConvDialog) loadEmployees();
  }, [newConvDialog, loadEmployees]);

  // ---------- actions ----------
  const handleConversationClick = (conv) => {
    setSelectedConvId(conv.id);
  };

  const handleSendMessage = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedConvId || sending) return;
    const text = newMessage.trim();
    if (!text && !attachmentIds.length) return;

    setSending(true);
    try {
      if (editingMessage) {
        await client.put(`/chat/messages/${editingMessage.id}`, { content: text });
        setEditingMessage(null);
      } else {
        await client.post('/chat/messages', {
          conversation_id: selectedConvId,
          content: text || null,
          attachment_ids: attachmentIds,
          reply_to_id: replyingTo?.id || undefined,
        });
        saveDraft(selectedConvId, '', []);
      }
      setNewMessage('');
      setAttachmentIds([]);
      setReplyingTo(null);
      await refreshMessages(selectedConvId);
      loadConversations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleUnsendMessage = async (messageId) => {
    if (!window.confirm('Unsend this message?')) return;
    try {
      await client.delete(`/chat/messages/${messageId}`);
      await refreshMessages(selectedConvId);
      loadConversations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unsend message');
    }
  };

  const handleReact = async (messageId, emoji) => {
    try {
      await client.post(`/chat/messages/${messageId}/reactions`, { emoji });
      refreshMessages(selectedConvId);
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      await client.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      refreshMessages(selectedConvId);
    } catch (err) {
      console.error('Failed to remove reaction:', err);
    }
  };

  const handleOpenDirect = async (employeeId) => {
    try {
      const { data } = await client.post('/chat/conversations/direct', { other_employee_id: employeeId });
      setNewConvDialog(false);
      setNewConvSearch('');
      await loadConversations();
      setSelectedConvId(data.conversation.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start conversation');
    }
  };

  const handleFileUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const newIds = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await client.post('/chat/attachments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newIds.push(data.attachment.id);
      }
      setAttachmentIds((prev) => [...prev, ...newIds]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
  };

  const handleMessageMenu = (event, msg) => {
    event.stopPropagation();
    setMenuMessage(msg);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuMessage(null);
  };

  const startReply = () => {
    setEditingMessage(null);
    setReplyingTo(menuMessage);
    handleMenuClose();
  };

  const startEdit = () => {
    setReplyingTo(null);
    setEditingMessage(menuMessage);
    setNewMessage(menuMessage?.content || '');
    handleMenuClose();
  };

  const cancelEditOrReply = () => {
    if (editingMessage) setNewMessage('');
    setEditingMessage(null);
    setReplyingTo(null);
  };

  const conversationPreview = (conv) => {
    const last = conv.last_message;
    if (!last) return 'No messages yet';
    const who = last.sender_id === staff?.id ? 'You: ' : last.sender_name ? `${last.sender_name}: ` : '';
    if (last.is_deleted) return `${who}[Message unsent]`;
    if (last.message_type === 'image') return `${who}📷 Image`;
    if (last.message_type === 'file') return `${who}📎 File`;
    return `${who}${last.content || ''}`;
  };

  // ---------- guards ----------
  if (!myEmployeeId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary">No employee record linked</Typography>
      </Box>
    );
  }

  const filteredConversations = conversations.filter((c) =>
    getConvName(c).toLowerCase().includes(search.toLowerCase())
  );

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.id !== myEmployeeId &&
      `${emp.full_name || ''} ${emp.employee_code || ''}`.toLowerCase().includes(newConvSearch.toLowerCase())
  );

  const showSidebar = !isMobile || !selectedConvId;
  const showChat = !isMobile || !!selectedConvId;
  const canSend = !sending && (newMessage.trim() || attachmentIds.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handleClose} edge="start" color="inherit" aria-label="Close chat">
              <CloseOutlined />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {convDetail && !isMobile ? getConvName(convDetail) : 'Messages'}
            </Typography>
          </Box>
          <Tooltip title="New direct message">
            <IconButton onClick={() => setNewConvDialog(true)} color="inherit">
              <PersonAdd />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Conversations sidebar */}
        {showSidebar && (
          <Box
            sx={{
              width: isMobile ? '100%' : 380,
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {filteredConversations.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                  <Typography variant="body1" color="text.secondary">
                    {conversations.length === 0
                      ? 'No conversations yet. Start a new direct message.'
                      : 'No conversations match your search.'}
                  </Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {filteredConversations.map((conv) => {
                    const displayName = getConvName(conv);
                    return (
                      <ListItemButton
                        key={conv.id}
                        selected={selectedConvId === conv.id}
                        onClick={() => handleConversationClick(conv)}
                        sx={{ px: 1.5, py: 1 }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: conv.type === 'direct' ? 'primary.main' : 'secondary.main',
                            }}
                          >
                            {displayName.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                {displayName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                {formatTime(conv.last_message?.created_at || conv.updated_at)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ fontStyle: conv.last_message?.is_deleted ? 'italic' : 'normal' }}
                              >
                                {conversationPreview(conv)}
                              </Typography>
                              {conv.unread_count > 0 && (
                                <Chip
                                  size="small"
                                  color="error"
                                  label={conv.unread_count}
                                  sx={{ height: 18, fontSize: '0.7rem', flexShrink: 0 }}
                                />
                              )}
                            </Box>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>

            <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <MobileButton variant="outlined" fullWidth startIcon={<PersonAdd />} onClick={() => setNewConvDialog(true)}>
                New Conversation
              </MobileButton>
            </Box>
          </Box>
        )}

        {/* Chat area */}
        {showChat && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, bgcolor: 'background.default' }}>
            {selectedConvId ? (
              <>
                {/* Conversation header */}
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {isMobile && (
                      <IconButton edge="start" onClick={() => setSelectedConvId(null)} aria-label="Back to conversations">
                        <ArrowBack />
                      </IconButton>
                    )}
                    <Avatar
                      sx={{
                        width: 44,
                        height: 44,
                        bgcolor: convDetail?.type === 'direct' ? 'primary.main' : 'secondary.main',
                      }}
                    >
                      {getConvName(convDetail).charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
                        {getConvName(convDetail)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {convDetail?.type === 'direct'
                          ? 'Direct message'
                          : `${convDetail?.members?.length || 0} members`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Messages */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : messages.length === 0 ? (
                    <Box
                      sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'text.secondary',
                      }}
                    >
                      <Typography variant="h6" gutterBottom>No messages yet</Typography>
                      <Typography variant="body1">Start the conversation!</Typography>
                    </Box>
                  ) : (
                    messages.map((msg) => {
                      const isMine = isMyMessage(msg);
                      const hasReactions = msg.reactions && msg.reactions.length > 0;

                      return (
                        <Box
                          key={msg.id}
                          sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 1 }}
                        >
                          <Box
                            sx={{
                              maxWidth: '75%',
                              bgcolor: isMine ? 'primary.main' : 'background.paper',
                              borderRadius: isMine ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                              px: 1.5,
                              py: 0.75,
                              color: isMine ? 'primary.contrastText' : 'text.primary',
                              boxShadow: 1,
                            }}
                          >
                            {!isMine && (
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', color: 'text.secondary', mb: 0.25, pl: 0.5 }}
                              >
                                {msg.sender_name}
                              </Typography>
                            )}

                            {msg.reply_to_id && msg.reply_preview && (
                              <Box
                                sx={{
                                  bgcolor: isMine ? 'rgba(0,0,0,0.15)' : 'action.hover',
                                  borderRadius: 1,
                                  px: 1,
                                  py: 0.5,
                                  mb: 0.5,
                                  opacity: 0.9,
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                  {msg.reply_preview.sender_name}
                                </Typography>
                                <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                                  {msg.reply_preview.content}
                                </Typography>
                              </Box>
                            )}

                            {msg.is_deleted ? (
                              <Typography
                                variant="body2"
                                sx={{ fontStyle: 'italic', opacity: 0.7 }}
                              >
                                [Message unsent]
                              </Typography>
                            ) : msg.message_type === 'image' && msg.attachments?.length ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {msg.attachments.map((att) => (
                                  <Box key={att.id} sx={{ borderRadius: 1, overflow: 'hidden' }}>
                                    <img
                                      src={`/api/chat/attachments/${att.id}/download`}
                                      alt={att.file_name}
                                      style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 4 }}
                                    />
                                  </Box>
                                ))}
                                {msg.content && (
                                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                    {msg.content}
                                  </Typography>
                                )}
                              </Box>
                            ) : msg.message_type === 'file' && msg.attachments?.length ? (
                              <Box>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    p: 1,
                                    bgcolor: isMine ? 'rgba(0,0,0,0.15)' : 'action.hover',
                                    borderRadius: 1,
                                  }}
                                >
                                  <AttachFile fontSize="small" sx={{ color: isMine ? 'common.white' : 'primary.main' }} />
                                  <Box>
                                    {msg.attachments.map((att) => (
                                      <Typography key={att.id} variant="body2">
                                        {att.file_name} ({(att.file_size / 1024).toFixed(1)} KB)
                                      </Typography>
                                    ))}
                                  </Box>
                                </Box>
                                {msg.content && (
                                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                    {msg.content}
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.content}
                              </Typography>
                            )}

                            {msg.is_edited && !msg.is_deleted && (
                              <Typography variant="caption" sx={{ display: 'block', opacity: 0.6, textAlign: 'right' }}>
                                Edited
                              </Typography>
                            )}

                            {hasReactions && (
                              <Box sx={{ display: 'flex', gap: 0.25, mt: 0.5, flexWrap: 'wrap' }}>
                                {msg.reactions.map((r) => (
                                  <Tooltip key={r.emoji} title={`${r.count}${r.me ? ' (you)' : ''}`}>
                                    <Chip
                                      size="small"
                                      label={`${r.emoji} ${r.count || ''}`}
                                      variant="outlined"
                                      color={r.me ? 'primary' : 'default'}
                                      onClick={() =>
                                        r.me ? handleRemoveReaction(msg.id, r.emoji) : handleReact(msg.id, r.emoji)
                                      }
                                      sx={{
                                        cursor: 'pointer',
                                        height: 24,
                                        fontSize: '0.7rem',
                                        bgcolor: 'background.paper',
                                      }}
                                    />
                                  </Tooltip>
                                ))}
                              </Box>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                              <Tooltip title={formatFullTime(msg.created_at)}>
                                <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.65rem' }}>
                                  {formatTime(msg.created_at)}
                                </Typography>
                              </Tooltip>
                              {!msg.is_deleted && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMessageMenu(e, msg)}
                                  sx={{ p: 0, color: 'inherit' }}
                                  aria-label="Message options"
                                >
                                  <MoreVert fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                  <Box ref={messagesEndRef} />
                </Box>

                {/* Message input */}
                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                  {(replyingTo || editingMessage) && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        px: 1.5,
                        py: 0.5,
                        mb: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {editingMessage ? 'Editing message' : `Replying to ${replyingTo.sender_name || 'message'}`}
                        </Typography>
                        {replyingTo && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {replyingTo.content}
                          </Typography>
                        )}
                      </Box>
                      <IconButton size="small" onClick={cancelEditOrReply} aria-label="Cancel">
                        <CloseOutlined fontSize="small" />
                      </IconButton>
                    </Box>
                  )}

                  {attachmentIds.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {attachmentIds.map((aid) => (
                        <Chip
                          key={aid}
                          label={`Attachment ${aid}`}
                          size="small"
                          onDelete={() => handleRemoveAttachment(aid)}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}

                  <Box ref={inputRowRef} sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
                    <Tooltip title="Attach file">
                      <span>
                        <IconButton component="label" disabled={uploading || !!editingMessage}>
                          <AttachFile />
                          <input
                            type="file"
                            multiple
                            hidden
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={(e) => {
                              handleFileUpload(Array.from(e.target.files));
                              e.target.value = '';
                            }}
                          />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Add image">
                      <span>
                        <IconButton component="label" disabled={uploading || !!editingMessage}>
                          <Photo />
                          <input
                            type="file"
                            multiple
                            hidden
                            accept="image/*"
                            onChange={(e) => {
                              handleFileUpload(Array.from(e.target.files));
                              e.target.value = '';
                            }}
                          />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Emoji">
                      <IconButton onClick={() => setShowEmojiPicker((v) => !v)}>
                        <EmojiEmotions />
                      </IconButton>
                    </Tooltip>

                    <TextField
                      fullWidth
                      multiline
                      maxRows={5}
                      size="small"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      disabled={sending}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 6 } }}
                    />

                    <Tooltip title={editingMessage ? 'Save' : 'Send'}>
                      <span>
                        <IconButton color="primary" onClick={handleSendMessage} disabled={!canSend}>
                          {sending ? <CircularProgress size={20} color="inherit" /> : <Send />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Emoji picker */}
                <Popover
                  open={showEmojiPicker}
                  anchorEl={inputRowRef.current}
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  onClose={() => setShowEmojiPicker(false)}
                >
                  <Box sx={{ p: 1, maxWidth: 350 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, overflowX: 'auto', pb: 1 }}>
                      {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                        <Button
                          key={cat}
                          size="small"
                          variant={emojiCategory === cat ? 'contained' : 'outlined'}
                          onClick={() => setEmojiCategory(cat)}
                          sx={{ flexShrink: 0 }}
                        >
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </Button>
                      ))}
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, maxHeight: 250, overflowY: 'auto' }}>
                      {EMOJI_CATEGORIES[emojiCategory].map((emoji, idx) => (
                        <Button
                          key={`${emoji}-${idx}`}
                          size="small"
                          variant="text"
                          onClick={() => {
                            setNewMessage((prev) => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          sx={{ fontSize: '1.5rem', minWidth: 40, height: 40 }}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                </Popover>

                {/* Message menu */}
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={handleMenuClose}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  <Box sx={{ display: 'flex', gap: 0.25, px: 1, py: 0.5, maxWidth: 260, flexWrap: 'wrap' }}>
                    {QUICK_REACTIONS.map((emoji) => (
                      <IconButton
                        key={emoji}
                        size="small"
                        onClick={() => {
                          if (menuMessage) handleReact(menuMessage.id, emoji);
                          handleMenuClose();
                        }}
                        sx={{ fontSize: '1.1rem' }}
                      >
                        {emoji}
                      </IconButton>
                    ))}
                  </Box>
                  <Divider />
                  <MenuItem onClick={startReply}>
                    <Reply fontSize="small" sx={{ mr: 1 }} /> Reply
                  </MenuItem>
                  {menuMessage && isMyMessage(menuMessage) && menuMessage.message_type !== 'image' && menuMessage.message_type !== 'file' && (
                    <MenuItem onClick={startEdit}>
                      <Edit fontSize="small" sx={{ mr: 1 }} /> Edit
                    </MenuItem>
                  )}
                  {menuMessage && isMyMessage(menuMessage) && (
                    <MenuItem
                      onClick={() => {
                        const id = menuMessage.id;
                        handleMenuClose();
                        handleUnsendMessage(id);
                      }}
                      sx={{ color: 'error.main' }}
                    >
                      <Delete fontSize="small" color="error" sx={{ mr: 1 }} /> Unsend
                    </MenuItem>
                  )}
                </Menu>
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  p: 4,
                }}
              >
                <Typography variant="h5" gutterBottom>Select a conversation</Typography>
                <Typography variant="body1">
                  Choose a conversation from the sidebar or start a new one.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Error notice */}
      {error && (
        <Dialog open onClose={() => setError('')} maxWidth="xs" fullWidth>
          <DialogTitle>Something went wrong</DialogTitle>
          <DialogContent>
            <Typography variant="body2">{error}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setError('')}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* New conversation dialog */}
      <Dialog open={newConvDialog} onClose={() => setNewConvDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Conversation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search for an employee to start a direct message
          </Typography>
          <TextField
            fullWidth
            size="small"
            autoFocus
            placeholder="Search employees..."
            value={newConvSearch}
            onChange={(e) => setNewConvSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />
          <List dense sx={{ mt: 1, maxHeight: 320, overflow: 'auto' }}>
            {filteredEmployees.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No employees found
              </Typography>
            ) : (
              filteredEmployees.map((emp) => (
                <ListItemButton key={emp.id} onClick={() => handleOpenDirect(emp.id)}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 36, height: 36 }}>
                      {emp.full_name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={emp.full_name}
                    secondary={emp.employee_code || emp.work_email}
                  />
                </ListItemButton>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewConvDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}