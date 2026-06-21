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
];
