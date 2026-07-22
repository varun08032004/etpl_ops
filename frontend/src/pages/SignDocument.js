import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert, Divider } from '@mui/material';
import client from '../api/client';

export default function SignDocument() {
  const { token } = useParams();
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState('');
  const [signedName, setSignedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // 'signed' | 'declined'
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    client.get(`/esignatures/sign/${token}`)
      .then(({ data }) => setSigner(data.signer))
      .catch((err) => setError(err.response?.data?.error || 'This signing link is invalid or has expired.'));
  }, [token]);

  const submitSign = async () => {
    if (!signedName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await client.post(`/esignatures/sign/${token}`, { signed_name: signedName });
      setDone('signed');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record your signature');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecline = async () => {
    setSubmitting(true);
    setError('');
    try {
      await client.post(`/esignatures/sign/${token}`, { decline: true, decline_reason: declineReason });
      setDone('declined');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record your response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper sx={{ width: 440, p: 4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 3 }}>
          ETPL <Box component="span" sx={{ color: 'primary.main' }}>Ops</Box> — Sign document
        </Typography>

        {error && !signer && <Alert severity="error">{error}</Alert>}

        {signer && !done && (
          <>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{signer.title}</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 3 }}>
              Requested of {signer.name}{signer.role_label ? ` (${signer.role_label})` : ''}
            </Typography>

            {!declining ? (
              <>
                <Typography sx={{ fontSize: '0.85rem', mb: 1 }}>
                  Type your full legal name below to sign. This records your name, the time, and
                  your IP address as your signature.
                </Typography>
                <TextField fullWidth label="Type your full name" value={signedName} onChange={(e) => setSignedName(e.target.value)} margin="normal" autoFocus />
                {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                <Button fullWidth variant="contained" size="large" sx={{ mt: 2 }} onClick={submitSign} disabled={submitting || !signedName.trim()}>
                  {submitting ? 'Signing…' : 'I agree — Sign'}
                </Button>
                <Button fullWidth color="error" sx={{ mt: 1 }} onClick={() => setDeclining(true)}>I decline to sign</Button>
              </>
            ) : (
              <>
                <TextField fullWidth multiline rows={2} label="Reason (optional)" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} margin="normal" />
                {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                <Button fullWidth variant="contained" color="error" sx={{ mt: 2 }} onClick={submitDecline} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Confirm decline'}
                </Button>
                <Button fullWidth sx={{ mt: 1 }} onClick={() => setDeclining(false)}>Back</Button>
              </>
            )}
          </>
        )}

        {done === 'signed' && (
          <Alert severity="success">Thanks — your signature has been recorded. You can close this page.</Alert>
        )}
        {done === 'declined' && (
          <Alert severity="info">Your decline has been recorded. You can close this page.</Alert>
        )}

        <Divider sx={{ mt: 3, mb: 1.5 }} />
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
          EtherTrack Technologies Private Limited — internal document signing
        </Typography>
      </Paper>
    </Box>
  );
}