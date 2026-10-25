type BirthdaySettingsRow = {
  birthdayEnabled: boolean;
  birthdaySendTime: string;
  birthdayGreetingTemplate: string;
  birthdayHeroTitle: string;
  birthdayHeroParagraph: string;
  birthdayTopTitle: string;
};

export function birthdaySettingsDto(s: BirthdaySettingsRow) {
  return {
    birthdayEnabled: s.birthdayEnabled,
    birthdaySendTime: s.birthdaySendTime,
    birthdayGreetingTemplate: s.birthdayGreetingTemplate,
    birthdayHeroTitle: s.birthdayHeroTitle,
    birthdayHeroParagraph: s.birthdayHeroParagraph,
    birthdayTopTitle: s.birthdayTopTitle,
  };
}

export const BIRTHDAY_KEYS = [
  "birthdayEnabled",
  "birthdaySendTime",
  "birthdayGreetingTemplate",
  "birthdayHeroTitle",
  "birthdayHeroParagraph",
  "birthdayTopTitle",
] as const;
