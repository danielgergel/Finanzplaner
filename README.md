# Finanzplaner (iPhone-PWA)

Eigenständige Finanz-App: CSV-Kontoauszüge importieren, automatisch kategorisieren, Budget mit Ampel und Alarm, versteckter Tresor. Alles läuft offline; Sync ist optional und Ende-zu-Ende verschlüsselt. Keine Analytics, keine Drittanbieter-Skripte außer Firebase (gstatic) und Google Fonts.

## Deployment
Die Dateien `index.html`, `sw.js` und `apple-touch-icon.png` auf einen beliebigen HTTPS-Webspace legen (z. B. Firebase Hosting, GitHub Pages) und die URL in Safari öffnen, dann Teilen, "Zum Home-Bildschirm". `test_data/` wird nicht gebraucht und kann weg. Der Service Worker (`finanzplaner-v4`) lädt Netz zuerst (3 s), dann Cache.

## CSV-Import
Reiter Import: Konto wählen, Datei wählen oder Text einfügen, Vorschau prüfen (neu/Duplikate), übernehmen.
- Trenner `;`/`,`, UTF-8 und Windows-1252, Zahlen wie 1.234,56, Datum TT.MM.JJJJ, TT.MM.JJ, JJJJ-MM-TT und TT/MM/JJJJ.
- Kopfzeilen werden per Synonymen erkannt (Meta-Zeilen vor der Tabelle werden übersprungen). Sonst erscheint eine Zuordnungs-Maske; die Zuordnung wird pro Konto gemerkt.
- Duplikate: Hash aus Datum, Betrag, Text und Konto; ein erneuter Import fügt nichts doppelt ein.
- Amex liefert Ausgaben meist positiv: Haken "Vorzeichen umkehren" (beim Konto Amex voreingestellt).
- Beispiel-CSVs zum Testen: `test_data/` (DKB, Revolut, Amex; komplett synthetisch).

## Tresor
Langdruck (1,5 s) auf den Titel "Finanzplaner" oder der unscheinbare Punkt ganz unten in "Mehr". PIN 4-6 Ziffern (nur als salted PBKDF2-Hash gespeichert), sperrt nach 60 s Inaktivität oder beim Verlassen der App. Vermögenswerte erscheinen nirgends sonst.

## Sync (optional, Einstellungen, Mehr)
Passphrase wählen (mindestens 12 Zeichen, lang und einmalig). Alle Daten werden im Browser mit AES-GCM verschlüsselt (Schlüssel per PBKDF2, 200.000 Iterationen, zufälliges Salt im Dokument) und als Base64 in die Collection `finanzplaner` geschrieben. Dokument-ID = gekürzter SHA-256 der Passphrase. Firestore sieht nur Chiffretext. Große Datenmengen werden in Teile (`<id>_1`, `<id>_2` ...) zu je ca. 700 KB aufgeteilt (max. 20). Konflikte: Buchungen werden nach Hash vereinigt, Konfiguration nach Zeitstempel (neuester gewinnt). Auf dem Gerät wird die Passphrase lokal gespeichert, damit der Sync automatisch läuft.

