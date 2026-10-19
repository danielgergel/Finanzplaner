# Finanzplaner (iPhone-PWA)

Eigenständige Finanz-App: CSV-Kontoauszüge importieren, automatisch kategorisieren, Budget mit Ampel und Alarm, versteckter Tresor. Alles läuft offline; Sync ist optional und Ende-zu-Ende verschlüsselt. Keine Analytics, keine Drittanbieter-Skripte außer Firebase (gstatic) und Google Fonts.

## Deployment
Die Dateien `index.html`, `sw.js` und `apple-touch-icon.png` auf einen beliebigen HTTPS-Webspace legen (z. B. Firebase Hosting, GitHub Pages) und die URL in Safari öffnen, dann Teilen, "Zum Home-Bildschirm". `test_data/` wird nicht gebraucht und kann weg. Der Service Worker (`finanzplaner-v1`) lädt Netz zuerst (3 s), dann Cache.

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
- Die PDF wird nur lokal im Browser gelesen (pdf.js 3.11.174 von cdnjs.cloudflare.com, wird erst beim ersten PDF-Import nachgeladen und danach vom Service Worker `finanzplaner-v2` gecacht). Beim allerersten PDF-Import ist deshalb Internet nötig; die PDF selbst wird nirgends hochgeladen.
- Erkannt werden Zeilen mit Datum (TT.MM.JJJJ, TT.MM.JJ, TT.MM., ISO, englisch) und Betrag (deutsch oder englisch, mit S/H, CR/DR, +/- oder nachgestelltem Minus); Folgezeilen gehören zum Verwendungszweck. Das Jahr bei Daten ohne Jahr kommt aus dem Auszugskopf oder dem Dateinamen, sonst wird gefragt. Saldo-, Summen-, IBAN- und Seitenzeilen werden ausgefiltert.
- Beträge ohne Vorzeichen werden als Ausgabe gewertet (Ausnahme: Wörter wie Gehalt/Gutschrift). Diese Buchungen sind in der Vorschau als "geschätzt" gekennzeichnet; der Haken "Vorzeichen umkehren" dreht alle um.
- Nicht zugeordnete Zeilen stehen in der Vorschau unter "Nicht erkannt". Gescannte PDFs (ohne Text) und passwortgeschützte PDFs liefern eine Meldung.
- Grenzen: Der Parser ist heuristisch und kennt keine bankspezifischen Layouts. Spaltenlayouts mit getrennten Soll/Haben-Spalten ohne Vorzeichen, mehrere Betragsspalten oder ungewöhnliche Zeilenumbrüche können falsch gelesen werden. CSV ist verlässlicher; PDF nur nutzen, wenn kein CSV-Export verfügbar ist, und die Vorschau immer prüfen.
