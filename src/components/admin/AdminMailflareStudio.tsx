import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  Send,
  Inbox,
  Settings2,
  History,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Paperclip,
  X,
  Users,
  UserCheck,
  Building2,
  Server,
  Eye,
  Reply,
  Search,
  Copy,
  ShieldCheck,
  Loader2,
  Star,
  Archive,
  Trash2,
  FileEdit,
  Plus,
  Globe,
  AtSign,
  Forward,
  Bot,
  Check,
  MailPlus,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CUSTOMER_EMAIL_TEMPLATES,
  NIKNOTE_EMAIL_LOGO_URL,
  SENDER_PRESETS,
  addEmailDomain,
  buildNikNoteEmailHtml,
  buildNikNotePlainText,
  bulkWebmailMessages,
  createCustomMailbox,
  deleteCustomMailbox,
  deleteEmailDomain,
  discoverMailflareMailboxes,
  extractDomainFromEmail,
  fileToAttachmentBase64,
  formatSenderPreview,
  getEmailWorkspace,
  getMailflareConfig,
  interpolateEmailTemplate,
  isValidEmailAddress,
  listCustomerEmailLogs,
  listWebmailMessages,
  parseRecipientInput,
   sanitizeBrandSenderName,
  saveEmailDraft,
  saveMailflareConfig,
  sendCustomerCampaign,
  sendCustomerEmail,
  syncMailflareToWebmail,
  testMailflareConnection,
  updateCustomMailbox,
  updateWebmailMessage,
  verifyEmailDomainDns,
  type AdminCustomMailbox,
  type AdminEmailDomain,
  type AdminWebmailMessage,
  type CampaignAudience,
  type ComposePrefill,
  type CustomerEmailLog,
  type DiscoveredMailbox,
  type EmailAttachmentInput,
  type EmailProviderType,
  type EmailVisualStyle,
  type MailflareConfigView,
  type WebmailCounts,
  type WebmailFolder,
} from '@/lib/mailflareClient';

export interface KnownCustomerOption {
  email: string;
  name?: string | null;
  plan?: string;
  institution?: string;
  userId?: string;
  leadId?: string;
}

interface AdminMailflareStudioProps {
  prefill?: ComposePrefill | null;
  onClearPrefill?: () => void;
  knownCustomers?: KnownCustomerOption[];
}

const FALLBACK_DOMAINS: AdminEmailDomain[] = [
  {
    id: 'dom_niknote_online',
    hostname: 'niknote.online',
    mailflare_domain_id: '',
    sending_provider: 'mailflare',
    receiving_provider: 'mailflare',
    dns_status: 'pending',
    mx_verified: false,
    spf_verified: false,
    dmarc_verified: false,
    is_primary: true,
    last_checked_at: null,
    created_at: new Date().toISOString(),
  },
];

const FALLBACK_MAILBOXES: AdminCustomMailbox[] = [
  {
    id: 'mbx_support',
    domain_id: 'dom_niknote_online',
    local_part: 'support',
    hostname: 'niknote.online',
    address: 'support@niknote.online',
    display_name: 'NikNote',
    mailbox_type: 'shared',
    color: '#7c3aed',
    signature: 'Warmly,\nTeam of NikNote\nhttps://www.niknote.online',
    forward_to: '',
    auto_reply_enabled: false,
    auto_reply_subject: 'We received your message — NikNote',
    auto_reply_body: 'Thank you for contacting NikNote. Team of NikNote will get back to you shortly.',
    is_default: true,
    disabled: false,
    mailflare_mailbox_id: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mbx_invite',
    domain_id: 'dom_niknote_online',
    local_part: 'invite',
    hostname: 'niknote.online',
    address: 'invite@niknote.online',
    display_name: 'Team of NikNote',
    mailbox_type: 'shared',
    color: '#db2777',
    signature: 'With warmth,\nTeam of NikNote\nhttps://www.niknote.online',
    forward_to: '',
    auto_reply_enabled: false,
    auto_reply_subject: 'Thank you for replying to your NikNote invite',
    auto_reply_body: 'Hi there! Team of NikNote is excited to welcome you onboard.',
    is_default: false,
    disabled: false,
    mailflare_mailbox_id: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mbx_hello',
    domain_id: 'dom_niknote_online',
    local_part: 'hello',
    hostname: 'niknote.online',
    address: 'hello@niknote.online',
    display_name: 'Team of NikNote',
    mailbox_type: 'shared',
    color: '#2563eb',
    signature: 'With warmth,\nTeam of NikNote\nhttps://www.niknote.online',
    forward_to: '',
    auto_reply_enabled: false,
    auto_reply_subject: 'Thanks for writing to Team of NikNote',
    auto_reply_body: 'Hi! Thank you for writing to Team of NikNote.',
    is_default: false,
    disabled: false,
    mailflare_mailbox_id: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mbx_team',
    domain_id: 'dom_niknote_online',
    local_part: 'team',
    hostname: 'niknote.online',
    address: 'team@niknote.online',
    display_name: 'Team of NikNote',
    mailbox_type: 'shared',
    color: '#6366f1',
    signature: 'Warmly,\nTeam of NikNote\nhttps://www.niknote.online',
    forward_to: '',
    auto_reply_enabled: false,
    auto_reply_subject: 'Message received — Team of NikNote',
    auto_reply_body: 'Team of NikNote has received your message and will reply soon.',
    is_default: false,
    disabled: false,
    mailflare_mailbox_id: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mbx_billing',
    domain_id: 'dom_niknote_online',
    local_part: 'billing',
    hostname: 'niknote.online',
    address: 'billing@niknote.online',
    display_name: 'NikNote',
    mailbox_type: 'shared',
    color: '#059669',
    signature: 'Warm regards,\nTeam of NikNote\nhttps://www.niknote.online',
    forward_to: '',
    auto_reply_enabled: false,
    auto_reply_subject: 'Billing Inquiry Received — NikNote',
    auto_reply_body: 'Team of NikNote has received your billing query and will assist you shortly.',
    is_default: false,
    disabled: false,
    mailflare_mailbox_id: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mbx_schools',
    domain_id: 'dom_niknote_online',
    local_part: 'schools',
    hostname: 'niknote.online',
    address: 'schools@niknote.online',
    display_name: 'Team of NikNote',
    mailbox_type: 'shared',
    color: '#ea580c',
    signature: 'Warm regards,\nTeam of NikNote\nhttps://www.niknote.online/schools',
    forward_to: '',
    auto_reply_enabled: false,
    auto_reply_subject: 'Institution Inquiry Received — NikNote',
    auto_reply_body: 'Thank you for your interest in NikNote for your institution.',
    is_default: false,
    disabled: false,
    mailflare_mailbox_id: '',
    created_at: new Date().toISOString(),
  },
];

const EMPTY_COUNTS: WebmailCounts = {
  inbox: 0,
  unread: 0,
  starred: 0,
  sent: 0,
  drafts: 0,
  archive: 0,
  spam: 0,
  trash: 0,
  byMailboxUnread: {},
  byMailboxTotal: {},
};

const MAILBOX_COLORS = ['#7c3aed', '#2563eb', '#ea580c', '#059669', '#db2777', '#0891b2', '#4f46e5'];

