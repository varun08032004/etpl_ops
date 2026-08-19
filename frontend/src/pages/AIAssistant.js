import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton, Chip, Alert,
  CircularProgress, Accordion, AccordionSummary, AccordionDetails,
  Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import client from '../api/client';
import AIConfirmationDialog from '../components/AIConfirmationDialog';
import AIActionResult from '../components/AIActionResult';

const SUGGESTIONS = [
  'What is our leave policy?',
  'How do I submit an expense claim?',
  'What are the GST invoice requirements?',
  'What was our net profit last month?',
  'Which invoices are overdue right now?',
  "What's our current headcount by department?",
  'Summarize the sales pipeline',
  'What are the approval limits for expenses?',
  'Add Rahul Sharma as Software Engineer in Finance',
  'Create invoice for Acme Corp',
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationDialog, setConfirmationDialog] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    client.get('/ai/history').then(({ data }) => {
      const hist = [];
      data.history.forEach((h) => {
        hist.push({
          role: 'user',
          text: h.question,
        });
        hist.push({
          role: 'assistant',
          text: h.answer,
          toolsUsed: h.tools_used,
          citations: h.retrieved_chunks || [],
          usedLegacy: h.used_legacy,
          hasSufficientContext: h.has_sufficient_context !== false,
          type: h.intent ? (h.intent === 'knowledge' ? 'knowledge' : h.intent === 'live_data' ? 'live_data' : 'combined') : 'knowledge',
          toolResults: [],
        });
      });
      setMessages(hist);
    }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const { data } = await client.post('/ai/query', { question: q });
      handleResponse(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get a response');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (data) => {
    if (data.type === 'action_confirmation' && data.confirmations) {
      setConfirmationDialog({
        confirmation: data.confirmations[0],
        originalQuestion: data.question || '',
        onConfirm: (confirmationId) => {
          // Re-send with confirmation
          client.post('/ai/confirm/:confirmationId', { question: data.question, tool: data.confirmations[0].tool, parameters: data.confirmations[0].parameters })
            .then(({ data: confirmData }) => handleResponse(confirmData))
            .catch((err) => setError(err.response?.data?.error || 'Confirmation failed'));
        },
        onCancel: () => setConfirmationDialog(null),
      });
    } else {
      setMessages((m) => [...m, {
        role: 'assistant',
        text: data.answer,
        toolsUsed: data.toolsUsed,
        citations: data.citations || [],
        retrievalMetadata: data.retrievalMetadata || [],
        usedLegacy: data.usedLegacy,
        hasSufficientContext: data.hasSufficientContext,
        latencyMs: data.latencyMs,
        model: data.model,
        type: data.type || 'knowledge',
        intent: data.intent,
        toolResults: data.toolResults,
      }]);
    }
  };

  const renderCitations = (citations) => {
    if (!citations?.length) return null;

    return (
      <Box sx={{ mt: 1.5 }}>
        <Divider variant="inset" />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
          Sources ({citations.length})
        </Typography>
        {citations.map((citation, idx) => (
          <Tooltip key={citation.chunkId || idx} title={citation.contentPreview || ''}>
            <Chip
              size="small"
              label={`${citation.citationIndex || idx + 1}. ${citation.documentName}${citation.section ? ` → ${citation.section}` : ''}`}
              variant="outlined"
              sx={{
                cursor: 'help',
                maxWidth: 300,
                '&:hover': { bgcolor: 'action.hover' },
              }}
              icon={<ArticleIcon fontSize="small" />}
            />
          </Tooltip>
        ))}
      </Box>
    );
  };

  const renderInsufficientContext = (message) => {
    if (message.hasSufficientContext !== false) return null;

    return (
      <Alert severity="warning" sx={{ mt: 1, variant: 'filled' }}>
        <WarningIcon sx={{ mr: 1 }} fontSize="small" />
        <Typography variant="body2">
          I don't have enough information in the knowledge base to answer this question.
          {message.usedLegacy && ' (Answered using real-time data tools instead)'}
        </Typography>
      </Alert>
    );
  };

  const renderLegacyTools = (toolsUsed) => {
    if (!toolsUsed?.length) return null;
    return (
      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.75 }}>
        Tools: {toolsUsed.join(', ')}
      </Typography>
    );
  };

  const renderMessageMeta = (message) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, fontSize: '0.6rem', color: 'text.secondary' }}>
      {message.latencyMs && <span>{message.latencyMs}ms</span>}
      {message.contextTokens && <span>• {message.contextTokens} ctx tokens</span>}
      {message.model && <span>• {message.model}</span>}
      {message.usedLegacy && <VerifiedIcon sx={{ fontSize: 12, color: 'warning.main' }} title="Legacy tool-based answer" />}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          AI Assistant
          <Chip
            label={process.env.REACT_APP_USE_RAG === 'false' ? 'Legacy' : 'RAG + Tools'}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          Answers questions using ETPL's internal knowledge base (policies, workflows, compliance, templates)
          {' '}—{' '}not general knowledge. Cites sources for every answer.
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
        {!messages.length && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onClick={() => send(s)} clickable variant="outlined" size="small" />
            ))}
          </Box>
        )}
        {messages.map((m, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
            <Paper sx={{
              p: 1.5, maxWidth: '80%',
              bgcolor: m.role === 'user' ? 'primary.dark' : 'background.paper',
              color: m.role === 'user' ? '#0a0f0d' : 'text.primary',
            }}>
              <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.text}</Typography>
              {renderInsufficientContext(m)}
              {renderCitations(m.citations)}
              {renderLegacyTools(m.toolsUsed)}
              {m.toolResults && <AIActionResult toolResults={m.toolResults} />}
              {renderMessageMeta(m)}
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={18} /> <Typography sx={{ fontSize: '0.85rem' }}>Searching knowledge base & generating answer…</Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          placeholder="Ask about policies, workflows, compliance, invoices, payroll, headcount, pipeline…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={loading}
        />
        <IconButton color="primary" onClick={() => send()} disabled={loading || !input.trim()} size="large">
          <SendIcon />
        </IconButton>
      </Box>

      <AIConfirmationDialog
        open={!!confirmationDialog}
        confirmation={confirmationDialog?.confirmation}
        onConfirm={confirmationDialog?.onConfirm}
        onCancel={confirmationDialog?.onCancel}
      />
    </Box>
  );
}