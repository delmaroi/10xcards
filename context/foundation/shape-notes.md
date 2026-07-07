---
project: "10xCards"
context_type: greenfield
created: 2026-06-17
updated: 2026-06-17
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "rodzaj bólu"
      decision: "tarcie w przepływie + bariera czasowa + jakość fiszek (wszystkie trzy)"
    - topic: "główna persona"
      decision: "student przygotowujący się do egzaminu"
    - topic: "moment bólu"
      decision: "tuż przed sesją/egzaminem — duża partia materiału, mało czasu"
    - topic: "insight"
      decision: "niższy próg wejścia niż Anki — prostota + AI zdejmują barierę"
    - topic: "model logowania"
      decision: "OAuth (Google)"
    - topic: "model ról"
      decision: "dwie role: admin i zwykły użytkownik"
    - topic: "uprawnienia admina"
      decision: "zarządzanie użytkownikami + wgląd w metryki + moderacja treści"
  frs_drafted: 12
  quality_check_status: accepted
---

# 10xCards — Shape Notes

> Seed idea (verbatim, provided by user):
>
> **10xCards - MVP**
>
> **Główny problem:** Manualne tworzenie wysokiej jakości fiszek edukacyjnych jest czasochłonne, co zniechęca do korzystania z efektywnej metody nauki jaką jest spaced repetition.
>
> **Najmniejszy zestaw funkcjonalności:**
> - Generowanie fiszek przez AI na podstawie wprowadzonego tekstu (kopiuj-wklej)
> - Manualne tworzenie fiszek
> - Przeglądanie, edycja i usuwanie fiszek
> - Prosty system kont użytkowników do przechowywania fiszek
> - Integracja fiszek z gotowym algorytmem powtórek
>
> **Co NIE wchodzi w zakres MVP:**
> - Własny, zaawansowany algorytm powtórek (jak SuperMemo, Anki)
> - Import wielu formatów (PDF, DOCX, itp.)
> - Współdzielenie zestawów fiszek między użytkownikami
> - Integracje z innymi platformami edukacyjnymi
> - Aplikacje mobilne (na początek tylko web)
>
> **Kryteria sukcesu:**
> - 75% fiszek wygenerowanych przez AI jest akceptowane przez użytkownika
> - Użytkownicy tworzą 75% fiszek z wykorzystaniem AI

## Vision & Problem Statement

Student przygotowujący się do egzaminu staje tuż przed sesją z dużą partią materiału (notatki, skrypt, rozdziały) i niewielką ilością czasu. Aby skorzystać ze spaced repetition — najskuteczniejszej metody utrwalania — musi najpierw ręcznie zamienić ten materiał na fiszki. Ten krok jest mozolny, czasochłonny, a powstałe fiszki bywają niskiej jakości. W efekcie student albo rezygnuje z metody, albo zużywa skąpy czas na produkcję fiszek zamiast na samą naukę.

Insight: główną barierą nie jest sam algorytm powtórek, lecz koszt wejścia w tworzenie fiszek. Istniejące narzędzia (np. Anki) są potężne, ale zniechęcająco złożone. Połączenie prostoty z generowaniem fiszek przez AI z wklejonego tekstu obniża próg wejścia na tyle, że nauka faktycznie się zaczyna.

## User & Persona

**Persona główna: Student przygotowujący się do egzaminu.**

- **Rola/kontekst:** uczeń lub student uczący się dużych partii materiału pod konkretny egzamin (matura, kolokwium, sesja, certyfikat).
- **Moment sięgnięcia po produkt:** tuż przed sesją/egzaminem — ma materiał w formie tekstu i mało czasu, potrzebuje szybko przekształcić go w fiszki gotowe do powtórek.
- **Co go dziś blokuje:** ręczne tworzenie fiszek jest zbyt wolne; istniejące narzędzia mają wysoki próg wejścia.

## Access Control

Aplikacja wieloużytkownikowa z logowaniem przez OAuth (Google). Model dostępu obejmuje dwie role:

- **Zwykły użytkownik** — po zalogowaniu widzi i zarządza wyłącznie własnymi fiszkami (tworzenie ręczne i przez AI, przegląd, edycja, usuwanie, powtórki). Nie ma dostępu do danych innych użytkowników.
- **Administrator** — dodatkowo:
  - zarządzanie użytkownikami (podgląd listy kont, blokowanie/usuwanie),
  - wgląd w metryki użycia (m.in. wskaźnik akceptacji fiszek AI i udział fiszek tworzonych z AI — potrzebne do mierzenia kryteriów sukcesu),
  - moderacja / zarządzanie treścią (przegląd i usuwanie treści użytkowników).

Niezalogowany użytkownik trafiający na chronioną ścieżkę jest kierowany do logowania. Konkretny mechanizm wymuszania uprawnień jest decyzją wdrożeniową (downstream), nie kształtujemy go tutaj.

