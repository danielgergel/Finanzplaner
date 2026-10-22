# Finanzplaner (iPhone-PWA)

Eigenständige Finanz-App: CSV-Kontoauszüge importieren, automatisch kategorisieren, Budget mit Ampel und Alarm, versteckter Tresor. Alles läuft offline; Sync ist optional und Ende-zu-Ende verschlüsselt. Keine Analytics, keine Drittanbieter-Skripte außer Firebase (gstatic) und Google Fonts.

## Deployment
Die Dateien `index.html`, `sw.js` und `apple-touch-icon.png` auf einen beliebigen HTTPS-Webspace legen (z. B. Firebase Hosting, GitHub Pages) und die URL in Safari öffnen, dann Teilen, "Zum Home-Bildschirm". `test_data/` wird nicht gebraucht und kann weg. Der Service Worker (`finanzplaner-v12`) lädt Netz zuerst (3 s), dann Cache.

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
- Die PDF wird nur lokal im Browser gelesen (pdf.js 3.11.174 von cdnjs.cloudflare.com, wird erst beim ersten PDF-Import nachgeladen und danach vom Service Worker `finanzplaner-v12` gecacht). Beim allerersten PDF-Import ist deshalb Internet nötig; die PDF selbst wird nirgends hochgeladen.
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

## Einnahmen nachvollziehen (Version 5)
- Unter der Zusammenfassung steht "Einnahmen: X aus n Buchungen (Gehalt: Y)". Tippen öffnet alle Buchungen der Summe nach Betrag, die Summe, die Einnahmen je Konto und den Block "Nicht mitgezählt" (Umbuchung, Kreditkarte bezahlt) mit dem Knopf "Doch als Einnahme zählen".
- **Gehalt am Monatswechsel:** Wird das Gehalt am 30. oder 31. gebucht oder am 1. bis 3. des Folgemonats, steht es im Nachbarmonat. Im Sheet erscheint "Gehalt zum Monatswechsel" mit "In <Monat> zählen" (optionales Feld `mo` an der Buchung, rückgängig mit "Zurück").
- **Mögliche Duplikate:** Eingänge werden nie still übersprungen, nur mögliche Duplikate bei Ausgaben auf Wunsch. Beim Import als Duplikat verworfene Buchungen werden nicht gespeichert.
- **Umbuchungs-Paarung:** Beträge ab 500 Euro werden nur gepaart, wenn der Text nach Übertrag aussieht. PDF: Dezember im Auszug "1/2026" bekommt das Vorjahr.

## Rechnen pro Monat und Abdeckung (Version 5)
- **Alles pro Kalendermonat.** Nichts wird über den ganzen Importzeitraum aufsummiert. Ø-Werte (Gehalt, Ø pro Monat, Wiederkehr) nutzen nur vollständige Monate.
- **Abdeckung je Konto:** Zeitraum = erstes bis letztes Buchungsdatum des Kontos. Ein Monat ist für ein Konto nur vollständig, wenn er komplett darin liegt (ein Auszug vom 1. bis Monatsletzten zählt). Konten mit 90, 180 oder 365 Tagen werden so einzeln richtig gerechnet. In der Monatsansicht warnt eine Zeile "Konto X deckt diesen Monat nicht ab – Zahlen unvollständig". Der laufende Monat warnt nur, wenn der Import älter als 3 Tage ist. Der Vormonatsvergleich erscheint nur bei vollständigem Vormonat.
- **Ø pro Monat** (Monat, Link unter den Einnahmen, oder Mehr): Zeitraum letzte 3 / 6 / 12 / alle vollständigen Monate. Je Konto Summe / Anzahl der vollständigen Monate, die Konten werden addiert. Zeilen für Einnahmen, Fixkosten, Variabel, Sparen/Anlegen, Übrig, je Kategorie mit "Ø aus n Monaten" und bei weniger als 3 Monaten "wenig Daten". Bei Fixkosten steht "Plan X · real Y".
- **Fixkosten automatisch erkannt:** gleicher Händler, Betrag ±10 %, fast jeden Monat; oder regelmäßig alle 3, 6 oder 12 Monate (z. B. 25 Euro alle 3 Monate = 8,33 pro Monat). Nur ein Vorschlag mit Bestätigung, übernommen wird der Betrag pro Monat.
- **Datenformat:** unverändert (keine neuen Felder), Daniels Daten bleiben erhalten.

