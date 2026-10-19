# Finanzplaner (iPhone-PWA)

Eigenständige Finanz-App: CSV-Kontoauszüge importieren, automatisch kategorisieren, Budget mit Ampel und Alarm, versteckter Tresor. Alles läuft offline; Sync ist optional und Ende-zu-Ende verschlüsselt. Keine Analytics, keine Drittanbieter-Skripte außer Firebase (gstatic) und Google Fonts.

## Deployment
Die Dateien `index.html`, `sw.js` und `apple-touch-icon.png` auf einen beliebigen HTTPS-Webspace legen (z. B. Firebase Hosting, GitHub Pages) und die URL in Safari öffnen, dann Teilen, "Zum Home-Bildschirm". `test_data/` wird nicht gebraucht und kann weg. Der Service Worker (`finanzplaner-v3`) lädt Netz zuerst (3 s), dann Cache.

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
- Die PDF wird nur lokal im Browser gelesen (pdf.js 3.11.174 von cdnjs.cloudflare.com, wird erst beim ersten PDF-Import nachgeladen und danach vom Service Worker `finanzplaner-v3` gecacht). Beim allerersten PDF-Import ist deshalb Internet nötig; die PDF selbst wird nirgends hochgeladen.
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
