# Tower Defense Peli

Minimalistinen, retrofuturistinen Tower Defense -peli, jossa yhdistyy klassinen pelattavuus ja moderni toteutus.

## Pelin kuvaus

Tower Defense on strategiapeli, jossa pelaajan tehtävänä on puolustaa aluetta rakentamalla puolustustorneja. Peli yhdistää taktisen suunnittelun ja resurssien hallinnan hauskalla tavalla.

## Pelaaminen

1. Avaa `index.html` selaimessa aloittaaksesi pelin
2. Aloita vihollisaallot painamalla "NEXT WAVE" -nappia
3. Sijoita torneja valitsemalla ne vasemmasta paneelista ja klikkaamalla peliruudukkoa
4. Jokainen torni vie 2x2 ruudun kokoisen alueen
5. Tornit maksavat rahaa ja ampuvat vihollisia automaattisesti
6. Vihollisten tuhoaminen antaa rahaa uusien tornien rakentamiseen
7. Peli päättyy, jos 10 vihollista pääsee maaliin
8. Jokainen aalto on edellistä vaikeampi ja viholliset kestävämpiä

## Ohjaus

- **Hiiren klikkaus**: Sijoita valittu torni, paina nappeja tai myy torneja myyntitilassa
- **Hiiren raahaus**: Valitse useita torneja myyntiä varten (myyntitilassa)
- **D-näppäin**: Vaihda debug-tila, näyttää tornien kantamat

## Tekniset ominaisuudet

### Frontend
- Toteutettu puhtaalla JavaScriptillä ja HTML5 Canvasilla
- Responsiivinen käyttöliittymä
- Dynaaminen tornien sijoitusjärjestelmä
- Reaaliaikainen polunetsintä (A* algoritmi)

### Tietokanta
- SQLite-tietokanta huipputulosten tallentamiseen
- Pelaajatietojen ja pelisessioiden seuranta
- Tilastojen tallennus ja analysointi

### Pääkomponentit
- **Grid.js**: Ruudukon ja tornien sijoittelun hallinta
- **Tower.js**: Tornien toiminnallisuus ja vihollisten tähtääminen
- **Creep.js**: Vihollisten liikkuminen ja polunetsintä
- **Pathfinding.js**: A* polunetsintäalgoritmin toteutus
- **Game.js**: Pelin pääsilmukka ja tilanhallinta
- **Database.js**: Tietokantaoperaatiot ja tilastojen käsittely

## Tietokannan rakenne

### Taulut

#### Players
- id (PRIMARY KEY)
- username
- created_at
- last_played

#### Scores
- id (PRIMARY KEY)
- player_id (FOREIGN KEY)
- score
- waves_completed
- towers_built
- enemies_killed
- played_at

#### GameStats
- id (PRIMARY KEY)
- game_id (FOREIGN KEY)
- wave_number
- resources_spent
- damage_dealt
- timestamp

## Asennus ja käyttöönotto

1. Kloonaa repositorio
2. Varmista, että sinulla on SQLite asennettuna
3. Suorita tietokannan alustusscripti: `init_db.sql`
4. Avaa `index.html` selaimessa

## Kehityssuunnitelma

- [ ] Uusien tornityyppien lisääminen
- [ ] Moninpelitilan kehittäminen
- [ ] Saavutusjärjestelmän implementointi
- [ ] Pelaajaprofiilien laajentaminen
- [ ] Lisää tilastoja ja analytiikkaa

## Lisenssi

MIT License - Katso LICENSE tiedosto tarkempia tietoja varten. 