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

export default function HomePage() {
  return (
    <main id="main-content">
      <HeroSection />
      <CategoryIcons />
      <BestSelling />
      <ShopByBrand />
      <PopularCategoryShelves />
      <DealsOfDay />
      <ReviewsSummary />
      <NewArrivalsCarousel />
      <ShopByDevice />
      <ShopByNeed />
      <TrustStrip />
      <VideoStrip />
      <FaqSection />
    </main>
  );
}
