export interface NormalizerOptions {
  unifyCharacters?: boolean;
  normalizeDigits?: boolean;
  removeDiacritics?: boolean;
  normalizePunctuation?: boolean;
  enforceZWNJRules?: boolean;
}

export class PersianNormalizer {
  private static readonly ARABIC_TO_PERSIAN_MAP: Record<string, string> = {
    '\u064A': '\u06CC', // Arabic Yeh -> Persian Yeh (ي -> ی)
    '\u0643': '\u06A9', // Arabic Kaf -> Persian Keheh (ك -> ک)
    '\u0629': '\u0647', // Teh Marbuta -> Heh (ة -> ه)
    '\u06C0': '\u0647\u0654', // Heh with above Hamza (ۀ -> هٔ)
    '\u0624': '\u0648', // Waw with Hamza -> Waw (ؤ -> و)
    '\u0625': '\u0627', // Alef with below Hamza -> Alef (إ -> ا)
    '\u0623': '\u0627', // Alef with above Hamza -> Alef (أ -> ا)
  };

  private static readonly ARABIC_DIGITS: RegExp = /[\u0660-\u0669]/g;
  private static readonly DIACRITICS: RegExp = /[\u064B-\u0652\u0670]/g;

  public static normalize(text: string, options: NormalizerOptions = {}): string {
    if (!text) return '';

    const opts = {
      unifyCharacters: true,
      normalizeDigits: true,
      removeDiacritics: true,
      normalizePunctuation: true,
      enforceZWNJRules: true,
      ...options,
    };

    let result = text;

    // 0. Protect domain entity codes (DECR: PR-X, TS-X, HM-X, EV-X, RP-X) from digit substitution
    const codePlaceholders: string[] = [];
    result = result.replace(/\b(PR|TS|HM|EV|RP)-\d+\b/gi, (match) => {
      const idx = codePlaceholders.length;
      codePlaceholders.push(match);
      return `__DOMAINENTITY${idx}TOKEN__`;
    });

    // 1. Unify Arabic characters to Persian
    if (opts.unifyCharacters) {
      result = result.replace(/[\u064A\u0643\u0629\u06C0\u0624\u0625\u0623]/g, (match) => {
        return PersianNormalizer.ARABIC_TO_PERSIAN_MAP[match] || match;
      });
    }

    // 2. Remove Arabic/Persian diacritics
    if (opts.removeDiacritics) {
      result = result.replace(PersianNormalizer.DIACRITICS, '');
    }

    // 3. Standardize regular standalone digits to Persian digits
    if (opts.normalizeDigits) {
      result = result.replace(PersianNormalizer.ARABIC_DIGITS, (d) =>
        String.fromCharCode(d.charCodeAt(0) + 0x06f0 - 0x0660)
      );
      result = result.replace(/[0-9]/g, (d) =>
        String.fromCharCode(d.charCodeAt(0) + 0x06f0 - 0x0030)
      );
    }

    // 4. Enforce linguistic ZWNJ (\u200C) rules (Hazm / DadmaTools semantics)
    if (opts.enforceZWNJRules) {
      // Clean redundant ZWNJs and whitespace around them
      result = result.replace(/\s*\u200C+\s*/g, '\u200C');

      // Continuous verbal prefixes: (می|نمی) followed by verb stem
      result = result.replace(/(^|\s)(ن?می)\s+([^\s\u200C]+)/g, '$1$2\u200C$3');

      // Plural suffixes: (ها|های) attached to nouns
      result = result.replace(/([^\s\u200C]+)\s+(ها|های)([\s،؛!؟.]|$)/g, '$1\u200C$2$3');

      // Comparative & Superlative suffixes: (تر|ترین)
      result = result.replace(/([^\s\u200C]+)\s+(تر|ترین)([\s،؛!؟.]|$)/g, '$1\u200C$2$3');

      // Pronominal possessives following silent Heh
      result = result.replace(/([هة])\s+(ام|ات|اش|مان|تان|شان)([\s،؛!؟.]|$)/g, '$1\u200C$2$3');

      // Indefinite marker 'ی' after silent Heh
      result = result.replace(/([هة])\s+(ای|ی)([\s،؛!؟.]|$)/g, '$1\u200C$2$3');

      // Prepositional compounds: (به‌عنوان، به‌صورت، به‌ویژه، به‌طور)
      result = result.replace(/(^|\s)به\s+(عنوان|صورت|ویژه|طور|خوبی|سرعت)([\s،؛!؟.]|$)/g, '$1به\u200C$2$3');
    }

    // 5. Restore protected domain entity codes (handling possible Persian digit transformation of index)
    result = result.replace(/__DOMAINENTITY(\d+|[\u06F0-\u06F9]+)TOKEN__/g, (match) => {
      const numStr = match.replace(/__DOMAINENTITY/g, '').replace(/TOKEN__/g, '');
      const asciiNum = numStr.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
      return codePlaceholders[Number(asciiNum)] || match;
    });

    // 6. Standardize punctuation spacing
    if (opts.normalizePunctuation) {
      result = result.replace(/\s*([،؛:!؟.])\s*/g, '$1 ');
      result = result.replace(/\s{2,}/g, ' ').trim();
    }

    return result;
  }
}
