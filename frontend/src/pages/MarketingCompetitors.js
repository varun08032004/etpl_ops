import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, IconButton, Tooltip, Tabs, Tab, Divider,
  Table, TableHead, TableRow, TableCell, TableBody, LinearProgress, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileFormGrid,
  MobileActionButtons,
  MobileStack,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

const CAP_OPTIONS = ['✅', '❌', '⚠️', 'N'];
const REGION_LABEL = { india: '🇮🇳 India', global: '🌍 Global' };

const emptyForm = {
  company_name: '', region: 'india', is_featured: false, website: '', last_reviewed_date: '', notes: '',
  country: '', hq_city: '', founded: '', funding_verified: '', team_size_verified: '', dev_stage: '', ceo_founders: '', overview_source: '',
  cap_scope1: '', cap_scope2: '', cap_scope3: '', cap_supplier_portal: '', cap_ghg_inventory: '', cap_brsr: '', cap_cdp: '', cap_tcfd: '', cap_ccts: '', cap_audit_trail: '', capability_source_notes: '',
  market_marketplace: '', market_credit_issuance: '', market_trading: '', market_retirement: '', market_registry_integration: '', market_tokenisation: '', market_blockchain_audit: '', market_onchain_settlement: '', market_source_notes: '',
  pricing_model: '', pricing_type: '', est_price_range: '', free_trial: '', implementation_support: '', consulting_support: '', india_presence: '', commercial_source_notes: '',
  target_customer: '', gtm_model: '', key_partners: '', audit_firm_alignment: '', govt_regulatory_alignment: '', investor_backed: '', international_expansion: '', strategic_notes: '',
  customer_count: '', case_studies_published: '', testimonials_reviews: '', known_clients: '', industry_verticals: '', trust_signal: '', customer_proof_source_notes: '',
};

// One entry per Excel sheet — column order matches the source workbook
// exactly (Company first, then left-to-right as it appeared in the sheet).
const VIEW_SECTIONS = [
  {
    label: 'Company Overview',
    columns: [
      { key: 'country', label: 'Country' }, { key: 'hq_city', label: 'HQ City' }, { key: 'founded', label: 'Founded' },
      { key: 'funding_verified', label: 'Funding (Verified)', wide: true }, { key: 'team_size_verified', label: 'Team Size (Verified)', wide: true },
      { key: 'dev_stage', label: 'Dev Stage' }, { key: 'ceo_founders', label: 'CEO / Founders', wide: true }, { key: 'overview_source', label: 'Source', wide: true },
      { key: 'website', label: 'Website', link: true },
    ],
  },
  {
    label: 'Product Capability',
    columns: [
      { key: 'cap_scope1', label: 'Scope 1', cap: true }, { key: 'cap_scope2', label: 'Scope 2', cap: true }, { key: 'cap_scope3', label: 'Scope 3', cap: true },
      { key: 'cap_supplier_portal', label: 'Supplier Portal', cap: true }, { key: 'cap_ghg_inventory', label: 'GHG Inventory', cap: true },
      { key: 'cap_brsr', label: 'BRSR', cap: true }, { key: 'cap_cdp', label: 'CDP', cap: true }, { key: 'cap_tcfd', label: 'TCFD', cap: true },
      { key: 'cap_ccts', label: 'CCTS', cap: true }, { key: 'cap_audit_trail', label: 'Audit Trail', cap: true },
      { key: 'capability_source_notes', label: 'Source Notes', wide: true },
    ],
  },
  {
    label: 'Carbon Market',
    columns: [
      { key: 'market_marketplace', label: 'Marketplace', cap: true }, { key: 'market_credit_issuance', label: 'Credit Issuance', cap: true },
      { key: 'market_trading', label: 'Trading', cap: true }, { key: 'market_retirement', label: 'Retirement', cap: true },
      { key: 'market_registry_integration', label: 'Registry Integration', cap: true }, { key: 'market_tokenisation', label: 'Tokenisation', cap: true },
      { key: 'market_blockchain_audit', label: 'Blockchain Audit', cap: true }, { key: 'market_onchain_settlement', label: 'On-chain Settlement', cap: true },
      { key: 'market_source_notes', label: 'Source Notes', wide: true },
    ],
  },
  {
    label: 'Commercial Analysis',
    columns: [
      { key: 'pricing_model', label: 'Pricing Model' }, { key: 'pricing_type', label: 'Pricing Type' },
      { key: 'est_price_range', label: 'Est. Price Range', wide: true }, { key: 'free_trial', label: 'Free Trial' },
      { key: 'implementation_support', label: 'Implementation Support', wide: true }, { key: 'consulting_support', label: 'Consulting Support', wide: true },
      { key: 'india_presence', label: 'India Presence', wide: true }, { key: 'commercial_source_notes', label: 'Source Notes', wide: true },
    ],
  },
  {
    label: 'Strategic Analysis',
    columns: [
      { key: 'target_customer', label: 'Target Customer', wide: true }, { key: 'gtm_model', label: 'GTM Model', wide: true },
      { key: 'key_partners', label: 'Key Partners', wide: true }, { key: 'audit_firm_alignment', label: 'Audit Firm Alignment', wide: true },
      { key: 'govt_regulatory_alignment', label: 'Govt/Regulatory Alignment', wide: true }, { key: 'investor_backed', label: 'Investor Backed', wide: true },
      { key: 'international_expansion', label: 'International Expansion', wide: true }, { key: 'strategic_notes', label: 'Strategic Notes', wide: true },
    ],
  },
  {
    label: 'Customer Proof',
    columns: [
      { key: 'customer_count', label: 'Customer Count' }, { key: 'case_studies_published', label: 'Case Studies Published', wide: true },
      { key: 'testimonials_reviews', label: 'Testimonials/Reviews', wide: true }, { key: 'known_clients', label: 'Known Clients', wide: true },
      { key: 'industry_verticals', label: 'Industry Verticals', wide: true }, { key: 'trust_signal', label: 'Trust Signal', wide: true },
      { key: 'customer_proof_source_notes', label: 'Source Notes', wide: true },
    ],
  },
];

