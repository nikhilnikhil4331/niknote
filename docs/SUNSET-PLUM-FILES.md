# Sunset Plum — modified files

Total files changed in this branch: **248** (new + modified, `git status --porcelain -uall`).

## Theme foundation & config (6)

- `index.html`
- `public/theme-init.js`
- `src/App.css`
- `src/index.css`
- `src/styles/theme.css`
- `tailwind.config.ts`

## Design system — NK component library (20)

- `src/components/nk/NKBadge.tsx`
- `src/components/nk/NKButton.tsx`
- `src/components/nk/NKCalendar.tsx`
- `src/components/nk/NKCard.tsx`
- `src/components/nk/NKChart.tsx`
- `src/components/nk/NKCircularProgress.tsx`
- `src/components/nk/NKDropdown.tsx`
- `src/components/nk/NKEmptyState.tsx`
- `src/components/nk/NKFloatingActionButton.tsx`
- `src/components/nk/NKIconButton.tsx`
- `src/components/nk/NKInput.tsx`
- `src/components/nk/NKModal.tsx`
- `src/components/nk/NKNavigation.tsx`
- `src/components/nk/NKProgressBar.tsx`
- `src/components/nk/NKSearch.tsx`
- `src/components/nk/NKSidebar.tsx`
- `src/components/nk/NKSkeleton.tsx`
- `src/components/nk/NKToast.tsx`
- `src/components/nk/NKTooltip.tsx`
- `src/components/nk/index.ts`

## Tokens, appearance themes & tests (6)

- `src/design-system/tokens.ts`
- `src/hooks/useDarkMode.ts`
- `src/lib/readableInk.ts`
- `src/tests/readableInk.test.ts`
- `src/tests/themePersistence.test.ts`
- `src/utils/uiThemes.ts`

## Pages / screens (31)

- `src/pages/Account.tsx`
- `src/pages/Achievements.tsx`
- `src/pages/Admin.tsx`
- `src/pages/AdminLogin.tsx`
- `src/pages/AdminPanelNikhil.tsx`
- `src/pages/AgentConsole.tsx`
- `src/pages/AuditReports.tsx`
- `src/pages/B2BLanding.tsx`
- `src/pages/Blog.tsx`
- `src/pages/Board.tsx`
- `src/pages/Checkup.tsx`
- `src/pages/Donate.tsx`
- `src/pages/Feedback.tsx`
- `src/pages/Flashcards.tsx`
- `src/pages/Handbook.tsx`
- `src/pages/History.tsx`
- `src/pages/Hub.tsx`
- `src/pages/Index.tsx`
- `src/pages/LegalPage.tsx`
- `src/pages/MoneyTracker.tsx`
- `src/pages/MyNotebooks.tsx`
- `src/pages/NotFound.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/Payment.tsx`
- `src/pages/PremiumLanding.tsx`
- `src/pages/QA.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/RoutineApp.tsx`
- `src/pages/RoutineTracker.tsx`
- `src/pages/ScanNotes.tsx`
- `src/pages/Upgrade.tsx`

## Desktop workspace & admin (32)

- `src/components/admin/AdminActivityFeed.tsx`
- `src/components/admin/AdminAnalyticsCharts.tsx`
- `src/components/admin/AdminCSVExport.tsx`
- `src/components/admin/AdminCommandCenter.tsx`
- `src/components/admin/AdminControls.tsx`
- `src/components/admin/AdminErrorLogs.tsx`
- `src/components/admin/AdminFeatureHeatmap.tsx`
- `src/components/admin/AdminKPICards.tsx`
- `src/components/admin/AdminStatsCards.tsx`
- `src/components/admin/AdminUserDrawer.tsx`
- `src/components/admin/AdminUserFunnel.tsx`
- `src/components/admin/AdminUserList.tsx`
- `src/components/desktop/DesktopShell.tsx`
- `src/components/desktop/MiniMonthCalendar.tsx`
- `src/components/desktop/RightRail.tsx`
- `src/components/desktop/analytics/FocusInsights.tsx`
- `src/components/desktop/analytics/ProductivityOverview.tsx`
- `src/components/desktop/desktop.css`
- `src/components/desktop/focus/CircularDial.tsx`
- `src/components/desktop/focus/FocusTimerPanel.tsx`
- `src/components/desktop/focus/SessionHistory.tsx`
- `src/components/desktop/notes.ts`
- `src/components/desktop/store.ts`
- `src/components/desktop/widgets.tsx`
- `src/pages/DesktopCalendar.tsx`
- `src/pages/DesktopFocus.tsx`
- `src/pages/DesktopHome.tsx`
- `src/pages/DesktopNotes.tsx`
- `src/pages/DesktopShared.tsx`
- `src/pages/DesktopTasks.tsx`
- `src/pages/DesktopTemplates.tsx`
- `src/pages/DesktopTrash.tsx`

