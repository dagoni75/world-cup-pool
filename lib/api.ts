import { createClient } from "@supabase/supabase-js";
import { FAVORITE_TEAM_OPTIONS } from "./favorite-teams";
import { predictionPoints } from "./scoring";
import { Match, Player, PoolData, Prediction } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Supabase environment variables are not configured.");
}

const supabase = createClient(url, key);

type MatchRow = {
  id: string;
  team_a: string;
  team_b: string;
  starts_at: string;
  stage: string;
  bracket_slot: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a_pk_score: number | null;
  team_b_pk_score: number | null;
};

type PlayerRow = {
  id: string;
  name: string;
  is_admin: boolean;
  favorite_team: string | null;
};

type TeamStanding = {
  team: string;
  group: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
};

type KnockoutEntrants = {
  winners: Partial<Record<GroupLetter, string>>;
  runnersUp: Partial<Record<GroupLetter, string>>;
  thirds: Partial<Record<GroupLetter, string>>;
};

type OfficialResult = {
  teamA: string;
  teamB: string;
  teamAScore: number;
  teamBScore: number;
};

const KNOCKOUT_STAGES = [
  "Round of 32",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Third Place Match",
  "Final",
] as const;

const KNOCKOUT_STAGE_SET = new Set<string>(KNOCKOUT_STAGES);
const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
type GroupLetter = (typeof GROUP_LETTERS)[number];
const KNOCKOUT_SLOT_COUNTS = [
  { stage: "Round of 32", prefix: "R32", count: 16 },
  { stage: "Round of 16", prefix: "R16", count: 8 },
  { stage: "Quarterfinals", prefix: "QF", count: 4 },
  { stage: "Semifinals", prefix: "SF", count: 2 },
  { stage: "Third Place Match", prefix: "THIRD", count: 1 },
  { stage: "Final", prefix: "FINAL", count: 1 },
];
const KNOCKOUT_EXPECTED_SCORES = new Map(KNOCKOUT_SLOT_COUNTS.map((item) => [item.stage, item.count]));
const FIFA_THIRD_PLACE_SLOT_ORDER = ["A", "B", "D", "E", "G", "I", "K", "L"] as const;
const FIFA_THIRD_PLACE_ASSIGNMENTS: Record<string, string> = {
  "EFGHIJKL": "EJIFHGLK",
  "DFGHIJKL": "HGIDJFLK",
  "DEGHIJKL": "EJIDHGLK",
  "DEFHIJKL": "EJIDHFLK",
  "DEFGIJKL": "EGIDJFLK",
  "DEFGHJKL": "EGJDHFLK",
  "DEFGHIKL": "EGIDHFLK",
  "DEFGHIJL": "EGJDHFLI",
  "DEFGHIJK": "EGJDHFIK",
  "CFGHIJKL": "HGICJFLK",
  "CEGHIJKL": "EJICHGLK",
  "CEFHIJKL": "EJICHFLK",
  "CEFGIJKL": "EGICJFLK",
  "CEFGHJKL": "EGJCHFLK",
  "CEFGHIKL": "EGICHFLK",
  "CEFGHIJL": "EGJCHFLI",
  "CEFGHIJK": "EGJCHFIK",
  "CDGHIJKL": "HGICJDLK",
  "CDFHIJKL": "CJIDHFLK",
  "CDFGIJKL": "CGIDJFLK",
  "CDFGHJKL": "CGJDHFLK",
  "CDFGHIKL": "CGIDHFLK",
  "CDFGHIJL": "CGJDHFLI",
  "CDFGHIJK": "CGJDHFIK",
  "CDEHIJKL": "EJICHDLK",
  "CDEGIJKL": "EGICJDLK",
  "CDEGHJKL": "EGJCHDLK",
  "CDEGHIKL": "EGICHDLK",
  "CDEGHIJL": "EGJCHDLI",
  "CDEGHIJK": "EGJCHDIK",
  "CDEFIJKL": "CJEDIFLK",
  "CDEFHJKL": "CJEDHFLK",
  "CDEFHIKL": "CEIDHFLK",
  "CDEFHIJL": "CJEDHFLI",
  "CDEFHIJK": "CJEDHFIK",
  "CDEFGJKL": "CGEDJFLK",
  "CDEFGIKL": "CGEDIFLK",
  "CDEFGIJL": "CGEDJFLI",
  "CDEFGIJK": "CGEDJFIK",
  "CDEFGHKL": "CGEDHFLK",
  "CDEFGHJL": "CGJDHFLE",
  "CDEFGHJK": "CGJDHFEK",
  "CDEFGHIL": "CGEDHFLI",
  "CDEFGHIK": "CGEDHFIK",
  "CDEFGHIJ": "CGJDHFEI",
  "BFGHIJKL": "HJBFIGLK",
  "BEGHIJKL": "EJIBHGLK",
  "BEFHIJKL": "EJBFIHLK",
  "BEFGIJKL": "EJBFIGLK",
  "BEFGHJKL": "EJBFHGLK",
  "BEFGHIKL": "EGBFIHLK",
  "BEFGHIJL": "EJBFHGLI",
  "BEFGHIJK": "EJBFHGIK",
  "BDGHIJKL": "HJBDIGLK",
  "BDFHIJKL": "HJBDIFLK",
  "BDFGIJKL": "IGBDJFLK",
  "BDFGHJKL": "HGBDJFLK",
  "BDFGHIKL": "HGBDIFLK",
  "BDFGHIJL": "HGBDJFLI",
  "BDFGHIJK": "HGBDJFIK",
  "BDEHIJKL": "EJBDIHLK",
  "BDEGIJKL": "EJBDIGLK",
  "BDEGHJKL": "EJBDHGLK",
  "BDEGHIKL": "EGBDIHLK",
  "BDEGHIJL": "EJBDHGLI",
  "BDEGHIJK": "EJBDHGIK",
  "BDEFIJKL": "EJBDIFLK",
  "BDEFHJKL": "EJBDHFLK",
  "BDEFHIKL": "EIBDHFLK",
  "BDEFHIJL": "EJBDHFLI",
  "BDEFHIJK": "EJBDHFIK",
  "BDEFGJKL": "EGBDJFLK",
  "BDEFGIKL": "EGBDIFLK",
  "BDEFGIJL": "EGBDJFLI",
  "BDEFGIJK": "EGBDJFIK",
  "BDEFGHKL": "EGBDHFLK",
  "BDEFGHJL": "HGBDJFLE",
  "BDEFGHJK": "HGBDJFEK",
  "BDEFGHIL": "EGBDHFLI",
  "BDEFGHIK": "EGBDHFIK",
  "BDEFGHIJ": "HGBDJFEI",
  "BCGHIJKL": "HJBCIGLK",
  "BCFHIJKL": "HJBCIFLK",
  "BCFGIJKL": "IGBCJFLK",
  "BCFGHJKL": "HGBCJFLK",
  "BCFGHIKL": "HGBCIFLK",
  "BCFGHIJL": "HGBCJFLI",
  "BCFGHIJK": "HGBCJFIK",
  "BCEHIJKL": "EJBCIHLK",
  "BCEGIJKL": "EJBCIGLK",
  "BCEGHJKL": "EJBCHGLK",
  "BCEGHIKL": "EGBCIHLK",
  "BCEGHIJL": "EJBCHGLI",
  "BCEGHIJK": "EJBCHGIK",
  "BCEFIJKL": "EJBCIFLK",
  "BCEFHJKL": "EJBCHFLK",
  "BCEFHIKL": "EIBCHFLK",
  "BCEFHIJL": "EJBCHFLI",
  "BCEFHIJK": "EJBCHFIK",
  "BCEFGJKL": "EGBCJFLK",
  "BCEFGIKL": "EGBCIFLK",
  "BCEFGIJL": "EGBCJFLI",
  "BCEFGIJK": "EGBCJFIK",
  "BCEFGHKL": "EGBCHFLK",
  "BCEFGHJL": "HGBCJFLE",
  "BCEFGHJK": "HGBCJFEK",
  "BCEFGHIL": "EGBCHFLI",
  "BCEFGHIK": "EGBCHFIK",
  "BCEFGHIJ": "HGBCJFEI",
  "BCDHIJKL": "HJBCIDLK",
  "BCDGIJKL": "IGBCJDLK",
  "BCDGHJKL": "HGBCJDLK",
  "BCDGHIKL": "HGBCIDLK",
  "BCDGHIJL": "HGBCJDLI",
  "BCDGHIJK": "HGBCJDIK",
  "BCDFIJKL": "CJBDIFLK",
  "BCDFHJKL": "CJBDHFLK",
  "BCDFHIKL": "CIBDHFLK",
  "BCDFHIJL": "CJBDHFLI",
  "BCDFHIJK": "CJBDHFIK",
  "BCDFGJKL": "CGBDJFLK",
  "BCDFGIKL": "CGBDIFLK",
  "BCDFGIJL": "CGBDJFLI",
  "BCDFGIJK": "CGBDJFIK",
  "BCDFGHKL": "CGBDHFLK",
  "BCDFGHJL": "CGBDHFLJ",
  "BCDFGHJK": "HGBCJFDK",
  "BCDFGHIL": "CGBDHFLI",
  "BCDFGHIK": "CGBDHFIK",
  "BCDFGHIJ": "HGBCJFDI",
  "BCDEIJKL": "EJBCIDLK",
  "BCDEHJKL": "EJBCHDLK",
  "BCDEHIKL": "EIBCHDLK",
  "BCDEHIJL": "EJBCHDLI",
  "BCDEHIJK": "EJBCHDIK",
  "BCDEGJKL": "EGBCJDLK",
  "BCDEGIKL": "EGBCIDLK",
  "BCDEGIJL": "EGBCJDLI",
  "BCDEGIJK": "EGBCJDIK",
  "BCDEGHKL": "EGBCHDLK",
  "BCDEGHJL": "HGBCJDLE",
  "BCDEGHJK": "HGBCJDEK",
  "BCDEGHIL": "EGBCHDLI",
  "BCDEGHIK": "EGBCHDIK",
  "BCDEGHIJ": "HGBCJDEI",
  "BCDEFJKL": "CJBDEFLK",
  "BCDEFIKL": "CEBDIFLK",
  "BCDEFIJL": "CJBDEFLI",
  "BCDEFIJK": "CJBDEFIK",
  "BCDEFHKL": "CEBDHFLK",
  "BCDEFHJL": "CJBDHFLE",
  "BCDEFHJK": "CJBDHFEK",
  "BCDEFHIL": "CEBDHFLI",
  "BCDEFHIK": "CEBDHFIK",
  "BCDEFHIJ": "CJBDHFEI",
  "BCDEFGKL": "CGBDEFLK",
  "BCDEFGJL": "CGBDJFLE",
  "BCDEFGJK": "CGBDJFEK",
  "BCDEFGIL": "CGBDEFLI",
  "BCDEFGIK": "CGBDEFIK",
  "BCDEFGIJ": "CGBDJFEI",
  "BCDEFGHL": "CGBDHFLE",
  "BCDEFGHK": "CGBDHFEK",
  "BCDEFGHJ": "HGBCJFDE",
  "BCDEFGHI": "CGBDHFEI",
  "AFGHIJKL": "HJIFAGLK",
  "AEGHIJKL": "EJIAHGLK",
  "AEFHIJKL": "EJIFAHLK",
  "AEFGIJKL": "EJIFAGLK",
  "AEFGHJKL": "EGJFAHLK",
  "AEFGHIKL": "EGIFAHLK",
  "AEFGHIJL": "EGJFAHLI",
  "AEFGHIJK": "EGJFAHIK",
  "ADGHIJKL": "HJIDAGLK",
  "ADFHIJKL": "HJIDAFLK",
  "ADFGIJKL": "IGJDAFLK",
  "ADFGHJKL": "HGJDAFLK",
  "ADFGHIKL": "HGIDAFLK",
  "ADFGHIJL": "HGJDAFLI",
  "ADFGHIJK": "HGJDAFIK",
  "ADEHIJKL": "EJIDAHLK",
  "ADEGIJKL": "EJIDAGLK",
  "ADEGHJKL": "EGJDAHLK",
  "ADEGHIKL": "EGIDAHLK",
  "ADEGHIJL": "EGJDAHLI",
  "ADEGHIJK": "EGJDAHIK",
  "ADEFIJKL": "EJIDAFLK",
  "ADEFHJKL": "HJEDAFLK",
  "ADEFHIKL": "HEIDAFLK",
  "ADEFHIJL": "HJEDAFLI",
  "ADEFHIJK": "HJEDAFIK",
  "ADEFGJKL": "EGJDAFLK",
  "ADEFGIKL": "EGIDAFLK",
  "ADEFGIJL": "EGJDAFLI",
  "ADEFGIJK": "EGJDAFIK",
  "ADEFGHKL": "HGEDAFLK",
  "ADEFGHJL": "HGJDAFLE",
  "ADEFGHJK": "HGJDAFEK",
  "ADEFGHIL": "HGEDAFLI",
  "ADEFGHIK": "HGEDAFIK",
  "ADEFGHIJ": "HGJDAFEI",
  "ACGHIJKL": "HJICAGLK",
  "ACFHIJKL": "HJICAFLK",
  "ACFGIJKL": "IGJCAFLK",
  "ACFGHJKL": "HGJCAFLK",
  "ACFGHIKL": "HGICAFLK",
  "ACFGHIJL": "HGJCAFLI",
  "ACFGHIJK": "HGJCAFIK",
  "ACEHIJKL": "EJICAHLK",
  "ACEGIJKL": "EJICAGLK",
  "ACEGHJKL": "EGJCAHLK",
  "ACEGHIKL": "EGICAHLK",
  "ACEGHIJL": "EGJCAHLI",
  "ACEGHIJK": "EGJCAHIK",
  "ACEFIJKL": "EJICAFLK",
  "ACEFHJKL": "HJECAFLK",
  "ACEFHIKL": "HEICAFLK",
  "ACEFHIJL": "HJECAFLI",
  "ACEFHIJK": "HJECAFIK",
  "ACEFGJKL": "EGJCAFLK",
  "ACEFGIKL": "EGICAFLK",
  "ACEFGIJL": "EGJCAFLI",
  "ACEFGIJK": "EGJCAFIK",
  "ACEFGHKL": "HGECAFLK",
  "ACEFGHJL": "HGJCAFLE",
  "ACEFGHJK": "HGJCAFEK",
  "ACEFGHIL": "HGECAFLI",
  "ACEFGHIK": "HGECAFIK",
  "ACEFGHIJ": "HGJCAFEI",
  "ACDHIJKL": "HJICADLK",
  "ACDGIJKL": "IGJCADLK",
  "ACDGHJKL": "HGJCADLK",
  "ACDGHIKL": "HGICADLK",
  "ACDGHIJL": "HGJCADLI",
  "ACDGHIJK": "HGJCADIK",
  "ACDFIJKL": "CJIDAFLK",
  "ACDFHJKL": "HJFCADLK",
  "ACDFHIKL": "HFICADLK",
  "ACDFHIJL": "HJFCADLI",
  "ACDFHIJK": "HJFCADIK",
  "ACDFGJKL": "CGJDAFLK",
  "ACDFGIKL": "CGIDAFLK",
  "ACDFGIJL": "CGJDAFLI",
  "ACDFGIJK": "CGJDAFIK",
  "ACDFGHKL": "HGFCADLK",
  "ACDFGHJL": "CGJDAFLH",
  "ACDFGHJK": "HGJCAFDK",
  "ACDFGHIL": "HGFCADLI",
  "ACDFGHIK": "HGFCADIK",
  "ACDFGHIJ": "HGJCAFDI",
  "ACDEIJKL": "EJICADLK",
  "ACDEHJKL": "HJECADLK",
  "ACDEHIKL": "HEICADLK",
  "ACDEHIJL": "HJECADLI",
  "ACDEHIJK": "HJECADIK",
  "ACDEGJKL": "EGJCADLK",
  "ACDEGIKL": "EGICADLK",
  "ACDEGIJL": "EGJCADLI",
  "ACDEGIJK": "EGJCADIK",
  "ACDEGHKL": "HGECADLK",
  "ACDEGHJL": "HGJCADLE",
  "ACDEGHJK": "HGJCADEK",
  "ACDEGHIL": "HGECADLI",
  "ACDEGHIK": "HGECADIK",
  "ACDEGHIJ": "HGJCADEI",
  "ACDEFJKL": "CJEDAFLK",
  "ACDEFIKL": "CEIDAFLK",
  "ACDEFIJL": "CJEDAFLI",
  "ACDEFIJK": "CJEDAFIK",
  "ACDEFHKL": "HEFCADLK",
  "ACDEFHJL": "HJFCADLE",
  "ACDEFHJK": "HJECAFDK",
  "ACDEFHIL": "HEFCADLI",
  "ACDEFHIK": "HEFCADIK",
  "ACDEFHIJ": "HJECAFDI",
  "ACDEFGKL": "CGEDAFLK",
  "ACDEFGJL": "CGJDAFLE",
  "ACDEFGJK": "CGJDAFEK",
  "ACDEFGIL": "CGEDAFLI",
  "ACDEFGIK": "CGEDAFIK",
  "ACDEFGIJ": "CGJDAFEI",
  "ACDEFGHL": "HGFCADLE",
  "ACDEFGHK": "HGECAFDK",
  "ACDEFGHJ": "HGJCAFDE",
  "ACDEFGHI": "HGECAFDI",
  "ABGHIJKL": "HJBAIGLK",
  "ABFHIJKL": "HJBAIFLK",
  "ABFGIJKL": "IJBFAGLK",
  "ABFGHJKL": "HJBFAGLK",
  "ABFGHIKL": "HGBAIFLK",
  "ABFGHIJL": "HJBFAGLI",
  "ABFGHIJK": "HJBFAGIK",
  "ABEHIJKL": "EJBAIHLK",
  "ABEGIJKL": "EJBAIGLK",
  "ABEGHJKL": "EJBAHGLK",
  "ABEGHIKL": "EGBAIHLK",
  "ABEGHIJL": "EJBAHGLI",
  "ABEGHIJK": "EJBAHGIK",
  "ABEFIJKL": "EJBAIFLK",
  "ABEFHJKL": "EJBFAHLK",
  "ABEFHIKL": "EIBFAHLK",
  "ABEFHIJL": "EJBFAHLI",
  "ABEFHIJK": "EJBFAHIK",
  "ABEFGJKL": "EJBFAGLK",
  "ABEFGIKL": "EGBAIFLK",
  "ABEFGIJL": "EJBFAGLI",
  "ABEFGIJK": "EJBFAGIK",
  "ABEFGHKL": "EGBFAHLK",
  "ABEFGHJL": "HJBFAGLE",
  "ABEFGHJK": "HJBFAGEK",
  "ABEFGHIL": "EGBFAHLI",
  "ABEFGHIK": "EGBFAHIK",
  "ABEFGHIJ": "HJBFAGEI",
  "ABDHIJKL": "IJBDAHLK",
  "ABDGIJKL": "IJBDAGLK",
  "ABDGHJKL": "HJBDAGLK",
  "ABDGHIKL": "IGBDAHLK",
  "ABDGHIJL": "HJBDAGLI",
  "ABDGHIJK": "HJBDAGIK",
  "ABDFIJKL": "IJBDAFLK",
  "ABDFHJKL": "HJBDAFLK",
  "ABDFHIKL": "HIBDAFLK",
  "ABDFHIJL": "HJBDAFLI",
  "ABDFHIJK": "HJBDAFIK",
  "ABDFGJKL": "FJBDAGLK",
  "ABDFGIKL": "IGBDAFLK",
  "ABDFGIJL": "FJBDAGLI",
  "ABDFGIJK": "FJBDAGIK",
  "ABDFGHKL": "HGBDAFLK",
  "ABDFGHJL": "HGBDAFLJ",
  "ABDFGHJK": "HGBDAFJK",
  "ABDFGHIL": "HGBDAFLI",
  "ABDFGHIK": "HGBDAFIK",
  "ABDFGHIJ": "HGBDAFIJ",
  "ABDEIJKL": "EJBAIDLK",
  "ABDEHJKL": "EJBDAHLK",
  "ABDEHIKL": "EIBDAHLK",
  "ABDEHIJL": "EJBDAHLI",
  "ABDEHIJK": "EJBDAHIK",
  "ABDEGJKL": "EJBDAGLK",
  "ABDEGIKL": "EGBAIDLK",
  "ABDEGIJL": "EJBDAGLI",
  "ABDEGIJK": "EJBDAGIK",
  "ABDEGHKL": "EGBDAHLK",
  "ABDEGHJL": "HJBDAGLE",
  "ABDEGHJK": "HJBDAGEK",
  "ABDEGHIL": "EGBDAHLI",
  "ABDEGHIK": "EGBDAHIK",
  "ABDEGHIJ": "HJBDAGEI",
  "ABDEFJKL": "EJBDAFLK",
  "ABDEFIKL": "EIBDAFLK",
  "ABDEFIJL": "EJBDAFLI",
  "ABDEFIJK": "EJBDAFIK",
  "ABDEFHKL": "HEBDAFLK",
  "ABDEFHJL": "HJBDAFLE",
  "ABDEFHJK": "HJBDAFEK",
  "ABDEFHIL": "HEBDAFLI",
  "ABDEFHIK": "HEBDAFIK",
  "ABDEFHIJ": "HJBDAFEI",
  "ABDEFGKL": "EGBDAFLK",
  "ABDEFGJL": "EGBDAFLJ",
  "ABDEFGJK": "EGBDAFJK",
  "ABDEFGIL": "EGBDAFLI",
  "ABDEFGIK": "EGBDAFIK",
  "ABDEFGIJ": "EGBDAFIJ",
  "ABDEFGHL": "HGBDAFLE",
  "ABDEFGHK": "HGBDAFEK",
  "ABDEFGHJ": "HGBDAFEJ",
  "ABDEFGHI": "HGBDAFEI",
  "ABCHIJKL": "IJBCAHLK",
  "ABCGIJKL": "IJBCAGLK",
  "ABCGHJKL": "HJBCAGLK",
  "ABCGHIKL": "IGBCAHLK",
  "ABCGHIJL": "HJBCAGLI",
  "ABCGHIJK": "HJBCAGIK",
  "ABCFIJKL": "IJBCAFLK",
  "ABCFHJKL": "HJBCAFLK",
  "ABCFHIKL": "HIBCAFLK",
  "ABCFHIJL": "HJBCAFLI",
  "ABCFHIJK": "HJBCAFIK",
  "ABCFGJKL": "CJBFAGLK",
  "ABCFGIKL": "IGBCAFLK",
  "ABCFGIJL": "CJBFAGLI",
  "ABCFGIJK": "CJBFAGIK",
  "ABCFGHKL": "HGBCAFLK",
  "ABCFGHJL": "HGBCAFLJ",
  "ABCFGHJK": "HGBCAFJK",
  "ABCFGHIL": "HGBCAFLI",
  "ABCFGHIK": "HGBCAFIK",
  "ABCFGHIJ": "HGBCAFIJ",
  "ABCEIJKL": "EJBAICLK",
  "ABCEHJKL": "EJBCAHLK",
  "ABCEHIKL": "EIBCAHLK",
  "ABCEHIJL": "EJBCAHLI",
  "ABCEHIJK": "EJBCAHIK",
  "ABCEGJKL": "EJBCAGLK",
  "ABCEGIKL": "EGBAICLK",
  "ABCEGIJL": "EJBCAGLI",
  "ABCEGIJK": "EJBCAGIK",
  "ABCEGHKL": "EGBCAHLK",
  "ABCEGHJL": "HJBCAGLE",
  "ABCEGHJK": "HJBCAGEK",
  "ABCEGHIL": "EGBCAHLI",
  "ABCEGHIK": "EGBCAHIK",
  "ABCEGHIJ": "HJBCAGEI",
  "ABCEFJKL": "EJBCAFLK",
  "ABCEFIKL": "EIBCAFLK",
  "ABCEFIJL": "EJBCAFLI",
  "ABCEFIJK": "EJBCAFIK",
  "ABCEFHKL": "HEBCAFLK",
  "ABCEFHJL": "HJBCAFLE",
  "ABCEFHJK": "HJBCAFEK",
  "ABCEFHIL": "HEBCAFLI",
  "ABCEFHIK": "HEBCAFIK",
  "ABCEFHIJ": "HJBCAFEI",
  "ABCEFGKL": "EGBCAFLK",
  "ABCEFGJL": "EGBCAFLJ",
  "ABCEFGJK": "EGBCAFJK",
  "ABCEFGIL": "EGBCAFLI",
  "ABCEFGIK": "EGBCAFIK",
  "ABCEFGIJ": "EGBCAFIJ",
  "ABCEFGHL": "HGBCAFLE",
  "ABCEFGHK": "HGBCAFEK",
  "ABCEFGHJ": "HGBCAFEJ",
  "ABCEFGHI": "HGBCAFEI",
  "ABCDIJKL": "IJBCADLK",
  "ABCDHJKL": "HJBCADLK",
  "ABCDHIKL": "HIBCADLK",
  "ABCDHIJL": "HJBCADLI",
  "ABCDHIJK": "HJBCADIK",
  "ABCDGJKL": "CJBDAGLK",
  "ABCDGIKL": "IGBCADLK",
  "ABCDGIJL": "CJBDAGLI",
  "ABCDGIJK": "CJBDAGIK",
  "ABCDGHKL": "HGBCADLK",
  "ABCDGHJL": "HGBCADLJ",
  "ABCDGHJK": "HGBCADJK",
  "ABCDGHIL": "HGBCADLI",
  "ABCDGHIK": "HGBCADIK",
  "ABCDGHIJ": "HGBCADIJ",
  "ABCDFJKL": "CJBDAFLK",
  "ABCDFIKL": "CIBDAFLK",
  "ABCDFIJL": "CJBDAFLI",
  "ABCDFIJK": "CJBDAFIK",
  "ABCDFHKL": "HFBCADLK",
  "ABCDFHJL": "CJBDAFLH",
  "ABCDFHJK": "HJBCAFDK",
  "ABCDFHIL": "HFBCADLI",
  "ABCDFHIK": "HFBCADIK",
  "ABCDFHIJ": "HJBCAFDI",
  "ABCDFGKL": "CGBDAFLK",
  "ABCDFGJL": "CGBDAFLJ",
  "ABCDFGJK": "CGBDAFJK",
  "ABCDFGIL": "CGBDAFLI",
  "ABCDFGIK": "CGBDAFIK",
  "ABCDFGIJ": "CGBDAFIJ",
  "ABCDFGHL": "CGBDAFLH",
  "ABCDFGHK": "HGBCAFDK",
  "ABCDFGHJ": "HGBCAFDJ",
  "ABCDFGHI": "HGBCAFDI",
  "ABCDEJKL": "EJBCADLK",
  "ABCDEIKL": "EIBCADLK",
  "ABCDEIJL": "EJBCADLI",
  "ABCDEIJK": "EJBCADIK",
  "ABCDEHKL": "HEBCADLK",
  "ABCDEHJL": "HJBCADLE",
  "ABCDEHJK": "HJBCADEK",
  "ABCDEHIL": "HEBCADLI",
  "ABCDEHIK": "HEBCADIK",
  "ABCDEHIJ": "HJBCADEI",
  "ABCDEGKL": "EGBCADLK",
  "ABCDEGJL": "EGBCADLJ",
  "ABCDEGJK": "EGBCADJK",
  "ABCDEGIL": "EGBCADLI",
  "ABCDEGIK": "EGBCADIK",
  "ABCDEGIJ": "EGBCADIJ",
  "ABCDEGHL": "HGBCADLE",
  "ABCDEGHK": "HGBCADEK",
  "ABCDEGHJ": "HGBCADEJ",
  "ABCDEGHI": "HGBCADEI",
  "ABCDEFKL": "CEBDAFLK",
  "ABCDEFJL": "CJBDAFLE",
  "ABCDEFJK": "CJBDAFEK",
  "ABCDEFIL": "CEBDAFLI",
  "ABCDEFIK": "CEBDAFIK",
  "ABCDEFIJ": "CJBDAFEI",
  "ABCDEFHL": "HFBCADLE",
  "ABCDEFHK": "HEBCAFDK",
  "ABCDEFHJ": "HJBCAFDE",
  "ABCDEFHI": "HEBCAFDI",
  "ABCDEFGL": "CGBDAFLE",
  "ABCDEFGK": "CGBDAFEK",
  "ABCDEFGJ": "CGBDAFEJ",
  "ABCDEFGI": "CGBDAFEI",
  "ABCDEFGH": "HGBCAFDE",
};
const OFFICIAL_SCORES_SO_FAR: OfficialResult[] = [
  { teamA: "Mexico", teamB: "South Africa", teamAScore: 2, teamBScore: 0 },
  { teamA: "South Korea", teamB: "Czechia", teamAScore: 2, teamBScore: 1 },
  { teamA: "Canada", teamB: "Bosnia and Herzegovina", teamAScore: 1, teamBScore: 1 },
  { teamA: "United States", teamB: "Paraguay", teamAScore: 4, teamBScore: 1 },
  { teamA: "Qatar", teamB: "Switzerland", teamAScore: 1, teamBScore: 1 },
  { teamA: "Brazil", teamB: "Morocco", teamAScore: 1, teamBScore: 1 },
  { teamA: "Haiti", teamB: "Scotland", teamAScore: 0, teamBScore: 1 },
  { teamA: "Australia", teamB: "Turkey", teamAScore: 2, teamBScore: 0 },
  { teamA: "Germany", teamB: "Curacao", teamAScore: 7, teamBScore: 1 },
  { teamA: "Netherlands", teamB: "Japan", teamAScore: 2, teamBScore: 2 },
  { teamA: "Ivory Coast", teamB: "Ecuador", teamAScore: 1, teamBScore: 0 },
  { teamA: "Sweden", teamB: "Tunisia", teamAScore: 5, teamBScore: 1 },
  { teamA: "Spain", teamB: "Cape Verde", teamAScore: 0, teamBScore: 0 },
  { teamA: "Belgium", teamB: "Egypt", teamAScore: 1, teamBScore: 1 },
  { teamA: "Saudi Arabia", teamB: "Uruguay", teamAScore: 1, teamBScore: 1 },
  { teamA: "Iran", teamB: "New Zealand", teamAScore: 2, teamBScore: 2 },
  { teamA: "France", teamB: "Senegal", teamAScore: 3, teamBScore: 1 },
  { teamA: "Iraq", teamB: "Norway", teamAScore: 1, teamBScore: 4 },
  { teamA: "Argentina", teamB: "Algeria", teamAScore: 3, teamBScore: 0 },
  { teamA: "Austria", teamB: "Jordan", teamAScore: 3, teamBScore: 1 },
  { teamA: "Portugal", teamB: "DR Congo", teamAScore: 1, teamBScore: 1 },
  { teamA: "England", teamB: "Croatia", teamAScore: 4, teamBScore: 2 },
  { teamA: "Ghana", teamB: "Panama", teamAScore: 1, teamBScore: 0 },
  { teamA: "Uzbekistan", teamB: "Colombia", teamAScore: 1, teamBScore: 3 },
  { teamA: "Czechia", teamB: "South Africa", teamAScore: 1, teamBScore: 1 },
  { teamA: "Switzerland", teamB: "Bosnia and Herzegovina", teamAScore: 4, teamBScore: 1 },
  { teamA: "Canada", teamB: "Qatar", teamAScore: 6, teamBScore: 0 },
  { teamA: "Mexico", teamB: "South Korea", teamAScore: 1, teamBScore: 0 },
  { teamA: "United States", teamB: "Australia", teamAScore: 2, teamBScore: 0 },
  { teamA: "Scotland", teamB: "Morocco", teamAScore: 0, teamBScore: 1 },
  { teamA: "Brazil", teamB: "Haiti", teamAScore: 3, teamBScore: 0 },
  { teamA: "Turkey", teamB: "Paraguay", teamAScore: 0, teamBScore: 1 },
  { teamA: "Netherlands", teamB: "Sweden", teamAScore: 5, teamBScore: 1 },
  { teamA: "Germany", teamB: "Ivory Coast", teamAScore: 2, teamBScore: 1 },
  { teamA: "Ecuador", teamB: "Curacao", teamAScore: 0, teamBScore: 0 },
  { teamA: "Tunisia", teamB: "Japan", teamAScore: 0, teamBScore: 4 },
  { teamA: "Spain", teamB: "Saudi Arabia", teamAScore: 4, teamBScore: 0 },
  { teamA: "Belgium", teamB: "Iran", teamAScore: 0, teamBScore: 0 },
  { teamA: "Uruguay", teamB: "Cape Verde", teamAScore: 2, teamBScore: 2 },
  { teamA: "New Zealand", teamB: "Egypt", teamAScore: 1, teamBScore: 3 },
  { teamA: "Argentina", teamB: "Austria", teamAScore: 2, teamBScore: 0 },
];

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("No data returned.");
  return data;
}

