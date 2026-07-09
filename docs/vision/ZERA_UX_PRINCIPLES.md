# Zera — UX Principles (Draft Hypotheses)

Status: `draft` — unverbindlicher Diskussionsentwurf, **nicht** `accepted`, beeinflusst
weder `ROADMAP.md` noch die laufenden J-00X-Tasks der Journal Domain
Ebene: Präsentations-Ebene-Hypothesen — unterhalb von Vision, Product Bible und
Domain Models, nicht gleichrangig mit ihnen
Voraussetzung: [`ZERA_FOUNDING_BRIEF.md`](./ZERA_FOUNDING_BRIEF.md) (Prinzip 0, Vision),
[`ZERA_PRODUCT_BIBLE.md`](./ZERA_PRODUCT_BIBLE.md) (Abschnitt 4b: interne Architektur vs.
Produktoberfläche)

> **Herkunft:** Ausgangspunkt war ein YouTube-Transkript zu sechs UX-Psychologie-Prinzipien
> (Smart Defaults, Goal Gradient Effect, Reciprocity, IKEA-/Endowment-Effekt, Loss
> Aversion, Contrast Effect) plus eine ChatGPT-Analyse dazu. Dieses Dokument übernimmt
> **nicht** deren Schlussfolgerungen automatisch, sondern prüft jedes Prinzip einzeln
> gegen bereits akzeptierte Zera-Dokumente, bevor es als Kandidat gilt.
>
> **Ablageort (vorläufig):** Dieses Dokument liegt aktuell in `health-app`, obwohl mehrere
> Prinzipien produktunabhängig formuliert sind und potenziell auch für andere
> "Vision App Factory"-Produkte gelten. Diese Session hat keinen Zugriff auf ein separates
> Factory-Repository. Eine spätere Auslagerung in ein plattformweites Dokument (z. B.
> `FACTORY_UX_PRINCIPLES.md`) ist möglich, sobald ein solches Repo verfügbar ist — die
> hier getrennt gehaltene "generisches Prinzip vs. Zera-spezifische Anwendung"-Struktur ist
> bewusst so geschrieben, dass eine Extraktion einfach bleibt.

---

## 1. Zweck und Geltungsbereich

Dieses Dokument behandelt UX-Prinzipien als **Hypothesen, nicht als Entscheidungen**. Jedes
Prinzip wird gegen die bereits akzeptierten Dokumente geprüft — nicht umgekehrt. Ein
Prinzip, das einer akzeptierten Entscheidung widerspricht, wird hier nicht "trotzdem gut
gemeint" übernommen, sondern als Konflikt markiert.

Reihenfolge der Autorität bleibt unverändert:

1. **Vision** (Founding Brief) — _warum_ Zera existiert.
2. **Product Bible** — _was_ Zera fachlich ist.
3. **Domain Models / Decision Records** — die Fachlichkeit einzelner Domänen.
4. **UX Principles (dieses Dokument, draft)** — _wie_ diese Fachlichkeit nutzerfreundlich
   präsentiert wird. Erst danach, nie davor.

Dieses Dokument ist **kein Implementierungsplan**. Keine `ROADMAP.md`-Task-IDs, keine
UI-Texte als Vorgabe, keine Komponenten-Entwürfe.

---

## 2. Konflikt-Matrix

| #   | UX-Prinzip                                               | Konflikt mit akzeptierten Entscheidungen?                                                                                                                                                                                            | Betroffene Domänen                                | Empfehlung                                              |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------- |
| 1   | Smart Defaults                                           | Nein — passt direkt auf die bestehende Preset/User-Origin-Architektur (Product Bible Abschnitt 4/5)                                                                                                                                  | Goals & Evaluation, Journal (Eingabe-Vorschläge)  | **Kandidat**                                            |
| 2   | Never Start at Zero                                      | **Ja, in der ursprünglichen Illustration** — nutzt "Profil" als UI-Text (verletzt Product Bible Abschnitt 4b) und suggeriert eine erfundene Bewertungskennzahl ohne erklärten Nenner (Spannung zum Ehrlichkeits-Geist von Prinzip 0) | Presentation/Onboarding (nicht modelliert), Goals | **Nur mit Einschränkung** — siehe Abschnitt 3.2         |
| 3   | Value Before Account                                     | Nein — passt organisch zur bereits lokalen Speicherung (`AsyncStorageKeyValueStore`, siehe Journal Domain Model)                                                                                                                     | Account/Auth (nicht modelliert), Journal          | **Kandidat**, mit offener Folgefrage (Abschnitt 3.3)    |
| 4   | Ownership Before Authentication (IKEA-/Endowment-Effekt) | Nein direkt, aber ungeklärte Abhängigkeit: Datenübernahme lokal → Konto ist nirgends spezifiziert                                                                                                                                    | Account/Auth, Journal                             | **Kandidat**, Datenübernahme als offene Frage vormerken |
| 5   | Loss Aversion                                            | Kein Konflikt mit Dokumenten, aber Risiko von Dark Patterns — erfordert strikte Ehrlichkeits-Guard (siehe Abschnitt 3.5)                                                                                                             | Monetarisierung/Premium (nicht modelliert)        | **Optional**, nur mit realen, wahren Konsequenzen       |
| 6   | Contrast Effect                                          | Kein Konflikt, aber kein MVP-Thema                                                                                                                                                                                                   | Monetarisierung (nicht modelliert)                | **Später**                                              |

