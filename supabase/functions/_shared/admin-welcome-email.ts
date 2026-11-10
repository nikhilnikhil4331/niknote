export const NIKNOTE_WELCOME_TEMPLATE_ID = 'niknote-welcome-v1';

const SITE_URL = 'https://niknote.online';
const WORDMARK_URL = `${SITE_URL}/images/brand/niknote-primary-wordmark.png`;
const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap';
const BODY_FONT = "'Inter', 'Aptos', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const DISPLAY_FONT = "'Fredoka', 'Inter', 'Aptos', 'Segoe UI', Arial, sans-serif";

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] || character));

function safeName(value: string): string {
  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, 100);
  return cleaned || 'creator';
}

export function buildNikNoteWelcomeEmail(customerName: string): {
  subject: string;
  html: string;
  text: string;
} {
  const name = safeName(customerName);
  const subject = 'Welcome to NikNote — make room for bright ideas';
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <link href="${escapeHtml(FONT_STYLESHEET_URL)}" rel="stylesheet">
  <style type="text/css">
    .nn-email-body { font-family: ${BODY_FONT}; }
    .nn-email-display { font-family: ${DISPLAY_FONT}; }
    @media only screen and (max-width: 620px) {
      .nn-email-shell { width: 100% !important; }
      .nn-email-gutter { padding: 18px 10px !important; }
      .nn-email-card { padding: 28px 21px !important; }
      .nn-email-title { font-size: 34px !important; line-height: 1.12 !important; }
      .nn-email-cta { display: block !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body class="nn-email-body" style="margin:0; padding:0; background-color:#F4F6FB; color:#182235; font-family:${BODY_FONT}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">Your NikNote space is ready. Save a thought, plan your day, or start a fresh note.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background-color:#F4F6FB;">
    <tr>
      <td align="center" class="nn-email-gutter" style="padding:24px 14px 32px;">
        <table role="presentation" class="nn-email-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <a href="${SITE_URL}/" style="display:inline-block; color:#182235; text-decoration:none;">
                <img src="${WORDMARK_URL}" width="124" alt="NikNote" style="display:block; width:124px; max-width:100%; height:auto; border:0; color:#182235; font-family:${DISPLAY_FONT}; font-size:28px; font-weight:700;">
              </a>
            </td>
          </tr>
          <tr>
            <td class="nn-email-card" style="padding:34px 40px 32px; background-color:#FFFFFF; border:1px solid #DCE4F0; border-top:5px solid #3285F4; border-radius:22px; box-shadow:0 14px 38px rgba(20,32,55,.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                <tr>
                  <td align="center" style="padding:0 0 18px;">
                    <span style="display:inline-block; padding:8px 13px; border:1px solid #DCE4F0; border-radius:999px; background-color:#F4F8FF; color:#2869D5; font-family:${BODY_FONT}; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">A little note from NikNote</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 7px; color:#64748B; font-family:${BODY_FONT}; font-size:14px; line-height:1.5;">Hi ${escapeHtml(name)},</td>
                </tr>
                <tr>
                  <td align="center" class="nn-email-title nn-email-display" style="padding:0 0 13px; color:#111827; font-family:${DISPLAY_FONT}; font-size:40px; font-weight:700; line-height:1.12;">Make room for<br><span style="color:#2869D5;">bright ideas.</span></td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 21px; color:#526076; font-family:${BODY_FONT}; font-size:16px; line-height:1.75;">
                    Thanks for joining NikNote. Your space for notes, study plans, and everyday ideas is ready whenever you are.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr><td align="center" bgcolor="#3285F4" style="border:1px solid #182235; border-radius:12px; background-color:#3285F4; box-shadow:0 3px 0 #182235;">
                        <a class="nn-email-cta" href="${SITE_URL}/" style="display:inline-block; padding:14px 25px; color:#FFFFFF; font-family:${BODY_FONT}; font-size:15px; font-weight:800; line-height:1.2; text-decoration:none;">OPEN NIKNOTE&nbsp; →</a>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px 18px; border:1px solid #E4EAF2; border-radius:14px; background-color:#F8FAFD; color:#526076; font-family:${BODY_FONT}; font-size:13px; line-height:1.65;">
                    Start small: capture one thought, give it a title, and come back to it whenever you need.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:24px 0 0; color:#64748B; font-family:${BODY_FONT}; font-size:13px; line-height:1.7;">
                    Need a hand? <a href="mailto:support@niknote.online" style="color:#2869D5; font-weight:700; text-decoration:underline;">support@niknote.online</a><br>
                    Made for your next bright idea.<br>
                    <span style="color:#334155; font-weight:800;">NikNote</span> · <a href="${SITE_URL}/" style="color:#526076; text-decoration:underline;">niknote.online</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td align="center" style="padding:15px 10px 0; color:#94A3B8; font-family:${BODY_FONT}; font-size:11px; line-height:1.5;">You received this account welcome email because you joined NikNote.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = [
    `Hi ${name},`,
    '',
    'Thanks for joining NikNote. Your space for notes, study plans, and everyday ideas is ready whenever you are.',
    '',
    'Start small: capture one thought, give it a title, and come back to it whenever you need.',
    '',
    `Open NikNote: ${SITE_URL}/`,
    '',
    'Need a hand? support@niknote.online',
    'NikNote · https://niknote.online/',
    '',
    'You received this account welcome email because you joined NikNote.',
  ].join('\n');

  return { subject, html, text };
}
