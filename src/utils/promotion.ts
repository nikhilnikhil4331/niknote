// ============================================================
// NikNote 4.0 — SEO & Social Promotion Engine
// Generates SEO meta tags, social share links, sitemap
// ============================================================

import { getAllSitemapEntries } from '@/lib/seoConfig';

export const SITE_CONFIG = {
  name: 'NikNote',
  tagline: 'AI-Powered Handwriting Notes for Indian Students',
  description: 'Convert typed text into realistic handwritten notes. 16+ handwriting styles, AI teacher, smart editor, exam-focused notes. Free for Indian students!',
  url: 'https://www.niknote.online',
  logo: 'https://www.niknote.online/niknote-logo.png',
  keywords: [
    'handwriting notes', 'AI notes', 'handwritten notes app', 'student notes',
    'Indian students', 'NCERT notes', 'exam preparation', 'AI teacher',
    'handwriting app', 'convert text to handwriting', 'padhai notes',
    'likhavit notes', 'study app India', 'free notes maker',
    'handwriting practice', 'exam notes generator', 'CBSE notes',
    'ICSE notes', 'board exam notes', 'study tool', 'AI learning',
    'flashcards maker', 'mind map maker', 'quiz generator',
    'revision notes', 'last minute notes', 'cheat sheet maker',
  ],
  social: {
    twitter: '@NikNoteApp',
    ogType: 'website',
    locale: 'en_IN',
  },
};

// Generate share links for social platforms
export function getShareLinks(title: string, text: string, url: string = SITE_CONFIG.url) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(text);
  
  return {
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=NikNote,AIStudy,IndianStudents`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    copy: url,
  };
}

// Generate SEO-friendly page data
export function getPageSEO(page: string) {
  const pages: Record<string, { title: string; description: string; keywords: string[] }> = {
    home: {
      title: 'NikNote — AI Handwriting Notes for Indian Students | Free Study App',
      description: 'Convert typed text into realistic handwritten notes. AI teacher explains concepts, creates notes, quizzes & flashcards. 16+ handwriting styles. Free to start.',
      keywords: ['handwriting notes', 'AI teacher', 'student app', 'free notes', 'NCERT'],
    },
    ai: {
      title: 'NikNote AI Teacher — Learn Any Subject with AI | Free for Students',
      description: 'AI agents that teach, create notes, generate quizzes, make flashcards & mind maps. Works offline with 28+ built-in topics. Instant answers!',
      keywords: ['AI teacher', 'AI tutor', 'quiz generator', 'flashcards', 'study AI'],
    },
    login: {
      title: 'Login to NikNote — Your AI Study Companion',
      description: 'Sign in to access your handwritten notes, AI teacher, and study tools. Free for Indian students!',
      keywords: ['login', 'sign in', 'student login'],
    },
    signup: {
      title: 'Join NikNote — Free AI Study App for Indian Students',
      description: 'Create free account. Get AI teacher, handwriting notes, quizzes, flashcards & more. Join 1000s of Indian students!',
      keywords: ['sign up', 'free account', 'student registration'],
    },
  };
  return pages[page] || pages.home;
}

// Generate sitemap XML (canonical indexable public routes only)
export function generateSitemap(): string {
  const entries = getAllSitemapEntries();

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((u) => {
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>
    <loc>${u.loc}</loc>${lastmod}
  </url>`;
  })
  .join('\n')}
</urlset>`;
}

// Promotion messages for different platforms
export const PROMO_MESSAGES = {
  whatsapp: [
    `📚 *NikNote — Free AI Study App!* 🤖✨

Yeh app Indian students ke liye GAME CHANGER hai:
✅ Type karo → Handwriting mein convert
✅ AI Teacher — Explain, Notes, Quiz, Flashcards
✅ 28+ Topics instant answers (Newton, Photosynthesis, etc.)
✅ 16+ Handwriting styles
✅ Free to start, no card

👉 Try now: https://www.niknote.online

Share karo apne classmates ko! 🎓`,

    `🎓 Board exam prep? NikNote hai na! 📝

Free app jahan:
• AI Teacher concepts samjhata hai
• Notes handwriting mein ban jaate hain
• Quiz + Flashcards auto-generate
• NCERT focused content

🔗 https://www.niknote.online`,
  ],
  telegram: [
    `🚀 NikNote — AI Study App for Indian Students!

✍️ Text → Handwriting
🤖 AI Teacher, Quiz, Notes, Flashcards
📚 28+ Built-in Topics
🆓 Free tier, no ads

Try: https://www.niknote.online`,
  ],
  twitter: [
    `📚 NikNote — AI Study App for Indian Students!

✍️ Text → Handwriting
🤖 AI Teacher, Notes, Quiz, Flashcards
📝 Quiz + Flashcards
🆓 Free tier, no ads

Try now → https://www.niknote.online

#NikNote #AIStudy #IndianStudents #EdTech #StudyApp`,
  ],
  reddit: [
    `Free AI study app for Indian students - NikNote (made by an Indian dev)

Features:
- Convert typed text to 16+ handwriting styles
- AI agents for teacher mode, notes, quizzes, flashcards and mind maps
- 28+ offline topics with instant answers
- Exam-focused: NCERT, CBSE, ICSE patterns
- Free tier, no ads

Link: https://www.niknote.online

Would love feedback from fellow students!`,
  ],
  linkedin: [
    `Excited to share NikNote — an AI-powered learning platform built for Indian students! 🎓

What makes it different:
✍️ Realistic handwriting conversion (16+ styles)
🤖 9 specialized AI agents for learning
📝 Auto-generated quizzes, flashcards & mind maps
📚 28+ built-in topics covering Physics, Chemistry, Math, Biology & more
🆓 Completely free

Check it out: https://www.niknote.online

#EdTech #AI #Education #IndianStudents #NikNote`,
  ],
};