## Version 6: Diagramm, eigene Buchungen, Neustart, Kontofilter
- **Kreisdiagramm** (Monatsansicht, inline SVG, kein Framework): Umschalter Ausgaben / Einnahmen / Konten. Ausgaben ohne Umbuchungen und ohne Einnahmen, Mitte = Gesamtsumme, Unsortiert grau, Kategorien unter 3 % als aufklappbare Gruppe "Weitere". Feste Farben je Kategorie. Unter dem Diagramm steht dieselbe Liste als Text (barrierefrei). Tipp auf Segment oder Zeile zeigt Betrag, Anteil und die Buchungen.
- **Kontofilter** oben in der Monatsansicht (Alle Konten / einzelnes Konto), wirkt auf Zusammenfassung, Diagramm und Listen. Umbuchungen werden weiter über alle Konten erkannt. Die Diagnose unter Mehr zeigt je Konto den Saldo der Buchungen (kein Kontostand, der bleibt im Tresor).
- **Eigene Buchungen:** Plus-Knopf unten rechts (Betrag, Ausgabe/Einnahme, Kategorie, Datum, Notiz, Konto, optional "Jeden Monat wiederholen" mit Enddatum). Markierung ✎, bzw. ⟳ bei Dauerposten; bearbeiten und löschen über die Buchung, Dauerposten außerdem unter Mehr. Sie zählen in alle Summen, Diagramme und Ø pro Monat. Sie liegen im virtuellen Konto "Manuell" (immer voll abgedeckt, keine Abdeckungs-Warnung) und werden von Importen und der Duplikat-Erkennung nie verändert. Neue Felder: `man`, `rec` an Buchungen, `recur[]` (Dauerposten), Konto `man`, `delw` (Löschzeitstempel). Schema 4, additiv und idempotent migriert, ältere App-Versionen verlieren beim Sync nichts.
- **Neu aufsetzen** (Mehr): "Nur Buchungen löschen (Einstellungen behalten)" entfernt alle importierten Buchungen samt Import-Hashes und behält Konten, Kategorien, Regeln, Plan, feste Kosten, Profil, Tresor sowie manuelle Buchungen und Dauerposten. Mit Sync werden die gelöschten Buchungen über Löschzeitstempel auch auf anderen Geräten entfernt, ein Neuimport bleibt trotzdem erhalten. Danach alle Konten für denselben Zeitraum neu laden.
- **Sauber importieren** (Import): Leitfaden (gleicher Zeitraum für alle Konten, ganze Monate), Abdeckung je Konto als Balken mit von/bis, "Gemeinsamer Zeitraum aller Konten" mit dem begrenzenden Konto und Warnung bei deutlich kürzeren oder längeren Konten. Konten, die seit mehr als 62 Tagen nichts Neues haben, blockieren den gemeinsamen Zeitraum nicht. Die Monatsansicht startet auf dem letzten Monat, den alle aktiven Konten vollständig abdecken.

## Version 7: Donut als Hauptansicht
Das Kreisdiagramm steht direkt unter der Zusammenfassung der Monatsansicht (Kontofilter darüber). Die Kategorie-Zeilen haben keine Fortschrittsbalken mehr, sondern Ampel-Punkt, Segmentfarbe als Punkt und Text "Ist / Richtwert · Prozent". Rote Kategorien tragen zusätzlich ⚠ (Farbenblindheit). Ø pro Monat zeigt die Aufteilung des Einkommens (Fixkosten, Variabel, Sparen, Übrig) als kleinen Donut. Das Balken-Element bleibt nur als Zeitachse im Import-Leitfaden und als Fortschritt im Sortieren-Ablauf. Daten und Schema unverändert.

