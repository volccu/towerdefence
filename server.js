import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Tarjoa staattiset tiedostot
app.use(express.static(__dirname));

app.listen(port, () => {
    console.log(`Palvelin käynnissä osoitteessa http://localhost:${port}`);
}); 