function validScore(score: number) {
  return Number.isInteger(score) && score >= 0 && score <= 30;
}

function validPkScore(score: number) {
  return Number.isInteger(score) && score >= 0 && score <= 20;
}

function testScore() {
  return Math.floor(Math.random() * 5);
}

function testKnockoutScore() {
  const teamAScore = testScore();
  let teamBScore = testScore();

  if (teamAScore === teamBScore) {
    teamBScore = teamAScore === 4 ? teamAScore - 1 : teamAScore + 1;
  }

  return { teamAScore, teamBScore };
}

function normalizePlayerName(name: string) {
  return name.trim();
}

function normalizeTeamName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
  const aliases: Record<string, string> = {
    "cabo verde": "cape verde",
    "congo dr": "dr congo",
    "cote d ivoire": "ivory coast",
    curacao: "curacao",
    "ir iran": "iran",
    "korea republic": "south korea",
    turkiye: "turkey",
    usa: "united states",
  };

  return aliases[normalized] ?? normalized;
}

function sameTeam(left: string, right: string) {
  return normalizeTeamName(left) === normalizeTeamName(right);
}

function isGroupMatch(match: MatchRow) {
  return /^Group [A-L]$/.test(match.stage);
}

function groupLetter(stage: string) {
  const match = stage.match(/^Group ([A-L])$/);
  return match?.[1] as GroupLetter | undefined;
}

