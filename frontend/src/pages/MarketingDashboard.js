import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Chip, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import client from '../api/client';
import Money from '../components/Money';
import {
  MobilePaper,
  MobilePageHeader,
  MobileCardGrid,
  MobileButton,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

function formatCount(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function StatCard({ label, value, sub, to }) {
  const isMobile = useMobile();
  return (
    <MobilePaper component={to ? RouterLink : 'div'} to={to} sx={{ display: 'block', textDecoration: 'none', color: 'inherit', height: '100%', '&:hover': to ? { boxShadow: 3 } : {} }}>
      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.78rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: 700 }} className="figure">{value}</Typography>
      {sub && <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mt: 0.5 }}>{sub}</Typography>}
    </MobilePaper>
  );
}

export default function MarketingDashboard() {
  const isMobile = useMobile();
  const [data, setData] = useState(null);

  useEffect(() => {
    client.get('/marketing/dashboard/summary').then(({ data }) => setData(data)).catch(() => setData(null));
  }, []);

  if (!data) {
    return <Box><Typography variant="h5" sx={{ mb: 2 }}>Marketing Dashboard</Typography><Typography color="text.secondary">Loading…</Typography></Box>;
  }

  const { social, campaigns, content, leads, events, press, newsletter, seo, upcomingContent, recentLeads, upcomingEvents } = data;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>Marketing Dashboard</Typography>
      </MobilePageHeader>
      <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary', mb: 3 }}>
        Everything happening across Socials, Campaigns, Content, Leads, Events, Press, Newsletter, and SEO — at a glance.
      </Typography>

      <MobileCardGrid sx={{ mb: 3 }}>
        <StatCard label="Combined followers" value={formatCount(social.followers)} sub={`${social.accounts} active accounts`} to="/marketing/socials" />
        <StatCard label="Active campaigns" value={campaigns.active_count} sub={<><Money amount={campaigns.total_spent} /> spent all-time</>} to="/marketing/campaigns" />
        <StatCard label="New leads" value={leads.new_leads} sub={`${leads.converted} converted · ${leads.total} total`} to="/marketing/leads" />
        <StatCard label="Content in the pipe" value={content.upcoming} sub={`${content.ideas} ideas parked`} to="/marketing/content-calendar" />
      </MobileCardGrid>

      <MobileCardGrid sx={{ mb: 3 }}>
        <StatCard label="Upcoming events" value={events.upcoming} to="/marketing/events" />
        <StatCard label="Press mentions (90d)" value={press.total} to="/marketing/press" />
        <StatCard label="Newsletter subscribers" value={newsletter ? formatCount(newsletter.subscriber_count) : '—'} sub={newsletter ? `as of ${newsletter.snapshot_date?.slice(0, 10)}` : 'No data yet'} to="/marketing/newsletter" />
        <StatCard label="Organic traffic" value={seo ? formatCount(seo.organic_traffic) : '—'} sub={seo ? `as of ${seo.snapshot_date?.slice(0, 10)}` : 'No data yet'} to="/marketing/seo" />
      </MobileCardGrid>

      <MobileStack gap={2} direction="column">
        <MobilePaper sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Upcoming content</Typography>
          <List dense disablePadding>
            {upcomingContent.map((c, i) => (
              <Box key={c.id}>
                <ListItem disableGutters>
                  <ListItemText
                    primary={c.title}
                    secondary={`${c.scheduled_date?.slice(0, 10) || '—'}${c.platform ? ` · ${c.platform}` : ''}`}
                  />
                  <Chip size="small" label={c.status} sx={{ textTransform: 'capitalize' }} />
                </ListItem>
                {i < upcomingContent.length - 1 && <Divider component="li" />}
              </Box>
            ))}
            {!upcomingContent.length && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Nothing scheduled.</Typography>}
          </List>
        </MobilePaper>

        <MobilePaper sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent leads</Typography>
          <List dense disablePadding>
            {recentLeads.map((l, i) => (
              <Box key={l.id}>
                <ListItem disableGutters>
                  <ListItemText
                    primary={l.full_name}
                    secondary={`${l.company_name || l.source} · ${l.received_at?.slice(0, 10) || ''}`}
                  />
                  <Chip size="small" label={l.status} sx={{ textTransform: 'capitalize' }} />
                </ListItem>
                {i < recentLeads.length - 1 && <Divider component="li" />}
              </Box>
            ))}
            {!recentLeads.length && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>No leads yet.</Typography>}
          </List>
        </MobilePaper>

        <MobilePaper>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Upcoming events</Typography>
          <List dense disablePadding>
            {upcomingEvents.map((e, i) => (
              <Box key={e.id}>
                <ListItem disableGutters>
                  <ListItemText
                    primary={e.name}
                    secondary={`${e.start_date?.slice(0, 10) || '—'} · ${e.role}`}
                  />
                </ListItem>
                {i < upcomingEvents.length - 1 && <Divider component="li" />}
              </Box>
            ))}
            {!upcomingEvents.length && <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Nothing on the calendar.</Typography>}
          </List>
        </MobilePaper>
      </MobileStack>
    </Box>
  );
}