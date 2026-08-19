import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Tabs, Tab, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const STATUS_COLOR = { not_started: 'default', in_progress: 'info', filed: 'success' };

function monthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ComplianceCalendar() {
  const isMobile = useMobile();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('history');

  useEffect(() => {
    client.get('/compliance').then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  }, []);

  // Recurring filing history: group by title, count filed vs total
  const history = useMemo(() => {
    const recurring = items.filter((i) => i.recurring_interval);
    const groups = {};
    for (const item of recurring) {
      if (!groups[item.title]) {
        groups[item.title] = { title: item.title, category: item.category, interval: item.recurring_interval, cycles: [] };
      }
      groups[item.title].cycles.push(item);
    }
    return Object.values(groups).map((g) => {
      const filed = g.cycles.filter((c) => c.status === 'filed');
      const pending = g.cycles.filter((c) => c.status !== 'filed').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      const filedSorted = [...filed].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
      return {
        ...g,
        totalCycles: g.cycles.length,
        filedCount: filed.length,
        nextDue: pending[0]?.due_date || null,
        nextStatus: pending[0]?.status || null,
        lastFiled: filedSorted[0]?.due_date || null,
        history: filedSorted,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  // Calendar: group ALL items (recurring + one-off) by due month
  const byMonth = useMemo(() => {
    const groups = {};
    for (const item of items) {
      if (!item.due_date) continue;
      const key = monthKey(item.due_date);
      if (!groups[key]) groups[key] = { key, label: monthLabel(item.due_date), items: [] };
      groups[key].items.push(item);
    }
    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  }, [items]);

  const currentMonthKey = monthKey(new Date().toISOString());

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Recurring Compliance</Typography>
      </MobilePageHeader>
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 3 }}>
        How often each filing recurs, how many times it's been filed, and what's due when.
      </Typography>

      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
          <Tab label="Filing history" value="history" />
          <Tab label="Calendar" value="calendar" />
        </Tabs>
      </MobilePaper>

      {tab === 'history' && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Filing</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Recurs</TableCell>
                  <TableCell>Filed / Total cycles</TableCell>
                  <TableCell>Last filed</TableCell>
                  <TableCell>Next due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.title}>
                    <TableCell sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{h.title}</TableCell>
                    <TableCell><Chip size="small" label={h.category} variant="outlined" /></TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{h.interval.replace('_', ' ')}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                      {h.filedCount} / {h.totalCycles}
                    </TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{h.lastFiled?.slice(0, 10) || '—'}</TableCell>
                    <TableCell className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                      {h.nextDue ? (
                        <>
                          {h.nextDue.slice(0, 10)}
                          <Chip size="small" label={h.nextStatus.replace('_', ' ')} color={STATUS_COLOR[h.nextStatus]} sx={{ ml: 1 }} />
                        </>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!history.length && (
                  <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No recurring filings yet — mark a one-time registration done to generate some.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}

      {tab === 'calendar' && (
        <MobilePaper>
          {byMonth.map((month) => (
            <Accordion key={month.key} defaultExpanded={month.key === currentMonthKey} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>{month.label}</Typography>
                <Typography sx={{ ml: 2, fontSize: '0.8rem', color: 'text.secondary' }}>
                  {month.items.length} item{month.items.length !== 1 ? 's' : ''}
                  {month.key === currentMonthKey ? ' — this month' : ''}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ResponsiveTableContainer>
                  <Table size="small">
                    <TableBody>
                      {month.items
                        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                        .map((item) => (
                          <TableRow key={item.id}>
                            <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{item.due_date?.slice(0, 10)}</TableCell>
                            <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600 }}>{item.title}</TableCell>
                            <TableCell><Chip size="small" label={item.category} variant="outlined" /></TableCell>
                            <TableCell><Chip size="small" label={item.status.replace('_', ' ')} color={STATUS_COLOR[item.status]} /></TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
          {!byMonth.length && <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>No compliance items with due dates yet.</Typography>}
        </MobilePaper>
      )}
    </Box>
  );
}