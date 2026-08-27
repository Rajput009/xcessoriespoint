import {
  HeroSection,
  CategoryIcons,
  BestSelling,
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
    <main id="main-content">
      <HeroSection />
      <CategoryIcons />
      <BestSelling />
      <DealsOfDay />
      <ReviewsSummary />
      <NewArrivalsCarousel />
      <CategoryBanners />
      <VideoStrip />
      <FaqSection />
    </main>
  );
}
