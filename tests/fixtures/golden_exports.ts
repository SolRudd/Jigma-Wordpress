export interface GoldenExportFixture {
  templateId: string;
  templateName: string;
  expected: {
    elementCount: number;
    classCount: number;
    rootClass: string;
    rootClassId: string;
    firstLabels: string[];
    firstClassIds: Record<string, string>;
    svgLabels: string[];
    nativeStyleMappedCount: number;
    customCssFallbackCount: number;
    literalFallbackRuleCount: number;
    responsiveRuleCount: number;
    pseudoRuleCount: number;
    cssAttachedRuleCount: number;
    cssUnmappedRuleCount: number;
    unresolvedSelectorCount: number;
    unsignedSvgCodeCount: number;
  };
}

export const goldenExportFixtures: GoldenExportFixture[] = [
  {
    templateId: "jigma-header",
    templateName: "Jigma Header",
    expected: {
      elementCount: 24,
      classCount: 12,
      rootClass: "jigma-header",
      rootClassId: "j7si2l",
      firstLabels: ["Header", "Header Inner", "Header Brand", "Header Logo SVG", "Header Nav"],
      firstClassIds: {
        "jigma-header": "j7si2l",
        "jigma-header__inner": "j5zfhg",
        "jigma-header__brand": "jfnxd4",
        "jigma-header__logo-svg": "jkqbr4",
        "jigma-header__nav": "y69uus",
        "jigma-header__nav-link": "n6s9r3",
        "jigma-header__cta": "jic5ov",
        "jigma-header__cta-label": "j9kf1o",
      },
      svgLabels: ["Header Logo SVG"],
      nativeStyleMappedCount: 158,
      customCssFallbackCount: 22,
      literalFallbackRuleCount: 7,
      responsiveRuleCount: 1,
      pseudoRuleCount: 2,
      cssAttachedRuleCount: 44,
      cssUnmappedRuleCount: 0,
      unresolvedSelectorCount: 0,
      unsignedSvgCodeCount: 1,
    },
  },
  {
    templateId: "jigma-hero",
    templateName: "Jigma Hero",
    expected: {
      elementCount: 23,
      classCount: 18,
      rootClass: "jigma-hero",
      rootClassId: "jb78zt",
      firstLabels: ["Hero Section", "Hero Overlay", "Hero Inner", "Hero Grid", "Hero Content"],
      firstClassIds: {
        "jigma-hero": "jb78zt",
        "jigma-hero__overlay": "jepqte",
        "jigma-hero__inner": "jsioe6",
        "jigma-hero__grid": "jejb9g",
        "jigma-hero__content": "ti7a8f",
        "jigma-hero__eyebrow": "c7btsd",
        "jigma-hero__title": "js15l0",
        "jigma-hero__lead": "ma5eys",
      },
      svgLabels: ["Hero Mockup SVG"],
      nativeStyleMappedCount: 120,
      customCssFallbackCount: 14,
      literalFallbackRuleCount: 4,
      responsiveRuleCount: 2,
      pseudoRuleCount: 1,
      cssAttachedRuleCount: 33,
      cssUnmappedRuleCount: 0,
      unresolvedSelectorCount: 0,
      unsignedSvgCodeCount: 1,
    },
  },
  {
    templateId: "jigma-proof",
    templateName: "Jigma Proof Bar",
    expected: {
      elementCount: 23,
      classCount: 11,
      rootClass: "jigma-proof",
      rootClassId: "jvcy96",
      firstLabels: ["Proof Section", "Proof Inner", "Proof Intro", "Proof Eyebrow", "Proof Title"],
      firstClassIds: {
        "jigma-proof": "jvcy96",
        "jigma-proof__inner": "pu57v0",
        "jigma-proof__intro": "j555y4",
        "jigma-proof__eyebrow": "j8e6k6",
        "jigma-proof__title": "iuyqve",
        "jigma-proof__metrics": "jm1gox",
        "jigma-proof__metric": "jgelk8",
        "jigma-proof__icon-svg": "jnvegj",
      },
      svgLabels: ["Proof Icon SVG", "Proof Icon SVG", "Proof Icon SVG", "Proof Icon SVG"],
      nativeStyleMappedCount: 100,
      customCssFallbackCount: 21,
      literalFallbackRuleCount: 4,
      responsiveRuleCount: 3,
      pseudoRuleCount: 2,
      cssAttachedRuleCount: 33,
      cssUnmappedRuleCount: 0,
      unresolvedSelectorCount: 0,
      unsignedSvgCodeCount: 4,
    },
  },
];
