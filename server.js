const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log("🚀 Server wurde gestartet");

// Logging
app.use((req, res, next) => {
    console.log(`➡️ Request empfangen: ${req.method} ${req.url}`);
    next();
});

app.use(express.static(__dirname));
app.use(express.json());

// API-Endpunkt zum Aufteilen von Aufgaben (lokal, ohne OpenAI)
app.post('/api/subtasks', (req, res) => {
    const { task } = req.body;

    if (!task || typeof task !== 'string') {
        return res.status(400).json({ error: 'Ungültige Aufgabe' });
    }

    const lower = task.toLowerCase();
    let subtasks = [];

    if (lower.includes('präsentation')) {
        subtasks = [
            "Thema recherchieren",
            "Folien erstellen",
            "Sprechtext vorbereiten",
            "Üben",
            "Vortrag halten"
        ];
    } else {
        subtasks = [
            "Aufgabe analysieren",
            "Schritte planen",
            "Arbeitsschritte umsetzen",
            "Ergebnisse prüfen"
        ];
    }

    console.log("📤 Lokale Teilaufgaben:", subtasks);
    res.json({ subtasks });
});

app.listen(PORT, () => {
    console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});