## Version 8: Eigenüberweisungen, Gehaltsvorschlag, bessere Zuordnung
- **Spalten (DKB-Stil):** Händler = Zahlungsempfänger*in bei Ausgang, Zahlungspflichtige*r bei Eingang; zusätzlich werden IBAN (nur als Hash gespeichert) und Gläubiger-ID gelesen. Status "Vorgemerkt" wird ausgeschlossen.
- **Eigenüberweisungen:** Der Kontoinhaber wird beim Import aus den Daten abgeleitet (Name, der auf der eigenen Seite der Buchungen häufig vorkommt) und unter Mehr, "Mein Name" angezeigt und änderbar. Überweisungen von und an den eigenen Namen oder an erkannte eigene Konten (IBAN) zählen als Umbuchung. Für schon importierte Daten fragt die Monatsansicht einmal nach ("Sind das deine eigenen Überweisungen?"). Außerdem gilt ein Zahlungsempfänger "Revolut" als Umbuchung.
- **Gehalt ohne Stichwort:** Der größte regelmäßig wiederkehrende Eingang gleichen Absenders wird als Vorschlag gezeigt ("Ist das dein Gehalt?"). Bei Ja entsteht eine Regel nur auf den Absender, die nur für Eingänge gilt (Regelfeld `in`).
- **Zuordnung:** Viele neue generische Standardregeln (Kantinen, Tankstellen, Supermärkte auch im Ausland, Apotheken, Bekleidung, Streaming, Versicherungen, Verkehr, Baumärkte, Prop-Trading-Firmen, Banken-Automaten). Bei PayPal, Klarna & Co. wird der Händler aus dem Verwendungszweck gelesen ("Ihr Einkauf bei ..."). Nicht zugeordnete Ausgaben übernehmen die Kategorie von Buchungen mit gleicher Gläubiger-ID oder gleichem Händler (auch erster Wortteil), sofern dort mindestens 80 % dieselbe Kategorie haben. Zahlungsdienstleister werden dabei nie als Händler gelernt.
- **Daten:** Schema 5, additiv. Neue Standardregeln werden beim Laden einmalig am Ende ergänzt, eigene Regeln bleiben vorn. Neue optionale Felder: `g`, `ib` an Buchungen, `profile.myNames`, `profile.myIbans`, `profile.skipNames`, Regelfeld `in`.