---

## 3. Prinzipien im Detail

### 3.1 Smart Defaults

**Generisches Prinzip:** Vorausgewählte, sinnvolle Standardwerte senken die
Entscheidungslast; die meisten Nutzer:innen ändern Defaults selten, ein guter Default wird
als Empfehlung gelesen.

**Zera-Anwendung:**

- **Goals:** Ziel-Empfehlung (z. B. aus Evidence-based Standard, dem bereits definierten
  Default-Profile — Product Bible Abschnitt 5) vorschlagen, mit klarer Möglichkeit zur
  Anpassung. Das ist keine neue Architektur, sondern nutzt die bestehende
  Preset-vs-User-Origin-Unterscheidung (Product Bible Abschnitt 4) für UX statt nur für
  Datenmodellierung.
- **Journal:** Tageszeitabhängige Eingabe-Platzhalter (z. B. "z. B. 2 Eier und Toast"
  morgens). Reine Eingabe-Erleichterung, berührt keine Fakten oder Bewertungen.

**Konfliktprüfung:** Kein Konflikt gefunden.

### 3.2 Never Start at Zero — geschärfte Fassung

**Ursprüngliches Prinzip (verworfen in dieser Form):** Fortschritt nie bei 0% zeigen, um
Momentum zu erzeugen (Goal Gradient Effect, Autowäsche-Studie).

**Warum die ursprüngliche Illustration nicht trägt:** Der Autowäsche-Effekt funktioniert,
weil zwei Dinge gelten: Der Nutzer versteht exakt, was die Stempel bedeuten (8 = eine
Gratiswäsche), und der Wert der vorausgefüllten Stempel ist real. Eine UI-Anzeige wie
"Profil bereits 20% abgeschlossen" hat beides nicht — unklarer Nenner, keine erklärte
Bedeutung, plus die Verwendung des intern reservierten Begriffs "Profil" (Product Bible
Abschnitt 4b). Eine erfundene Prozentzahl kurz nach dem ersten Eintrag ist der gleichen
Art unausgesprochener Bewertung, die Prinzip 0 bewusst aus dem Journal heraushält — nur
jetzt in der Onboarding-Schicht.

**Geschärfte Fassung:** Zeige nur Fortschritt gegenüber einem Ziel, das der Nutzer kennt
und dem er zugestimmt hat — nie eine erfundene Kennzahl, um Dranbleiben zu erzeugen.

- Erlaubt: "2 von 3 Einrichtungsschritten erledigt" (real, verständlich, ehrlich).
- Erlaubt: Der erste Eintrag einer Sammlung als etwas Besonderes behandeln (Ownership-Effekt
  — der Nutzer hat wirklich etwas hinzugefügt, das ist wahr) — **ohne** dabei eine
  Prozentzahl mit unklarem Nenner anzuzeigen.
- Nicht erlaubt: Eine "Ernährungsprofil zu 28%"-artige Anzeige nach wenigen Journal-Einträgen
  ohne erklärten, verstandenen Maßstab.

**Konfliktprüfung:** Ursprüngliche Form verletzt Product Bible Abschnitt 4b (Wortwahl) und
steht in Spannung zum Ehrlichkeits-Geist von Prinzip 0. Geschärfte Fassung: kein Konflikt.

### 3.3 Value Before Account