function isKnockoutMatch(match: MatchRow) {
  return KNOCKOUT_STAGE_SET.has(match.stage);
}

function bracketSlot(stage: string, index: number) {
  const config = KNOCKOUT_SLOT_COUNTS.find((item) => item.stage === stage);
  if (!config) return null;
  if (config.prefix === "THIRD" || config.prefix === "FINAL") return config.prefix;
  return `${config.prefix}-${index + 1}`;
}

function knockoutStageOrder(stage: string) {
  return KNOCKOUT_SLOT_COUNTS.findIndex((item) => item.stage === stage);
}

function slotNumber(slot: string | null) {
  if (!slot) return Number.MAX_SAFE_INTEGER;
  const match = slot.match(/-(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function sortKnockoutRows(a: MatchRow, b: MatchRow) {
  return (
    knockoutStageOrder(a.stage) - knockoutStageOrder(b.stage) ||
    slotNumber(a.bracket_slot) - slotNumber(b.bracket_slot) ||
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime() ||
    a.id.localeCompare(b.id)
  );
}

function sameInstant(left: string, right: string) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function avoidSameTeam(teamA: string, teamB: string, fallback: string) {
  return teamA === teamB ? fallback : teamB;
}

function completed(match: MatchRow) {
  return match.team_a_score !== null && match.team_b_score !== null;
}

function played(match: MatchRow) {
  return new Date(match.starts_at) <= new Date();
}

function leaderboardPointReason(
  predictedA: number,
  predictedB: number,
  actualA: number,
  actualB: number,
) {
  if (predictedA === actualA && predictedB === actualB) return "exact";

  const predictedGoalDifference = predictedA - predictedB;
  const actualGoalDifference = actualA - actualB;
  if (predictedGoalDifference === actualGoalDifference) return "goal diff";
  if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) return "outcome";
  if (predictedA === actualA || predictedB === actualB) return "team score";
  return "points";
}

function knockoutWinner(match?: MatchRow) {
  if (!match) return null;
  if (!completed(match)) return null;
  if (match.team_a_score! > match.team_b_score!) return match.team_a;
  if (match.team_b_score! > match.team_a_score!) return match.team_b;
  if (match.team_a_pk_score === null || match.team_b_pk_score === null) return null;
  if (match.team_a_pk_score > match.team_b_pk_score) return match.team_a;
  if (match.team_b_pk_score > match.team_a_pk_score) return match.team_b;
  return null;
}

function knockoutLoser(match?: MatchRow) {
  if (!match) return null;
  if (!completed(match)) return null;
  if (match.team_a_score! > match.team_b_score!) return match.team_b;
  if (match.team_b_score! > match.team_a_score!) return match.team_a;
  if (match.team_a_pk_score === null || match.team_b_pk_score === null) return null;
  if (match.team_a_pk_score > match.team_b_pk_score) return match.team_b;
  if (match.team_b_pk_score > match.team_a_pk_score) return match.team_a;
  return null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function sortStandings(a: TeamStanding, b: TeamStanding) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.team.localeCompare(b.team)
  );
}

function groupStandings(groupMatches: MatchRow[]) {
  const standings = new Map<string, TeamStanding>();

  for (const match of groupMatches) {
    for (const team of [match.team_a, match.team_b]) {
      if (!standings.has(team)) {
        standings.set(team, {
          team,
          group: match.stage,
          points: 0,
          goalDifference: 0,
          goalsFor: 0,
        });
      }
    }

    if (!completed(match)) continue;

    const teamA = standings.get(match.team_a)!;
    const teamB = standings.get(match.team_b)!;
    const teamAScore = match.team_a_score!;
    const teamBScore = match.team_b_score!;

    teamA.goalsFor += teamAScore;
    teamB.goalsFor += teamBScore;
    teamA.goalDifference += teamAScore - teamBScore;
    teamB.goalDifference += teamBScore - teamAScore;

    if (teamAScore > teamBScore) {
      teamA.points += 3;
    } else if (teamBScore > teamAScore) {
      teamB.points += 3;
    } else {
      teamA.points += 1;
      teamB.points += 1;
    }
  }

  return Array.from(standings.values()).sort(sortStandings);
}

function knockoutEntrants(matchRows: MatchRow[]) {
  const groupMatches = matchRows.filter(isGroupMatch);
  if (groupMatches.length === 0 || groupMatches.some((match) => !completed(match))) return null;

  const groups = Array.from(new Set(groupMatches.map((match) => match.stage))).sort();
  const winners: KnockoutEntrants["winners"] = {};
  const runnersUp: KnockoutEntrants["runnersUp"] = {};
  const thirdPlaced: TeamStanding[] = [];

  for (const group of groups) {
    const letter = groupLetter(group);
    if (!letter) return null;

    const standings = groupStandings(groupMatches.filter((match) => match.stage === group));
    if (standings.length < 3) return null;

    winners[letter] = standings[0].team;
    runnersUp[letter] = standings[1].team;
    thirdPlaced.push(standings[2]);
  }

  const thirds: KnockoutEntrants["thirds"] = {};
  for (const standing of thirdPlaced.sort(sortStandings).slice(0, 8)) {
    const letter = groupLetter(standing.group);
    if (letter) thirds[letter] = standing.team;
  }

  return { winners, runnersUp, thirds };
}

function thirdPlaceAssignment(entrants: KnockoutEntrants, winnerGroup: (typeof FIFA_THIRD_PLACE_SLOT_ORDER)[number]) {
  const key = Object.keys(entrants.thirds).sort().join("");
  const assignment = FIFA_THIRD_PLACE_ASSIGNMENTS[key];
  const index = FIFA_THIRD_PLACE_SLOT_ORDER.indexOf(winnerGroup);
  const thirdGroup = assignment?.[index] as GroupLetter | undefined;

  return thirdGroup ? entrants.thirds[thirdGroup] ?? `3${thirdGroup}` : `Best 3rd place`;
}

function entrant(entrants: KnockoutEntrants, source: string) {
  const group = source[1] as GroupLetter;
  if (source[0] === "1") return entrants.winners[group] ?? source;
  if (source[0] === "2") return entrants.runnersUp[group] ?? source;
  if (source[0] === "3") return entrants.thirds[group] ?? source;
  return source;
}

function buildKnockoutPlan(matchRows: MatchRow[]) {
  const entrants = knockoutEntrants(matchRows);
  if (!entrants) return [];

  const lastGroupStart = Math.max(
    ...matchRows.filter(isGroupMatch).map((match) => new Date(match.starts_at).getTime()),
  );
  const base = new Date(lastGroupStart + 3 * 24 * 60 * 60 * 1000);
  const existingKnockout = matchRows.filter(isKnockoutMatch);
  const roundRow = (stage: string, index: number) => {
    const slot = bracketSlot(stage, index);
    return existingKnockout.find((match) => match.stage === stage && match.bracket_slot === slot);
  };
  const winner = (stage: string, index: number, fallback: string) =>
    knockoutWinner(roundRow(stage, index)) ?? fallback;
  const loser = (stage: string, index: number, fallback: string) =>
    knockoutLoser(roundRow(stage, index)) ?? fallback;

  const r32Teams = [
    [entrant(entrants, "2A"), entrant(entrants, "2B")],
    [entrant(entrants, "1E"), thirdPlaceAssignment(entrants, "E")],
    [entrant(entrants, "1F"), entrant(entrants, "2C")],
    [entrant(entrants, "1C"), entrant(entrants, "2F")],
    [entrant(entrants, "1I"), thirdPlaceAssignment(entrants, "I")],
    [entrant(entrants, "2E"), entrant(entrants, "2I")],
    [entrant(entrants, "1A"), thirdPlaceAssignment(entrants, "A")],
    [entrant(entrants, "1L"), thirdPlaceAssignment(entrants, "L")],
    [entrant(entrants, "1D"), thirdPlaceAssignment(entrants, "D")],
    [entrant(entrants, "1G"), thirdPlaceAssignment(entrants, "G")],
    [entrant(entrants, "2K"), entrant(entrants, "2L")],
    [entrant(entrants, "1H"), entrant(entrants, "2J")],
    [entrant(entrants, "1B"), thirdPlaceAssignment(entrants, "B")],
    [entrant(entrants, "1J"), entrant(entrants, "2H")],
    [entrant(entrants, "1K"), thirdPlaceAssignment(entrants, "K")],
    [entrant(entrants, "2D"), entrant(entrants, "2G")],
  ];
  const r16Teams = [
    [winner("Round of 32", 1, "Winner M74"), winner("Round of 32", 4, "Winner M77")],
    [winner("Round of 32", 0, "Winner M73"), winner("Round of 32", 2, "Winner M75")],
    [winner("Round of 32", 3, "Winner M76"), winner("Round of 32", 5, "Winner M78")],
    [winner("Round of 32", 6, "Winner M79"), winner("Round of 32", 7, "Winner M80")],
    [winner("Round of 32", 10, "Winner M83"), winner("Round of 32", 11, "Winner M84")],
    [winner("Round of 32", 8, "Winner M81"), winner("Round of 32", 9, "Winner M82")],
    [winner("Round of 32", 13, "Winner M86"), winner("Round of 32", 15, "Winner M88")],
    [winner("Round of 32", 12, "Winner M85"), winner("Round of 32", 14, "Winner M87")],
  ];
  const qfTeams = [
    [winner("Round of 16", 0, "Winner M89"), winner("Round of 16", 1, "Winner M90")],
    [winner("Round of 16", 4, "Winner M93"), winner("Round of 16", 5, "Winner M94")],
    [winner("Round of 16", 2, "Winner M91"), winner("Round of 16", 3, "Winner M92")],
    [winner("Round of 16", 6, "Winner M95"), winner("Round of 16", 7, "Winner M96")],
  ];
  const sfTeams = [
    [winner("Quarterfinals", 0, "Winner M97"), winner("Quarterfinals", 1, "Winner M98")],
    [winner("Quarterfinals", 2, "Winner M99"), winner("Quarterfinals", 3, "Winner M100")],
  ];
  const thirdPlaceTeams = [
    [
      loser("Semifinals", 0, "Runner-up SF1"),
      loser("Semifinals", 1, "Runner-up SF2"),
    ],
  ];
  const finalTeams = [
    [
      winner("Semifinals", 0, "Winner SF1"),
      winner("Semifinals", 1, "Winner SF2"),
    ],
  ];

  const rounds = [
    { stage: "Round of 32", offsetDays: 0, teams: r32Teams },
    { stage: "Round of 16", offsetDays: 5, teams: r16Teams },
    { stage: "Quarterfinals", offsetDays: 9, teams: qfTeams },
    { stage: "Semifinals", offsetDays: 13, teams: sfTeams },
    { stage: "Third Place Match", offsetDays: 16, teams: thirdPlaceTeams },
    { stage: "Final", offsetDays: 17, teams: finalTeams },
  ];

  return rounds.flatMap((round) =>
    round.teams.map(([teamA, teamB], index) => ({
      team_a: teamA,
      team_b: avoidSameTeam(teamA, teamB, "TBD"),
      starts_at: addHours(base, round.offsetDays * 24 + index * 3),
      stage: round.stage,
      bracket_slot: bracketSlot(round.stage, index),
    })),
  );
}

async function loadMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select("id, team_a, team_b, starts_at, stage, bracket_slot, team_a_score, team_b_score, team_a_pk_score, team_b_pk_score")
    .order("starts_at");

  return unwrap(data, error) as MatchRow[];
}