## Version 10: einfach richtig erkennen
- **Entfernt:** Netto/Brutto-Umschalter und jede Verrechnung von Erstattungen, "Einmalig/Mitzählen", Preisänderungs- und "noch offen"-Hinweise, stilles Lernen von Händlern (Gläubiger-ID, Wortteil). Beträge stehen so, wie sie gebucht wurden; positive Buchungen werden nie mit Ausgaben verrechnet.
- **Matching nur auf Wörtern:** Schlüssel treffen Wörter (Groß/Klein, Umlaute, Satzzeichen und Leerzeichen . / - _ & , ( ) normalisiert), keine Teilstrings: WOLT trifft nicht WOLTER, SHELL nicht SHELLY oder "Beach Shell Bar", SKY nicht SKYLINE. Mehrwort-Schlüssel ("TANK CENTER", "ESTACION DE SERVICIO", "TANK & RAST") und Marken mit Punkt (TANK.CENTER, Aral.Station.123) funktionieren. Syntax in Regeln: "A B" Wortfolge, "A+B" beide Wörter, "A!B" nicht wenn B vorkommt, "ANFANG*" oder "*ENDE" für zusammengesetzte deutsche Wörter. Optionen pro Regel: nur positiv (pos), nur negativ (neg), Mindestbetrag (min).
- **Prüfreihenfolge:** (1) Einzelzuordnung und eigene Regeln, (2) Gehalt (Stichwort, positiv, ab 500 Euro), (3) Wohnen (Miete, Kaltmiete, Warmmiete, Hausverwaltung, Vermieter schlagen Namens-Treffer), (4) eigene Konten/Umbuchung (Name, IBAN; eine eigene Regel darf das übersteuern), (5) Standardregeln nach Spezifität (Marken vor generischen Wörtern), (6) Rest bleibt unsortiert. Überweisungen an Privatpersonen werden nie geraten.
- **Neue Kategorien (additiv):** Strom & Nebenkosten (Fix), Bargeld, Auto/Parken, Gesundheit, ÖPNV/Bahn. Bestehende Kategorien und Zuordnungen bleiben. Trading-Gebühren sind Kosten in der Gruppe Variabel ("Trading-Kosten", Warnfarbe), Trade Republic und ETF gelten als Sparen.
- **Tanken:** Wortliste aller gängigen Marken plus Tankstelle, Tankcenter, SB-Tank, Autohof, Rasthof, Gasolinera, Estacion de Servicio, Station Service; Supermarkt + Tankstelle zählt als Tanken; TOTAL nicht bei Mietwagen, STAR nur mit Tank-Kontext. Parken, Autowäsche, Ladestation und EnBW mobility gehören zu Auto/Parken.
- **Miete:** Miete, Kaltmiete, Warmmiete, Hausverwaltung, Vermieter im Text, oder monatlich ab 400 Euro an denselben Empfänger (±10 %, mindestens 3 Monate, nur wenn sonst nichts passt). Nennt der Verwendungszweck einen Monat ("Miete Oktober", gebucht am 29.09.), zählt die Buchung dort (Feld `mo`).
- **Einnahmen:** nur Kategorie Einkommen (Gehalt, BAföG/AFBG, Kindergeld, Rente, Steuererstattung, Förderung). Alle anderen Eingänge (Rückzahlungen, Beiträge von Mitbewohnern, Gutschriften) stehen in einer eigenen Zeile "Weitere Eingänge (Rückzahlungen, Beiträge)" mit Detail-Liste; sie zählen in "Übrig" als Geldzufluss, nicht in Einnahmen oder Gehalt.
- **Fixkosten pro Monat:** Je Händler/Empfänger und Betrag (±10 %) zu Posten zusammengefasst. Betrag = zuletzt gebuchter regelmäßiger Betrag, Einmalzahlungen bleiben außen vor. Mehrere feste Zahlungen (z. B. Abos) sind mehrere Posten, die Summe stimmt mit den Posten überein. Fixkosten, die über eigene Konten laufen, stehen unter Ø pro Monat als "Auf andere eigene Konten verschoben" (zählt nicht als Ausgabe).
- **Duplikate:** Wörter wie Debitkartenumsatz, Visa, Kartenzahlung, Vom zählen nie als Händler; gleicher Betrag und Datum bei anderem Händler ist kein Duplikat.
- **Reparatur:** Beim ersten Start von v10 werden alle aus Regeln stammenden Zuordnungen einmalig neu berechnet (einzeln gesetzte Zuordnungen bleiben), die alten Teilstring-Standardregeln werden durch die neuen ersetzt, eigene Regeln bleiben vorn. "Regeln neu anwenden" unter Mehr bleibt. Schema 6, additiv und idempotent.

## Version 11: Plus und Minus manuell umdrehen

So drehst du Plus/Minus um:
1. Neben jeder Buchung (Kategorie-Detail, Einnahmen, Weitere Eingänge, Ausgaben, Sortieren, Umbuchungen) steht ein Knopf "±". Ein Tipp dreht die Buchung um, nochmal tippen stellt das Original wieder her.
2. In der Buchung selbst: "± Plus/Minus umdrehen" und "Alle Buchungen dieses Händlers umdrehen (n)" (mit Rückfrage und Anzahl).
3. Ganzes Konto: Mehr, Konten/Import prüfen, beim Konto Bereich wählen (gewählter Monat, Zeitraum, ganzes Konto), "Umdrehen", Rückfrage mit Anzahl bestätigen.
4. Beim Import warnt die App, wenn bei einem Konto fast alles positiv ist ("Ist das richtig?" mit "Ja, stimmt" oder "Umkehren"), wenn die Saldo-Spalte nur mit umgekehrten Vorzeichen passt oder wenn Buchungstext/Typ (z. B. Lastschrift) und Vorzeichen nicht zusammenpassen.
5. Eine einzeln gesetzte Kategorie bleibt beim Umdrehen; automatische Zuordnungen (Gehalt, Miete, Regeln) werden neu berechnet.

