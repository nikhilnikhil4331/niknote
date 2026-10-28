import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, MessageCircle, BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { blogPosts, type BlogPost } from '@/content/blogPosts';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { trackShare } from '@/utils/referral';
import { trackClickCTA } from '@/lib/tracking';

function getContextualToolLinks(post: BlogPost): { label: string; to: string; desc: string }[] {
  const tagsJoined = `${post.slug} ${post.tags.join(' ')}`.toLowerCase();
  const links: { label: string; to: string; desc: string }[] = [
    {
      label: 'Handwriting Notes Editor',
      to: '/',
      desc: 'Type or paste notes and convert into 16+ realistic handwriting styles.',
    },
  ];

  if (tagsJoined.includes('flashcard')) {
    links.push({
      label: 'Online Study Flashcards',
      to: '/flashcards',
      desc: 'Practice active recall and exam revision cards.',
    });
  }
  if (tagsJoined.includes('ocr') || tagsJoined.includes('converter')) {
    links.push({
      label: 'Scan Handwritten Notes (OCR)',
      to: '/scan-notes',
      desc: 'Convert photos of handwritten English or Hindi notes into editable text.',
    });
  }
  if (tagsJoined.includes('school') || tagsJoined.includes('b2b') || tagsJoined.includes('institution')) {
    links.push({
      label: 'NikNote for Schools & Coaching',
      to: '/schools',
      desc: 'Teacher plans from ₹999/year, tuition centres from ₹4,999/year, free 30-day pilot.',
    });
  } else {
    links.push({
      label: 'NikAI Study Assistant',
      to: '/ai',
      desc: 'Ask study doubts in Hindi or English and generate quizzes.',
    });
  }

  links.push({
    label: 'Free PDF Tools & PDF Editor',
    to: '/pdf-tools',
    desc: 'Merge, split, compress, OCR, and convert PDFs in your browser.',
  });

  return links.slice(0, 3);
}

const BlogPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const selectedPost = slug ? blogPosts.find((p) => p.slug === slug) ?? null : null;

  useDocumentTitle(
    selectedPost
      ? {
          title: `${selectedPost.title} | NikNote Blog`,
          description: selectedPost.excerpt,
        }
      : slug
        ? {
            title: 'Article Not Found — NikNote Blog',
            description: 'The requested article could not be found. Browse all study guides on the NikNote Blog.',
          }
        : {
            title: 'NikNote Blog — Handwritten Notes Tutorials, AI Study Tips & Exam Guides',
            description:
              'Step-by-step guides on converting text to handwriting, making CBSE, JEE, NEET & UPSC notes, using flashcards, and studying effectively in Hindi and English.',
          },
  );

  const handleShare = (post: BlogPost) => {
    const msg = encodeURIComponent(
      `${post.title}\n\n${post.excerpt}\n\nRead more: https://www.niknote.online/blog/${post.slug}`,
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    trackShare('whatsapp');
  };

  if (slug && !selectedPost) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card/80 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" asChild className="gap-2">
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4" />
                Back to Blog
              </Link>
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 max-w-2xl text-center space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Article not found</h1>
          <p className="text-muted-foreground">
            This guide may have moved. Explore all handwritten-note tutorials and exam study guides on our blog.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link to="/blog">Browse all guides</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Open Handwriting Editor</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (selectedPost) {
    const relatedPosts = blogPosts.filter((p) => p.slug !== selectedPost.slug).slice(0, 3);
    const toolLinks = getContextualToolLinks(selectedPost);

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <Button variant="ghost" asChild className="gap-2">
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4" />
                All Guides
              </Link>
            </Button>
            <Link to="/" className="text-sm font-semibold text-primary hover:underline">
              Open NikNote Editor →
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-5 flex flex-wrap items-center gap-1.5">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-foreground">Blog</Link>
            <span>/</span>
            <span className="text-foreground truncate max-w-[260px] sm:max-w-md">{selectedPost.title}</span>
          </nav>

          <article>
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {selectedPost.category}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {selectedPost.readTime}
                </span>
                {selectedPost.date && (
                  <time dateTime={selectedPost.date} className="text-xs text-muted-foreground">
                    {selectedPost.date}
                  </time>
                )}
                <span className="text-xs text-muted-foreground">By Nikhil Jatav</span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">
                {selectedPost.title}
              </h1>
              <p className="text-base text-muted-foreground mb-4">{selectedPost.excerpt}</p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare(selectedPost)}
                  className="gap-1.5 text-green-600 border-green-200"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Share on WhatsApp
                </Button>
              </div>
            </header>

            <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Keep exactly one H1 on the page by demoting markdown # to h2
                  h1: ({ children }) => <h2 className="text-xl sm:text-2xl font-bold mt-7 mb-3 text-foreground">{children}</h2>,
                  h2: ({ children }) => <h2 className="text-xl sm:text-2xl font-bold mt-7 mb-3 text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h3>,
                }}
              >
                {selectedPost.content}
              </ReactMarkdown>
            </div>

            {/* Contextual Product Links (Phase 11 Internal Linking) */}
            <section aria-label="Related NikNote tools" className="mt-10 pt-8 border-t border-border/60">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Try These NikNote Tools
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {toolLinks.map((tool) => (
                  <Link
                    key={tool.to}
                    to={tool.to}
                    className="p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-colors block"
                  >
                    <div className="text-sm font-semibold text-primary mb-1">{tool.label}</div>
                    <p className="text-xs text-muted-foreground leading-snug">{tool.desc}</p>
                  </Link>
                ))}
              </div>
            </section>

            {/* Primary CTA */}
            <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/10 text-center">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Create Realistic Handwritten Notes Online
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Start writing in 16+ handwriting styles, ask NikAI study doubts in Hindi or English, and export print-ready PDFs.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => {
                    trackClickCTA({
                      buttonLocation: 'blog_article_cta',
                      conversionSource: `blog_${selectedPost.slug}`,
                      pageType: 'blog_post',
                    });
                    navigate('/');
                  }}
                  className="rounded-full bg-gradient-to-r from-primary to-blue-600"
                >
                  Start Writing Free
                </Button>
                <Button variant="outline" asChild className="rounded-full">
                  <Link to="/upgrade">View Pricing Plans</Link>
                </Button>
              </div>
            </div>
          </article>

          {/* Related Guides */}
          <section aria-label="More study guides" className="mt-12 pt-8 border-t border-border/60">
            <h2 className="text-xl font-bold text-foreground mb-4">More Study &amp; Handwriting Guides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all block"
                >
                  <span className="text-[11px] font-semibold text-primary">{post.category}</span>
                  <h3 className="text-sm font-semibold text-foreground mt-1 line-clamp-2">{post.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Blog index (/blog)
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" asChild className="gap-2">
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
                Back to NikNote
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground">NikNote Blog</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Handwritten Notes Tutorials, AI Study Tips &amp; Exam Guides
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Practical tutorials on converting text to realistic handwriting, preparing CBSE, JEE, NEET &amp; UPSC notes, and studying smarter in Hindi &amp; English.
          </p>
          <nav aria-label="Quick feature links" className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
            <Link to="/" className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90">Handwriting Editor</Link>
            <Link to="/ai" className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90">NikAI Tutor</Link>
            <Link to="/pdf-editor" className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90">PDF Editor</Link>
            <Link to="/pdf-tools" className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90">PDF Tools</Link>
            <Link to="/scan-notes" className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90">Scan Notes OCR</Link>
            <Link to="/flashcards" className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:opacity-90">Flashcards</Link>
          </nav>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {blogPosts.map((post, index) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.3) }}
              className="group"
            >
              <Link
                to={`/blog/${post.slug}`}
                className="block h-full p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                    {post.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                  {post.date && (
                    <span className="text-[11px] text-muted-foreground ml-auto">{post.date}</span>
                  )}
                </div>
                <h2 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </motion.article>
          ))}
        </div>

        <footer className="mt-14 pt-6 border-t border-border/50 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} NikNote</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/welcome" className="hover:text-foreground">How It Works</Link>
            <Link to="/upgrade" className="hover:text-foreground">Pricing</Link>
            <Link to="/schools" className="hover:text-foreground">For Schools</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default BlogPage;