## Success Criteria

Najmniejszy przepływ end-to-end, który udowadnia działanie produktu (zatwierdzony jako rdzeń MVP):

1. Student loguje się przez Google (OAuth).
2. Wkleja tekst (notatki / fragment skryptu).
3. Klika „Generuj fiszki".
4. Widzi wygenerowane fiszki i dla każdej: akceptuje / edytuje / odrzuca.
5. Zaakceptowane fiszki trafiają do jego talii.
6. Uruchamia powtórki (gotowy algorytm) i przerabia fiszki.

### Primary
- ≥ 75% fiszek wygenerowanych przez AI jest akceptowanych przez użytkownika (bez odrzucenia).
- ≥ 75% wszystkich tworzonych fiszek powstaje z wykorzystaniem AI (a nie ręcznie).

### Secondary
- Retencja: użytkownicy wracają na kolejne sesje powtórek (oznaka wejścia w nawyk), nie wystarczająca sama w sobie.

### Guardrails
- Tekst wklejany do generowania pozostaje prywatny — nie wycieka i nie jest dostępny innym użytkownikom ani publicznie.
- Pełna izolacja danych między kontami — użytkownik nigdy nie widzi fiszek ani danych innego użytkownika.
- Brak utraty danych — raz zaakceptowane/zapisane fiszki nie giną.
- Generowanie kończy się w rozsądnym czasie i przez cały czas daje użytkownikowi widoczną informację zwrotną o postępie.

### Budżet czasowy
- MVP: ~3 tygodnie pracy po godzinach (`mvp_weeks: 3`, `after_hours_only: true`). Termin twardy: do ustalenia (Faza 6).

## Functional Requirements

> Numeracja przeliczona po rundzie Sokratesa (usunięto dawne FR-005 „moderacja" → patrz Non-Goals).

### Konta i dostęp
- FR-001: Użytkownik może zalogować się przez Google (OAuth). Priority: must-have
  > Socrates: kontrargument „OAuth wyklucza studentów bez konta Google". Rozstrzygnięcie: utrzymane dla niskiego tarcia w MVP; alternatywa e-mail+hasło zapisana w Open Questions.
- FR-002: Użytkownik może się wylogować. Priority: must-have
  > Socrates: „trywialne, ale konieczne" — bez wylogowania ryzyko prywatności na współdzielonym urządzeniu. Utrzymane.
- FR-003: Administrator może zarządzać użytkownikami (podgląd listy, blokowanie/usuwanie). Priority: nice-to-have
  > Socrates: utrzymane jako nice-to-have; nie blokuje pętli nauki MVP.
- FR-004: System zbiera metryki sukcesu (wskaźnik akceptacji fiszek AI i udział fiszek tworzonych z AI); administrator może je przeglądać. Priority: must-have (zbieranie danych); panel przeglądu = nice-to-have
  > Socrates: kryteria sukcesu (75%) wymagają pomiaru → zbieranie metryk podniesione do must-have; ładny panel admina pozostaje nice-to-have.

### Generowanie fiszek przez AI
- FR-005: Użytkownik może wkleić tekst i wygenerować z niego propozycje fiszek przez AI. Priority: must-have
  > Socrates: ryzyko „niska jakość = utrata zaufania" → wprowadzić limit długości wejścia i traktować jakość jako guardrail (patrz NFR). Utrzymane.
- FR-006: Użytkownik może dla każdej wygenerowanej fiszki ją zaakceptować, edytować lub odrzucić. Priority: must-have
  > Socrates: „tarcie przy wielu fiszkach" → akcja masowa („zaakceptuj wszystkie") rozważana jako przyszły nice-to-have; granularność utrzymana, bo zasila metrykę 75%.
- FR-007: Zaakceptowane fiszki są zapisywane do talii użytkownika. Priority: must-have
  > Socrates: trywialne następstwo akceptacji; utrzymane jako osobny FR dla jasności.

### Ręczne tworzenie i zarządzanie
- FR-008: Użytkownik może ręcznie utworzyć fiszkę. Priority: nice-to-have
  > Socrates: potrzebne jako uzupełnienie (dopisanie własnej fiszki, której AI nie wygenerowało). Utrzymane jako nice-to-have.
- FR-009: Użytkownik może przeglądać swoje fiszki. Priority: must-have
  > Socrates: niezbędne — bez przeglądu talii nie ma czego powtarzać. Utrzymane.
- FR-010: Użytkownik może edytować zapisaną fiszkę. Priority: must-have
  > Socrates: częściowo pokrywa się z edycją przy akceptacji (FR-006), ale edycja zapisanej fiszki po czasie to odrębna potrzeba. Utrzymane.
