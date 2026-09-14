// Shared with db/schema.surql, which defines the same two lists as $PROFANITY_SUB
// and $PROFANITY_EXACT. The database copy is the one that actually enforces
// anything; this copy exists so the player is told before a round trip.
//
// SUB words are unambiguous enough to match anywhere inside a name. EXACT words
// are short and embed innocently in real ones (Cassidy, Dickson), so they only
// reject a name that is nothing but the word. ALLOW is the escape hatch for
// real words that contain a SUB word — the Scunthorpe problem — and is checked
// before either blocklist.

export const PROFANITY_SUB = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore",
  "slut", "rape", "wanker", "bastard", "dickhead", "asshole", "arsehole",
  "motherfuck", "pussy", "retard", "coon", "chink", "spic", "kike", "tranny",
  "puta", "puto", "mierda", "pendejo", "cabron", "concha", "verga", "polla",
  "boludo", "forro", "trolo", "pelotudo",
];

export const PROFANITY_EXACT = [
  "ass", "arse", "cum", "cock", "dick", "tit", "tits", "twat", "prick",
  "piss", "crap", "damn", "hell", "anal", "anus", "penis", "vagina",
  "culo", "teta", "tetas", "pito", "poronga", "choto",
];

export const PROFANITY_ALLOW = [
  "scunthorpe", "penistone", "lightwater", "clitheroe", "assassin",
  "assassins", "classic", "classics", "cockpit", "cocktail", "shiitake",
  "analysis", "analyst", "titan", "titanic", "titus", "cockburn",
];