async function adminUpsertMatch(player: Player, match: Omit<MatchRow, "id"> & { id?: string }) {
  const { data, error } = await supabase.rpc("app_admin_upsert_match", {
    p_player_id: player.id,
    p_token: player.token,
    p_match_id: match.id ?? null,
    p_team_a: match.team_a,
    p_team_b: match.team_b,
    p_starts_at: match.starts_at,
    p_stage: match.stage,
    p_bracket_slot: match.bracket_slot,
    p_team_a_score: match.team_a_score,
    p_team_b_score: match.team_b_score,
    p_team_a_pk_score: match.team_a_pk_score,
    p_team_b_pk_score: match.team_b_pk_score,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

async function adminDeleteKnockoutMatches(player: Player) {
  const { error } = await supabase.rpc("app_admin_delete_knockout_matches", {
    p_player_id: player.id,
    p_token: player.token,
  });

  if (error) throw new Error(error.message);
}

async function assignMissingBracketSlots(matchRows: MatchRow[], player: Player) {
  let changed = false;

  for (const config of KNOCKOUT_SLOT_COUNTS) {
    const stageRows = matchRows
      .filter((match) => match.stage === config.stage)
      .sort(sortKnockoutRows);
    const usedIds = new Set<string>();

    for (let index = 0; index < config.count; index += 1) {
      const slot = bracketSlot(config.stage, index);
      if (!slot) continue;

      const row =
        stageRows.find((match) => match.bracket_slot === slot && !usedIds.has(match.id)) ??
        stageRows.find((match) => !match.bracket_slot && !usedIds.has(match.id));

      if (!row) continue;
      usedIds.add(row.id);

      if (row.bracket_slot !== slot) {
        await adminUpsertMatch(player, { ...row, bracket_slot: slot });
        row.bracket_slot = slot;
        changed = true;
      }
    }
  }

  return changed ? loadMatches() : matchRows;
}

async function ensureKnockoutMatches(matchRows: MatchRow[], player: Player) {
  const slottedRows = await assignMissingBracketSlots(matchRows, player);
  const plan = buildKnockoutPlan(slottedRows);
  if (plan.length === 0) return slottedRows;

  const existing = slottedRows.filter(isKnockoutMatch);
  let changed = false;

  for (const plannedMatch of plan) {
    const current = existing.find(
      (match) => match.stage === plannedMatch.stage && match.bracket_slot === plannedMatch.bracket_slot,
    );

    if (!current) {
      await adminUpsertMatch(player, {
        ...plannedMatch,
        team_a_score: null,
        team_b_score: null,
        team_a_pk_score: null,
        team_b_pk_score: null,
      });
      changed = true;
      continue;
    }

    if (
      current.team_a !== plannedMatch.team_a ||
      current.team_b !== plannedMatch.team_b ||
      !sameInstant(current.starts_at, plannedMatch.starts_at)
    ) {
      await adminUpsertMatch(player, {
        ...current,
        team_a: plannedMatch.team_a,
        team_b: plannedMatch.team_b,
        starts_at: plannedMatch.starts_at,
        bracket_slot: plannedMatch.bracket_slot,
        team_a_score: null,
        team_b_score: null,
        team_a_pk_score: null,
        team_b_pk_score: null,
      });
      changed = true;
    }
  }

  return loadMatches();
}

async function ensureRoundOf32Matches(player: Player) {
  const matches = await ensureKnockoutMatches(await loadMatches(), player);
  const roundOf32Matches = matches.filter((match) => match.stage === "Round of 32");
  if (roundOf32Matches.length > 0) return matches;

  const rebuiltMatches = await ensureKnockoutMatches(await loadMatches(), player);
  if (rebuiltMatches.some((match) => match.stage === "Round of 32")) return rebuiltMatches;

  throw new Error("Round of 32 matches are not ready. Generate group results first.");
}

async function requireSession(player: Player) {
  const { data, error } = await supabase
    .rpc("app_require_session", { p_player_id: player.id, p_token: player.token })
    .single();

  if (error) throw new Error(error.message);
  return data as PlayerRow;
}

export async function login(name: string, pin: string): Promise<Player> {
  const normalizedName = normalizePlayerName(name);
  const { data, error } = await supabase
    .rpc("app_login_player", { p_name: normalizedName, p_pin: pin })
    .single();

  if (error) throw new Error(error.message);

  const row = unwrap(data, error) as PlayerRow & { token: string };
  return {
    id: row.id,
    name: row.name,
    isAdmin: row.is_admin,
    favoriteTeam: row.favorite_team ?? null,
    token: row.token,
  };
}

export async function changePin(
  player: Player,
  currentPin: string,
  newPin: string,
  confirmNewPin: string,
) {
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error("PIN must be 4 to 8 digits.");
  }
  if (newPin !== confirmNewPin) {
    throw new Error("New PINs do not match.");
  }

  const { error } = await supabase.rpc("app_change_pin", {
    p_player_id: player.id,
    p_token: player.token,
    p_current_pin: currentPin,
    p_new_pin: newPin,
  });

  if (error) throw new Error(error.message);
}

export async function saveFavoriteTeam(player: Player, favoriteTeam: string) {
  await requireSession(player);

  const normalizedFavoriteTeam = favoriteTeam.trim();
  const teams = new Set(FAVORITE_TEAM_OPTIONS);

  if (!teams.has(normalizedFavoriteTeam)) {
    throw new Error("Choose a valid team.");
  }

  const { error } = await supabase.rpc("app_save_favorite_team", {
    p_player_id: player.id,
    p_token: player.token,
    p_favorite_team: normalizedFavoriteTeam,
  });

  if (error) throw new Error(error.message);
}

export async function loadPool(player: Player): Promise<PoolData> {
  const currentPlayer = await requireSession(player);

  const initialMatchRows = await loadMatches();
  const matchRows = currentPlayer.is_admin
    ? await ensureKnockoutMatches(initialMatchRows, player)
    : initialMatchRows;
  const favoriteTeamOptions = FAVORITE_TEAM_OPTIONS;

  const [myPredictionsResult, playersResult, allPredictionsResult] = await Promise.all([
    supabase
      .from("predictions")
      .select("match_id, team_a_score, team_b_score")
      .eq("player_id", player.id),
    supabase.from("players").select("id, name, is_admin, favorite_team"),
    supabase.from("predictions").select("player_id, match_id, team_a_score, team_b_score"),
  ]);

  const matches = matchRows.map((row): Match => ({
    id: row.id,
    teamA: row.team_a,
    teamB: row.team_b,
    startsAt: row.starts_at,
    stage: row.stage,
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    teamAPkScore: row.team_a_pk_score,
    teamBPkScore: row.team_b_pk_score,
  }));

  const predictions = unwrap(myPredictionsResult.data, myPredictionsResult.error).map(
    (row): Prediction => ({
      matchId: row.match_id,
      teamAScore: row.team_a_score,
      teamBScore: row.team_b_score,
    }),
  );

  const completedMatchMap = new Map(
    matchRows
      .filter((match) => completed(match) && played(match))
      .map((match) => [match.id, match]),
  );
  const allPredictions = unwrap(allPredictionsResult.data, allPredictionsResult.error);
  const players = unwrap(playersResult.data, playersResult.error);
  const leaderboard = players
    .filter((item) => !item.is_admin)
    .map((item) => {
      let points = 0;
      let exactScores = 0;
      let correctOutcomes = 0;
      let goalDifferences = 0;
      const details = [];

      for (const prediction of allPredictions.filter((entry) => entry.player_id === item.id)) {
        const match = completedMatchMap.get(prediction.match_id);
        if (!match) continue;
        const actualTeamAScore = match.team_a_score;
        const actualTeamBScore = match.team_b_score;
        if (actualTeamAScore === null || actualTeamBScore === null) continue;

        const predictedGoalDifference = prediction.team_a_score - prediction.team_b_score;
        const actualGoalDifference = actualTeamAScore - actualTeamBScore;

        const matchPoints = predictionPoints(
          prediction.team_a_score,
          prediction.team_b_score,
          actualTeamAScore,
          actualTeamBScore,
        );
        points += matchPoints;
        if (matchPoints > 0) {
          details.push({
            matchId: match.id,
            label: `${match.team_a} ${actualTeamAScore}-${actualTeamBScore} ${match.team_b}`,
            points: matchPoints,
            reason: leaderboardPointReason(
              prediction.team_a_score,
              prediction.team_b_score,
              actualTeamAScore,
              actualTeamBScore,
            ),
          });
        }
        if (predictedGoalDifference === actualGoalDifference) {
          goalDifferences += 1;
        }
        if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
          correctOutcomes += 1;
        }
        if (
          prediction.team_a_score === actualTeamAScore &&
          prediction.team_b_score === actualTeamBScore
        ) {
          exactScores += 1;
        }
      }

      return { playerId: item.id, name: item.name, points, exactScores, correctOutcomes, goalDifferences, details };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exactScores - a.exactScores ||
        b.goalDifferences - a.goalDifferences ||
        a.name.localeCompare(b.name),
    );
  const rankMap = new Map(leaderboard.map((row, index) => [row.playerId, index + 1]));
  const profilePlayers = players.filter((item) => item.id === player.id);
  const profiles = profilePlayers.map((item) => {
    let totalPoints = 0;
    let exactScores = 0;
    let correctOutcomes = 0;
    let goalDifferences = 0;
    let completedMatchesCount = 0;
    const playerPredictions = allPredictions.filter((entry) => entry.player_id === item.id);
    const roundStats = new Map<string, { points: number; count: number }>();
    const recentMatches = [];

    for (const prediction of playerPredictions) {
      const match = completedMatchMap.get(prediction.match_id);
      if (!match) continue;
      const actualTeamAScore = match.team_a_score;
      const actualTeamBScore = match.team_b_score;
      if (actualTeamAScore === null || actualTeamBScore === null) continue;

      completedMatchesCount += 1;
      const predictedGoalDifference = prediction.team_a_score - prediction.team_b_score;
      const actualGoalDifference = actualTeamAScore - actualTeamBScore;
      const matchPoints = predictionPoints(
        prediction.team_a_score,
        prediction.team_b_score,
        actualTeamAScore,
        actualTeamBScore,
      );

      totalPoints += matchPoints;
      const currentRoundStats = roundStats.get(match.stage) ?? { points: 0, count: 0 };
      currentRoundStats.points += matchPoints;
      currentRoundStats.count += 1;
      roundStats.set(match.stage, currentRoundStats);
      if (Math.sign(predictedGoalDifference) === Math.sign(actualGoalDifference)) {
        correctOutcomes += 1;
      }
      if (predictedGoalDifference === actualGoalDifference) {
        goalDifferences += 1;
      }
      if (prediction.team_a_score === actualTeamAScore && prediction.team_b_score === actualTeamBScore) {
        exactScores += 1;
      }
      recentMatches.push({
        matchId: match.id,
        label: `${match.team_a} vs ${match.team_b}`,
        pick: `${prediction.team_a_score} - ${prediction.team_b_score}`,
        actual: `${actualTeamAScore} - ${actualTeamBScore}`,
        points: matchPoints,
        startsAt: match.starts_at,
      });
    }

    recentMatches.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    const favoriteTeam = item.favorite_team ?? "Not selected yet";
    const bestRound = Array.from(roundStats.entries()).sort((a, b) => {
      const leftAverage = a[1].points / a[1].count;
      const rightAverage = b[1].points / b[1].count;
      return rightAverage - leftAverage || b[1].count - a[1].count || a[0].localeCompare(b[0]);
    })[0]?.[0] ?? "Not enough data yet";

    return {
      playerId: item.id,
      name: item.name,
      totalPoints,
      rank: rankMap.get(item.id) ?? null,
      exactScores,
      correctOutcomes,
      goalDifferences,
      totalPredictions: playerPredictions.length,
      completedMatchesCount,
      accuracyPercentage:
        completedMatchesCount === 0 ? 0 : Number(((correctOutcomes / completedMatchesCount) * 100).toFixed(1)),
      favoriteTeam,
      bestRound,
      averagePointsPerCompletedMatch:
        completedMatchesCount === 0 ? 0 : Number((totalPoints / completedMatchesCount).toFixed(2)),
      recentMatches: recentMatches.slice(0, 8).map(({ startsAt, ...match }) => match),
    };
  });
  const completedMatches = matchRows.filter((match) => completed(match) && played(match));
  const lockedAwaitingResult = matchRows.filter((match) => played(match) && !completed(match)).length;
  const lastOfficialMatch = completedMatches.sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
  )[0];
  const adminDashboard = player.isAdmin
    ? {
        totalPlayers: players.filter((item) => !item.is_admin).length,
        totalPredictions: allPredictions.length,
        completedMatches: completedMatches.length,
        lockedAwaitingResult,
        currentLeader: leaderboard[0] ? `${leaderboard[0].name} (${leaderboard[0].points} pts)` : "No leader yet",
        lastOfficialResult: lastOfficialMatch
          ? `${lastOfficialMatch.team_a} ${lastOfficialMatch.team_a_score}-${lastOfficialMatch.team_b_score} ${lastOfficialMatch.team_b}`
          : "No official results yet",
      }
    : null;

  return { matches, predictions, leaderboard, profiles, favoriteTeamOptions, adminDashboard };
}

export async function savePrediction(player: Player, prediction: Prediction) {
  await requireSession(player);

  if (!validScore(prediction.teamAScore) || !validScore(prediction.teamBScore)) {
    throw new Error("Scores must be between 0 and 30.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("starts_at")
    .eq("id", prediction.matchId)
    .maybeSingle();

  if (matchError) throw new Error(matchError.message);
  if (!match) throw new Error("Match not found.");
  if (new Date(match.starts_at) <= new Date()) {
    throw new Error("This match has started. Predictions are locked.");
  }

  const { error } = await supabase.rpc("app_save_prediction", {
    p_player_id: player.id,
    p_token: player.token,
    p_match_id: prediction.matchId,
    p_team_a_score: prediction.teamAScore,
    p_team_b_score: prediction.teamBScore,
  });

  if (error) throw new Error(error.message);
}

export async function saveResult(
  player: Player,
  matchId: string,
  teamAScore: number,
  teamBScore: number,
  teamAPkScore?: number,
  teamBPkScore?: number,
) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");
  if (!validScore(teamAScore) || !validScore(teamBScore)) {
    throw new Error("Scores must be between 0 and 30.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("stage")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) throw new Error(matchError.message);
  if (!match) throw new Error("Match not found.");

  const tied = teamAScore === teamBScore;
  const knockout = KNOCKOUT_STAGE_SET.has(match.stage);
  let penaltyScores = {
    team_a_pk_score: null as number | null,
    team_b_pk_score: null as number | null,
  };

  if (knockout && tied) {
    if (teamAPkScore === undefined || teamBPkScore === undefined) {
      throw new Error("Penalty scores are required for tied knockout matches.");
    }
    if (!validPkScore(teamAPkScore) || !validPkScore(teamBPkScore)) {
      throw new Error("Penalty scores must be between 0 and 20.");
    }
    if (teamAPkScore === teamBPkScore) {
      throw new Error("Penalty scores cannot be tied.");
    }

    penaltyScores = { team_a_pk_score: teamAPkScore, team_b_pk_score: teamBPkScore };
  }

  const { data, error } = await supabase.rpc("app_admin_set_match_result", {
    p_player_id: player.id,
    p_token: player.token,
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
    p_team_a_pk_score: penaltyScores.team_a_pk_score,
    p_team_b_pk_score: penaltyScores.team_b_pk_score,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Match not found.");
  await ensureKnockoutMatches(await loadMatches(), player);
}

export async function generateTestGroupResults(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  const groupMatches = (await loadMatches()).filter(isGroupMatch);

  for (const match of groupMatches) {
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: testScore(),
      team_b_score: testScore(),
      team_a_pk_score: null,
      team_b_pk_score: null,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);
}

async function generateTestScoresForStage(player: Player, stage: string) {
  const matches = await ensureKnockoutMatches(await loadMatches(), player);
  const stageMatches = matches.filter((match) => match.stage === stage).sort(sortKnockoutRows);
  if (stageMatches.length === 0) throw new Error(`No ${stage} matches found.`);

  for (const match of stageMatches) {
    const { teamAScore, teamBScore } = testKnockoutScore();
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      team_a_pk_score: null,
      team_b_pk_score: null,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);
  await verifyScoredStage(stage);
}

async function verifyScoredStage(stage: string) {
  const expected = KNOCKOUT_EXPECTED_SCORES.get(stage);
  if (!expected) throw new Error(`Unknown knockout stage: ${stage}`);

  const matches = (await loadMatches()).filter((match) => match.stage === stage);
  const scored = matches.filter(
    (match) => match.team_a_score !== null && match.team_b_score !== null,
  ).length;

  if (scored !== expected) {
    throw new Error(`Failed: ${stage} updated ${scored} of ${expected}`);
  }
}

async function verifyFullTestTournament() {
  for (const stage of KNOCKOUT_STAGES) {
    await verifyScoredStage(stage);
  }
}

export async function resetTestKnockoutBracket(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  await adminDeleteKnockoutMatches(player);

  await ensureKnockoutMatches(await loadMatches(), player);
}

export async function resetTestResults(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  const matches = await loadMatches();
  const groupMatchIds = matches.filter(isGroupMatch).map((match) => match.id);

  if (groupMatchIds.length > 0) {
    for (const match of matches.filter(isGroupMatch)) {
      await adminUpsertMatch(player, {
        ...match,
        team_a_score: null,
        team_b_score: null,
        team_a_pk_score: null,
        team_b_pk_score: null,
      });
    }
  }

  await adminDeleteKnockoutMatches(player);
}

export async function importOfficialScoresSoFar(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  const groupMatches = (await loadMatches()).filter(isGroupMatch);
  const lockedAt = new Date(Date.now() - 60 * 1000).toISOString();

  for (const result of OFFICIAL_SCORES_SO_FAR) {
    const match = groupMatches.find(
      (item) =>
        (sameTeam(item.team_a, result.teamA) && sameTeam(item.team_b, result.teamB)) ||
        (sameTeam(item.team_a, result.teamB) && sameTeam(item.team_b, result.teamA)),
    );

    if (!match) throw new Error(`Could not find group match: ${result.teamA} vs ${result.teamB}`);

    const resultMatchesTeamOrder = sameTeam(match.team_a, result.teamA);
    const teamAScore = resultMatchesTeamOrder ? result.teamAScore : result.teamBScore;
    const teamBScore = resultMatchesTeamOrder ? result.teamBScore : result.teamAScore;
    const startsAt =
      new Date(match.starts_at).getTime() <= Date.now() ? match.starts_at : lockedAt;
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      team_a_pk_score: null,
      team_b_pk_score: null,
      starts_at: startsAt,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);
}

export async function generateFullTestTournament(player: Player) {
  const currentPlayer = await requireSession(player);
  if (!currentPlayer.is_admin) throw new Error("Admin access required.");

  await adminDeleteKnockoutMatches(player);

  const groupMatches = (await loadMatches()).filter(isGroupMatch);
  for (const match of groupMatches) {
    await adminUpsertMatch(player, {
      ...match,
      team_a_score: testScore(),
      team_b_score: testScore(),
      team_a_pk_score: null,
      team_b_pk_score: null,
    });
  }

  await ensureKnockoutMatches(await loadMatches(), player);

  for (const stage of KNOCKOUT_STAGES) {
    await generateTestScoresForStage(player, stage);
  }

  await verifyFullTestTournament();
}