Technik: Felder `fl` (umgedreht), `oa` (Originalbetrag), `pc` (vorherige automatische Kategorie), `u` für den Sync-Abgleich; Schema bleibt 6 (nur zusätzliche Felder, ältere App-Versionen sehen einfach den umgedrehten Betrag). Re-Import: gleicher Hash, wird als Duplikat erkannt (mit Originalvorzeichen), die Umdrehung bleibt. Dauerposten sind ausgenommen. Neu erkannt: Spalte "Sender / Empfänger" als Gegenüber, "Buchungstext"/"Type" zur Plausibilitätsprüfung, Typ-Wörter Soll/Haben/Debit/Credit. Tests: `test_v11.js` (40 Prüfungen) und Browser-Test (Cache `finanzplaner-v11`).

## Version 12: Duplikate, PDF-Vorzeichen, Gehalt und Tanken nachvollziehbar

**Was falsch war (an echten Exporten nachgestellt):**
- **Überlappende CSV-Exporte:** Neuere DKB-Exporte kürzen Händlernamen (z. B. "AMZN Mktp…" → "Amazon", "OIL.144…" → "OIL! Tankstellen"). Die alte Duplikat-Prüfung brauchte ein gemeinsames Wort ab 4 Buchstaben, dadurch rutschten Buchungen doppelt durch (auch eine Tankung).
- **PDF-Import (DKB-Umsatzliste):** Die IBAN-Zeile beendete die Buchung, der Verwendungszweck ("Lohn/Gehalt", "Miete …") ging verloren. Beträge ohne Zeichen (Eingänge) wurden als Ausgabe geschätzt, und ein Bindestrich am Namensende ("…-Straße- 3.130,72") wurde als Minus gelesen. Folge: Gehalt und Eingänge erschienen als Ausgaben, nach CSV-Import zusätzlich doppelt.
- **"Dein Gehalt"** war der Durchschnitt der letzten 3 Monate inklusive Sonderzahlungen und Förderung (z. B. AFBG) und überstimmte das eigene Plan-Gehalt.
- **Startmonat:** Die App öffnete den letzten vollständig abgedeckten Monat (meist den Vormonat), der wie der laufende Monat aussah.
- **Daueraufträge auf eigene Konten** mit Namen wie "Versicherungen Wohnung" zählten als Versicherung statt als Umbuchung; KFZ-Versicherungen landeten unter Auto/Parken, "Vers. AG" blieb unsortiert, Sanifair-Toiletten zählten als Tanken, "C&A" wurde nicht erkannt.

