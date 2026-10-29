import React from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { SocialProofSection } from './SocialProofSection';
import { HowItWorksSection } from './HowItWorksSection';
import { FeatureShowcase } from './FeatureShowcase';
import { PreviewSection } from './PreviewSection';
import { PricingTeaser } from './PricingTeaser';
import { FAQSection } from './FAQSection';
import { CTASection } from './CTASection';
import { DisclaimerBanner } from './DisclaimerBanner';
import { LandingFooter } from './LandingFooter';
import { ReferralWidget } from '@/components/promotion/ReferralWidget';
import { TrustBar } from '@/components/premium/TrustBar';
import { ExitIntentPopup } from '@/components/urgency/ExitIntentPopup';
import { MobilePremiumBar } from '@/components/urgency/MobilePremiumBar';

interface LandingPageProps {
  isDark: boolean;
  onToggleDark: () => void;
  onStartWriting: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  isDark,
  onToggleDark,
  onStartWriting,
}) => {
  const handlePreviewNotes = () => {
    const previewSection = document.getElementById('preview-section');
    if (previewSection) {
      previewSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Urgency Banner at top */}
      <TrustBar variant="banner" />

      <LandingHeader 
        isDark={isDark} 
        onToggleDark={onToggleDark}
        onStartWriting={onStartWriting}
      />
      
      <main className="pt-16">
        <HeroSection 
          onStartWriting={onStartWriting}
          onPreviewNotes={handlePreviewNotes}
        />
        
        <SocialProofSection />
        
        <HowItWorksSection />
        
        <FeatureShowcase />
        
        <div id="preview-section">
          <PreviewSection />
        </div>
        
        {/* Urgency Card — between features and pricing for maximum conversion */}
        <div className="container mx-auto px-4 lg:px-6 max-w-lg py-6">
          <TrustBar variant="card" />
        </div>
        
        {/* Referral Widget — between features and pricing for maximum visibility */}
        <div className="container mx-auto px-4 lg:px-6 max-w-2xl py-8">
          <ReferralWidget variant="card" />
        </div>
        
        <PricingTeaser />
        
        <FAQSection />
        
        <CTASection onStartWriting={onStartWriting} />
        
        <DisclaimerBanner />
        
        <LandingFooter />
      </main>

      {/* Conversion urgency overlays */}
      <ExitIntentPopup />
      <MobilePremiumBar />
    </div>
  );
};
