// ============================================================
// NikNote 4.0 — Referral & Viral Growth Engine
// "3 friends batao, Premium free pao!" system
// ============================================================

const REFERRAL_BONUS = 3; // invite 3 friends to unlock premium perk
const REFERRAL_KEY = 'niknote_referral';
const REFERRAL_COUNT_KEY = 'niknote_referral_count';
const REFERRAL_REWARDED_KEY = 'niknote_referral_rewarded';

// Generate unique referral code for a user
export function generateReferralCode(userId: string): string {
  const hash = userId.slice(0, 8).toUpperCase();
  return `NIK-${hash}`;
}

// Get referral link
export function getReferralLink(userId?: string): string {
  const code = userId ? generateReferralCode(userId) : 'NIKNOTE';
  return `https://www.niknote.online/?ref=${code}`;
}

// Check if user came from a referral
export function checkReferral(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  if (refCode) {
    localStorage.setItem(REFERRAL_KEY, refCode);
    // Track that this referrer sent a new user
    trackReferralVisit(refCode);
    return refCode;
  }
  return localStorage.getItem(REFERRAL_KEY);
}

// Track referral visit (local storage based — server side would be better)
function trackReferralVisit(refCode: string): void {
  try {
    const key = `niknote_ref_visits_${refCode}`;
    const visits = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (visits + 1).toString());
  } catch (e) {
    // ignore
  }
}

// Get referral stats for current user
export function getReferralStats(userId: string): {
  code: string;
  link: string;
  visits: number;
  count: number;
  rewarded: boolean;
  needed: number;
} {
  const code = generateReferralCode(userId);
  const link = getReferralLink(userId);
  const visitKey = `niknote_ref_visits_${code}`;
  const visits = parseInt(localStorage.getItem(visitKey) || '0', 10);
  const count = parseInt(localStorage.getItem(REFERRAL_COUNT_KEY) || '0', 10);
  const rewarded = localStorage.getItem(REFERRAL_REWARDED_KEY) === 'true';

  return {
    code,
    link,
    visits,
    count,
    rewarded,
    needed: Math.max(0, REFERRAL_BONUS - count),
  };
}

// Mark a referral conversion (called when a referred user signs up)
export function markReferralConversion(): void {
  const refCode = localStorage.getItem(REFERRAL_KEY);
  if (!refCode) return;

  // Increment referrer's count
  const count = parseInt(localStorage.getItem(REFERRAL_COUNT_KEY) || '0', 10);
  const newCount = count + 1;
  localStorage.setItem(REFERRAL_COUNT_KEY, newCount.toString());

  // Check if reward threshold met
  if (newCount >= REFERRAL_BONUS) {
    localStorage.setItem(REFERRAL_REWARDED_KEY, 'true');
  }

  // Clear referral code
  localStorage.removeItem(REFERRAL_KEY);
}

// Get WhatsApp share message for referral
export function getReferralWhatsAppMessage(userId?: string): string {
  const link = getReferralLink(userId);
  return encodeURIComponent(
    `🎓 Bhai ye dekh! NikNote — Free AI Study App 🤩\n\n` +
    `✍️ Text ko handwriting mein convert karo (16+ styles)\n` +
    `🧠 AI Teacher — Hindi mein samjhata hai!\n` +
    `📝 Quiz + Flashcards generator\n` +
    `📱 Phone + Laptop dono pe kaam karta hai\n\n` +
    `Abhi try karo (free hai!): ${link}\n\n` +
    `3 dosto ko bhejo — Premium free mein! 🎁`
  );
}

// Get all viral share messages
export function getViralShareMessages(): {
  whatsapp: string[];
  telegram: string[];
  twitter: string[];
} {
  return {
    whatsapp: [
      '🎓 Bhai ye app dekh! AI se notes banta hai + handwriting mein convert karta hai. Free hai! 👇',
      '📚 Padhai asaan bana di! AI Teacher + Handwriting Notes + Quiz Generator. Try karo free mein! 👇',
      '🔥 Ye app se meri padhai ka level upar ho gaya! Notes handwriting mein, AI se samjhai, quiz practice — sab ek jagah. Free try karo! 👇',
      '✍️ Tumhe pata hai? Text type karo aur realistic handwriting mein convert ho jaata hai! School/college ke liye perfect. Free hai! 👇',
    ],
    telegram: [
      '🎓 Check out NikNote — India ka best AI study app! Free mein try karo!',
      '📚 AI Teacher + Handwriting Notes + Quiz Generator = NikNote. Indian students ke liye! 👇',
    ],
    twitter: [
      'Just found @NikNote — an AI study app made for Indian students! 🇮🇳\n\n✍️ Handwriting notes\n🧠 AI Teacher (Hindi!)\n📝 Quiz generator\n📱 Works offline\n\nTry free → niknote.online',
      'NikNote is like Notion + ChatGPT + GoodNotes for Indian students! 🎓\n\nFree to start. 16+ handwriting styles, AI teacher in Hindi, quiz generator.\n\nTry it → niknote.online',
    ],
  };
}

// Get growth metrics for display
export function getGrowthMetrics(): {
  totalShareClicks: number;
  whatsappShares: number;
  telegramShares: number;
  twitterShares: number;
  referralSignups: number;
} {
  try {
    return {
      totalShareClicks: parseInt(localStorage.getItem('niknote_share_clicks') || '0', 10),
      whatsappShares: parseInt(localStorage.getItem('niknote_wa_shares') || '0', 10),
      telegramShares: parseInt(localStorage.getItem('niknote_tg_shares') || '0', 10),
      twitterShares: parseInt(localStorage.getItem('niknote_tw_shares') || '0', 10),
      referralSignups: parseInt(localStorage.getItem(REFERRAL_COUNT_KEY) || '0', 10),
    };
  } catch {
    return { totalShareClicks: 0, whatsappShares: 0, telegramShares: 0, twitterShares: 0, referralSignups: 0 };
  }
}

// Track a share action
export function trackShare(platform: 'whatsapp' | 'telegram' | 'twitter' | 'copy'): void {
  try {
    const key = platform === 'whatsapp' ? 'niknote_wa_shares'
      : platform === 'telegram' ? 'niknote_tg_shares'
      : platform === 'twitter' ? 'niknote_tw_shares'
      : 'niknote_copy_shares';

    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());

    const total = parseInt(localStorage.getItem('niknote_share_clicks') || '0', 10);
    localStorage.setItem('niknote_share_clicks', (total + 1).toString());
  } catch (e) {
    // ignore
  }
}
