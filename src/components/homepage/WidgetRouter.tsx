'use client';

/**
 * WIDGET ROUTER — maps the 40 homepage widget module keys to components.
 * Each widget gets variant, sectionTitle/subtitle and the shared WidgetData bag.
 */

import * as React from 'react';
import {
  HeroSliderWidget, EmergencyStripWidget, QuickActionsWidget, StatsCountersWidget,
  AppointmentCtaWidget, CtaGradientWidget, ContactBannerWidget, PartnersStripWidget,
  InsuranceStripWidget, AppDownloadWidget, OpeningHoursWidget, TrustBadgesWidget,
  WidgetData,
} from './widgets/core';
import {
  ServicesGridWidget, DepartmentsMegaWidget, AboutSplitWidget, WhyChooseUsWidget,
  MchHighlightWidget, MaternityShowcaseWidget, LabShowcaseWidget, PharmacyShowcaseWidget,
  AdmissionInfoWidget, ValuesCardsWidget, VisionMissionSplitWidget, TimelineHistoryWidget,
  PricingTablesWidget, HealthTipsWidget,
} from './widgets/content';
import {
  DoctorsCarouselWidget, DoctorsGridWidget, TeamLeadershipWidget, TestimonialsCarouselWidget,
  NewsGridWidget, NewsListWidget, BlogMagazineWidget, VideoStoryWidget, GalleryMasonryWidget,
  GalleryCarouselWidget, FaqAccordionWidget, DownloadsListWidget, AppointmentFormInlineWidget,
  MapContactWidget, FooterNewsletterWidget,
} from './widgets/people-news';

export interface WidgetConfig {
  moduleKey: string;
  variantId?: number;
  sectionTitle?: string | null;
  sectionSubtitle?: string | null;
}

const WIDGET_MAP: Record<string, React.ComponentType<any>> = {
  HERO_SLIDER: HeroSliderWidget,
  EMERGENCY_STRIP: EmergencyStripWidget,
  QUICK_ACTIONS: QuickActionsWidget,
  SERVICES_GRID: ServicesGridWidget,
  DEPARTMENTS_MEGA: DepartmentsMegaWidget,
  STATS_COUNTERS: StatsCountersWidget,
  ABOUT_SPLIT: AboutSplitWidget,
  WHY_CHOOSE_US: WhyChooseUsWidget,
  DOCTORS_CAROUSEL: DoctorsCarouselWidget,
  DOCTORS_GRID: DoctorsGridWidget,
  MCH_HIGHLIGHT: MchHighlightWidget,
  MATERNITY_SHOWCASE: MaternityShowcaseWidget,
  LAB_SHOWCASE: LabShowcaseWidget,
  PHARMACY_SHOWCASE: PharmacyShowcaseWidget,
  ADMISSION_INFO: AdmissionInfoWidget,
  TESTIMONIALS_CAROUSEL: TestimonialsCarouselWidget,
  NEWS_GRID: NewsGridWidget,
  NEWS_LIST: NewsListWidget,
  APPOINTMENT_CTA: AppointmentCtaWidget,
  APPOINTMENT_FORM_INLINE: AppointmentFormInlineWidget,
  CONTACT_BANNER: ContactBannerWidget,
  DOWNLOADS_LIST: DownloadsListWidget,
  GALLERY_MASONRY: GalleryMasonryWidget,
  GALLERY_CAROUSEL: GalleryCarouselWidget,
  FAQ_ACCORDION: FaqAccordionWidget,
  PARTNERS_STRIP: PartnersStripWidget,
  INSURANCE_STRIP: InsuranceStripWidget,
  BLOG_MAGAZINE: BlogMagazineWidget,
  VIDEO_STORY: VideoStoryWidget,
  TIMELINE_HISTORY: TimelineHistoryWidget,
  VALUES_CARDS: ValuesCardsWidget,
  VISION_MISSION_SPLIT: VisionMissionSplitWidget,
  TEAM_LEADERSHIP: TeamLeadershipWidget,
  PRICING_TABLES: PricingTablesWidget,
  HEALTH_TIPS: HealthTipsWidget,
  CTA_GRADIENT: CtaGradientWidget,
  APP_DOWNLOAD: AppDownloadWidget,
  MAP_CONTACT: MapContactWidget,
  FOOTER_NEWSLETTER: FooterNewsletterWidget,
  OPENING_HOURS: OpeningHoursWidget,
  TRUST_BADGES: TrustBadgesWidget,
};

export const WIDGET_KEYS = Object.keys(WIDGET_MAP);

export function WidgetRouter({ widget, data }: { widget: WidgetConfig; data: WidgetData }) {
  const Component = WIDGET_MAP[widget.moduleKey];
  if (!Component) return null;
  return (
    <Component
      variant={widget.variantId || 1}
      title={widget.sectionTitle}
      subtitle={widget.sectionSubtitle}
      data={data}
    />
  );
}
