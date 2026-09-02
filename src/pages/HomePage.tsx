import {
  HeroSection,
  CategoryIcons,
  BestSelling,
  DealsOfDay,
} from "../components/home/sections1";
import {
  ReviewsSummary,
  NewArrivalsCarousel,
  VideoStrip,
  FaqSection,
} from "../components/home/sections2";
import {
  ShopByBrand,
  PopularCategoryShelves,
  ShopByDevice,
  ShopByNeed,
  TrustStrip,
  StatsStrip,
} from "../components/home/collections";

/* A single warm ivory canvas with generous, consistent vertical rhythm.
 * White cards (products, trust, brands, reviews) carry their own surfaces,
 * so the page reads as one calm, editorial flow instead of stacked bands. */
export default function HomePage() {
  return (
    <main id="main-content">
      <HeroSection />

      <TrustStrip />

      <CategoryIcons />

      <BestSelling />

      <StatsStrip />

      <DealsOfDay />

      <ShopByBrand />

      <NewArrivalsCarousel />

      <ReviewsSummary />

      <ShopByDevice />

      <PopularCategoryShelves />

      <ShopByNeed />

      <VideoStrip />

      <FaqSection />
    </main>
  );
}