- FR-011: Użytkownik może usunąć fiszkę. Priority: must-have
  > Socrates: niezbędne do higieny talii. Utrzymane.

### Powtórki
- FR-012: Użytkownik może uruchomić sesję powtórek opartą o gotowy algorytm spaced repetition. Priority: must-have
  > Socrates: rdzeń wartości — bez powtórek produkt to tylko generator fiszek. Utrzymane must-have. (Uwaga: integracja gotowego algorytmu to potencjalny ukryty koszt — pilnować w planowaniu.)

## User Stories

### US-01: Generowanie fiszek z wklejonego tekstu

- **Given** zalogowany użytkownik (przez Google) z dostępem do swojej talii
- **When** wkleja fragment tekstu (notatki/skrypt) i uruchamia generowanie fiszek przez AI
- **Then** widzi listę wygenerowanych propozycji fiszek, a dla każdej może ją zaakceptować, edytować lub odrzucić; zaakceptowane trafiają do jego talii

#### Acceptance Criteria
- Każda wygenerowana fiszka ma stronę pytania i odpowiedzi i jest osobno akceptowalna/edytowalna/odrzucalna.
- Odrzucenie fiszki nie zapisuje jej do talii; akceptacja zapisuje ją trwale.
- Puste lub zbyt krótkie wejście pokazuje czytelny komunikat zamiast generować pustą listę.
- Przez cały czas generowania użytkownik widzi informację o postępie.

## Business Logic

Aplikacja przekształca wklejony przez użytkownika tekst źródłowy w zestaw atomowych par pytanie–odpowiedź (fiszek) gotowych do nauki metodą spaced repetition.

Wejściem reguły jest surowy tekst dostarczony przez użytkownika (notatki, fragment skryptu, rozdział). Wyjściem jest lista propozycji fiszek — każda to zwięzła para pytanie/odpowiedź obejmująca pojedynczy fakt lub pojęcie. Użytkownik spotyka regułę bezpośrednio po wklejeniu tekstu i uruchomieniu generowania: dostaje gotowe propozycje, które recenzuje (akceptuje/edytuje/odrzuca), a zaakceptowane trafiają do jego talii i do harmonogramu powtórek. Reguła zdejmuje z użytkownika pracę decydowania, co jest istotne i jak rozbić materiał na pojedyncze, powtarzalne jednostki.

## Non-Functional Requirements

- Użytkownik dostaje potwierdzenie każdej akcji szybko, a przy każdej operacji trwającej dłużej niż ~2 s (zwłaszcza generowaniu) widzi ciągłą, widoczną informację o postępie.
- Tekst źródłowy wklejony do generowania pozostaje prywatny — nie jest dostępny innym użytkownikom ani publicznie i nie pozostaje w magazynie dostępnym dla operatora po zakończeniu obsługującego go żądania.
- Wklejany tekst ma rozsądny górny limit długości, tak by koszt i jakość generowania pozostały pod kontrolą (konkretna wartość do ustalenia downstream).
- Aplikacja pozostaje używalna na najnowszych wersjach głównych przeglądarek desktopowych (produkt web-only w MVP).

## Open Questions

1. **Alternatywa logowania e-mail+hasło** — czy obok OAuth Google dodać klasyczne konto, by nie wykluczać studentów bez konta Google? Owner: użytkownik. (z FR-001)
2. **Limit długości wklejanego tekstu i próg jakości generowania** — jaka konkretna wartość/granica? Owner: użytkownik + decyzja downstream. (z FR-005 / NFR)
3. **Akcja masowa „zaakceptuj wszystkie"** — czy potrzebna już w MVP przy generowaniu wielu fiszek naraz? Owner: użytkownik. (z FR-006, kandydat na nice-to-have)
4. **Wybór gotowego algorytmu/biblioteki SRS** — która biblioteka, jaki model danych powtórek i harmonogram? Owner: decyzja downstream (tech-stack/plan). (z FR-012)

## Non-Goals

Funkcjonalne:
- **Własny zaawansowany algorytm powtórek** (jak SuperMemo/Anki) — korzystamy z gotowego algorytmu; budowa własnego to ogromny zakres bez wartości dla MVP.
- **Import wielu formatów (PDF, DOCX itp.)** — wyłącznie wklejanie tekstu; parsowanie plików to kosztowna obsługa formatów odłożona poza MVP.
- **Współdzielenie zestawów fiszek między użytkownikami** — dane są prywatne i jednoosobowe; brak współdzielenia pociąga też brak moderacji treści (dawne FR-005 usunięte).
- **Integracje z innymi platformami edukacyjnymi** — brak w MVP.

Niefunkcjonalne / platformowe:
- **Aplikacje mobilne** — MVP jest web-only; brak natywnej aplikacji mobilnej.
