import { useState } from 'react';
import { Box, Typography, Paper, Button, MenuItem, TextField, Alert, List, ListItem, ListItemText } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import client from '../api/client';

const TARGETS = [
  { value: 'employees', label: 'Employees', columns: 'full_name, work_email, date_of_joining, employment_type, department, designation, ctc_annual, basic_monthly, hra_monthly, other_allowances_monthly, phone, city, state, pan_number' },
  { value: 'parties', label: 'Customers / Vendors', columns: 'name, party_type, email, phone, gstin, billing_address, state, payment_terms_days' },
  { value: 'invoices', label: 'Invoices', columns: 'party_name, invoice_date, due_date, description, quantity, unit_price, gst_rate, hsn_sac_code' },
];

export default function Import() {
  const [target, setTarget] = useState('employees');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeTarget = TARGETS.find((t) => t.value === target);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await client.post(`/import/${target}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Import from CSV</Typography>

      <Paper sx={{ p: 3, maxWidth: 640 }}>
        <TextField fullWidth select label="Import into" value={target} onChange={(e) => { setTarget(e.target.value); setResult(null); }} sx={{ mb: 2 }}>
          {TARGETS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>

        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
          Expected columns (first row must be a header with exactly these names):
          <Box component="code" className="figure" sx={{ display: 'block', mt: 0.5, p: 1, bgcolor: 'background.default', borderRadius: 1, fontSize: '0.7rem' }}>
            {activeTarget.columns}
          </Box>
        </Typography>

        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mb: 2 }}>
          {file ? file.name : 'Choose CSV file'}
          <input type="file" accept=".csv" hidden onChange={(e) => setFile(e.target.files[0])} />
        </Button>

        <Box>
          <Button variant="contained" onClick={handleUpload} disabled={!file || loading}>
            {loading ? 'Importing…' : 'Import'}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={result.failed?.length ? 'warning' : 'success'}>
              {result.created ?? result.invoicesCreated ?? 0} imported successfully.
              {result.failed?.length ? ` ${result.failed.length} row(s) failed.` : ''}
            </Alert>
            {result.failed?.length > 0 && (
              <List dense sx={{ mt: 1 }}>
                {result.failed.map((f, i) => (
                  <ListItem key={i} sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={`Row ${f.row ?? ''} — ${f.name || f.party || ''}`}
                      secondary={f.reason}
                      primaryTypographyProps={{ fontSize: '0.8rem' }}
                      secondaryTypographyProps={{ fontSize: '0.75rem', color: 'error.main' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
