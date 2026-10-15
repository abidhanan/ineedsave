// Language data shared by the edge middleware (picks the page language), the build script
// (renders one HTML file per language) and the browser (language picker).
// [code, native name, English name, flag country, script]
export const LANGS = [
  ['en', 'English', 'English', 'US', 'latn'],
  ['id', 'Bahasa Indonesia', 'Indonesian', 'ID', 'latn'],
  ['ms', 'Bahasa Melayu', 'Malay', 'MY', 'latn'],
  ['jv', 'Basa Jawa', 'Javanese', 'ID', 'latn'],
  ['su', 'Basa Sunda', 'Sundanese', 'ID', 'latn'],
  ['tl', 'Filipino', 'Filipino', 'PH', 'latn'],
  ['vi', 'Tiếng Việt', 'Vietnamese', 'VN', 'latn'],
  ['th', 'ไทย', 'Thai', 'TH', 'thai'],
  ['lo', 'ລາວ', 'Lao', 'LA', 'laoo'],
  ['km', 'ខ្មែរ', 'Khmer', 'KH', 'khmr'],
  ['my', 'မြန်မာ', 'Burmese', 'MM', 'mymr'],
  ['zh-CN', '简体中文', 'Chinese (Simplified)', 'CN', 'hans'],
  ['zh-TW', '繁體中文', 'Chinese (Traditional)', 'TW', 'hant'],
  ['ja', '日本語', 'Japanese', 'JP', 'jpan'],
  ['ko', '한국어', 'Korean', 'KR', 'kore'],
  ['mn', 'Монгол', 'Mongolian', 'MN', 'cyrl'],
  ['hi', 'हिन्दी', 'Hindi', 'IN', 'deva'],
  ['bn', 'বাংলা', 'Bengali', 'BD', 'beng'],
  ['ur', 'اردو', 'Urdu', 'PK', 'arab'],
  ['pa', 'ਪੰਜਾਬੀ', 'Punjabi', 'IN', 'guru'],
  ['gu', 'ગુજરાતી', 'Gujarati', 'IN', 'gujr'],
  ['mr', 'मराठी', 'Marathi', 'IN', 'deva'],
  ['ta', 'தமிழ்', 'Tamil', 'IN', 'taml'],
  ['te', 'తెలుగు', 'Telugu', 'IN', 'telu'],
  ['kn', 'ಕನ್ನಡ', 'Kannada', 'IN', 'knda'],
  ['ml', 'മലയാളം', 'Malayalam', 'IN', 'mlym'],
  ['ne', 'नेपाली', 'Nepali', 'NP', 'deva'],
  ['si', 'සිංහල', 'Sinhala', 'LK', 'sinh'],
  ['ar', 'العربية', 'Arabic', 'SA', 'arab'],
  ['fa', 'فارسی', 'Persian', 'IR', 'arab'],
  ['he', 'עברית', 'Hebrew', 'IL', 'hebr'],
  ['tr', 'Türkçe', 'Turkish', 'TR', 'latn'],
  ['az', 'Azərbaycanca', 'Azerbaijani', 'AZ', 'latn'],
  ['uz', 'Oʻzbekcha', 'Uzbek', 'UZ', 'latn'],
  ['kk', 'Қазақ тілі', 'Kazakh', 'KZ', 'cyrl'],
  ['ky', 'Кыргызча', 'Kyrgyz', 'KG', 'cyrl'],
  ['tg', 'Тоҷикӣ', 'Tajik', 'TJ', 'cyrl'],
  ['tk', 'Türkmençe', 'Turkmen', 'TM', 'latn'],
  ['ps', 'پښتو', 'Pashto', 'AF', 'arab'],
  ['ka', 'ქართული', 'Georgian', 'GE', 'geor'],
  ['hy', 'Հայերեն', 'Armenian', 'AM', 'armn'],
  ['ku', 'Kurdî', 'Kurdish', 'IQ', 'latn'],
  ['ru', 'Русский', 'Russian', 'RU', 'cyrl'],
  ['uk', 'Українська', 'Ukrainian', 'UA', 'cyrl'],
  ['be', 'Беларуская', 'Belarusian', 'BY', 'cyrl'],
  ['pl', 'Polski', 'Polish', 'PL', 'latn'],
  ['cs', 'Čeština', 'Czech', 'CZ', 'latn'],
  ['sk', 'Slovenčina', 'Slovak', 'SK', 'latn'],
  ['hu', 'Magyar', 'Hungarian', 'HU', 'latn'],
  ['ro', 'Română', 'Romanian', 'RO', 'latn'],
  ['bg', 'Български', 'Bulgarian', 'BG', 'cyrl'],
  ['sr', 'Српски', 'Serbian', 'RS', 'cyrl'],
  ['hr', 'Hrvatski', 'Croatian', 'HR', 'latn'],
  ['bs', 'Bosanski', 'Bosnian', 'BA', 'latn'],
  ['sl', 'Slovenščina', 'Slovenian', 'SI', 'latn'],
  ['mk', 'Македонски', 'Macedonian', 'MK', 'cyrl'],
  ['sq', 'Shqip', 'Albanian', 'AL', 'latn'],
  ['el', 'Ελληνικά', 'Greek', 'GR', 'grek'],
  ['lt', 'Lietuvių', 'Lithuanian', 'LT', 'latn'],
  ['lv', 'Latviešu', 'Latvian', 'LV', 'latn'],
  ['et', 'Eesti', 'Estonian', 'EE', 'latn'],
  ['fi', 'Suomi', 'Finnish', 'FI', 'latn'],
  ['sv', 'Svenska', 'Swedish', 'SE', 'latn'],
  ['nb', 'Norsk', 'Norwegian', 'NO', 'latn'],
  ['da', 'Dansk', 'Danish', 'DK', 'latn'],
  ['is', 'Íslenska', 'Icelandic', 'IS', 'latn'],
  ['nl', 'Nederlands', 'Dutch', 'NL', 'latn'],
  ['de', 'Deutsch', 'German', 'DE', 'latn'],
  ['fr', 'Français', 'French', 'FR', 'latn'],
  ['it', 'Italiano', 'Italian', 'IT', 'latn'],
  ['es', 'Español', 'Spanish', 'ES', 'latn'],
  ['pt-BR', 'Português (Brasil)', 'Portuguese (Brazil)', 'BR', 'latn'],
  ['pt-PT', 'Português (Portugal)', 'Portuguese (Portugal)', 'PT', 'latn'],
  ['ca', 'Català', 'Catalan', 'AD', 'latn'],
  ['eu', 'Euskara', 'Basque', 'ES', 'latn'],
  ['gl', 'Galego', 'Galician', 'ES', 'latn'],
  ['ga', 'Gaeilge', 'Irish', 'IE', 'latn'],
  ['cy', 'Cymraeg', 'Welsh', 'GB', 'latn'],
  ['mt', 'Malti', 'Maltese', 'MT', 'latn'],
  ['lb', 'Lëtzebuergesch', 'Luxembourgish', 'LU', 'latn'],
  ['af', 'Afrikaans', 'Afrikaans', 'ZA', 'latn'],
  ['sw', 'Kiswahili', 'Swahili', 'KE', 'latn'],
  ['am', 'አማርኛ', 'Amharic', 'ET', 'ethi'],
  ['ha', 'Hausa', 'Hausa', 'NG', 'latn'],
  ['yo', 'Yorùbá', 'Yoruba', 'NG', 'latn'],
  ['ig', 'Igbo', 'Igbo', 'NG', 'latn'],
  ['zu', 'isiZulu', 'Zulu', 'ZA', 'latn'],
  ['xh', 'isiXhosa', 'Xhosa', 'ZA', 'latn'],
  ['so', 'Soomaali', 'Somali', 'SO', 'latn'],
  ['mg', 'Malagasy', 'Malagasy', 'MG', 'latn'],
  ['rw', 'Kinyarwanda', 'Kinyarwanda', 'RW', 'latn'],
  ['ht', 'Kreyòl ayisyen', 'Haitian Creole', 'HT', 'latn'],
  ['mi', 'Māori', 'Maori', 'NZ', 'latn'],
].map(([code, native, english, flag, script]) => ({ code, native, english, flag, script }));
export const BY_CODE = Object.fromEntries(LANGS.map((l) => [l.code.toLowerCase(), l]));
export const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps']);

