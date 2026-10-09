import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Tabs, Tab,
  Accordion, AccordionSummary, AccordionDetails, LinearProgress, CircularProgress, Divider
} from '@mui/material';
import Money from '../components/Money';
import StatusChip from '../components/StatusChip';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileDialog,
  MobileActionButtons,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function FinanceSelfService() {
  const { staff } = useAuth();
  const isMobile = useMobile();
  const [payslips, setPayslips] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({ annual: 0, sick: 0 });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [taxInfo, setTaxInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    if (!staff.employee_id) return;
    setLoading(true);
    try {
      const [payslipRes, leaveRes, leaveTypesRes, empRes] = await Promise.all([
        client.get('/payroll/me/payslips'),
        client.get('/employees/me/leave'),
        client.get('/employees/leave-types'),
        client.get('/employees/me'),
      ]);
      setPayslips(payslipRes.data.payslips);
      setLeaveRequests(leaveRes.data.leaveRequests);
      setLeaveTypes(leaveTypesRes.data.leaveTypes);
      setLeaveBalances({
        annual: empRes.data.employee.leave_balance_annual || 0,
        sick: empRes.data.employee.leave_balance_sick || 0,
      });

      // Fetch tax info from payroll items
      if (payslipRes.data.payslips.length > 0) {
        const latest = payslipRes.data.payslips[0];
        const { data: detail } = await client.get(`/payroll/runs/${latest.payroll_run_id}/items/${latest.id}`);
        setTaxInfo({
          pf_deduction: detail.pf_deduction,
          esic_deduction: detail.esic_employee_deduction,
          professional_tax: detail.professional_tax,
          tds_deduction: detail.tds_deduction,
          epf_employer: detail.epf_employer_contribution,
          esic_employer: detail.esic_employer_contribution,
        });
      }
    } catch (err) {
      console.error('Finance self-service load error:', err);
      setError('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, [staff.employee_id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDownloadPayslip = async (payslip) => {
    try {
      const { data } = await client.get(`/payroll/me/payslips/${payslip.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip-${MONTHS[payslip.month - 1]}-${payslip.year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Download failed');
    }
  };

  if (!staff.employee_id) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary">No employee record linked</Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Please contact HR to link your account to an employee record.
        </Typography>
      </Box>
    );
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>My Finance</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Payslips, tax deductions, leave balances & more
        </Typography>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Current Month Gross</Typography>
            {payslips[0] && <Money amount={payslips[0].gross_pay} size="1.5rem" />}
          </MobilePaper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Current Month Net</Typography>
            {payslips[0] && <Money amount={payslips[0].net_pay} size="1.5rem" />}
          </MobilePaper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Annual Leave Balance</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{leaveBalances.annual} days</Typography>
          </MobilePaper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MobilePaper sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Sick Leave Balance</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{leaveBalances.sick} days</Typography>
          </MobilePaper>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" sx={{ mb: 3 }}>
        <Tab label="Payslips" />
        <Tab label="Tax Details" />
        <Tab label="Leave" />
        <Tab label="Compliance" />
      </Tabs>

      {/* PAYSLIPS TAB */}
      {tab === 0 && (
        <MobilePaper>
          {payslips.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>No Payslips Yet</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Payslips will appear here once payroll is processed.
              </Typography>
            </Box>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Gross</TableCell>
                    <TableCell align="right">Net</TableCell>
                    <TableCell align="right">LOP Days</TableCell>
                    <TableCell align="right">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payslips.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                      <TableCell align="right"><Money amount={p.gross_pay} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
                      <TableCell align="right"><Money amount={p.net_pay} size={isMobile ? '0.75rem' : '0.875rem'} /></TableCell>
                      <TableCell align="right" className="figure">{p.loss_of_pay_days}</TableCell>
                      <TableCell align="right"><StatusChip status={p.run_status} /></TableCell>
                      <TableCell align="right">
                        <MobileButton size="small" startIcon={<DownloadIcon fontSize="small" />} onClick={() => handleDownloadPayslip(p)}>
                          Download
                        </MobileButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </MobilePaper>
      )}

      {/* TAX DETAILS TAB */}
      {tab === 1 && (
        <MobilePaper>
          {taxInfo ? (
            <>
              <Typography variant="h6" sx={{ mb: 2 }}>Employee Deductions (Latest Month)</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">PF (Employee)</Typography>
                    <Money amount={taxInfo.pf_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">ESIC (Employee)</Typography>
                    <Money amount={taxInfo.esic_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">Professional Tax</Typography>
                    <Money amount={taxInfo.professional_tax} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">TDS (Sec 192)</Typography>
                    <Money amount={taxInfo.tds_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Employer Contributions</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">PF (Employer)</Typography>
                    <Money amount={taxInfo.epf_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">ESIC (Employer)</Typography>
                    <Money amount={taxInfo.esic_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Tax Regime & Declarations</Typography>
              <MobilePaper sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Tax Regime</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>New Regime (Default)</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">PAN</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>Available on profile</Typography>
                  </Grid>
                </Grid>
              </MobilePaper>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">No Tax Data Available</Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Tax details will appear after your first payroll run.
              </Typography>
            </Box>
          )}
        </MobilePaper>
      )}

      {/* LEAVE TAB */}
      {tab === 2 && (
        <>
          <MobilePaper sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Leave Balances</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <MobilePaper sx={{ p: 2, border: '1px solid', borderColor: 'primary.main' }}>
                  <Typography variant="caption" color="text.secondary">Annual Leave</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{leaveBalances.annual} days</Typography>
                </MobilePaper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <MobilePaper sx={{ p: 2, border: '1px solid', borderColor: 'success.main' }}>
                  <Typography variant="caption" color="text.secondary">Sick Leave</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{leaveBalances.sick} days</Typography>
                </MobilePaper>
              </Grid>
            </Grid>
          </MobilePaper>

          <MobilePaper>
            <Typography variant="h6" sx={{ mb: 2 }}>Leave History</Typography>
            {leaveRequests.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No leave requests yet</Typography>
            ) : (
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveRequests.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.leave_type_name}</TableCell>
                        <TableCell className="figure">{l.start_date?.slice(0, 10)}</TableCell>
                        <TableCell className="figure">{l.end_date?.slice(0, 10)}</TableCell>
                        <TableCell className="figure">{l.num_days}</TableCell>
                        <TableCell><StatusChip status={l.status} /></TableCell>
                        <TableCell>{l.reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            )}
          </MobilePaper>
        </>
      )}

      {/* COMPLIANCE TAB */}
      {tab === 3 && (
        <MobilePaper>
          <Typography variant="h6" sx={{ mb: 2 }}>Compliance & Contributions</Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Provident Fund (EPF)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">Employee Contribution (12% of Basic+DA)</Typography>
                    <Money amount={taxInfo?.pf_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">Employer Contribution (12% of Basic+DA)</Typography>
                    <Money amount={taxInfo?.epf_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                PF is deducted from Basic + DA. Employer also contributes 12%. The total goes to your EPF account.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Employee State Insurance (ESIC)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">Employee Contribution (0.75% of Gross)</Typography>
                    <Money amount={taxInfo?.esic_deduction} size="1.25rem" />
                  </MobilePaper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MobilePaper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">Employer Contribution (3.25% of Gross)</Typography>
                    <Money amount={taxInfo?.esic_employer} size="1.25rem" />
                  </MobilePaper>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                ESIC applies when gross monthly salary ≤ ₹21,000. Provides medical, sickness, maternity & disability benefits.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Professional Tax (PT)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <MobilePaper sx={{ p: 2 }}>
                <Money amount={taxInfo?.professional_tax} size="1.5rem" />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  State-specific tax deducted monthly. Varies by state and income slab.
                </Typography>
              </MobilePaper>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Tax Deducted at Source (TDS)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <MobilePaper sx={{ p: 2 }}>
                <Money amount={taxInfo?.tds_deduction} size="1.5rem" />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Calculated under Section 192 based on estimated annual taxable income and declared deductions.
                </Typography>
              </MobilePaper>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary">
            For detailed Form 16, investment declarations, or tax planning assistance, contact the Finance/HR team.
          </Typography>
        </MobilePaper>
      )}
    </Box>
  );
}