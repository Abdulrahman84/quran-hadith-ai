import type { GroundedAnswer, RetrievalLanguage, SourceRecord } from "@/lib/retrieval/types";

type GenerateGroundedAnswerInput = {
  question: string;
  language: RetrievalLanguage;
  records: SourceRecord[];
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

const defaultOllamaBaseUrl = "http://127.0.0.1:11434";
const defaultOllamaModel = "qwen2.5-coder:7b";

function disabledAnswer(): GroundedAnswer {
  return {
    status: "disabled",
    text: null,
    citations: [],
    warnings: [{ code: "ollama_disabled", message: "Ollama answer generation is disabled." }],
  };
}

function getOllamaConfig() {
  const enabled = process.env.OLLAMA_ENABLED?.trim() !== "false";
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || defaultOllamaBaseUrl;
  const model = process.env.OLLAMA_MODEL?.trim() || defaultOllamaModel;
  const timeoutMs = Number.parseInt(process.env.OLLAMA_TIMEOUT_MS || "25000", 10);

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 25000,
  };
}

function getRecordText(record: SourceRecord, language: RetrievalLanguage) {
  if (record.sourceKind === "tafsir") {
    if (language === "arabic") {
      return [record.arabicText, record.tafsirText].filter(Boolean).join("\n");
    }

    return [record.englishText, record.tafsirText].filter(Boolean).join("\n");
  }

  if (language === "arabic") {
    return record.arabicText;
  }

  return record.englishText || "";
}

function buildCitationPack(records: SourceRecord[], language: RetrievalLanguage) {
  return records
    .map((record, index) => {
      const citation = `[${index + 1}]`;
      const text = getRecordText(record, language).trim();
      const metadata =
        language === "arabic"
          ? arabicRecordMetadata(record)
          : record.sourceKind === "hadith"
            ? [
                `${record.displayName} ${record.reference}`,
                record.book ? `book: ${record.book}` : null,
                record.chapter ? `chapter: ${record.chapter}` : null,
                record.grade?.value ? `grade: ${record.grade.value}` : "grade: unavailable",
                `source: ${record.sourceReference}`,
              ]
            : [
                `${record.displayName} ${record.reference}`,
                record.translationEdition ? `translation: ${record.translationEdition}` : null,
                record.tafsirSource ? `tafsir: ${record.tafsirSource}` : null,
                `source: ${record.sourceReference}`,
              ];
      const metadataText = metadata
        .filter(Boolean)
        .join("; ");

      return `${citation} ${metadataText}\n${text.slice(0, 900)}`;
    })
    .join("\n\n");
}