Empfohlene Firestore-Regeln (nur diese Collection, Größe begrenzt). Da die Daten ohnehin verschlüsselt sind, ist das ein zusätzlicher Schutz:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /finanzplaner/{docId} {
      allow read: if true;
      allow write: if request.resource.data.keys().hasOnly(['v','salt','iv','z','ts','dev','n','c'])
                   && request.resource.data.c is string
                   && request.resource.data.c.size() < 800000;
    }
    // bestehende Regeln für andere Collections (z. B. Kochplaner) hier beibehalten
  }
}
```
Hinweis: Wer die Passphrase kennt, findet und entschlüsselt die Daten; wer sie nicht kennt, sieht nur Zufallsdaten. Passphrase verloren = Cloud-Daten nicht wiederherstellbar (lokales JSON-Backup nutzen).

## Backup
Mehr, Daten: JSON-Backup herunterladen (optional ohne Tresor) und wieder einlesen (wird zusammengeführt).

## PDF-Import
Im Import-Reiter kann statt einer CSV auch ein PDF-Kontoauszug gewählt, per Drag & Drop oder Einfügen übergeben werden. Beim Einfügen von Text erkennt die App automatisch, ob es CSV oder aus einer PDF kopierter Text ist.
- Die PDF wird nur lokal im Browser gelesen (pdf.js 3.11.174 von cdnjs.cloudflare.com, wird erst beim ersten PDF-Import nachgeladen und danach vom Service Worker `finanzplaner-v4` gecacht). Beim allerersten PDF-Import ist deshalb Internet nötig; die PDF selbst wird nirgends hochgeladen.
- Erkannt werden Zeilen mit Datum (TT.MM.JJJJ, TT.MM.JJ, TT.MM., ISO, englisch) und Betrag (deutsch oder englisch, mit S/H, CR/DR, +/- oder nachgestelltem Minus); Folgezeilen gehören zum Verwendungszweck. Das Jahr bei Daten ohne Jahr kommt aus dem Auszugskopf oder dem Dateinamen, sonst wird gefragt. Saldo-, Summen-, IBAN- und Seitenzeilen werden ausgefiltert.
- Beträge ohne Vorzeichen werden als Ausgabe gewertet (Ausnahme: Wörter wie Gehalt/Gutschrift). Diese Buchungen sind in der Vorschau als "geschätzt" gekennzeichnet; der Haken "Vorzeichen umkehren" dreht alle um.
- Nicht zugeordnete Zeilen stehen in der Vorschau unter "Nicht erkannt". Gescannte PDFs (ohne Text) und passwortgeschützte PDFs liefern eine Meldung.
- Grenzen: Der Parser ist heuristisch und kennt keine bankspezifischen Layouts. Spaltenlayouts mit getrennten Soll/Haben-Spalten ohne Vorzeichen, mehrere Betragsspalten oder ungewöhnliche Zeilenumbrüche können falsch gelesen werden. CSV ist verlässlicher; PDF nur nutzen, wenn kein CSV-Export verfügbar ist, und die Vorschau immer prüfen.

## Bedienung (Version 3, UX-Überarbeitung)
Vier Reiter: **Monat** (Startseite), **Sortieren**, **Import**, **Mehr**.
- **Monat:** Ein Satz oben ("Bisher X ausgegeben · Prognose Monatsende Y · Einnahmen Z · übrig N"), dann Hinweise (unsortiert, Umbuchungen, Konten ohne Buchungen), die Aufteilung Einnahmen / Fixkosten / Variable Ausgaben / Sparen und Anlegen / Unsortiert / Übrig und die Ampel-Liste der Kategorien (Rot zuerst, Top 5, "Alle anzeigen"). Tipp auf eine Kategorie öffnet ein Bottom-Sheet mit den Buchungen. Der Monatswechsel sitzt unten. Beim Start öffnet sich der letzte Monat mit Daten.
- **Ampel:** Grün unter 90 % des Richtwerts, Gelb ab 90 % bis zum Richtwert (oder Prognose über 110 %), Rot darüber. Prognose erst ab dem 8. des Monats, Bezugstag = min(heute, letzte Buchung), Fixposten (Miete, Abos, Versicherungen, Weiterbildung ...) werden nicht hochgerechnet.
- **Richtwert:** Mein Plan, sonst Durchschnitt Deutschland (als "Standardwert" markiert). Umschalten nur unter Mehr, Richtwerte. Jede Kategorie ist ein eigener Budgetposten.
- **Umbuchungen (zählen nicht):** Übertrag zwischen eigenen Konten und Kreditkarte bezahlt. Erkennung per Regeln und strenger Paarung (exakt gleicher Betrag, gegenläufig, verschiedene Konten, max. 3 Tage, ab 5 Euro; Text nach Übertrag ODER genau ein Kandidat). Die Zeile "Umbuchungen ignoriert" öffnet die Liste, jede Buchung lässt sich als normale Buchung zurückholen (Feld `nt`).
- **Sortieren:** Händlerkarten nach Betrag, ein Tipp auf die Kategorie ordnet alle Buchungen zu und legt eine Regel an. Eingänge getrennt unter "Eingänge prüfen". "Später" überspringt.
- **Gehalt:** Wird nichts erkannt, fragt die Monatsansicht "Welche Buchung ist dein Gehalt?". Der laufende Teilmonat zählt nicht in den Durchschnitt. Trading-Auszahlungen zählen als Rückfluss (Einnahme), Netto-Trading wird angezeigt.
- **Import:** Statuszeile pro Konto ("zuletzt importiert bis"), nach dem Import ein Ergebnis-Dialog. Duplikate: exakter Hash, außerdem gleiches Datum, Betrag und Konto mit gemeinsamem Wort (z. B. dieselbe Buchung aus PDF und CSV); gleiches Datum, Betrag und Konto mit anderem Text ist ein "mögliches Duplikat" (Rückfrage in der Vorschau).

## Datenformat und Migration
Schema-Version 2. Alte Daten (Version 1) werden beim Laden additiv migriert: nichts wird gelöscht oder umbenannt (auch der interne Kategoriename "Eigene Überträge" bleibt, nur die Anzeige heißt "Umbuchungen (zählen nicht)"). Der Sammelposten "Online-Shopping, Drogerie, Sonstiges" wird in einzelne Posten aufgeteilt (Plan skaliert), die alten Standardregeln SPARDA und PAYPAL werden durch genauere ersetzt, neue Standardregeln am Ende ergänzt, eigene Regeln und Werte bleiben unverändert. Neue Felder sind optional (`nt` an Buchungen). Ältere App-Versionen können weiter synchronisieren; die Migration ist idempotent und ändert beim Sync-Merge keinen Zeitstempel der Gegenseite.

## Einrichtung für neue Nutzer (Version 4, Schema 3)
Jede frische Installation startet ohne persönlichen Plan: keine Plan-Werte, kein Gehalt, keine Fixposten. Beim ersten Start führt ein Assistent in drei kurzen, überspringbaren Schritten durch die Einrichtung (später jederzeit unter Mehr, Einrichtung):
1. **Nettoeinkommen** pro Monat. Es gilt, bis die App dein Gehalt in den Buchungen erkennt.
2. **Feste Kosten**: Vorschläge zum Antippen (Miete, Strom/Gas, Internet, Handy, Versicherungen, Auto-Rate, Abos, Kredit/Raten, Sparrate, Sonstiges fest) mit Betrag und Kategorie. Jeder Posten wird zum Plan-Wert seiner Kategorie (bei gleicher Kategorie summiert) und gilt als Fixposten (keine Hochrechnung). Bearbeiten, Hinzufügen und Löschen unter Mehr, Feste Kosten.
3. **Variable Kategorien** (Lebensmittel, Tanken, Essen gehen, Freizeit, Shopping ...): eigenes Limit eintragen oder leer lassen. Leer = Vorschlag, also der Durchschnitt Deutschland in Prozent deines eigenen Einkommens (als "Standardwert" markiert).
Solange weder Einkommen noch Plan gesetzt sind, gibt es keine Ampel, sondern eine neutrale Anzeige und die Karte "Einrichtung starten". Fehlt nur das Einkommen, erscheint der Hinweis "Gib dein Einkommen ein ...". In der Monatsansicht steht die Zeile "Feste Kosten: Plan X · bisher Y". Wiederkehrende Zahlungen (gleicher Händler, Betrag ±5 %, mindestens 3 Monate) werden nur vorgeschlagen, nie automatisch übernommen.

**Bestehende Datensätze:** Wer schon Buchungen oder eigene Werte hat, behält seinen Plan unverändert, `setupDone` ist true und es erscheint kein Assistent. Eine Installation ohne eigene Daten, die noch die alten Standardwerte trägt, wird beim Laden neutral und startet den Assistenten. Neue optionale Felder: `profile` (`income`, `setupDone`, `legacy`, `skipRec`) und `fixed[]` (`id`, `n`, `amt`, `cat`); sie sind im JSON-Backup enthalten. Migration idempotent, ältere App-Versionen lesen die Daten weiter.

**Sync und Isolation:** Jede Person braucht eine eigene Passphrase. Daraus entsteht eine eigene Dokument-ID und ein eigener Schlüssel, fremde Dokumente sind weder auffindbar noch lesbar. Ohne Passphrase liest und schreibt die App nichts in Firestore. Eine frische Installation (Konfigurations-Zeitstempel 0) überschreibt beim Verbinden nie die Konfiguration einer bestehenden. Wichtig: Daniels Passphrase niemals weitergeben, auch nicht an Familie.

## Einnahmen und Vorzeichen (Fehlerbehebung "keine Einnahmen")
- **Jeder Eingang zählt als Einnahme**, auch unsortierte und Erstattungen (außer echte Umbuchungen). In der Monatsansicht listet "Eingänge prüfen: n Buchungen, X €" alle Eingänge, die nicht als Gehalt erkannt sind; ein Tipp auf "Das ist mein Gehalt" legt die Regel an und setzt das Einkommen. Gibt es gar keinen Eingang, erscheint "Keine Eingänge gefunden" mit Direktlink zu Mehr, Import prüfen.
- **Gehalt wird nie ausgeblendet:** Ein Eingang mit Wörtern wie Gehalt, Lohn, Bezüge, Arbeitgeber, Rente gilt nie als Umbuchung und nie als Sparen. Firmen (GmbH, AG ...) werden nicht mit einer gleich hohen Abbuchung eines anderen Kontos gepaart, solange der Text nicht nach Übertrag aussieht.
- **CSV:** `+1.234,56`, Leerzeichen und Non-Breaking-Space in Beträgen, Soll/Haben getrennt, Umsatzart Eingang/Ausgang bei unsignierten Beträgen (Spalten Umsatztyp, Umsatzart, Buchungsart), Suffixe S/H und CR/DR.
- **PDF:** Vorzeichen aus (1) ausdrücklicher Markierung (S/H, +/-, CR/DR), (2) Differenz der Saldo-Spalte zur vorigen Zeile, (3) Position in der Soll/Haben-Spalte (x-Koordinate), (4) Stichwort oder Schätzung. Unsichere Zeilen stehen in der Vorschau unter "Vorzeichen unsicher" und lassen sich einzeln (↔) oder alle umdrehen.
- **Mehr, Import prüfen:** pro Konto Anzahl, Summe positiver und negativer Beträge und Zeitraum, ohne Buchungstexte.
