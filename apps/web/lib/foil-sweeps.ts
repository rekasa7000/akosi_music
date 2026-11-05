// Same ember/plum/flare gradient family as the landing page's FoilCard
// (apps/web/components/landing/foil-card.tsx), shared by every admin
// surface that needs a cover-less placeholder to still read as
// "physical card" rather than a flat two-color SaaS swatch.
export const FOIL_SWEEPS = [
  "linear-gradient(135deg, #7a1f1a 0%, #c23b2e 35%, #ff8a3d 70%, #ffd8a8 100%)",
  "linear-gradient(135deg, #3d0f1f 0%, #5c1a2e 30%, #c23b2e 70%, #ff8a3d 100%)",
  "linear-gradient(135deg, #c23b2e 0%, #ff8a3d 45%, #ffd8a8 75%, #fff4e4 100%)",
] as const;
