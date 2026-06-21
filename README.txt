Compact Dashboard V5 Scoreboard 2 Regels

Dashboard blijft hetzelfde.

Aanpassing:
- Scoreboard toont per speler:
  Naam
  Antwoord
- Geen antwoord meer naast de naam.
- Scoreboard-venster is scrollbaar als er veel spelers zijn.
- Hostscherm blijft host als URL geen ?room= bevat.


V7B hard popup: modal direct in HTML en init gekoppeld.

Fullscreen Bingo overlay toegevoegd voor host en alle spelers.

Bingo Beats Clean From Stable
- Gebouwd vanaf stabiele pre-Bingo-Beats versie.
- Originele pickCell-logica behouden.
- Bingo Beats look, kleuren en surprise dierenpicker toegevoegd.

Bingo Beats V31 No Old Colors
- Oude kleuren hard verwijderd uit CSS/JS.
- colorHexV5/hbColor/playerColorByIndex naar nieuwe palette.
- Compacte bingokaart wordt direct met nieuwe inline kleuren gebouwd bij updates.

Bingo Beats V32 Monkeys Only
- ✅ en 👑 verwijderd/vervangen in code.
- Gekozen en vrije vakjes tonen random 🐵 🙈 🙉 🙊.

Bingo Beats V34 Spotify Category Keep
- Categorieën worden opgeslagen vóór Spotify-login.
- Categorieën worden direct teruggezet na klikken/terugkomen.

Bingo Beats V35 Cartoon Animals
- Activeer host-geluid verborgen/verwijderd uit UI.
- Emoji-dierenkleurkiezer vervangen door CSS-cartoon dieren.
- Aap, papegaai en schildpad bewegen met armen/vleugels/pootjes.
- Groot draaiend kleurrad, kleur blijft geheim tot reveal.

Bingo Beats V36 Force Cartoon
- Host-geluid balk en statusregel hard verborgen.
- Oude pickerfuncties pickerHTML/sharedPickerHTML/renderPlayerPicker/renderCompactPicker/startRoundVisual hard overschreven.
- Oude discobal/emoji picker wordt bij render direct vervangen door cartoon dierenrad.

Bingo Beats V39 Schone Picker + Categorie Fix
- Categorieën worden opgeslagen in localStorage en nooit gereset door Spotify-login/startpopup.
- Oude picker visuals geneutraliseerd.
- hbRenderPicker/renderCompactPicker/renderPlayerPicker/startRoundVisual wijzen allemaal naar één nieuwe cartoon-dierenrad picker.
- Host/speler schermen worden niet handmatig gewisseld of overschreven.

Bingo Beats V42 Categorie Reset Verwijderd
- Directe automatische category .value resets verwijderd waar gevonden.
- Oude categorie-memory/protection blokken vervangen door één eenvoudige bron van waarheid.
- Categorieën worden alleen aangepast als de host zelf typt.
- Aantal verdachte regels verwijderd: 0.

Bingo Beats V43 Hard Lock Categorieën
- Categorievelden krijgen een harde input-lock.
- Automatische code/popup/Firebase/startscherm mag de velden niet meer overschrijven.
- Alleen typen, plakken of handmatig wijzigen in het veld slaat een nieuwe waarde op.