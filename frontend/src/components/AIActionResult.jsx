import { Box, Typography, Alert, Chip, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export default function AIActionResult({ toolResults, onRetry }) {
  if (!toolResults || !toolResults.length) return null;

  const hasErrors = toolResults.some(r => !r.success);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Tool Execution Results {hasErrors && <Chip label="Errors" size="small" color="error" />}
      </Typography>
      {toolResults.map((result, idx) => (
        <Accordion key={idx} defaultExpanded={!result.success} sx={{ mb: 1 }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`panel-${idx}`}
            id={`panel-${idx}-header`}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {result.success ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
              <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {result.tool}
              </Typography>
              <Chip label={result.success ? 'Success' : 'Failed'} size="small" color={result.success ? 'success' : 'error'} />
              {result.latencyMs && <Typography variant="caption" color="text.secondary">{result.latencyMs}ms</Typography>}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {result.success ? (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Result:</Typography>
                <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(result.result, null, 2)}
                </Box>
              </Box>
            ) : (
              <Box>
                <Alert severity="error" sx={{ mb: 1 }}>
                  <Typography variant="body2">{result.error || 'Unknown error'}</Typography>
                </Alert>
                {onRetry && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Parameters sent:</Typography>
                    <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(result.parameters, null, 2)}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}