**Was v12 macht:**
- **Duplikate beim Import:** Kundenreferenz (gleich = Duplikat, verschieden = nie Duplikat), gleicher Händler (Wort ab 3 Buchstaben, Ziffern ignoriert, gleicher Namensanfang), lange Referenznummern (PayPal), PDF gegen CSV über den Verwendungszweck. Bei einem erkannten Re-Export (mindestens 80 % schon vorhanden) zählt auch der gleiche Verwendungszweck bei umbenanntem Händler. Zwei Käufe beim selben Händler mit verschiedenem Kartendatum bleiben zwei Buchungen.
- **CSV verbessert PDF:** Trifft eine CSV-Zeile eine vorhandene PDF-Buchung, bekommt diese Händler, Verwendungszweck, Referenz und das richtige Vorzeichen (Hash und eigene Zuordnungen bleiben). In der Vorschau steht "Davon … genauere Daten".
- **PDF-Parser:** IBAN/BIC-Zeilen beenden keine Buchung mehr; Vorzeichen-Konvention je Dokument (tragen Ausgaben ein Minus und nichts ein Plus/S/H, sind Beträge ohne Zeichen Eingänge); Bindestrich am Wortende ist kein Minus.
- **Vorgemerkt:** wird getrennt gespeichert (`pend`), zählt nicht, steht im Kategorie-Sheet unter "Vorgemerkt". Die neueste Datei eines Kontos ersetzt die Vormerkungen (Reservierung an der Zapfsäule → endgültiger Betrag).
- **Warnung beim Import**, wenn die Datei schon zu großen Teilen in einem anderen Konto steckt ("In Konto X importieren").
- **Mehr, "Duplikate prüfen und bereinigen":** zeigt sichere Duplikate mit Grund (gleiche Referenz, Händler umbenannt, PDF/CSV, PDF mit falschem Vorzeichen, dasselbe Bankkonto unter zwei Namen) und unsichere (runde Beträge, nur gleicher Text; werden nie automatisch entfernt). Entfernen mit Rückfrage, Vorher/Nachher (Anzahl, Umsatzvolumen), eigene Zuordnungen wandern auf die behaltene Buchung, manuelle Buchungen und Dauerposten bleiben, entfernte Kopien kommen per Re-Import oder Sync nicht zurück. Ein zweiter Lauf findet nichts mehr.
- **Einnahmen:** Monatszeile "Einnahmen: X (Gehalt · Förderung)". Das Einnahmen-Sheet gliedert nach Gehalt / Förderung / Sonstiges und Weitere Eingänge je Quelle mit Anzahl und Konto, warnt bei gleichem Betrag in zwei Konten und zeigt das Gehalt der letzten Monate mit Median, Spanne und möglichen Sonderzahlungen. "Dein Gehalt" = Ø der letzten 3 normalen Gehaltsmonate (ohne Förderung, ohne Sonderzahlungen über 125 % des Medians); dieselbe Gehaltszahlung in zwei Konten zählt einmal. Knopf "Stattdessen mit … rechnen (dein Plan)".
- **Kategorie-Sheet:** Summe, Anzahl, kleinster/größter Betrag, Durchschnitt, Aufteilung nach Konto, jede Buchung mit Datum, Konto und Status (gebucht, aus PDF, manuell, vorgemerkt), Hinweis bei gleichen Beträgen in zwei Konten.
- **Start im laufenden Monat**, Überschrift mit Monat und "laufender Monat, Buchungen bis …".
- **Regeln:** Dauerauftrag an ein eigenes Konto (Gegenbuchung mit gleichem Betrag und Verwendungszweck, max. 3 Tage) = Umbuchung; KFZ nur ohne Versicherungs-Wort; neue Schlüssel für Versicherungen (Vers. AG, VHV, Barmenia, …), Sanifair (Sonstiges), C&A, Street Food.

**Daten:** Schema bleibt 6. Neue optionale Felder: `ref`, `src`, `gs` an Buchungen, `pend`, `pendMax`, `pendTs`, `r12` am Zustand. Einmalige Regel-Migration (Marker `r12`): geänderte Standardregeln ersetzt, eigene Regeln bleiben vorn, gelöschte Standardregeln bleiben gelöscht; Buchungen, Zuordnungen und Einstellungen unverändert. Ältere App-Versionen lesen die Daten weiter.

**Für bestehende Daten:** Nach dem Update Mehr, "Duplikate prüfen und bereinigen" ausführen. Wurden früher PDFs importiert, danach die neuesten CSV-Exporte der Konten (ganzer Zeitraum) noch einmal importieren: alte PDF-Buchungen bekommen dabei die CSV-Daten und das richtige Vorzeichen.

Tests: `test_v12.js` (44 Prüfungen, synthetisch), alle älteren Suiten unverändert grün, Browser-Test (Cache `finanzplaner-v12`).