function stripThinkingBlocks(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function arabicRecordTitle(record: SourceRecord) {
  if (record.sourceKind === "quran") {
    return `القرآن - ${arabicReferenceSuffix(record)}`;
  }

  if (record.sourceKind === "tafsir") {
    return `${arabicTafsirSourceName(record)} - ${arabicReferenceSuffix(record)}`;
  }

  return `${arabicHadithCollectionName(record)} ${record.reference}`.trim();
}

const arabicTafsirSourceLabels = new Map<string, string>([
  ["tabary", "تفسير الطبري"],
  ["tabari", "تفسير الطبري"],
  ["katheer", "تفسير ابن كثير"],
  ["ibn-kathir", "تفسير ابن كثير"],
  ["baghawy", "تفسير البغوي"],
  ["baghawi", "تفسير البغوي"],
  ["saady", "تفسير السعدي"],
  ["saadi", "تفسير السعدي"],
  ["moyassar", "التفسير الميسر"],
  ["muyassar", "التفسير الميسر"],
  ["mokhtasar", "المختصر في التفسير"],
  ["mukhtasar", "المختصر في التفسير"],
]);

function arabicTafsirSourceName(record: SourceRecord) {
  const collectionLabel = arabicTafsirSourceLabels.get(record.collection.toLowerCase());

  if (collectionLabel) {
    return collectionLabel;
  }

  if (record.tafsirSource && !/[A-Za-z]/.test(record.tafsirSource)) {
    return record.tafsirSource.split(/[،,]/)[0]?.trim() || "التفسير";
  }

  return "التفسير";
}

function arabicReferenceSuffix(record: SourceRecord) {
  return record.surahName ? `سورة ${record.surahName} ${record.reference}` : record.reference;
}

function arabicHadithCollectionName(record: SourceRecord) {
  const collection = record.collection.toLowerCase();
  const displayName = record.displayName.toLowerCase();

  if (collection.includes("bukhari") || displayName.includes("bukhari")) {
    return "صحيح البخاري";
  }

  if (collection.includes("muslim") || displayName.includes("muslim")) {
    return "صحيح مسلم";
  }

  if (collection.includes("abudawud") || collection.includes("abu-dawud") || displayName.includes("abu dawud")) {
    return "سنن أبي داود";
  }

  if (collection.includes("tirmidhi") || displayName.includes("tirmidhi")) {
    return "جامع الترمذي";
  }

  if (collection.includes("nasai") || collection.includes("nasa") || displayName.includes("nasa")) {
    return "سنن النسائي";
  }

  if (collection.includes("majah") || displayName.includes("majah")) {
    return "سنن ابن ماجه";
  }

  return "كتاب الحديث";
}

function arabicRecordMetadata(record: SourceRecord) {
  if (record.sourceKind === "hadith") {
    return [
      arabicRecordTitle(record),
      record.book ? `الكتاب: ${record.book}` : null,
      record.chapter ? `الباب: ${record.chapter}` : null,
      record.grade?.value ? `الدرجة: ${record.grade.value}` : "الدرجة: غير متاحة",
      `المصدر: ${record.sourceReference}`,
    ];
  }

  return [
    arabicRecordTitle(record),
    record.sourceKind === "tafsir" ? "النوع: تفسير" : "النوع: قرآن",
  ];
}

function citationLabels(records: SourceRecord[], language: RetrievalLanguage) {
  return records.map((record, index) => {
    const title = language === "arabic" ? arabicRecordTitle(record) : `${record.displayName} ${record.reference}`.trim();

    return `[${index + 1}] ${title}`;
  });
}

function citationLabelsForText(records: SourceRecord[], language: RetrievalLanguage, text: string) {
  const allLabels = citationLabels(records, language);
  const usedIndexes = [...text.matchAll(/\[(\d+)\]/g)]
    .map((match) => Number.parseInt(match[1] || "", 10))
    .filter((index) => Number.isInteger(index) && index >= 1 && index <= records.length);
  const uniqueUsedIndexes = [...new Set(usedIndexes)];

  return uniqueUsedIndexes.map((index) => allLabels[index - 1]).filter((label): label is string => Boolean(label));
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArabicForExcerpt(value: string) {
  return cleanWhitespace(
    value
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[إأآٱ]/g, "ا")
      .replace(/ى/g, "ي"),
  );
}

function stripArabicNarratorOpening(value: string) {
  const text = cleanWhitespace(value);
  const narratorOpening = /^(?:حدثنا|حدثني|اخبرنا|انبانا|انبا|سمعت)(?:\s|،|,)/;

  if (!narratorOpening.test(text)) {
    return text;
  }

  const matnMarkersToKeep = ["قال رسول الله", "قال النبي", "سمعت رسول الله", "عن النبي", "ان رسول الله", "ان النبي"];
  const markerIndex = matnMarkersToKeep
    .map((marker) => text.lastIndexOf(marker))
    .filter((index) => index > 0)
    .sort((a, b) => b - a)[0];

  if (markerIndex !== undefined) {
    return text.slice(markerIndex).trim();
  }

  const genericSpeechMarkers = Array.from(text.matchAll(/\sقال\s*[:،,]\s*/g));
  const finalSpeechMarker = genericSpeechMarkers.at(-1);

  if (finalSpeechMarker?.index !== undefined) {
    return text.slice(finalSpeechMarker.index + finalSpeechMarker[0].length).trim();
  }

  return text;
}

function excerptArabicText(value: string) {
  const text = stripArabicNarratorOpening(normalizeArabicForExcerpt(value));
  const markers = ["قال رسول الله", "سمعت رسول الله", "ان رسول الله", "عن النبي", "قال النبي", " ثم قال ", " قال "];
  const markerIndex = markers
    .map((marker) => text.lastIndexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => b - a)[0];
  const excerpt = markerIndex === undefined ? text : text.slice(markerIndex);

  return excerpt.slice(0, 260);
}

function excerptEnglishText(value: string) {
  const text = cleanWhitespace(value);
  const markers = ["saying,", "said,", "reported that", "narrated that", "the Prophet"];
  const markerIndex = markers
    .map((marker) => text.toLowerCase().indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const excerpt = markerIndex === undefined ? text : text.slice(markerIndex);

  return excerpt.slice(0, 230);
}

function contentExcerpt(record: SourceRecord, language: RetrievalLanguage) {
  const text = getRecordText(record, language);

  if (!text.trim()) {
    return language === "arabic" ? "لا يتوفر نص بهذا اللسان في هذا السجل" : "No text is available in this language for this record";
  }

  if (record.sourceKind !== "hadith") {
    return cleanWhitespace(text).slice(0, language === "arabic" ? 260 : 230);
  }

  return language === "arabic" ? excerptArabicText(text) : excerptEnglishText(text);
}

function summarizeArabicExcerpt(excerpt: string) {
  const text = normalizeArabicForExcerpt(excerpt).replace(/^قال\s+/, "");

  if (text.includes("اقيمت الصلاة") && text.includes("حبسه")) {
    return "موقفا وقع بعد إقامة الصلاة، حيث عُرض للنبي صلى الله عليه وسلم رجل فحبسه بعد الإقامة";
  }

  if (text.includes("نجمع بين الصلاتين") && text.includes("عهد رسول الله")) {
    return "الجمع بين الصلاتين على عهد رسول الله صلى الله عليه وسلم";
  }

  if (text.includes("افضل الصلاة") && text.includes("الصلاة المكتوبة")) {
    return "أن من الصلاة المذكورة في النص صلاة الليل بعد الصلاة المكتوبة";
  }

  if (text.includes("لا صلاة") && text.includes("فاتحة الكتاب")) {
    return "رواية تربط صحة الصلاة بقراءة فاتحة الكتاب";
  }

  return text.slice(0, 190);
}

function summarizeEnglishExcerpt(excerpt: string) {
  const text = cleanWhitespace(excerpt);

  if (text.includes("prayer") && text.includes("intention")) {
    return "a report that connects the described action with intention";
  }

  return text.slice(0, 190);
}

function summarizeExcerpt(excerpt: string, language: RetrievalLanguage) {
  return language === "arabic" ? summarizeArabicExcerpt(excerpt) : summarizeEnglishExcerpt(excerpt);
}

export function fallbackGroundedSummary(input: GenerateGroundedAnswerInput): GroundedAnswer {
  const seenExcerpts = new Set<string>();
  const featuredRecords = input.records
    .map((record, index) => ({
      citation: `[${index + 1}]`,
      grade: record.grade?.value || null,
      excerpt: contentExcerpt(record, input.language),
    }))
    .filter((record) => {
      const key = summarizeExcerpt(record.excerpt, input.language).slice(0, 90);

      if (seenExcerpts.has(key)) {
        return false;
      }

      seenExcerpts.add(key);
      return true;
    })
    .slice(0, 3);

  if (input.language === "arabic") {
    const quranLines = exactArabicQuranLines(input.records);
    const tafsirSummaryLines = exactArabicTafsirSummaryLines(input.records);
    const genericLines = featuredRecords
      .map((record) => {
        const grade = record.grade ? ` درجة السجل: ${record.grade}.` : "";
        return `- يلخص أحد السجلات ${summarizeExcerpt(record.excerpt, input.language)} ${record.citation}.${grade}`;
      })
      .join("\n");
    const lines =
      quranLines.length > 0
        ? [`النص المسترجع:`, quranLines.join("\n"), tafsirSummaryLines.length > 0 ? `الخلاصة من كتب التفسير:\n${tafsirSummaryLines.join("\n")}` : null]
            .filter(Boolean)
            .join("\n")
        : genericLines;

    const text = `بالنسبة إلى سؤالك، تعرض السجلات المسترجعة ما يلي:\n${lines}\nهذه صياغة تلخص النصوص المسترجعة فقط، وليست فتوى أو حكما شرعيا مستقلا.`;

    return {
      status: "ready",
      text,
      citations: citationLabelsForText(input.records, input.language, text),
      warnings: [{ code: "ollama_guardrail_fallback", message: "The model output was replaced by a guarded source summary." }],
    };
  }

  const lines = featuredRecords
    .map((record) => {
      const grade = record.grade ? ` Record grade: ${record.grade}.` : "";
      return `- One record describes ${summarizeExcerpt(record.excerpt, input.language)} ${record.citation}.${grade}`;
    })
    .join("\n");

  const text = `For your question, the retrieved records contain passages related to what you asked:\n${lines}\nThis summarizes only the retrieved text and is not an independent religious ruling.`;

  return {
    status: "ready",
    text,
    citations: citationLabelsForText(input.records, input.language, text),
    warnings: [{ code: "ollama_guardrail_fallback", message: "The model output was replaced by a guarded source summary." }],
  };
}

function exactArabicQuranLines(records: SourceRecord[]) {
  const seen = new Set<string>();
  const lines: string[] = [];

  records.forEach((record, index) => {
    if (record.sourceKind !== "quran" && record.sourceKind !== "tafsir") {
      return;
    }

    const ayahText = cleanWhitespace(record.arabicText);

    if (!ayahText) {
      return;
    }

    const reference = record.verseKey || record.reference;
    const key = `${reference}:${ayahText}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    const surahPrefix = record.surahName ? `سورة ${record.surahName}، ` : "";
    const sourceName = record.sourceKind === "quran" ? "القرآن الكريم" : arabicTafsirSourceName(record);

    lines.push(`- في ${sourceName}، ${surahPrefix}الآية ${reference}: ${ayahText} [${index + 1}].`);
  });

  return lines.slice(0, 3);
}

function exactArabicTafsirSummaryLines(records: SourceRecord[]) {
  const seen = new Set<string>();
  const lines: string[] = [];

  records.forEach((record, index) => {
    if (record.sourceKind !== "tafsir" || !record.tafsirText) {
      return;
    }

    const sourceName = arabicTafsirSourceName(record);
    const tafsirText = cleanWhitespace(record.tafsirText);

    if (!tafsirText || /[A-Za-z]/.test(tafsirText)) {
      return;
    }

    const key = `${sourceName}:${tafsirText.slice(0, 100)}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    lines.push(`- يذكر ${sourceName}: ${tafsirText.slice(0, 220)} [${index + 1}].`);
  });

  return lines.slice(0, 2);
}

function passesGroundingGuardrails(text: string, language: RetrievalLanguage) {
  if (!/\[\d+\]/.test(text)) {
    return false;
  }

  if (language === "arabic" && /[A-Za-z]/.test(text)) {
    return false;
  }

  if (language === "arabic" && /(?:^|\s)(?:حدثنا|حدثني|أخبرنا|اخبرنا|أنبأنا|انبانا|سمعت)(?:\s|،|,)/.test(text)) {
    return false;
  }

  if (/[«»"]/.test(text)) {
    return false;
  }

  const riskyArabicTerms = ["حرام", "حلال", "واجب", "فرض", "يجوز", "لا يجوز", "ينبغي على المسلم"];
  const riskyEnglishTerms = ["permissible", "impermissible", "obligatory", "forbidden", "must", "must not"];
  const riskyTerms = language === "arabic" ? riskyArabicTerms : riskyEnglishTerms;

  return !riskyTerms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

const arabicAllowedSummaryWords = new Set([
  "تعرض",
  "السجلات",
  "المسترجعة",
  "النصوص",
  "تتضمن",
  "تذكر",
  "إحدى",
  "احدى",
  "رواية",
  "روايات",
  "مرتبطة",
  "بسؤال",
  "سؤالك",
  "بالنسبة",
  "بالنسبه",
  "إلى",
  "الى",
  "بما",
  "سألت",
  "سالت",
  "عنه",
  "المستخدم",
  "أبرز",
  "يظهر",
  "صياغة",
  "تلخص",
  "فقط",
  "وليست",
  "فتوى",
  "حكما",
  "حكم",
  "شرعيا",
  "مستقلا",
  "درجة",
  "السجل",
]);

const englishAllowedSummaryWords = new Set([
  "the",
  "retrieved",
  "records",
  "contain",
  "passages",
  "related",
  "for",
  "your",
  "what",
  "you",
  "asked",
  "question",
  "user",
  "summarizes",
  "only",
  "text",
  "independent",
  "religious",
  "ruling",
  "record",
  "grade",
  "source",
]);

function tokenizeForGrounding(value: string, language: RetrievalLanguage) {
  const normalized =
    language === "arabic"
      ? value
          .replace(/[\u064B-\u065F\u0670]/g, "")
          .replace(/\u0640/g, "")
          .replace(/[إأآٱ]/g, "ا")
          .replace(/ى/g, "ي")
          .replace(/ة/g, "ه")
      : value.toLowerCase();

  return normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !/^\d+$/.test(token));
}

function passesLexicalGrounding(text: string, input: GenerateGroundedAnswerInput) {
  const sourceTokens = new Set(
    input.records.flatMap((record) => tokenizeForGrounding(getRecordText(record, input.language), input.language)),
  );
  const allowedWords = input.language === "arabic" ? arabicAllowedSummaryWords : englishAllowedSummaryWords;
  const unsupportedTokens = tokenizeForGrounding(text, input.language).filter((token) => {
    return !sourceTokens.has(token) && !allowedWords.has(token);
  });

  return unsupportedTokens.length <= 4;
}

function passesExactQuranGuardrail(text: string, input: GenerateGroundedAnswerInput) {
  if (input.language !== "arabic") {
    return true;
  }

  const quranRecords = input.records.filter((record) => {
    return (record.sourceKind === "quran" || record.sourceKind === "tafsir") && cleanWhitespace(record.arabicText).length > 0;
  });

  if (quranRecords.length === 0) {
    return true;
  }

  return quranRecords.some((record) => {
    const reference = record.verseKey || record.reference;
    const ayahText = cleanWhitespace(record.arabicText);

    return text.includes(reference) && text.includes(ayahText);
  });
}

function systemPrompt(language: RetrievalLanguage) {
  if (language === "arabic") {
    return [
      "أنت طبقة صياغة في سند AI، ولست مفتيا.",
      "استخدم سجلات المصادر المرفقة فقط. لا تضف نص قرآن أو تفسير أو حديث أو درجة أو مصدر من الذاكرة.",
      "لا تصدر فتوى ولا تقدم حكما شرعيا مستقلا. إن كانت السجلات غير كافية فاذكر ذلك بوضوح.",
      "لا تعتبر عناوين الكتب أو الأبواب حكما شرعيا؛ هي بيانات وصفية فقط.",
      "اكتب إجابة عربية قصيرة تصف ما تحتويه السجلات، لا تجب بصيغة حكم عام.",
      "لا تستخدم أي كلمة إنجليزية في الإجابة العربية، بما في ذلك أسماء الأنواع مثل Quran أو Tafsir.",
      "خاطب السائل مباشرة بصيغة المخاطب مثل: بالنسبة إلى سؤالك.",
      "إذا كان في السجلات آية قرآنية، فاذكر مرجع الآية ونصها العربي كما هو حرفيا من السجل، ولا تعد صياغة النص القرآني ولا تكمله من الذاكرة.",
      "لخّص المعنى والمضمون المشترك للنصوص المسترجعة، ولا تنقل أسانيد الرواة في الحديث إلا إذا كان السؤال عنها.",
      "لا تعرض قائمة بأسماء المصادر فقط؛ لخّص مضمون النصوص المسترجعة.",
      "ضع أرقام الاقتباس مثل [1] بجانب كل معلومة مستندة إلى سجل.",
      "لا تذكر أي مصدر غير موجود في الحزمة.",
    ].join("\n");
  }

  return [
    "You are the composition layer for سند AI, not a mufti.",
    "Use only the attached retrieved source records. Do not add Quran text, tafsir text, hadith text, grades, or provenance from memory.",
    "Do not issue fatwas or independent religious rulings. If the records are insufficient, say so clearly.",
    "Do not treat book or chapter titles as religious rulings; they are metadata only.",
    "Write a short answer that describes what the records contain, not a broad ruling.",
    "Address the asker directly in second person, with wording like: For your question.",
    "Summarize the shared meaning and content of the retrieved source texts. Do not quote or paraphrase hadith narrator chains unless the question asks about chains.",
    "Do not only list source names; summarize the content of the retrieved texts.",
    "Place citation markers like [1] beside every sourced claim.",
    "Do not cite any source that is not in the pack.",
  ].join("\n");
}

function userPrompt(input: GenerateGroundedAnswerInput) {
  const citationPack = buildCitationPack(input.records, input.language);

  if (input.language === "arabic") {
    return `السؤال:\n${input.question}\n\nسجلات المصادر المسترجعة:\n${citationPack}\n\nاكتب جملتين أو ثلاثا فقط. خاطب السائل مباشرة وابدأ بعبارة مثل: "بالنسبة إلى سؤالك، تعرض السجلات المسترجعة..." إذا وجدت آية فاذكر رقمها ونصها العربي حرفيا كما ورد في السجل، ولا تكتب أي كلمة إنجليزية. لا تضف تفصيلا غير ظاهر في النصوص.`;
  }

  return `Question:\n${input.question}\n\nRetrieved source records:\n${citationPack}\n\nWrite only two or three sentences. Address the asker directly and start with a phrase like: "For your question, the retrieved records show..." Summarize the overall meaning of the retrieved texts, not only the source names and not hadith narrator chains. Do not add details that are not visible in the records.`;
}

export async function generateGroundedAnswer(input: GenerateGroundedAnswerInput): Promise<GroundedAnswer> {
  if (input.records.length === 0) {
    return {
      status: "insufficient_sources",
      text: null,
      citations: [],
      warnings: [{ code: "insufficient_sources", message: "No retrieved records were available for answer generation." }],
    };
  }

  const config = getOllamaConfig();

  if (!config.enabled) {
    return disabledAnswer();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt(input.language) },
          { role: "user", content: userPrompt(input) },
        ],
        options: {
          temperature: 0.1,
          num_predict: 190,
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as OllamaChatResponse;

    if (!response.ok || payload.error) {
      return {
        status: "error",
        text: null,
        citations: [],
        warnings: [
          {
            code: "ollama_error",
            message: payload.error || `Ollama returned HTTP ${response.status}.`,
          },
        ],
      };
    }

    const text = stripThinkingBlocks(payload.message?.content || "");

    if (!text) {
      return {
        status: "error",
        text: null,
        citations: [],
        warnings: [{ code: "ollama_empty_answer", message: "Ollama returned an empty grounded answer." }],
      };
    }

    if (!passesGroundingGuardrails(text, input.language) || !passesLexicalGrounding(text, input) || !passesExactQuranGuardrail(text, input)) {
      return fallbackGroundedSummary(input);
    }

    return {
      status: "ready",
      text,
      citations: citationLabelsForText(input.records, input.language, text),
      warnings: [],
    };
  } catch (error) {
    return {
      status: "error",
      text: null,
      citations: [],
      warnings: [
        {
          code: "ollama_request_failed",
          message: error instanceof Error ? error.message : "The local Ollama answer request failed.",
        },
      ],
    };
  } finally {
    clearTimeout(timeout);
  }
}
