"""Podobne przypadki — proste porównanie słów kluczowych, bez modelu."""

import re

PL_ASCII = str.maketrans("ąćęłńóśźż", "acelnoszz")
WORD_RE = re.compile(r"[a-z]{4,}")
# Rdzeń = pierwsze znaki słowa: wystarcza, by zrównać polskie odmiany („seniorów” ~ „seniorzy”).
STEM_LEN = 5
MIN_SHARED = 2
STOPWORDS = frozenset(
    stem[:STEM_LEN]
    for stem in (
        "ktory ktora ktore jest beda bedzie oraz albo tylko takze rowniez bardzo "
        "przez przed jako jego jeszcze moze mozna potrzeba potrzebuje problem pomoc "
        "wsparcie osoba osoby osob ludzie brak dotyczy sprawa projekt rozwiazanie"
    ).split()
)


def keywords(text: str) -> frozenset[str]:
    words = WORD_RE.findall(text.lower().translate(PL_ASCII))
    return frozenset(word[:STEM_LEN] for word in words) - STOPWORDS


def is_similar(a: frozenset[str], b: frozenset[str]) -> bool:
    return len(a & b) >= MIN_SHARED