function CapCell({ value }) {
  const color = value === '✅' ? 'success.main' : value === '⚠️' ? 'warning.main' : value === '❌' ? 'error.main' : 'text.disabled';
  return <Typography component="span" sx={{ color, fontSize: '0.95rem' }}>{value || '—'}</Typography>;
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
        {title}
      </Typography>
      <MobileFormGrid>{children}</MobileFormGrid>
    </Box>
  );
}

export default function MarketingCompetitors() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const [isMarketingHead, setIsMarketingHead] = useState(false);
  // Per request: add/edit/delete allowed for admin, Marketing HOD, and founder (owner) only.
  const canEdit = ['owner', 'admin'].includes(staff?.role) || isMarketingHead;

  const [competitors, setCompetitors] = useState([]);
  const [regionFilter, setRegionFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState(0);
  const [viewTab, setViewTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = regionFilter ? { region: regionFilter } : {};
    client.get('/marketing/competitors', { params })
      .then(({ data }) => setCompetitors(data.competitors))
      .catch(() => setCompetitors([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [regionFilter]);

  useEffect(() => {
    if (['owner', 'admin'].includes(staff?.role)) return;
    client.get('/departments/my-access')
      .then(({ data }) => {
        const dept = data.deptAccess;
        setIsMarketingHead(!!(dept?.isHOD && dept?.departmentName === 'Marketing'));
      })
      .catch(() => setIsMarketingHead(false));
  }, [staff?.role]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setTab(0); setError(''); setOpen(true); };
  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ ...emptyForm, ...c, last_reviewed_date: c.last_reviewed_date?.slice(0, 10) || '' });
    setTab(0);
    setError('');
    setOpen(true);
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingId) await client.put(`/marketing/competitors/${editingId}`, form);
      else await client.post('/marketing/competitors', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.company_name}"? This cannot be undone.`)) return;
    await client.delete(`/marketing/competitors/${c.id}`);
    load();
  };

  const capField = (label, key) => (
    <MobileTextField
      fullWidth
      select
      size="small"
      label={label}
      value={form[key] || ''}
      onChange={set(key)}
      options={[{ value: '', label: '—' }, ...CAP_OPTIONS.map((o) => ({ value: o, label: o }))]}
    >
    </MobileTextField>
  );

  const textField = (label, key, opts = {}) => (
    <MobileTextField
      fullWidth
      size="small"
      label={label}
      value={form[key] || ''}
      onChange={set(key)}
      multiline={opts.multiline}
      rows={opts.multiline ? 2 : undefined}
    >
    </MobileTextField>
  );

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Competitors</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Full competitive intelligence — company overview, product capability, carbon market, commercial, strategic, and customer proof.
          </Typography>
        </Box>
        {canEdit && <MobileButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add competitor</MobileButton>}
      </MobilePageHeader>

      <MobileStack gap={2} direction="row" sx={{ mb: 3, flexWrap: 'wrap' }}>
        <MobileTextField
          select
          size="small"
          label="Filter region"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          options={[
            { value: '', label: 'All regions' },
            { value: 'india', label: '🇮🇳 India' },
            { value: 'global', label: '🌍 Global' },
          ]}
        />
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
          {loading ? 'Loading…' : `${competitors.length} compan${competitors.length === 1 ? 'y' : 'ies'} tracked`}
        </Typography>
      </MobileStack>

      <MobilePaper sx={{ mb: 2 }}>
        <Tabs value={viewTab} onChange={(e, v) => setViewTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, px: 3, py: 1.5 } }}
        >
          {VIEW_SECTIONS.map((s) => <Tab key={s.label} label={s.label} />)}
        </Tabs>
      </MobilePaper>

      <MobilePaper
        variant="outlined"
        sx={{
          width: '100%', overflowX: 'auto', borderRadius: 2,
          '&::-webkit-scrollbar': { height: 12 },
          '&::-webkit-scrollbar-track': { bgcolor: 'action.hover', borderRadius: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'text.disabled', borderRadius: 6, border: '3px solid transparent', backgroundClip: 'content-box' },
          '&::-webkit-scrollbar-thumb:hover': { bgcolor: 'text.secondary' },
          scrollbarWidth: 'auto',
        }}
      >
        {loading && <LinearProgress />}
        <Table sx={{ minWidth: 1400, borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em',
                  position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 3, minWidth: 240,
                  borderRight: '2px solid', borderColor: 'divider', py: 2, px: 2.5,
                }}
              >
                Company
              </TableCell>
              {VIEW_SECTIONS[viewTab].columns.map((col) => (
                <TableCell
                  key={col.key}
                  sx={{
                    fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em',
                    minWidth: col.wide ? 320 : col.cap ? 130 : 190, py: 2, px: 2.5, whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em', py: 2, px: 2.5, minWidth: 130 }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {competitors.map((c, i) => (
              <TableRow key={c.id} hover sx={{ bgcolor: i % 2 === 0 ? 'transparent' : 'action.hover' }}>
                <TableCell
                  sx={{
                    position: 'sticky', left: 0, bgcolor: i % 2 === 0 ? 'background.paper' : 'background.default',
                    zIndex: 2, borderRight: '2px solid', borderColor: 'divider', py: 1.75, px: 2.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {c.is_featured && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                    <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.company_name}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.25 }}>{REGION_LABEL[c.region]}</Typography>
                </TableCell>
                {VIEW_SECTIONS[viewTab].columns.map((col) => (
                  <TableCell
                    key={col.key}
                    sx={{
                      fontSize: '0.8rem', py: 1.75, px: 2.5, lineHeight: 1.6,
                      maxWidth: col.wide ? 380 : 220,
                      ...(col.wide
                        ? { whiteSpace: 'normal', wordBreak: 'break-word' }
                        : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
                    }}
                    title={!col.wide && !col.cap && !col.link ? (c[col.key] || '') : undefined}
                  >
                    {col.cap ? (
                      <CapCell value={c[col.key]} />
                    ) : col.link && c[col.key] ? (
                      <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />} href={c[col.key]} target="_blank" rel="noopener noreferrer" sx={{ p: 0, minWidth: 0, fontSize: '0.78rem' }}>
                        Visit
                      </Button>
                    ) : (c[col.key] || '—')}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ py: 1.75, px: 2.5, whiteSpace: 'nowrap' }}>
                  <MobileButton size="small" onClick={() => openEdit(c)}>{canEdit ? 'Edit' : 'View'}</MobileButton>
                  {canEdit && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(c)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!competitors.length && (
              <TableRow>
                <TableCell colSpan={VIEW_SECTIONS[viewTab].columns.length + 2} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                      <CircularProgress size={18} />
                      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Loading competitor data…</Typography>
                    </Box>
                  ) : (
                    'No competitors tracked yet.'
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </MobilePaper>

      <MobileDialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? (canEdit ? 'Edit' : 'View') : 'Add'} competitor</DialogTitle>
        <DialogContent>
          <MobileStack gap={2} direction="row" sx={{ mb: 1 }}>
            <MobileTextField
              fullWidth
              label="Company name"
              size="small"
              margin="normal"
              value={form.company_name}
              onChange={set('company_name')}
              disabled={!canEdit}
            />
            <MobileTextField
              fullWidth
              select
              label="Region"
              size="small"
              margin="normal"
              value={form.region}
              onChange={set('region')}
              disabled={!canEdit}
              options={[
                { value: 'india', label: '🇮🇳 India' },
                { value: 'global', label: '🌍 Global' },
              ]}
            />
            <MobileTextField
              fullWidth
              select
              label="Featured"
              size="small"
              margin="normal"
              value={form.is_featured ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, is_featured: e.target.value === 'yes' })}
              disabled={!canEdit}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: '⭐ Yes' },
              ]}
            />
          </MobileStack>

          <MobilePaper sx={{ mb: 2 }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, px: 3, py: 1.5 } }}
            >
              {VIEW_SECTIONS.map((s) => <Tab key={s.label} label={s.label} />)}
            </Tabs>
          </MobilePaper>

          <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }}>
            {tab === 0 && (
              <Section title="Company Overview">
                {textField('Country', 'country')}
                {textField('HQ City', 'hq_city')}
                {textField('Founded', 'founded')}
                {textField('Dev Stage', 'dev_stage')}
                {textField('Funding (verified)', 'funding_verified', { multiline: true, full: true })}
                {textField('Team size (verified)', 'team_size_verified', { multiline: true, full: true })}
                {textField('CEO / Founders', 'ceo_founders', { full: true })}
                {textField('Source', 'overview_source', { multiline: true, full: true })}
                {textField('Website', 'website')}
                <MobileTextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Last reviewed"
                  InputLabelProps={{ shrink: true }}
                  value={form.last_reviewed_date}
                  onChange={set('last_reviewed_date')}
                />
              </Section>
            )}

            {tab === 1 && (
              <Section title="Product Capability">
                {capField('Scope 1', 'cap_scope1')}
                {capField('Scope 2', 'cap_scope2')}
                {capField('Scope 3', 'cap_scope3')}
                {capField('Supplier Portal', 'cap_supplier_portal')}
                {capField('GHG Inventory', 'cap_ghg_inventory')}
                {capField('BRSR', 'cap_brsr')}
                {capField('CDP', 'cap_cdp')}
                {capField('TCFD', 'cap_tcfd')}
                {capField('CCTS', 'cap_ccts')}
                {capField('Audit Trail', 'cap_audit_trail')}
                {textField('Source notes', 'capability_source_notes', { multiline: true, full: true })}
              </Section>
            )}

            {tab === 2 && (
              <Section title="Carbon Market Capability">
                {capField('Marketplace', 'market_marketplace')}
                {capField('Credit Issuance', 'market_credit_issuance')}
                {capField('Trading', 'market_trading')}
                {capField('Retirement', 'market_retirement')}
                {capField('Registry Integration', 'market_registry_integration')}
                {capField('Tokenisation', 'market_tokenisation')}
                {capField('Blockchain Audit', 'market_blockchain_audit')}
                {capField('On-chain Settlement', 'market_onchain_settlement')}
                {textField('Source notes', 'market_source_notes', { multiline: true, full: true })}
              </Section>
            )}

            {tab === 3 && (
              <Section title="Commercial Analysis">
                {textField('Pricing model', 'pricing_model')}
                {textField('Pricing type', 'pricing_type')}
                {textField('Est. price range', 'est_price_range', { full: true })}
                {textField('Free trial', 'free_trial')}
                {textField('India presence', 'india_presence')}
                {textField('Implementation support', 'implementation_support', { multiline: true, full: true })}
                {textField('Consulting support', 'consulting_support', { multiline: true, full: true })}
                {textField('Source notes', 'commercial_source_notes', { multiline: true, full: true })}
              </Section>
            )}

            {tab === 4 && (
              <Section title="Strategic Analysis">
                {textField('Target customer', 'target_customer', { multiline: true, full: true })}
                {textField('GTM model', 'gtm_model', { multiline: true, full: true })}
                {textField('Key partners', 'key_partners', { multiline: true, full: true })}
                {textField('Audit firm alignment', 'audit_firm_alignment')}
                {textField('Investor backed', 'investor_backed')}
                {textField('International expansion', 'international_expansion')}
                {textField('Govt/regulatory alignment', 'govt_regulatory_alignment', { multiline: true, full: true })}
                {textField('Strategic notes', 'strategic_notes', { multiline: true, full: true })}
              </Section>
            )}

            {tab === 5 && (
              <Section title="Customer Proof">
                {textField('Customer count', 'customer_count')}
                {textField('Industry verticals', 'industry_verticals')}
                {textField('Case studies published', 'case_studies_published', { multiline: true, full: true })}
                {textField('Testimonials / reviews', 'testimonials_reviews', { multiline: true, full: true })}
                {textField('Known clients', 'known_clients', { multiline: true, full: true })}
                {textField('Trust signal', 'trust_signal', { multiline: true, full: true })}
                {textField('Source notes', 'customer_proof_source_notes', { multiline: true, full: true })}
              </Section>
            )}

            <Divider sx={{ my: 2 }} />
            <MobileTextField fullWidth label="General notes" multiline rows={2} size="small" value={form.notes || ''} onChange={set('notes')} />
          </fieldset>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setOpen(false)}>{canEdit ? 'Cancel' : 'Close'}</MobileButton>
          {canEdit && (
            <MobileButton variant="contained" onClick={handleSave} disabled={saving || !form.company_name}>
              {saving ? 'Saving…' : 'Save'}
            </MobileButton>
          )}
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}