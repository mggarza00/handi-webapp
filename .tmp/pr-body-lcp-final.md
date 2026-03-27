## Summary

- reduce network contention around the landing hero LCP image without reverting the server-first hero work
- remove non-critical image preloads below the fold and lower header logo priority on `/`
- keep Google One Tap only on `/` and preserve the existing login flows

## Validation

- npx eslint "app/(site)/(landing)/LandingPage.tsx" "app/(site)/(landing)/LandingPageStyles.tsx" "components/shared/HowItWorksSection.tsx" "components/shared/ProtectedPaymentsCard.tsx" "components/HeaderLogoSwap.client.tsx" "app/(site)/(landing)/LandingHero.tsx"
- npm run build
- local Lighthouse run against next start confirmed the LCP element is still the guest hero image and that its resource load delay is near-zero after this pass

## Notes

- this branch is based on `perf/mobile-lighthouse-pass-2`
- local unrelated changes in `app/layout.tsx` and `components/site-footer.tsx` were intentionally left out