// One type family everywhere: Noto Sans (Latin, Cyrillic, Greek) plus its sister family for other scripts.
export const SCRIPT_FONT = {
  arab: 'Noto Sans Arabic', hebr: 'Noto Sans Hebrew', deva: 'Noto Sans Devanagari', beng: 'Noto Sans Bengali',
  guru: 'Noto Sans Gurmukhi', gujr: 'Noto Sans Gujarati', taml: 'Noto Sans Tamil', telu: 'Noto Sans Telugu',
  knda: 'Noto Sans Kannada', mlym: 'Noto Sans Malayalam', sinh: 'Noto Sans Sinhala', thai: 'Noto Sans Thai',
  laoo: 'Noto Sans Lao', khmr: 'Noto Sans Khmer', mymr: 'Noto Sans Myanmar', geor: 'Noto Sans Georgian',
  armn: 'Noto Sans Armenian', ethi: 'Noto Sans Ethiopic', jpan: 'Noto Sans JP', kore: 'Noto Sans KR',
  hans: 'Noto Sans SC', hant: 'Noto Sans TC',
};

// Main language of each country (ISO 3166-1 alpha-2). Countries not listed fall back to English.
export const COUNTRY_LANG = {};
const assign = (code, countries) => countries.split(' ').forEach((c) => { COUNTRY_LANG[c] = code; });
assign('id', 'ID');
assign('ms', 'MY BN');
assign('tl', 'PH');
assign('vi', 'VN');
assign('th', 'TH');
assign('lo', 'LA');
assign('km', 'KH');
assign('my', 'MM');
assign('zh-CN', 'CN');
assign('zh-TW', 'TW HK MO');
assign('ja', 'JP');
assign('ko', 'KR KP');
assign('mn', 'MN');
assign('hi', 'IN');
assign('bn', 'BD');
assign('ur', 'PK');
assign('ne', 'NP');
assign('si', 'LK');
assign('ar', 'SA AE QA KW BH OM YE IQ JO LB SY PS EG LY TN DZ MA SD MR DJ KM EH');
assign('fa', 'IR AF');
assign('he', 'IL');
assign('tr', 'TR');
assign('az', 'AZ');
assign('uz', 'UZ');
assign('kk', 'KZ');
assign('ky', 'KG');
assign('tg', 'TJ');
assign('tk', 'TM');
assign('ka', 'GE');
assign('hy', 'AM');
assign('ru', 'RU');
assign('uk', 'UA');
assign('be', 'BY');
assign('pl', 'PL');
assign('cs', 'CZ');
assign('sk', 'SK');
assign('hu', 'HU');
assign('ro', 'RO MD');
assign('bg', 'BG');
assign('sr', 'RS ME');
assign('hr', 'HR');
assign('bs', 'BA');
assign('sl', 'SI');
assign('mk', 'MK');
assign('sq', 'AL XK');
assign('el', 'GR CY');
assign('lt', 'LT');
assign('lv', 'LV');
assign('et', 'EE');
assign('fi', 'FI');
assign('sv', 'SE');
assign('nb', 'NO');
assign('da', 'DK');
assign('is', 'IS');
assign('nl', 'NL BE SR');
assign('de', 'DE AT CH LI');
assign('fr', 'FR MC LU SN CI ML BF NE GN BJ TG CM GA CG CD CF TD BI HT NC PF');
assign('it', 'IT SM VA');
assign('es', 'ES MX GT HN SV NI CR PA CU DO PR CO VE EC PE BO CL AR PY UY GQ');
assign('pt-BR', 'BR');
assign('pt-PT', 'PT AO MZ CV GW ST TL');
assign('ca', 'AD');
assign('mt', 'MT');
assign('sw', 'KE TZ');
assign('am', 'ET');
assign('so', 'SO');
assign('mg', 'MG');
assign('rw', 'RW');