**Generisches Prinzip:** Erst echten Nutzen liefern, dann um ein Konto bitten (Reciprocity).

**Zera-Anwendung:** Journal funktioniert bereits heute vollständig ohne Konto — die
Journal Domain Model-Recherche hat gezeigt, dass `PersistedFoodEntryRepository` rein lokal
(`AsyncStorageKeyValueStore`) arbeitet, keine Supabase-Abhängigkeit für Einträge besteht.
Das Prinzip beschreibt also größtenteils den Ist-Zustand, nicht eine neue Anforderung.

**Offene Folgefrage (nicht Teil dieses Dokuments):** Wie werden lokal erfasste Einträge
später einem Konto zugeordnet, falls sich der Nutzer nachträglich anmeldet? Das ist eine
eigene, spätere Account/Auth-Domain-Frage, keine UX-Prinzipien-Frage.

**Konfliktprüfung:** Kein Konflikt gefunden.

### 3.4 Ownership Before Authentication (IKEA-/Endowment-Effekt)

**Generisches Prinzip:** Was Nutzer:innen selbst erstellt haben, wird höher bewertet als
identische, fremdbereitgestellte Inhalte — schon das Gefühl von Besitz reicht.

**Zera-Anwendung:** Vor einer Konto-Aufforderung bereits Ziel, erste Einträge etc.
existieren lassen, sodass ein späteres "Konto erstellen" sich wie "meinen Fortschritt
sichern" anfühlt statt wie eine Einstiegshürde.

**Konfliktprüfung:** Kein direkter Konflikt. Hängt an derselben offenen Folgefrage wie 3.3
(Datenübernahme lokal → Konto).

### 3.5 Loss Aversion — mit Ehrlichkeits-Guard

**Generisches Prinzip:** Verlustaussicht wirkt psychologisch stärker als gleichwertige
Gewinnaussicht.

**Ausdrückliche Einschränkung:** Keine künstliche FOMO, keine erfundenen Konsequenzen.
Ausschließlich reale, wahre Konsequenzen kommunizieren (z. B. "Ohne Backup gehen deine
Daten bei einem Gerätewechsel verloren" — das ist schlicht wahr, keine Manipulation). Jede
Formulierung, die eine nicht-reale Konsequenz suggeriert, ist ausgeschlossen.

**Konfliktprüfung:** Kein Konflikt mit Dokumenten, aber höchstes Missbrauchsrisiko der
sechs Prinzipien — deshalb "Optional" statt "Kandidat", und nur mit der Guard-Regel oben.

### 3.6 Contrast Effect

**Generisches Prinzip:** Ein zuvor gesehener Wert wird zum Vergleichsmaßstab für alles
Folgende (z. B. Premium-Preis relativ zu bereits gespeicherten Daten/Werten dargestellt).

**Zera-Anwendung:** Ausschließlich Monetarisierungskontext, explizit kein MVP-Thema (deckt
sich mit Founding Brief Abschnitt 12: "Keine Entscheidung über
Monetarisierung/Freemium-Grenzen").

**Konfliktprüfung:** Kein Konflikt, aber nicht jetzt relevant.

---

## 4. Übergeordnetes Prinzip (Arbeitshypothese)

> Der Nutzer soll niemals das Gefühl haben, Arbeit für die App zu leisten. Die App liefert
> zuerst Wert.

Dieser Satz ist bewusst als Arbeitshypothese formuliert, nicht als akzeptiertes Prinzip —
er müsste, wie die sechs Einzelprinzipien, gegen konkrete Anwendungsfälle geprüft werden,
bevor er in Founding Brief oder Product Bible aufgenommen wird.

---

## 5. Was dieses Dokument nicht tut

- Keine Änderung an `ROADMAP.md`, den J-00X-Journal-Tasks oder einem anderen bereits
  akzeptierten Dokument.
- Keine UI-Texte, Komponenten oder Implementierungsdetails.
- Keine Aussage zu Account/Auth- oder Monetarisierungs-Domains — diese sind nicht
  modelliert und nicht Teil der aktuellen Domänen-Reihenfolge.
- Keine Freigabe. Jedes "Kandidat"-Prinzip braucht vor Umsetzung dieselbe Prüfung, die
  Journal Domain Model und Decision Record 1 durchlaufen haben — eigene Domain-Model- bzw.
  Decision-Record-Dokumente, sobald die jeweilige Domäne (z. B. Onboarding, Account) an der
  Reihe ist.
