// Central, reversible launch flags.
// To re-open account creation: set SIGNUP_ENABLED = true.
// To restore paywalls after the free trial: set FREE_TRIAL = false.
export const SIGNUP_ENABLED = false;
// Was `true`, which made PremiumContext report every visitor as premium. That
// flag never reached the editor — every screen that actually gates a feature
// (Index, Account, Payment, Upgrade, the mobile shell) reads the usePremium()
// hook, which queries user_subscriptions directly and ignores this constant.
// The result was a sidebar badge reading "NikNote Premium" on an account with
// no subscription, sitting above an editor that had the AI assistant and
// dictation locked. Turning it off makes the display agree with the gates.
// The free tier itself is unchanged: styles, AI notes, PDF tools and exports
// were never gated and still are not.
export const FREE_TRIAL = false;
// Everyone gets a private guest workspace automatically; no sign-in screen is shown.
export const AUTO_GUEST = true;