const FOLDER_ITEMS: Array<{ id: WebmailFolder; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'sent', label: 'Sent Mail', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileEdit },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'spam', label: 'Spam', icon: AlertTriangle },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export const AdminMailflareStudio: React.FC<AdminMailflareStudioProps> = ({
  prefill,
  onClearPrefill,
  knownCustomers = [],
}) => {
  const [studioTab, setStudioTab] = useState<string>(prefill ? 'compose' : 'webmail');
  const [loadingWorkspace, setLoadingWorkspace] = useState<boolean>(true);
  const [config, setConfig] = useState<MailflareConfigView | null>(null);
  const [webhookSecretUrl, setWebhookSecretUrl] = useState<string>('');
  const [domains, setDomains] = useState<AdminEmailDomain[]>(FALLBACK_DOMAINS);
  const [mailboxes, setMailboxes] = useState<AdminCustomMailbox[]>(FALLBACK_MAILBOXES);
  const [counts, setCounts] = useState<WebmailCounts>(EMPTY_COUNTS);

  // ---------------- Webmail Manager State ----------------
  const [activeFolder, setActiveFolder] = useState<WebmailFolder>('inbox');
  const [activeMailboxFilter, setActiveMailboxFilter] = useState<string>('all');
  const [webmailSearch, setWebmailSearch] = useState<string>('');
  const [messages, setMessages] = useState<AdminWebmailMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [selectedMessage, setSelectedMessage] = useState<AdminWebmailMessage | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [syncingMailflare, setSyncingMailflare] = useState<boolean>(false);

  // ---------------- Compose & Broadcast State ----------------
  const [mode, setMode] = useState<'single' | 'campaign'>('single');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('invite');
  const [emailStyle, setEmailStyle] = useState<EmailVisualStyle>('handwritten');
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [toInput, setToInput] = useState<string>('');
  const [ccInput, setCcInput] = useState<string>('');
  const [bccInput, setBccInput] = useState<string>('');
  const [showCcBcc, setShowCcBcc] = useState<boolean>(false);
  const [recipientName, setRecipientName] = useState<string>('');
  const [institutionName, setInstitutionName] = useState<string>('');
  const [customerPlan, setCustomerPlan] = useState<string>('free');
  const [linkedUserId, setLinkedUserId] = useState<string | undefined>(undefined);
  const [linkedLeadId, setLinkedLeadId] = useState<string | undefined>(undefined);
  const [inReplyTo, setInReplyTo] = useState<string | undefined>(undefined);
  const [references, setReferences] = useState<string | undefined>(undefined);

  const [audience, setAudience] = useState<CampaignAudience>('all_users');
  const [customCampaignEmails, setCustomCampaignEmails] = useState<string>('');
  const [campaignLimit, setCampaignLimit] = useState<number>(25);

  const [selectedSenderMailboxId, setSelectedSenderMailboxId] = useState<string>('mbx_invite');
  const [fromName, setFromName] = useState<string>('Team of NikNote');
  const [fromEmail, setFromEmail] = useState<string>('invite@niknote.online');
  const [replyTo, setReplyTo] = useState<string>('');
  const [appendSignature, setAppendSignature] = useState<boolean>(true);
  const [subject, setSubject] = useState<string>(CUSTOMER_EMAIL_TEMPLATES[0].subject);
  const [heading, setHeading] = useState<string>(CUSTOMER_EMAIL_TEMPLATES[0].heading);
  const [bodyText, setBodyText] = useState<string>(CUSTOMER_EMAIL_TEMPLATES[0].body);
  const [ctaLabel, setCtaLabel] = useState<string>(CUSTOMER_EMAIL_TEMPLATES[0].ctaLabel);
  const [ctaUrl, setCtaUrl] = useState<string>(CUSTOMER_EMAIL_TEMPLATES[0].ctaUrl);
  const [useBrandedWrapper, setUseBrandedWrapper] = useState<boolean>(true);
  const [attachments, setAttachments] = useState<EmailAttachmentInput[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // ---------------- Custom Mailbox Manager State ----------------
  const [newMbxLocalPart, setNewMbxLocalPart] = useState<string>('');
  const [newMbxDomainId, setNewMbxDomainId] = useState<string>('dom_niknote_online');
  const [newMbxDisplayName, setNewMbxDisplayName] = useState<string>('');
  const [newMbxType, setNewMbxType] = useState<'personal' | 'shared'>('shared');
  const [newMbxColor, setNewMbxColor] = useState<string>('#7c3aed');
  const [newMbxForwardTo, setNewMbxForwardTo] = useState<string>('');
  const [newMbxSignature, setNewMbxSignature] = useState<string>(
    'Warmly,\nTeam of NikNote\nhttps://www.niknote.online',
  );
  const [creatingMailbox, setCreatingMailbox] = useState<boolean>(false);
  const [editingMailbox, setEditingMailbox] = useState<AdminCustomMailbox | null>(null);
  const [savingMailboxEdit, setSavingMailboxEdit] = useState<boolean>(false);

  // ---------------- Domains & Provider Settings State ----------------
  const [newDomainHostname, setNewDomainHostname] = useState<string>('');
  const [newDomainSendingProvider, setNewDomainSendingProvider] = useState<'mailflare' | 'resend'>('mailflare');
  const [addingDomain, setAddingDomain] = useState<boolean>(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  const [cfgProvider, setCfgProvider] = useState<EmailProviderType>('mailflare');
  const [cfgUrl, setCfgUrl] = useState<string>('');
  const [cfgApiKey, setCfgApiKey] = useState<string>('');
  const [cfgAdminKey, setCfgAdminKey] = useState<string>('');
  const [cfgMailboxId, setCfgMailboxId] = useState<string>('');
  const [cfgFromName, setCfgFromName] = useState<string>('Team of NikNote');
  const [cfgFromEmail, setCfgFromEmail] = useState<string>('support@niknote.online');
  const [cfgReplyTo, setCfgReplyTo] = useState<string>('');
  const [cfgResendKey, setCfgResendKey] = useState<string>('');
  const [discoveredMailboxes, setDiscoveredMailboxes] = useState<DiscoveredMailbox[]>([]);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testRecipient, setTestRecipient] = useState<string>('');

  // ---------------- Audit Logs State ----------------
  const [logs, setLogs] = useState<CustomerEmailLog[]>([]);
  const [logSummary, setLogSummary] = useState({ totalSent: 0, totalFailed: 0, last24hSent: 0 });
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const hydrateConfigFields = useCallback((cfg: MailflareConfigView) => {
    const cleanBrandName = sanitizeBrandSenderName(cfg.fromName || 'Team of NikNote');
    setConfig(cfg);
    setCfgProvider(cfg.provider);
    setCfgUrl(cfg.mailflareUrl || '');
    setCfgMailboxId(cfg.mailboxId || '');
    setCfgFromName(cleanBrandName);
    setCfgFromEmail(cfg.fromEmail || 'support@niknote.online');
    setCfgReplyTo(cfg.replyTo || '');
    setFromName(cleanBrandName);
    setFromEmail(cfg.fromEmail || 'support@niknote.online');
    setReplyTo(cfg.replyTo || '');
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const ws = await getEmailWorkspace();
      if (ws?.config) {
        hydrateConfigFields(ws.config);
        if (ws.webhookSecretPreview) setWebhookSecretUrl(ws.webhookSecretPreview);
        if (Array.isArray(ws.domains) && ws.domains.length > 0) setDomains(ws.domains);
        if (Array.isArray(ws.mailboxes) && ws.mailboxes.length > 0) {
          setMailboxes(ws.mailboxes);
          const def = ws.mailboxes.find((m) => m.is_default) || ws.mailboxes[0];
          if (def) setSelectedSenderMailboxId(def.id);
        }
        if (ws.counts) setCounts(ws.counts);
      } else {
        // Fallback for unit tests that only mock `get_config`
        const cfg = await getMailflareConfig();
        if (cfg) hydrateConfigFields(cfg);
      }
    } catch {
      try {
        const cfg = await getMailflareConfig();
        if (cfg) hydrateConfigFields(cfg);
      } catch {
        // Keep local defaults visible
      }
    } finally {
      setLoadingWorkspace(false);
    }
  }, [hydrateConfigFields]);

  const loadMessages = useCallback(
    async (folderOverride?: WebmailFolder, mailboxOverride?: string, queryOverride?: string) => {
      setLoadingMessages(true);
      try {
        const res = await listWebmailMessages({
          folder: folderOverride ?? activeFolder,
          mailboxAddress: mailboxOverride ?? activeMailboxFilter,
          q: (queryOverride ?? webmailSearch).trim() || undefined,
          limit: 80,
        });
        if (Array.isArray(res?.messages)) {
          setMessages(res.messages);
          setSelectedMessageIds([]);
          setSelectedMessage((prev) =>
            prev ? res.messages.find((m) => m.id === prev.id) || null : res.messages[0] || null,
          );
        }
        if (res?.counts) setCounts(res.counts);
      } catch {
        // Non-fatal in preview/test
      } finally {
        setLoadingMessages(false);
      }
    },
    [activeFolder, activeMailboxFilter, webmailSearch],
  );

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await listCustomerEmailLogs();
      if (Array.isArray(res?.logs)) setLogs(res.logs);
      if (res?.summary) setLogSummary(res.summary);
    } catch {
      // Non-fatal
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
    void loadLogs();
  }, [loadWorkspace, loadLogs]);

  useEffect(() => {
    if (studioTab === 'webmail') {
      void loadMessages();
    }
  }, [studioTab, activeFolder, activeMailboxFilter, loadMessages]);

  const activeTemplate = useMemo(
    () => CUSTOMER_EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) || null,
    [selectedTemplateId],
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId);
      const tpl = CUSTOMER_EMAIL_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      setSubject(tpl.subject);
      setHeading(tpl.heading);
      setBodyText(tpl.body);
      setCtaLabel(tpl.ctaLabel);
      setCtaUrl(tpl.ctaUrl);
      if (tpl.defaultStyle) {
        setEmailStyle(tpl.defaultStyle);
        setUseBrandedWrapper(true);
      }

      const matchingMbx = mailboxes.find(
        (m) => m.local_part === tpl.defaultFromLocalPart && !m.disabled,
      );
      if (matchingMbx) {
        setSelectedSenderMailboxId(matchingMbx.id);
        setFromEmail(matchingMbx.address);
        setFromName(sanitizeBrandSenderName(matchingMbx.display_name));
      } else {
        const domain = extractDomainFromEmail(config?.fromEmail || fromEmail, 'niknote.online');
        const preset = SENDER_PRESETS.find((p) => p.localPart === tpl.defaultFromLocalPart);
        if (preset) {
          setFromName(preset.fromName);
          setFromEmail(`${preset.localPart}@${domain}`);
        }
      }
    },
    [config?.fromEmail, fromEmail, mailboxes],
  );

  useEffect(() => {
    if (!prefill) return;
    setStudioTab('compose');
    setMode('single');
    setDraftId(undefined);
    setToInput(prefill.to || '');
    setRecipientName(prefill.recipientName || '');
    setInstitutionName(prefill.institution || '');
    setCustomerPlan(prefill.plan || 'free');
    setLinkedUserId(prefill.userId);
    setLinkedLeadId(prefill.leadId);
    setInReplyTo(prefill.inReplyTo);
    setReferences(prefill.references);

    if (prefill.templateId) {
      applyTemplate(prefill.templateId);
    }
    if (prefill.subject !== undefined) setSubject(prefill.subject);
    if (prefill.body !== undefined) {
      setBodyText(prefill.body);
      if (!prefill.templateId) {
        setSelectedTemplateId('custom');
        setHeading('');
        setCtaLabel('');
        setCtaUrl('');
      }
    }
  }, [prefill, applyTemplate]);

  const activeSenderMailbox = useMemo(
    () => mailboxes.find((m) => m.id === selectedSenderMailboxId) || null,
    [mailboxes, selectedSenderMailboxId],
  );

  const effectiveBodyWithSignature = useMemo(() => {
    const sig = activeSenderMailbox?.signature?.trim();
    if (!appendSignature || !sig) return bodyText;
    if (bodyText.includes(sig)) return bodyText;
    if (
      /(team of niknote|team niknote|happy studying,\s*\n\s*niknote|warmly,\s*\n\s*niknote|warm regards,\s*\n\s*niknote|with warmth,\s*\n\s*niknote)/i.test(
        bodyText,
      )
    ) {
      return bodyText;
    }
    return `${bodyText.trimEnd()}\n\n--\n${sig}`;
  }, [appendSignature, activeSenderMailbox, bodyText]);

  const previewVars = useMemo(() => {
    const firstRecipient = parseRecipientInput(toInput).valid[0] || 'student@example.com';
    return {
      name:
        recipientName.trim() ||
        (mode === 'campaign' ? 'Aarav Sharma' : firstRecipient.split('@')[0] || 'Friend'),
      email: firstRecipient,
      plan: customerPlan || 'premium',
      institution: institutionName.trim() || 'Delhi Public School',
    };
  }, [toInput, recipientName, mode, customerPlan, institutionName]);

  const renderedPreviewSubject = useMemo(
    () => interpolateEmailTemplate(subject, previewVars, false),
    [subject, previewVars],
  );

  const renderedPreviewHtml = useMemo(() => {
    const interpolatedHeading = interpolateEmailTemplate(heading, previewVars, false);
    const interpolatedBody = interpolateEmailTemplate(effectiveBodyWithSignature, previewVars, false);
    if (!useBrandedWrapper) {
      return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:20px;color:#1e293b;line-height:1.6;">${interpolatedBody
        .split('\n')
        .map((l) => `<p style="margin:0 0 10px;">${l || '&nbsp;'}</p>`)
        .join('')}</body></html>`;
    }
    return buildNikNoteEmailHtml({
      heading: interpolatedHeading,
      bodyText: interpolatedBody,
      ctaLabel: interpolateEmailTemplate(ctaLabel, previewVars, false),
      ctaUrl,
      fromName: sanitizeBrandSenderName(fromName),
      fromEmail,
      style: emailStyle,
      noteTag: activeTemplate?.noteTag,
      logoUrl: '/niknote-email-logo.png',
    });
  }, [
    heading,
    effectiveBodyWithSignature,
    ctaLabel,
    ctaUrl,
    fromName,
    fromEmail,
    previewVars,
    useBrandedWrapper,
    emailStyle,
    activeTemplate,
  ]);

  const filteredKnownCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const unique = new Map<string, KnownCustomerOption>();
    for (const c of knownCustomers) {
      if (!c.email) continue;
      const key = c.email.toLowerCase();
      if (!unique.has(key)) unique.set(key, c);
    }
    const list = Array.from(unique.values());
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          (c.name || '').toLowerCase().includes(q) ||
          (c.institution || '').toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [knownCustomers, customerSearch]);

  const handleSelectSenderMailbox = (mbxId: string) => {
    setSelectedSenderMailboxId(mbxId);
    const found = mailboxes.find((m) => m.id === mbxId);
    if (found) {
      setFromEmail(found.address);
      setFromName(sanitizeBrandSenderName(found.display_name));
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (attachments.length + files.length > 5) {
      toast.error('You can attach up to 5 files per email.');
      return;
    }
    try {
      const encoded = await Promise.all(files.map((file) => fileToAttachmentBase64(file)));
      setAttachments((prev) => [...prev, ...encoded]);
      toast.success(`Attached ${encoded.length} file${encoded.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not attach file');
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const cleanBrandFromName = sanitizeBrandSenderName(fromName);
      const htmlOut = buildNikNoteEmailHtml({
        heading,
        bodyText: effectiveBodyWithSignature,
        ctaLabel,
        ctaUrl,
        fromName: cleanBrandFromName,
        fromEmail,
        style: emailStyle,
        noteTag: activeTemplate?.noteTag,
        logoUrl: NIKNOTE_EMAIL_LOGO_URL,
      });
      const textOut = buildNikNotePlainText({
        heading,
        bodyText: effectiveBodyWithSignature,
        ctaLabel,
        ctaUrl,
      });
      const res = await saveEmailDraft({
        draftId,
        fromEmail,
        fromName: cleanBrandFromName,
        to: toInput,
        cc: ccInput,
        bcc: bccInput,
        subject: subject || '(Draft — No subject)',
        html: htmlOut,
        text: textOut,
      });
      if (res.draft?.id) setDraftId(res.draft.id);
      toast.success('Draft saved to Drafts folder');
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendSingle = async () => {
    const parsedTo = parseRecipientInput(toInput);
    if (parsedTo.invalid.length > 0) {
      toast.error(`Invalid recipient email: ${parsedTo.invalid.join(', ')}`);
      return;
    }
    if (parsedTo.valid.length === 0) {
      toast.error('Enter at least one customer email address');
      return;
    }
    if (!subject.trim()) {
      toast.error('Enter an email subject line');
      return;
    }
    if (!bodyText.trim()) {
      toast.error('Write a message before sending');
      return;
    }
    if (!isValidEmailAddress(fromEmail)) {
      toast.error('Choose a valid custom sender mailbox');
      return;
    }

    setSending(true);
    try {
      const cleanBrandFromName = sanitizeBrandSenderName(fromName);
      const finalSubject = interpolateEmailTemplate(subject.trim(), previewVars, false);
      const finalHeading = interpolateEmailTemplate(heading.trim(), previewVars, false);
      const finalBody = interpolateEmailTemplate(effectiveBodyWithSignature, previewVars, false);
      const finalCtaLabel = interpolateEmailTemplate(ctaLabel.trim(), previewVars, false);

      const htmlOut = useBrandedWrapper
        ? buildNikNoteEmailHtml({
            heading: finalHeading,
            bodyText: finalBody,
            ctaLabel: finalCtaLabel,
            ctaUrl: ctaUrl.trim(),
            fromName: cleanBrandFromName,
            fromEmail,
            style: emailStyle,
            noteTag: activeTemplate?.noteTag,
            logoUrl: NIKNOTE_EMAIL_LOGO_URL,
          })
        : finalBody
            .split('\n')
            .map((line) => `<p>${line}</p>`)
            .join('');

      const textOut = buildNikNotePlainText({
        heading: useBrandedWrapper ? finalHeading : undefined,
        bodyText: finalBody,
        ctaLabel: useBrandedWrapper ? finalCtaLabel : undefined,
        ctaUrl: useBrandedWrapper ? ctaUrl.trim() : undefined,
      });

      const res = await sendCustomerEmail({
        to: parsedTo.valid,
        cc: parseRecipientInput(ccInput).valid,
        bcc: parseRecipientInput(bccInput).valid,
        subject: finalSubject,
        html: htmlOut,
        text: textOut,
        fromName: cleanBrandFromName,
        fromEmail,
        mailflareMailboxId: activeSenderMailbox?.mailflare_mailbox_id || undefined,
        replyTo: replyTo.trim() || undefined,
        templateId: selectedTemplateId,
        recipientName: recipientName.trim() || undefined,
        userId: linkedUserId,
        leadId: linkedLeadId,
        draftId,
        inReplyTo,
        references,
        attachments: attachments.length ? attachments : undefined,
      });

      toast.success(`Email sent to ${parsedTo.valid.join(', ')} (${res.provider})`);
      setAttachments([]);
      setDraftId(undefined);
      setInReplyTo(undefined);
      setReferences(undefined);
      onClearPrefill?.();
      void loadLogs();
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
      void loadLogs();
    } finally {
      setSending(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!subject.trim() || !bodyText.trim()) {
      toast.error('Subject and message body are required for broadcasts');
      return;
    }
    let customRecipients: Array<{ email: string; name?: string }> | undefined;
    if (audience === 'custom') {
      const parsed = parseRecipientInput(customCampaignEmails);
      if (parsed.valid.length === 0) {
        toast.error('Paste at least one valid email for the custom recipient list');
        return;
      }
      customRecipients = parsed.valid.map((entry) => ({ email: entry }));
    }

    setSending(true);
    try {
      const cleanBrandFromName = sanitizeBrandSenderName(fromName);
      const htmlTemplate = useBrandedWrapper
        ? buildNikNoteEmailHtml({
            heading: heading.trim(),
            bodyText: effectiveBodyWithSignature,
            ctaLabel: ctaLabel.trim(),
            ctaUrl: ctaUrl.trim(),
            fromName: cleanBrandFromName,
            fromEmail,
            style: emailStyle,
            noteTag: activeTemplate?.noteTag,
            logoUrl: NIKNOTE_EMAIL_LOGO_URL,
          })
        : effectiveBodyWithSignature
            .split('\n')
            .map((l) => `<p>${l}</p>`)
            .join('');

      const textTemplate = buildNikNotePlainText({
        heading: useBrandedWrapper ? heading.trim() : undefined,
        bodyText: effectiveBodyWithSignature,
        ctaLabel: useBrandedWrapper ? ctaLabel.trim() : undefined,
        ctaUrl: useBrandedWrapper ? ctaUrl.trim() : undefined,
      });

      const res = await sendCustomerCampaign({
        audience,
        recipients: customRecipients,
        subject: subject.trim(),
        html: htmlTemplate,
        text: textTemplate,
        fromName: cleanBrandFromName,
        fromEmail,
        mailflareMailboxId: activeSenderMailbox?.mailflare_mailbox_id || undefined,
        replyTo: replyTo.trim() || undefined,
        templateId: selectedTemplateId,
        limit: campaignLimit,
      });

      if (res.failedCount > 0) {
        toast.warning(
          `Sent ${res.sentCount}/${res.totalRecipients} emails (${res.failedCount} failed).`,
        );
      } else {
        toast.success(`Delivered ${res.sentCount} personalized customer emails!`);
      }
      void loadLogs();
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Campaign send failed');
    } finally {
      setSending(false);
    }
  };

  // ---------------- Webmail Actions ----------------
  const handleSelectWebmailMessage = async (msg: AdminWebmailMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
      try {
        await updateWebmailMessage({ id: msg.id, isRead: true });
        void loadWorkspace();
      } catch {
        // Non-fatal
      }
    }
  };

  const handleToggleStar = async (msg: AdminWebmailMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !msg.is_starred;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_starred: next } : m)));
    if (selectedMessage?.id === msg.id) setSelectedMessage({ ...msg, is_starred: next });
    try {
      await updateWebmailMessage({ id: msg.id, isStarred: next });
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update star');
    }
  };

  const handleMoveMessage = async (
    msg: AdminWebmailMessage,
    folder: 'inbox' | 'archive' | 'spam' | 'trash',
  ) => {
    try {
      await updateWebmailMessage({ id: msg.id, folder });
      toast.success(`Moved to ${folder}`);
      setSelectedMessage(null);
      void loadMessages();
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not move email');
    }
  };

  const handleDeleteForever = async (msg: AdminWebmailMessage) => {
    try {
      await updateWebmailMessage({ id: msg.id, permanentDelete: true });
      toast.success('Email permanently deleted');
      setSelectedMessage(null);
      void loadMessages();
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete email');
    }
  };

  const handleBulkAction = async (
    operation:
      | 'mark_read'
      | 'mark_unread'
      | 'move_archive'
      | 'move_trash'
      | 'move_inbox'
      | 'delete_forever'
      | 'empty_trash',
  ) => {
    try {
      await bulkWebmailMessages({
        operation,
        ids: operation === 'empty_trash' ? undefined : selectedMessageIds,
      });
      toast.success('Updated emails');
      setSelectedMessageIds([]);
      setSelectedMessage(null);
      void loadMessages();
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk action failed');
    }
  };

  const handleReplyFromWebmail = (msg: AdminWebmailMessage) => {
    const replyTarget = msg.direction === 'inbound' ? msg.from_email : msg.to_emails[0] || '';
    const matchingMbx = mailboxes.find(
      (m) => m.address.toLowerCase() === (msg.mailbox_address || '').toLowerCase(),
    );
    if (matchingMbx) {
      setSelectedSenderMailboxId(matchingMbx.id);
      setFromEmail(matchingMbx.address);
      setFromName(matchingMbx.display_name);
    }
    setStudioTab('compose');
    setMode('single');
    setSelectedTemplateId('custom');
    setDraftId(undefined);
    setToInput(replyTarget);
    setRecipientName(msg.direction === 'inbound' ? msg.from_name : '');
    setSubject(msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || ''}`);
    setHeading('');
    setCtaLabel('');
    setCtaUrl('');
    setInReplyTo(msg.provider_message_id || undefined);
    const quoted = (msg.body_text || msg.snippet || '')
      .split('\n')
      .slice(0, 12)
      .map((l) => `> ${l}`)
      .join('\n');
    setBodyText(`\n\nOn ${new Date(msg.created_at).toLocaleString('en-IN')}, ${msg.from_email} wrote:\n${quoted}`);
  };

  const handleOpenDraftInComposer = (msg: AdminWebmailMessage) => {
    setDraftId(msg.id);
    setStudioTab('compose');
    setMode('single');
    setSelectedTemplateId('custom');
    setToInput((msg.to_emails || []).join(', '));
    setCcInput((msg.cc_emails || []).join(', '));
    setBccInput((msg.bcc_emails || []).join(', '));
    setFromEmail(msg.from_email || 'support@niknote.online');
    setFromName(msg.from_name || 'NikNote Support');
    setSubject(msg.subject === '(Draft — No subject)' ? '' : msg.subject);
    setHeading('');
    setBodyText(msg.body_text || '');
  };

  const handleSyncMailflareInbox = async () => {
    setSyncingMailflare(true);
    try {
      const res = await syncMailflareToWebmail();
      toast.success(`Synced ${res.fetched} message(s) from Mailflare server`);
      void loadMessages();
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mailflare sync failed');
    } finally {
      setSyncingMailflare(false);
    }
  };

  // ---------------- Custom Mailbox CRUD ----------------
  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLocal = newMbxLocalPart.trim().toLowerCase().replace(/@.*$/, '');
    if (!cleanLocal) {
      toast.error('Enter a mailbox username (for example invite, team, help, admissions)');
      return;
    }
    setCreatingMailbox(true);
    try {
      const res = await createCustomMailbox({
        localPart: cleanLocal,
        domainId: newMbxDomainId,
        displayName: sanitizeBrandSenderName(newMbxDisplayName.trim() || 'Team of NikNote'),
        mailboxType: newMbxType,
        color: newMbxColor,
        signature: newMbxSignature,
        forwardTo: newMbxForwardTo.trim() || undefined,
      });
      toast.success(`Created custom mailbox ${res.mailbox.address}`);
      setNewMbxLocalPart('');
      setNewMbxDisplayName('');
      setNewMbxForwardTo('');
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create mailbox');
    } finally {
      setCreatingMailbox(false);
    }
  };

  const handleSaveMailboxEdit = async () => {
    if (!editingMailbox) return;
    setSavingMailboxEdit(true);
    try {
      await updateCustomMailbox({
        id: editingMailbox.id,
        displayName: editingMailbox.display_name,
        mailboxType: editingMailbox.mailbox_type,
        color: editingMailbox.color,
        signature: editingMailbox.signature,
        forwardTo: editingMailbox.forward_to,
        autoReplyEnabled: editingMailbox.auto_reply_enabled,
        autoReplySubject: editingMailbox.auto_reply_subject,
        autoReplyBody: editingMailbox.auto_reply_body,
        disabled: editingMailbox.disabled,
        mailflareMailboxId: editingMailbox.mailflare_mailbox_id,
      });
      toast.success(`Saved settings for ${editingMailbox.address}`);
      setEditingMailbox(null);
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update mailbox');
    } finally {
      setSavingMailboxEdit(false);
    }
  };

  const handleMakeDefaultMailbox = async (mbx: AdminCustomMailbox) => {
    try {
      await updateCustomMailbox({ id: mbx.id, isDefault: true });
      toast.success(`${mbx.address} is now the default sender mailbox`);
      setSelectedSenderMailboxId(mbx.id);
      setFromEmail(mbx.address);
      setFromName(mbx.display_name);
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default mailbox');
    }
  };

  const handleDeleteMailbox = async (mbx: AdminCustomMailbox) => {
    try {
      await deleteCustomMailbox(mbx.id);
      toast.success(`Removed mailbox ${mbx.address}`);
      if (editingMailbox?.id === mbx.id) setEditingMailbox(null);
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete mailbox');
    }
  };

  // ---------------- Custom Domain & Provider Settings ----------------
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainHostname.trim()) {
      toast.error('Enter your domain name (for example mail.niknote.online)');
      return;
    }
    setAddingDomain(true);
    try {
      const res = await addEmailDomain({
        hostname: newDomainHostname.trim(),
        sendingProvider: newDomainSendingProvider,
      });
      toast.success(`Added domain ${res.domain.hostname}`);
      setNewDomainHostname('');
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerifyDns = async (dom: AdminEmailDomain) => {
    setVerifyingDomainId(dom.id);
    try {
      const res = await verifyEmailDomainDns({ domainId: dom.id, hostname: dom.hostname });
      if (res.dnsStatus === 'verified') {
        toast.success(`${dom.hostname}: MX & SPF DNS records verified!`);
      } else if (res.dnsStatus === 'partial') {
        toast.info(
          `${dom.hostname}: Partial DNS (${res.mxVerified ? 'MX ✓' : 'MX missing'}, ${res.spfVerified ? 'SPF ✓' : 'SPF missing'})`,
        );
      } else {
        toast.warning(`${dom.hostname}: No MX/SPF records detected yet. Add the DNS records shown below.`);
      }
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'DNS check failed');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleSaveConfig = async (rotateWebhookSecret = false) => {
    setSavingConfig(true);
    try {
      const saved = await saveMailflareConfig({
        provider: cfgProvider,
        mailflareUrl: cfgUrl.trim(),
        mailflareApiKey: cfgApiKey.trim() || undefined,
        mailflareAdminKey: cfgAdminKey.trim() || undefined,
        mailboxId: cfgMailboxId.trim(),
        fromName: cfgFromName.trim() || 'NikNote Support',
        fromEmail: cfgFromEmail.trim() || 'support@niknote.online',
        replyTo: cfgReplyTo.trim(),
        resendApiKey: cfgResendKey.trim() || undefined,
        rotateWebhookSecret,
      });
      hydrateConfigFields(saved);
      setCfgApiKey('');
      setCfgAdminKey('');
      setCfgResendKey('');
      toast.success(
        rotateWebhookSecret ? 'Rotated inbound webhook secret' : 'Saved email provider settings',
      );
      void loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDiscoverMailboxes = async () => {
    if (!cfgUrl.trim()) {
      toast.error('Enter your Mailflare server URL first (e.g. https://mail.niknote.online)');
      return;
    }
    setDiscovering(true);
    try {
      const res = await discoverMailflareMailboxes({
        mailflareUrl: cfgUrl.trim(),
        mailflareApiKey: cfgApiKey.trim() || undefined,
        mailflareAdminKey: cfgAdminKey.trim() || undefined,
      });
      setDiscoveredMailboxes(res.mailboxes || []);
      if (res.mailboxes?.length) {
        const first = res.mailboxes[0];
        setCfgMailboxId(first.id);
        if (isValidEmailAddress(first.address)) setCfgFromEmail(first.address);
        if (first.displayName) setCfgFromName(first.displayName);
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not discover mailboxes');
    } finally {
      setDiscovering(false);
    }
  };

  const handleTestConnection = async (withEmail: boolean) => {
    if (withEmail && !isValidEmailAddress(testRecipient)) {
      toast.error('Enter a valid email address to receive the test message');
      return;
    }
    setTesting(true);
    try {
      const res = await testMailflareConnection(withEmail ? testRecipient.trim() : undefined);
      if (res.ok) {
        toast.success(res.detail || 'Email connection verified!');
        if (withEmail) void loadLogs();
      } else {
        toast.error('Connection check did not succeed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const copyText = (value: string, label = 'Copied') => {
    navigator.clipboard.writeText(value);
    toast.success(label);
  };

  const isConfigured = Boolean(config?.configured);
  const activeMailboxes = mailboxes.filter((m) => !m.disabled);

  return (
    <section className="space-y-4" aria-label="NikNote Custom Email Mailbox & Manager">
      {/* Top Status & Quick Action Banner */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Custom Email Mailbox &amp; Email Manager
            </h2>
            {loadingWorkspace ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading
              </Badge>
            ) : isConfigured ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected ({config?.provider === 'resend' ? 'Resend' : 'Mailflare'} · {config?.fromEmail})
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3 h-3" />
                {mailboxes.length} Mailboxes Ready · Connect Outbound Key in Settings
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage custom <code className="px-1 py-0.5 rounded bg-muted">@niknote.online</code> mailboxes, read &amp; reply to customer emails, configure DNS/Mailflare settings, and send branded emails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setDraftId(undefined);
              setMode('single');
              applyTemplate('invite');
              setEmailStyle('handwritten');
              setUseBrandedWrapper(true);
              setStudioTab('compose');
            }}
            className="gap-1.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white border-0 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Invite User (Handwritten)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraftId(undefined);
              setStudioTab('compose');
            }}
            className="gap-1.5"
          >
            <MailPlus className="w-4 h-4" />
            Compose Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStudioTab('mailboxes')}
            className="gap-1.5"
          >
            <AtSign className="w-3.5 h-3.5" />
            Mailboxes ({mailboxes.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStudioTab('settings')}
            className="gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Settings &amp; DNS
          </Button>
        </div>
      </div>

      {/* Main 5-Tab Email Suite */}
      <Tabs value={studioTab} onValueChange={setStudioTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1 rounded-xl justify-start">
          <TabsTrigger value="webmail" className="gap-1.5 rounded-lg">
            <Inbox className="w-4 h-4" />
            Email Manager
            {counts.unread > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
                {counts.unread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5 rounded-lg">
            <Send className="w-4 h-4" />
            Compose &amp; Broadcast
          </TabsTrigger>
          <TabsTrigger value="mailboxes" className="gap-1.5 rounded-lg">
            <AtSign className="w-4 h-4" />
            Custom Mailboxes ({mailboxes.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 rounded-lg">
            <Globe className="w-4 h-4" />
            Domains &amp; Settings
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 rounded-lg">
            <History className="w-4 h-4" />
            Sent Logs ({logSummary.totalSent})
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* TAB 1: FULL 3-PANE WEBMAIL EMAIL MANAGER                            */}
        {/* =================================================================== */}
        <TabsContent value="webmail" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Rail: Mailbox Switcher + Folders */}
            <Card className="rounded-2xl lg:col-span-3">
              <CardContent className="p-3 space-y-4">
                <Button
                  className="w-full justify-center gap-2 rounded-xl"
                  onClick={() => {
                    setDraftId(undefined);
                    setStudioTab('compose');
                  }}
                >
                  <MailPlus className="w-4 h-4" />
                  New Email
                </Button>

                {/* Mailbox Switcher */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Mailboxes
                    </span>
                    <button
                      type="button"
                      onClick={() => setStudioTab('mailboxes')}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMailboxFilter('all')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeMailboxFilter === 'all'
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/70 text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      All Mailboxes
                    </span>
                    {counts.unread > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {counts.unread}
                      </Badge>
                    )}
                  </button>
                  {mailboxes.map((mbx) => {
                    const mbxUnread = counts.byMailboxUnread[mbx.address.toLowerCase()] || 0;
                    const active = activeMailboxFilter === mbx.address.toLowerCase();
                    return (
                      <button
                        key={mbx.id}
                        type="button"
                        onClick={() => setActiveMailboxFilter(mbx.address.toLowerCase())}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted/70 text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: mbx.color || '#7c3aed' }}
                          />
                          <span className="truncate">{mbx.address}</span>
                        </span>
                        {mbxUnread > 0 && (
                          <Badge className="text-[10px] h-4 px-1.5">{mbxUnread}</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Folder Navigation */}
                <div className="space-y-1 pt-2 border-t">
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Folders
                  </span>
                  {FOLDER_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const folderCount =
                      item.id === 'inbox'
                        ? counts.inbox
                        : item.id === 'starred'
                          ? counts.starred
                          : item.id === 'sent'
                            ? counts.sent
                            : item.id === 'drafts'
                              ? counts.drafts
                              : item.id === 'archive'
                                ? counts.archive
                                : item.id === 'spam'
                                  ? counts.spam
                                  : counts.trash;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveFolder(item.id);
                          setSelectedMessage(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                          activeFolder === item.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted/70 text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          {item.label}
                        </span>
                        {folderCount > 0 && (
                          <span className="text-[11px] opacity-85">{folderCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Middle Pane: Message List + Search + Bulk Toolbar */}
            <Card className="rounded-2xl lg:col-span-4 flex flex-col">
              <CardHeader className="p-3 pb-2 border-b space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={webmailSearch}
                      onChange={(e) => setWebmailSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void loadMessages();
                      }}
                      placeholder="Search emails..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5"
                    onClick={() => void loadMessages()}
                    disabled={loadingMessages}
                    title="Refresh folder"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs gap-1"
                    onClick={handleSyncMailflareInbox}
                    disabled={syncingMailflare}
                    title="Pull latest inbound/outbound emails from Mailflare server"
                  >
                    {syncingMailflare ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Server className="w-3.5 h-3.5" />
                    )}
                    Sync
                  </Button>
                </div>

                {/* Bulk Actions Bar */}
                {selectedMessageIds.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-xs">
                    <span className="font-medium text-primary">
                      {selectedMessageIds.length} selected
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => void handleBulkAction('mark_read')}
                      >
                        Read
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => void handleBulkAction('move_archive')}
                      >
                        Archive
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] text-destructive"
                        onClick={() =>
                          void handleBulkAction(
                            activeFolder === 'trash' ? 'delete_forever' : 'move_trash',
                          )
                        }
                      >
                        {activeFolder === 'trash' ? 'Delete Forever' : 'Trash'}
                      </Button>
                    </div>
                  </div>
                ) : activeFolder === 'trash' && messages.length > 0 ? (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      {messages.length} item(s) in Trash
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-destructive"
                      onClick={() => void handleBulkAction('empty_trash')}
                    >
                      Empty Trash
                    </Button>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="p-2 flex-1 max-h-[540px] overflow-y-auto space-y-1">
                {loadingMessages && messages.length === 0 && (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading {activeFolder}...
                  </div>
                )}

                {!loadingMessages && messages.length === 0 && (
                  <div className="py-12 px-4 text-center space-y-2">
                    <FolderOpen className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                    <p className="text-sm font-medium capitalize">No emails in {activeFolder}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeFolder === 'inbox'
                        ? 'Incoming customer emails via Mailflare Sync or your Inbound Webhook appear right here.'
                        : activeFolder === 'drafts'
                          ? 'Saved drafts from the Composer appear here.'
                          : 'Messages in this folder will show up here.'}
                    </p>
                  </div>
                )}

                {messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const isChecked = selectedMessageIds.includes(msg.id);
                  const peerLabel =
                    msg.direction === 'inbound'
                      ? msg.from_name || msg.from_email
                      : `To: ${(msg.to_emails || []).join(', ') || '(No recipient)'}`;

                  return (
                    <div
                      key={msg.id}
                      onClick={() => void handleSelectWebmailMessage(msg)}
                      className={`group rounded-xl border p-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : !msg.is_read
                            ? 'bg-secondary/40 border-primary/20 font-medium'
                            : 'hover:bg-muted/50 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedMessageIds((prev) =>
                              e.target.checked
                                ? [...prev, msg.id]
                                : prev.filter((id) => id !== msg.id),
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 rounded border-muted-foreground/40"
                        />
                        <button
                          type="button"
                          onClick={(e) => void handleToggleStar(msg, e)}
                          className="mt-0.5 text-muted-foreground hover:text-amber-500"
                          title="Star email"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              msg.is_starred ? 'fill-amber-400 text-amber-500' : ''
                            }`}
                          />
                        </button>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs truncate ${
                                !msg.is_read ? 'font-bold text-foreground' : 'font-medium'
                              }`}
                            >
                              {peerLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(msg.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          </div>
                          <p className="text-xs truncate text-foreground">
                            {msg.subject || '(No subject)'}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {msg.snippet || 'No preview text'}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              {msg.mailbox_address}
                            </Badge>
                            {msg.direction === 'draft' && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                Draft
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Right Pane: Message Reader & Thread Actions */}
            <Card className="rounded-2xl lg:col-span-5 flex flex-col">
              {selectedMessage ? (
                <>
                  <CardHeader className="p-4 pb-3 border-b space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {selectedMessage.direction === 'draft' ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenDraftInComposer(selectedMessage)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            Continue Editing Draft
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleReplyFromWebmail(selectedMessage)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            Reply
                          </Button>
                        )}
                        {selectedMessage.folder !== 'archive' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => void handleMoveMessage(selectedMessage, 'archive')}
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {selectedMessage.folder !== 'inbox' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => void handleMoveMessage(selectedMessage, 'inbox')}
                          >
                            Move to Inbox
                          </Button>
                        )}
                        {selectedMessage.folder === 'trash' ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => void handleDeleteForever(selectedMessage)}
                          >
                            Delete Forever
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs text-destructive"
                            onClick={() => void handleMoveMessage(selectedMessage, 'trash')}
                            title="Move to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {selectedMessage.provider} · {selectedMessage.delivery_status}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <CardTitle className="text-base leading-snug">
                        {selectedMessage.subject || '(No subject)'}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          <strong>From:</strong>{' '}
                          {selectedMessage.from_name
                            ? `${selectedMessage.from_name} <${selectedMessage.from_email}>`
                            : selectedMessage.from_email}
                        </div>
                        <div>
                          <strong>To:</strong> {(selectedMessage.to_emails || []).join(', ') || '—'}
                        </div>
                        <div>
                          <strong>Date:</strong>{' '}
                          {new Date(selectedMessage.created_at).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 flex-1">
                    {selectedMessage.body_html ? (
                      <div className="rounded-xl border overflow-hidden bg-white">
                        <iframe
                          title="Email Message Content"
                          sandbox=""
                          srcDoc={selectedMessage.body_html}
                          className="w-full h-[390px] border-0"
                        />
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground bg-muted/20 rounded-xl p-4 min-h-[260px]">
                        {selectedMessage.body_text || selectedMessage.snippet || '(Empty message)'}
                      </pre>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="py-20 text-center text-muted-foreground space-y-2">
                  <Mail className="w-10 h-10 mx-auto opacity-35" />
                  <p className="text-sm font-medium">Select an email to read</p>
                  <p className="text-xs max-w-xs mx-auto">
                    Choose any message on the left to read its full contents, reply from your custom{' '}
                    <code>@niknote.online</code> mailbox, or click <strong>New Email</strong> to compose.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 2: COMPOSE & CUSTOMER BROADCAST                                 */}
        {/* =================================================================== */}
        <TabsContent value="compose" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Card className="rounded-2xl xl:col-span-7">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Custom Customer Email Composer
                    </CardTitle>
                    <CardDescription>
                      Send 1-to-1 custom emails or personalized broadcasts from any{' '}
                      <code>@niknote.online</code> mailbox
                    </CardDescription>
                  </div>

                  <div className="inline-flex rounded-xl border bg-muted/50 p-1">
                    <button
                      type="button"
                      onClick={() => setMode('single')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        mode === 'single'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Individual Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('campaign')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        mode === 'campaign'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Segment Broadcast
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Template Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    1. Choose Template
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CUSTOMER_EMAIL_TEMPLATES.map((tpl) => {
                      const active = selectedTemplateId === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl.id)}
                          className={`text-left rounded-xl border p-2.5 transition-all ${
                            active
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'hover:border-primary/40 hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-semibold truncate">{tpl.label}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {tpl.badge}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {tpl.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Mailbox Sender Picker */}
                <div className="space-y-2 rounded-xl border bg-muted/25 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      2. Send From Custom Mailbox
                    </Label>
                    <button
                      type="button"
                      onClick={() => setStudioTab('mailboxes')}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Manage / Create Mailboxes
                    </button>
                  </div>

                  {activeMailboxes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {activeMailboxes.map((mbx) => {
                        const selected = fromEmail.toLowerCase() === mbx.address.toLowerCase();
                        return (
                          <button
                            key={mbx.id}
                            type="button"
                            onClick={() => handleSelectSenderMailbox(mbx.id)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                              selected
                                ? 'bg-primary text-primary-foreground border-primary font-medium'
                                : 'bg-background hover:bg-muted text-foreground'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: selected ? '#fff' : mbx.color }}
                            />
                            {mbx.address}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="mf-from-name" className="text-xs">
                        Sender Display Name (NikNote / Team of NikNote)
                      </Label>
                      <Input
                        id="mf-from-name"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="Team of NikNote"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="mf-from-email" className="text-xs">
                        Custom Domain Address
                      </Label>
                      <Input
                        id="mf-from-email"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        placeholder="invite@niknote.online"
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Recipient(s) */}
                {mode === 'single' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mf-to-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        3. Customer Recipient
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowCcBcc((v) => !v)}
                        className="text-xs text-primary hover:underline"
                      >
                        {showCcBcc ? 'Hide CC / BCC' : '+ Add CC / BCC'}
                      </button>
                    </div>

                    {inReplyTo && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs">
                        <span className="truncate">
                          Replying to thread: <code className="font-mono">{inReplyTo}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setInReplyTo(undefined);
                            setReferences(undefined);
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <Input
                      id="mf-to-input"
                      aria-label="Recipient email address"
                      value={toInput}
                      onChange={(e) => setToInput(e.target.value)}
                      placeholder="customer@example.com (comma-separated for multiple)"
                      className="h-9 text-sm"
                    />

                    {knownCustomers.length > 0 && (
                      <div className="rounded-xl border bg-muted/20 p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            placeholder="Quick-pick customer from NikNote users..."
                            className="w-full bg-transparent text-xs outline-none"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                          {filteredKnownCustomers.map((c) => (
                            <button
                              key={c.email}
                              type="button"
                              onClick={() => {
                                setToInput(c.email);
                                if (c.name) setRecipientName(c.name);
                                if (c.plan) setCustomerPlan(c.plan);
                                if (c.institution) setInstitutionName(c.institution);
                                setLinkedUserId(c.userId);
                                setLinkedLeadId(c.leadId);
                              }}
                              className="text-[11px] px-2 py-0.5 rounded-md border bg-background hover:border-primary transition-colors"
                            >
                              {c.name ? `${c.name} (${c.email})` : c.email}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showCcBcc && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label className="text-xs">CC</Label>
                          <Input
                            value={ccInput}
                            onChange={(e) => setCcInput(e.target.value)}
                            placeholder="cc@niknote.online"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">BCC</Label>
                          <Input
                            value={bccInput}
                            onChange={(e) => setBccInput(e.target.value)}
                            placeholder="audit@niknote.online"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs">Customer Name (fills {'{{name}}'})</Label>
                        <Input
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="e.g. Priya Verma"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Institution (fills {'{{institution}}'})</Label>
                        <Input
                          value={institutionName}
                          onChange={(e) => setInstitutionName(e.target.value)}
                          placeholder="Optional school / college"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border bg-primary/5 p-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider">
                      3. Customer Audience Segment (1-to-1 Personalized)
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'all_users', label: 'All Customers', icon: Users },
                        { id: 'premium_users', label: 'Premium Active', icon: UserCheck },
                        { id: 'free_users', label: 'Free Tier Users', icon: Users },
                        { id: 'institution_leads', label: 'School Leads', icon: Building2 },
                        { id: 'custom', label: 'Custom List', icon: Mail },
                      ].map((seg) => {
                        const Icon = seg.icon;
                        const active = audience === seg.id;
                        return (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={() => setAudience(seg.id as CampaignAudience)}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{seg.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {audience === 'custom' && (
                      <Textarea
                        value={customCampaignEmails}
                        onChange={(e) => setCustomCampaignEmails(e.target.value)}
                        rows={3}
                        placeholder="Paste customer emails separated by commas or newlines..."
                        className="text-xs font-mono"
                      />
                    )}

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        Supports <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>,{' '}
                        <code>{'{{plan}}'}</code>, <code>{'{{institution}}'}</code>.
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Label className="text-xs">Max batch:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={campaignLimit}
                          onChange={(e) =>
                            setCampaignLimit(
                              Math.min(50, Math.max(1, Number(e.target.value) || 25)),
                            )
                          }
                          className="w-16 h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Subject & Body */}
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="mf-subject" className="text-xs font-semibold">
                      Subject Line
                    </Label>
                    <Input
                      id="mf-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject line..."
                      className="h-9 text-sm font-medium"
                    />
                  </div>

                  {useBrandedWrapper && (
                    <div className="space-y-1">
                      <Label htmlFor="mf-heading" className="text-xs">
                        Email Banner Heading (optional)
                      </Label>
                      <Input
                        id="mf-heading"
                        value={heading}
                        onChange={(e) => setHeading(e.target.value)}
                        placeholder="Headline inside email card"
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  {/* Aesthetic Email Style Selector */}
                  <div className="space-y-1.5 rounded-xl border bg-amber-50/40 dark:bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                        Email Design &amp; Typography Style
                      </Label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <Switch
                            checked={appendSignature}
                            onCheckedChange={setAppendSignature}
                          />
                          Mailbox Signature
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUseBrandedWrapper(true);
                          setEmailStyle('handwritten');
                        }}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          useBrandedWrapper && emailStyle === 'handwritten'
                            ? 'border-pink-500 bg-pink-500/10 ring-1 ring-pink-500/30'
                            : 'bg-background hover:bg-muted/60'
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span style={{ fontFamily: "'Kalam', 'Caveat', cursive", fontSize: '14px' }}>
                            Handwritten Note ✨
                          </span>
                          <Badge className="bg-pink-600 hover:bg-pink-600 text-white text-[9px] px-1.5 py-0">
                            Aesthetic
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          NikNote logo + warm ruled notebook paper + handwriting font
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUseBrandedWrapper(true);
                          setEmailStyle('clean');
                        }}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          useBrandedWrapper && emailStyle === 'clean'
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'bg-background hover:bg-muted/60'
                        }`}
                      >
                        <div className="text-xs font-semibold">Clean Branded Card</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          NikNote logo + crisp minimal card + modern sans font
                        </p>
                      </button>

                      <button
                        type="button"
                        aria-pressed={useBrandedWrapper && emailStyle === 'retro'}
                        onClick={() => {
                          setUseBrandedWrapper(true);
                          setEmailStyle('retro');
                        }}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          useBrandedWrapper && emailStyle === 'retro'
                            ? 'border-[#090707] bg-[#FFE17A] text-[#090707] ring-1 ring-[#090707]'
                            : 'bg-background hover:bg-muted/60'
                        }`}
                      >
                        <div className="text-xs font-semibold" style={{ fontFamily: 'Georgia, serif' }}>Retro Cartoon</div>
                        <p className="text-[11px] mt-0.5">Illustrated envelope, bold outlines &amp; vintage poster colors</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUseBrandedWrapper(false)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          !useBrandedWrapper
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'bg-background hover:bg-muted/60'
                        }`}
                      >
                        <div className="text-xs font-semibold">Plain Simple Email</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Unstyled text without stationery card or button
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mf-body" className="text-xs font-semibold">
                        Message Body
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        Signed strictly as <strong>NikNote</strong> / <strong>Team of NikNote</strong>
                      </span>
                    </div>
                    <Textarea
                      id="mf-body"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      rows={8}
                      placeholder="Write your note... Use **bold**, '- ' bullet points, and {{name}} variables."
                      className="text-sm leading-relaxed"
                      style={
                        useBrandedWrapper && emailStyle === 'handwritten'
                          ? { fontFamily: "'Kalam', 'Caveat', 'Segoe Print', cursive", fontSize: '16px' }
                          : undefined
                      }
                    />
                  </div>

                  {useBrandedWrapper && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs">Button Label (optional)</Label>
                        <Input
                          value={ctaLabel}
                          onChange={(e) => setCtaLabel(e.target.value)}
                          placeholder="Open NikNote"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Button Link URL</Label>
                        <Input
                          value={ctaUrl}
                          onChange={(e) => setCtaUrl(e.target.value)}
                          placeholder="https://www.niknote.online"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {mode === 'single' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer hover:underline">
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach files (PDF, PNG, DOCX — max 8 MB)
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleAttachmentUpload}
                          />
                        </label>
                      </div>
                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {attachments.map((att, idx) => (
                            <Badge key={`${att.filename}-${idx}`} variant="secondary" className="gap-1.5 py-1">
                              <span className="max-w-[180px] truncate text-xs">{att.filename}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setAttachments((prev) => prev.filter((_, i) => i !== idx))
                                }
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t">
                    <div className="flex items-center gap-2">
                      {mode === 'single' && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSaveDraft}
                          disabled={savingDraft || sending}
                          className="gap-1.5"
                        >
                          {savingDraft ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileEdit className="w-4 h-4" />
                          )}
                          {draftId ? 'Update Draft' : 'Save Draft'}
                        </Button>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={mode === 'single' ? handleSendSingle : handleSendCampaign}
                      disabled={sending}
                      className="gap-2 min-w-[190px]"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          {mode === 'single' ? 'Send Custom Email' : 'Send Personalized Broadcast'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Live Email Preview */}
            <Card className="rounded-2xl xl:col-span-5 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Live Customer Preview
                </CardTitle>
                <CardDescription className="text-xs space-y-0.5 pt-1">
                  <span className="block truncate">
                    <strong>From:</strong> {formatSenderPreview(fromName, fromEmail)}
                  </span>
                  <span className="block truncate">
                    <strong>Subject:</strong> {renderedPreviewSubject || '(No subject)'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="rounded-xl border overflow-hidden bg-[#f6f0e4] h-[560px]">
                  <iframe
                    title="Customer Email Preview"
                    sandbox="allow-same-origin"
                    srcDoc={renderedPreviewHtml}
                    className="w-full h-full border-0"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 3: CUSTOM MAILBOXES MANAGER (`@niknote.online`)                 */}
        {/* =================================================================== */}
        <TabsContent value="mailboxes" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Create Custom Mailbox Card */}
            <Card className="rounded-2xl lg:col-span-5">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Create Custom Mailbox
                </CardTitle>
                <CardDescription>
                  Create unlimited custom addresses like <code>invite@niknote.online</code>,{' '}
                  <code>team@niknote.online</code>, or <code>help@niknote.online</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateMailbox} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Custom Email Address</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={newMbxLocalPart}
                        onChange={(e) => setNewMbxLocalPart(e.target.value)}
                        placeholder="invite"
                        className="font-mono text-sm"
                      />
                      <span className="text-muted-foreground font-mono text-sm">@</span>
                      <select
                        value={newMbxDomainId}
                        onChange={(e) => setNewMbxDomainId(e.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-2.5 text-sm font-mono"
                      >
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.hostname}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sender Display Name</Label>
                      <Input
                        value={newMbxDisplayName}
                        onChange={(e) => setNewMbxDisplayName(e.target.value)}
                        placeholder="Team of NikNote"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mailbox Type</Label>
                      <select
                        value={newMbxType}
                        onChange={(e) => setNewMbxType(e.target.value as 'personal' | 'shared')}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="shared">Shared Team Inbox</option>
                        <option value="personal">Personal Mailbox</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Forward Incoming Copies To (optional)</Label>
                    <Input
                      value={newMbxForwardTo}
                      onChange={(e) => setNewMbxForwardTo(e.target.value)}
                      placeholder="your-personal@gmail.com"
                      className="text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Badge Color</Label>
                    <div className="flex items-center gap-2">
                      {MAILBOX_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewMbxColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            newMbxColor === c ? 'scale-110 border-foreground' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Default Email Signature</Label>
                    <Textarea
                      rows={3}
                      value={newMbxSignature}
                      onChange={(e) => setNewMbxSignature(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <Button type="submit" disabled={creatingMailbox} className="w-full gap-2">
                    {creatingMailbox ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AtSign className="w-4 h-4" />
                    )}
                    Create Custom Mailbox
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Mailboxes List + Settings Editor */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg">
                    Active Custom Mailboxes ({mailboxes.length})
                  </CardTitle>
                  <CardDescription>
                    Click <strong>Send Email</strong> to compose from any mailbox, or{' '}
                    <strong>Configure</strong> to edit signatures, forwarding, and auto-replies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mailboxes.map((mbx) => {
                    const unread = counts.byMailboxUnread[mbx.address.toLowerCase()] || 0;
                    return (
                      <div
                        key={mbx.id}
                        className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          mbx.disabled ? 'opacity-60 bg-muted/30' : 'bg-card'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: mbx.color || '#7c3aed' }}
                          >
                            {mbx.local_part.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-sm font-semibold truncate">
                                {mbx.address}
                              </span>
                              {mbx.is_default && (
                                <Badge className="text-[10px] h-4 px-1.5 bg-emerald-600 text-white">
                                  Default
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                                {mbx.mailbox_type}
                              </Badge>
                              {mbx.auto_reply_enabled && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5">
                                  <Bot className="w-2.5 h-2.5" /> Auto-Reply
                                </Badge>
                              )}
                              {unread > 0 && (
                                <Badge className="text-[10px] h-4 px-1.5">{unread} unread</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Display Name: <strong>{mbx.display_name}</strong>
                              {mbx.forward_to ? ` · Forwards to ${mbx.forward_to}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1"
                            onClick={() => {
                              handleSelectSenderMailbox(mbx.id);
                              setStudioTab('compose');
                            }}
                          >
                            <Send className="w-3 h-3" />
                            Send Email
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1"
                            onClick={() => {
                              setActiveMailboxFilter(mbx.address.toLowerCase());
                              setStudioTab('webmail');
                            }}
                          >
                            <Inbox className="w-3 h-3" />
                            Inbox
                          </Button>
                          {!mbx.is_default && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => void handleMakeDefaultMailbox(mbx)}
                            >
                              Set Default
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            onClick={() => setEditingMailbox({ ...mbx })}
                          >
                            Configure
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Per-Mailbox Settings Drawer Card */}
              {editingMailbox && (
                <Card className="rounded-2xl border-primary">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Mailbox Settings — <code>{editingMailbox.address}</code>
                      </CardTitle>
                      <CardDescription>
                        Configure display name, signature, forwarding, auto-responder, and Mailflare ID
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingMailbox(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Display Name</Label>
                        <Input
                          value={editingMailbox.display_name}
                          onChange={(e) =>
                            setEditingMailbox({ ...editingMailbox, display_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Forward className="w-3 h-3" /> Forward Incoming Mail To
                        </Label>
                        <Input
                          value={editingMailbox.forward_to}
                          onChange={(e) =>
                            setEditingMailbox({ ...editingMailbox, forward_to: e.target.value })
                          }
                          placeholder="Leave blank to disable forwarding"
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Mailflare Mailbox ID (optional per-mailbox override)</Label>
                      <Input
                        value={editingMailbox.mailflare_mailbox_id}
                        onChange={(e) =>
                          setEditingMailbox({
                            ...editingMailbox,
                            mailflare_mailbox_id: e.target.value,
                          })
                        }
                        placeholder="mbx_... (uses global Mailflare Mailbox ID if blank)"
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Email Signature</Label>
                      <Textarea
                        rows={3}
                        value={editingMailbox.signature}
                        onChange={(e) =>
                          setEditingMailbox({ ...editingMailbox, signature: e.target.value })
                        }
                        className="text-xs"
                      />
                    </div>

                    <div className="rounded-xl border bg-muted/25 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                            Automatic Customer Reply (Auto-Responder)
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Automatically send an instant acknowledgement when a customer emails this mailbox
                          </p>
                        </div>
                        <Switch
                          checked={editingMailbox.auto_reply_enabled}
                          onCheckedChange={(v) =>
                            setEditingMailbox({ ...editingMailbox, auto_reply_enabled: v })
                          }
                        />
                      </div>
                      {editingMailbox.auto_reply_enabled && (
                        <div className="space-y-2 pt-1">
                          <Input
                            value={editingMailbox.auto_reply_subject}
                            onChange={(e) =>
                              setEditingMailbox({
                                ...editingMailbox,
                                auto_reply_subject: e.target.value,
                              })
                            }
                            placeholder="Auto-reply subject"
                            className="h-8 text-xs"
                          />
                          <Textarea
                            rows={3}
                            value={editingMailbox.auto_reply_body}
                            onChange={(e) =>
                              setEditingMailbox({
                                ...editingMailbox,
                                auto_reply_body: e.target.value,
                              })
                            }
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteMailbox(editingMailbox)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Delete Mailbox
                        </Button>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                          <Switch
                            checked={!editingMailbox.disabled}
                            onCheckedChange={(v) =>
                              setEditingMailbox({ ...editingMailbox, disabled: !v })
                            }
                          />
                          Mailbox Enabled
                        </label>
                      </div>
                      <Button
                        type="button"
                        onClick={handleSaveMailboxEdit}
                        disabled={savingMailboxEdit}
                        className="gap-1.5"
                      >
                        {savingMailboxEdit ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Save Mailbox Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 4: CUSTOM DOMAINS, LIVE DNS CHECKER & MAILFLARE / RESEND SETUP  */}
        {/* =================================================================== */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Custom Domains & Live DNS Checker */}
            <Card className="rounded-2xl lg:col-span-6">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Custom Email Domains &amp; Live DNS Verification
                </CardTitle>
                <CardDescription>
                  Verify MX, SPF, and DMARC records for <code>niknote.online</code> or add extra domains.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddDomain} className="flex flex-wrap gap-2">
                  <Input
                    value={newDomainHostname}
                    onChange={(e) => setNewDomainHostname(e.target.value)}
                    placeholder="Add domain (e.g. mail.niknote.online)"
                    className="flex-1 min-w-[200px] font-mono text-sm h-9"
                  />
                  <select
                    value={newDomainSendingProvider}
                    onChange={(e) =>
                      setNewDomainSendingProvider(e.target.value as 'mailflare' | 'resend')
                    }
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
                  >
                    <option value="mailflare">Mailflare</option>
                    <option value="resend">Resend</option>
                  </select>
                  <Button type="submit" size="sm" disabled={addingDomain} className="h-9 gap-1">
                    {addingDomain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Domain
                  </Button>
                </form>

                <div className="space-y-3">
                  {domains.map((dom) => (
                    <div key={dom.id} className="rounded-xl border p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">{dom.hostname}</span>
                          {dom.is_primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                          <Badge
                            variant={dom.dns_status === 'verified' ? 'default' : 'outline'}
                            className={
                              dom.dns_status === 'verified'
                                ? 'bg-emerald-600 text-white text-[10px]'
                                : 'text-[10px]'
                            }
                          >
                            DNS: {dom.dns_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={verifyingDomainId === dom.id}
                            onClick={() => void handleVerifyDns(dom)}
                          >
                            {verifyingDomainId === dom.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Verify DNS Live
                          </Button>
                          {!dom.is_primary && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive"
                              onClick={async () => {
                                try {
                                  await deleteEmailDomain(dom.id);
                                  toast.success(`Removed ${dom.hostname}`);
                                  void loadWorkspace();
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed');
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={dom.mx_verified ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                          {dom.mx_verified ? '✓ MX Verified' : '○ MX Pending'}
                        </span>
                        <span className={dom.spf_verified ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                          {dom.spf_verified ? '✓ SPF Verified' : '○ SPF Pending'}
                        </span>
                        <span className={dom.dmarc_verified ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                          {dom.dmarc_verified ? '✓ DMARC Verified' : '○ DMARC Recommended'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recommended DNS Records Table */}
                <div className="rounded-xl border bg-muted/25 p-3 space-y-2 text-xs">
                  <p className="font-semibold">Recommended DNS Records for <code>niknote.online</code>:</p>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-2 bg-background p-2 rounded border">
                      <span className="truncate">TXT @ → v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 shrink-0"
                        onClick={() =>
                          copyText(
                            'v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all',
                            'Copied SPF record',
                          )
                        }
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-background p-2 rounded border">
                      <span className="truncate">TXT _dmarc → v=DMARC1; p=quarantine; rua=mailto:support@niknote.online</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 shrink-0"
                        onClick={() =>
                          copyText(
                            'v=DMARC1; p=quarantine; rua=mailto:support@niknote.online',
                            'Copied DMARC record',
                          )
                        }
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Inbound Webhook Endpoint */}
                {webhookSecretUrl && (
                  <div className="rounded-xl border bg-primary/5 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5 text-primary" />
                        Live Inbound Email Webhook URL
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => void handleSaveConfig(true)}
                      >
                        Rotate Secret
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Paste this URL in Mailflare Webhooks or Resend/Cloudflare Inbound so incoming customer emails appear automatically inside your Admin Inbox:
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Input
                        readOnly
                        value={webhookSecretUrl}
                        className="h-8 text-[11px] font-mono bg-background"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 shrink-0"
                        onClick={() => copyText(webhookSecretUrl, 'Copied Inbound Webhook URL')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outbound Provider Configuration (Mailflare OR Resend Direct) */}
            <Card className="rounded-2xl lg:col-span-6">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  Mailflare Server &amp; Outbound Delivery Settings
                </CardTitle>
                <CardDescription>
                  Connect your self-hosted <code>./mailflare</code> server OR paste a Resend API key (3,000 free emails/month) to send immediately. All secrets stay encrypted on the server.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCfgProvider('mailflare')}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      cfgProvider === 'mailflare'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Mailflare Server</span>
                      <Badge variant="default" className="text-[10px]">Full Suite</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uses <code>./mailflare</code> (<code>/api/v1/send</code> &amp; <code>/api/v1/messages</code>).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCfgProvider('resend')}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      cfgProvider === 'resend'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Resend Direct (Instant)</span>
                      <Badge variant="outline" className="text-[10px]">Zero-Server</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send from <code>@niknote.online</code> immediately with just a Resend API key.
                    </p>
                  </button>
                </div>

                {cfgProvider === 'mailflare' ? (
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="cfg-url" className="text-xs font-semibold">
                        Mailflare Instance URL (HTTPS)
                      </Label>
                      <Input
                        id="cfg-url"
                        value={cfgUrl}
                        onChange={(e) => setCfgUrl(e.target.value)}
                        placeholder="https://mail.niknote.online"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cfg-mail-key" className="text-xs font-semibold">
                          Mailflare Mail API Key (<code>send</code>, <code>read</code>)
                        </Label>
                        <Input
                          id="cfg-mail-key"
                          type="password"
                          value={cfgApiKey}
                          onChange={(e) => setCfgApiKey(e.target.value)}
                          placeholder={
                            config?.hasMailflareKey
                              ? `Saved (${config.maskedMailflareKey})`
                              : 'Paste Mailflare API key'
                          }
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cfg-admin-key" className="text-xs">
                          Admin API Key (optional — auto-provisions mailboxes)
                        </Label>
                        <Input
                          id="cfg-admin-key"
                          type="password"
                          value={cfgAdminKey}
                          onChange={(e) => setCfgAdminKey(e.target.value)}
                          placeholder={
                            config?.hasMailflareAdminKey
                              ? `Saved (${config.maskedMailflareAdminKey})`
                              : 'Optional mailboxes/domains key'
                          }
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="cfg-mailbox-id" className="text-xs font-semibold">
                          Default Mailflare Mailbox ID
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleDiscoverMailboxes}
                          disabled={discovering}
                          className="h-7 text-xs gap-1.5"
                        >
                          {discovering ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Search className="w-3 h-3" />
                          )}
                          Auto-Detect Mailboxes
                        </Button>
                      </div>
                      <Input
                        id="cfg-mailbox-id"
                        value={cfgMailboxId}
                        onChange={(e) => setCfgMailboxId(e.target.value)}
                        placeholder="mbx_01J..."
                        className="font-mono text-sm"
                      />
                      {discoveredMailboxes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {discoveredMailboxes.map((mbx) => (
                            <button
                              key={mbx.id}
                              type="button"
                              onClick={() => {
                                setCfgMailboxId(mbx.id);
                                if (isValidEmailAddress(mbx.address)) setCfgFromEmail(mbx.address);
                                if (mbx.displayName) setCfgFromName(mbx.displayName);
                              }}
                              className={`text-xs px-2.5 py-1 rounded-lg border font-mono ${
                                cfgMailboxId === mbx.id
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-muted'
                              }`}
                            >
                              {mbx.address} ({mbx.id.slice(0, 10)}…)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border bg-muted/20 p-3.5">
                    <Label htmlFor="cfg-resend-key" className="text-xs font-semibold">
                      Resend API Key (3,000 free emails/mo for @niknote.online)
                    </Label>
                    <Input
                      id="cfg-resend-key"
                      type="password"
                      value={cfgResendKey}
                      onChange={(e) => setCfgResendKey(e.target.value)}
                      placeholder={
                        config?.hasResendKey ? `Saved (${config.maskedResendKey})` : 're_...'
                      }
                      className="font-mono text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Default From Name</Label>
                    <Input
                      value={cfgFromName}
                      onChange={(e) => setCfgFromName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default From Email</Label>
                    <Input
                      value={cfgFromEmail}
                      onChange={(e) => setCfgFromEmail(e.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reply-To (optional)</Label>
                    <Input
                      value={cfgReplyTo}
                      onChange={(e) => setCfgReplyTo(e.target.value)}
                      placeholder="support@niknote.online"
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    Encrypted in Supabase (<code>service_role</code> RLS).
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTestConnection(false)}
                      disabled={testing || savingConfig}
                    >
                      Verify Connection
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSaveConfig(false)}
                      disabled={savingConfig}
                      className="gap-1.5"
                    >
                      {savingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save Settings
                    </Button>
                  </div>
                </div>

                {/* Live Test Email Box */}
                <div className="rounded-xl border bg-muted/20 p-3 flex flex-col sm:flex-row gap-2">
                  <Input
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="Send test email to (e.g. your@gmail.com)"
                    className="h-9 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleTestConnection(true)}
                    disabled={testing}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Test Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 5: SENT AUDIT LOGS                                              */}
        {/* =================================================================== */}
        <TabsContent value="logs">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">Customer Email Audit Log</CardTitle>
                <CardDescription>
                  Sent: <strong>{logSummary.totalSent}</strong> · Last 24h:{' '}
                  <strong>{logSummary.last24hSent}</strong> · Failed:{' '}
                  <strong>{logSummary.totalFailed}</strong>
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="gap-1.5 self-start"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                Refresh Logs
              </Button>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No customer emails logged yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Time</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">From Mailbox</th>
                        <th className="py-2 pr-3">Subject</th>
                        <th className="py-2 pr-3">Provider</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {logs.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-xs">{item.recipient_email}</div>
                            {item.recipient_name && (
                              <div className="text-[11px] text-muted-foreground">
                                {item.recipient_name}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-xs font-mono text-muted-foreground">
                            {item.from_address}
                          </td>
                          <td className="py-2.5 pr-3 max-w-xs">
                            <div className="text-xs font-medium truncate">{item.subject}</div>
                            {item.error_message && (
                              <div className="text-[11px] text-destructive mt-0.5">
                                {item.error_message}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {item.provider}
                            </Badge>
                          </td>
                          <td className="py-2.5">
                            {item.status === 'sent' ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
                                Sent
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Failed
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
};
