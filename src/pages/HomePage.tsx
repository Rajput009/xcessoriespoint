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
} from "../components/home/collections";

/* Alternating, borderless background bands chunk the page into scannable zones.
 * The body canvas is slate-50; white bands break the monotony without cards. */
export default function HomePage() {
  return (
    <main id="main-content">
      <HeroSection />

      <div className="bg-white">
        <CategoryIcons />
      </div>

      <BestSelling />

      <div className="bg-white">
        <TrustStrip />
        <ReviewsSummary />
      </div>

      <ShopByBrand />

      <div className="bg-white">
        <DealsOfDay />
      </div>

      <NewArrivalsCarousel />

      <div className="bg-white">
        <PopularCategoryShelves />
      </div>

      <ShopByDevice />

      <div className="bg-white">
        <ShopByNeed />
      </div>

      <VideoStrip />

      <div className="bg-white">
        <FaqSection />
      </div>
    </main>
  );
}
