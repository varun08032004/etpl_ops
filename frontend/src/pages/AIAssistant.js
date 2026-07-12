import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, TextField, IconButton, Chip, Alert, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import client from '../api/client';

const SUGGESTIONS = [
  'What was our net profit last month?',
  'Which invoices are overdue right now?',
  "What's our current headcount by department?",
  'Summarize the sales pipeline',
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    client.get('/ai/history').then(({ data }) => {
      const hist = [];
      data.history.forEach((h) => {
        hist.push({ role: 'user', text: h.question });
        hist.push({ role: 'assistant', text: h.answer, toolsUsed: h.tools_used });
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
      setMessages((m) => [...m, { role: 'assistant', text: data.answer, toolsUsed: data.toolsUsed }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get a response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>AI Assistant</Typography>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
        Answers questions using your own ledger, HR, payroll, and sales data — not general knowledge.
      </Typography>

      <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
        {!messages.length && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onClick={() => send(s)} clickable variant="outlined" />
            ))}
          </Box>
        )}
        {messages.map((m, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
            <Paper sx={{
              p: 1.5, maxWidth: '75%',
              bgcolor: m.role === 'user' ? 'primary.dark' : 'background.paper',
              color: m.role === 'user' ? '#0a0f0d' : 'text.primary',
            }}>
              <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              {m.toolsUsed?.length > 0 && (
                <Typography sx={{ fontSize: '0.65rem', color: m.role === 'user' ? 'rgba(10,15,13,0.6)' : 'text.secondary', mt: 0.75 }}>
                  Used: {m.toolsUsed.join(', ')}
                </Typography>
              )}
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <CircularProgress size={14} /> <Typography sx={{ fontSize: '0.8rem' }}>Thinking…</Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth placeholder="Ask about spend, invoices, payroll, headcount, pipeline…"
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <IconButton color="primary" onClick={() => send()} disabled={loading || !input.trim()}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}