// Importataan vanhat skriptit niiden sivuvaikutusten ja
// globaalien muuttujien alustamisen takia.
// HUOM: Säilytä TÄSMÄLLEEN SAMA JÄRJESTYS kuin index.html:ssä!
import './mapGenerator.js';
import './grid.js';
import './tower.js';
import './creep.js';
import './pathfinding.js';
import './game.js';

console.log("Main module loaded, legacy scripts imported.");

// Voit jättää loput tästä tiedostosta tyhjäksi tai lisätä
// pienen alustuskutsun, jos game.js ei enää käynnisty automaattisesti
// (esim. jos pelin käynnistys oli viimeisen skriptin lopussa)
// Esimerkiksi:
// if (typeof window.initGame === 'function') {
//   window.initGame(); // Olettaen että game.js määrittelisi tällaisen globaalin funktion
// } 