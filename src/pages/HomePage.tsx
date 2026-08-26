import {
  HeroSection,
  CategoryIcons,
  BestSelling,
  FeaturedProductDetail,
  DealsOfDay,
} from "../components/home/sections1";
import { ReviewsSummary, FaqSection } from "../components/home/sections2";

/**
 * Editorial storefront home: a focused hero, category discovery, featured
 * products, one promotional block, reviews and FAQs. Secondary catalog routes
 * still expose new arrivals, category banners and guides without overloading
 * the first page shoppers see.
 */
export default function HomePage() {
  return (
    <main id="main-content" className="home-page bg-[#eef0ff]">
      <div className="home-canvas mx-auto max-w-[1280px] bg-white">
        <HeroSection />
        <CategoryIcons />
        <BestSelling />
        <FeaturedProductDetail />
        <DealsOfDay />
        <ReviewsSummary />
        <FaqSection />
      </div>
    </main>
  );
}
