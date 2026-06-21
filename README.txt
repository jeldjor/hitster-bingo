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

Bingo Beats V37 Clean Picker + Cats
- Oude picker patchblokken uit app.js verwijderd waar mogelijk.
- Laatste runtime override forceert alleen cartoon dierenrad.
- Spotify/startpopup mag categorieën nooit meer resetten: opgeslagen vóór klik en hersteld na popup/terugkomst.
- Host geluid UI hard verwijderd.