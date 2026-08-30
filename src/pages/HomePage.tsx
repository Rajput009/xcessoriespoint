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

/* Alternating, borderless background bands chunk the page into scannable zones.
 * The body canvas is slate-50; white bands break the monotony without cards. */
export default function HomePage() {
  return (
    <main id="main-content">
      <HeroSection />

      <div className="bg-white/70">
        <CategoryIcons />
      </div>

      <BestSelling />

      <div className="bg-white/70">
        <TrustStrip />
        <StatsStrip />
        <ReviewsSummary />
      </div>

      <ShopByBrand />

      <div className="bg-white/70">
        <DealsOfDay />
      </div>

      <NewArrivalsCarousel />

      <div className="bg-white/70">
        <PopularCategoryShelves />
      </div>

      <ShopByDevice />

      <div className="bg-white/70">
        <ShopByNeed />
      </div>

      <VideoStrip />

      <div className="bg-white/70">
        <FaqSection />
      </div>
    </main>
  );
}
