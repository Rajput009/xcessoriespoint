import {
  HeroSection,
  CategoryIcons,
  BestSelling,
  FeaturedProductDetail,
  DealsOfDay,
} from "../components/home/sections1";
import {
  ReviewsSummary,
  NewArrivalsCarousel,
  CategoryBanners,
  VideoStrip,
  FaqSection,
} from "../components/home/sections2";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <CategoryIcons />
      <BestSelling />
      <FeaturedProductDetail />
      <DealsOfDay />
      <ReviewsSummary />
      <NewArrivalsCarousel />
      <CategoryBanners />
      <VideoStrip />
      <FaqSection />
    </main>
  );
}