## Habit tracker (21)

- `src/components/habits/BigWaterGlass.tsx`
- `src/components/habits/FloatingNav.tsx`
- `src/components/habits/RoutineApp.tsx`
- `src/components/habits/RoutineProvider.tsx`
- `src/components/habits/charts.tsx`
- `src/components/habits/habits.css`
- `src/components/habits/screens/AddHabit.tsx`
- `src/components/habits/screens/CalendarView.tsx`
- `src/components/habits/screens/Exercise.tsx`
- `src/components/habits/screens/FocusTimer.tsx`
- `src/components/habits/screens/HabitDetail.tsx`
- `src/components/habits/screens/Habits.tsx`
- `src/components/habits/screens/Home.tsx`
- `src/components/habits/screens/Insights.tsx`
- `src/components/habits/screens/Profile.tsx`
- `src/components/habits/screens/Sleep.tsx`
- `src/components/habits/screens/Splash.tsx`
- `src/components/habits/screens/Streaks.tsx`
- `src/components/habits/ui.tsx`
- `src/lib/routineStore.ts`
- `src/lib/trackers.ts`

## Mobile experience (2)

- `src/components/mobile/MobileExperience.tsx`
- `src/components/mobile/mobile.css`

## PDF studio (6)

- `src/components/pdf-studio/PagePanel.tsx`
- `src/components/pdf-studio/PdfPageView.tsx`
- `src/components/pdf-studio/PdfStudio.tsx`
- `src/components/pdf-studio/RadialTools.tsx`
- `src/components/pdf-studio/pdf-studio.css`
- `src/components/pdf-tools/PdfTools.tsx`

## shadcn primitives (token bridge) (16)

- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/toast.tsx`

## Editor, AI, collaboration & other components (98)

- `src/components/AIWritingAssistant.tsx`
- `src/components/ControlPanel.tsx`
- `src/components/CookieConsent.tsx`
- `src/components/DrawingTool.tsx`
- `src/components/EmptyStates.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/FisheyeCameraBackground.tsx`
- `src/components/HandwritingAnalyzer.tsx`
- `src/components/HandwritingTextImporter.tsx`
- `src/components/InstallBanner.tsx`
- `src/components/LineBasedEditor.tsx`
- `src/components/MobileBottomNav.tsx`
- `src/components/MobileLivePreview.tsx`
- `src/components/MobileStyleSheet.tsx`
- `src/components/MoodSelector.tsx`
- `src/components/NikNoteToast.tsx`
- `src/components/NotebookPreview.tsx`
- `src/components/OnboardingFlow.tsx`
- `src/components/PageBar.tsx`
- `src/components/PageNavigator.tsx`
- `src/components/PenPalette.tsx`
- `src/components/QuickStylesBar.tsx`
- `src/components/RouteErrorBoundary.tsx`
- `src/components/ShareButtons.tsx`
- `src/components/SlidePanel.tsx`
- `src/components/TableConfigPanel.tsx`
- `src/components/TextEditor.tsx`
- `src/components/UserProfileDropdown.tsx`
- `src/components/ai-workspace/AIWorkspacePanel.tsx`
- `src/components/ai/FileUploadZone.tsx`
- `src/components/app/AppHeader.tsx`
- `src/components/app/BottomNavBar.tsx`
- `src/components/app/StepStyle.tsx`
- `src/components/asta/AstaMarkdown.tsx`
- `src/components/auth/GuestUpgradeCard.tsx`
- `src/components/auth/NiknoteAuth.tsx`
- `src/components/collaboration/ActivityFeed.tsx`
- `src/components/collaboration/CommentsPanel.tsx`
- `src/components/collaboration/NotificationSystem.tsx`
- `src/components/collaboration/PresenceSystem.tsx`
- `src/components/command-palette/CommandPalette.tsx`
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/HandwritingUploader.tsx`
- `src/components/dashboard/NotebookCard.tsx`
- `src/components/database/CalendarView.tsx`
- `src/components/database/GalleryView.tsx`
- `src/components/database/KanbanView.tsx`
- `src/components/database/TimelineView.tsx`
- `src/components/dial/SemiCircularDial.tsx`
- `src/components/document-intelligence/DocumentIntelligence.tsx`
- `src/components/editor/AIContextMenu.tsx`
- `src/components/editor/AIDiffView.tsx`
- `src/components/editor/BacklinksAndMentions.tsx`
- `src/components/editor/BlockCommentsThread.tsx`
- `src/components/editor/BlockContextMenu.tsx`
- `src/components/editor/BlockEditor.tsx`
- `src/components/editor/ColumnLayout.tsx`
- `src/components/editor/InlineAIMenu.tsx`
- `src/components/editor/MentionPopup.tsx`
- `src/components/editor/NotionEditor.tsx`
- `src/components/editor/PageHeader.tsx`
- `src/components/editor/SlashCommandMenu.tsx`
- `src/components/editor/TableBlock.tsx`
- `src/components/editor/VersionHistory.tsx`
- `src/components/editor/blocks/FlashcardBlock.tsx`
- `src/components/gamification/StudyStreak.tsx`
- `src/components/handwriting-dna/HandwritingScanner.tsx`
- `src/components/handwriting-dna/HandwritingStudio.tsx`
- `src/components/landing/CTASection.tsx`
- `src/components/landing/DisclaimerBanner.tsx`
- `src/components/landing/FAQSection.tsx`
- `src/components/landing/FeatureShowcase.tsx`
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/HowItWorksSection.tsx`
- `src/components/landing/LandingFooter.tsx`
- `src/components/landing/LandingHeader.tsx`
- `src/components/landing/PreviewSection.tsx`
- `src/components/landing/PricingTeaser.tsx`
- `src/components/landing/SocialProofSection.tsx`
- `src/components/nikai/NikAIBrand.tsx`
- `src/components/nikai/NikAIThinkingArena.tsx`
- `src/components/nikai/NikAIWorkspace.tsx`
- `src/components/premium/PaywallModal.tsx`
- `src/components/premium/PricingPopup.tsx`
- `src/components/premium/TrustBar.tsx`
- `src/components/promotion/ReferralWidget.tsx`
- `src/components/promotion/ShareButtons.tsx`
- `src/components/referral/ReferralWidget.tsx`
- `src/components/search/QuickSearch.tsx`
- `src/components/sharing/SharePanel.tsx`
- `src/components/smart-editor/SmartEditor.tsx`
- `src/components/urgency/ExitIntentPopup.tsx`
- `src/components/urgency/LiveActivityFeed.tsx`
- `src/components/urgency/MobilePremiumBar.tsx`
- `src/components/workflow/WorkflowCanvas.tsx`
- `src/components/workspace/RightPanel.tsx`
- `src/components/workspace/WorkspaceLayout.tsx`
- `src/components/workspace/WorkspaceSidebar.tsx`

## Libraries & services (6)

- `src/lib/cloudSyncEngine.ts`
- `src/lib/nikaiNotesBridge.ts`
- `src/lib/noteGraphs.ts`
- `src/lib/pdfTools.ts`
- `src/services/agents/MultiAgentSystem.ts`
- `src/utils/analytics.ts`

## Other (4)

- `src/App.tsx`
- `src/data/agents.ts`
- `src/hooks/useMood.ts`
- `src/main.tsx`