// Browser tags that don't map 1:1 onto a code above.
export const ALIASES = {
  zh: 'zh-CN', 'zh-hans': 'zh-CN', 'zh-sg': 'zh-CN', 'zh-hant': 'zh-TW', 'zh-hk': 'zh-TW', 'zh-mo': 'zh-TW',
  pt: 'pt-BR', no: 'nb', nn: 'nb', fil: 'tl', in: 'id', iw: 'he', jw: 'jv', prs: 'fa',
};

/** Maps a BCP 47 tag (browser / Accept-Language) onto a supported code, or null. */
export function match(tag) {
  if (!tag) return null;
  const t = tag.trim().toLowerCase();
  if (BY_CODE[t]) return BY_CODE[t].code;
  if (ALIASES[t]) return ALIASES[t];
  const [base, ...rest] = t.split('-');
  if (base === 'zh') return rest.some((p) => ['hant', 'tw', 'hk', 'mo'].includes(p)) ? 'zh-TW' : 'zh-CN';
  if (base === 'pt') return rest.includes('pt') ? 'pt-PT' : 'pt-BR';
  if (ALIASES[base]) return ALIASES[base];
  return BY_CODE[base] ? BY_CODE[base].code : null;
}

/**
 * The visitor's own choice wins, then a non-English browser language, then the main language of
 * their country (e.g. an English phone in India gets Hindi), then English.
 */
export function pickLanguage({ choice, acceptLanguage, country }) {
  const chosen = match(choice);
  if (chosen) return chosen;
  const browser = (acceptLanguage || '').split(',').map((part) => match(part.split(';')[0])).filter(Boolean);
  const nonEnglish = browser.find((code) => code !== 'en');
  if (nonEnglish) return nonEnglish;
  return COUNTRY_LANG[(country || '').toUpperCase()] || 'en';
}

export function flagEmoji(country) {
  return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
