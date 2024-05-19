const express = require('express');
const { Pool } = require('pg');
const { Client } = require('@googlemaps/google-maps-services-js');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());

// Configuration de la connexion à la base de données PostgreSQL
const pool = new Pool({
  user: 'votre_utilisateur',
  host: 'localhost',
  database: 'votre_base_de_donnees',
  password: '',
  port: 5432,
});

// Configuration du client Google Maps
const googleMapsClient = new Client({
  apiKey: 'VOTRE_CLE_API' // Assurez-vous de configurer votre clé API correctement
});

// API pour la gestion des chauffeurs et des commandes
let chauffeurs = [];
let commandes = [];

app.post('/chauffeurs', upload.fields([
  { name: 'cni', maxCount: 1 },
  { name: 'permis', maxCount: 1 },
  { name: 'casier', maxCount: 1 },
  { name: 'carteGrise', maxCount: 1 }
]), (req, res) => {
  const { nom, prenom, DatNaiss, email, motDePasse, modeleVoiture, plaqueImmatriculation } = req.body;
  const newChauffeur = {
    id: chauffeurs.length + 1,
    nom,
    prenom,
    DatNaiss,
    email,
    motDePasse,
    modeleVoiture,
    plaqueImmatriculation,
    documents: {
      cni: req.files['cni'][0].path,
      permis: req.files['permis'][0].path,
      casier: req.files['casier'][0].path,
      carteGrise: req.files['carteGrise'][0].path
    },
    validé: false
  };
  chauffeurs.push(newChauffeur);
  res.status(201).send(newChauffeur);
});

app.get('/chauffeurs', (req, res) => {
  res.status(200).send(chauffeurs);
});

app.post('/commandes', async (req, res) => {
  const { depart, destination } = req.body;
  try {
    const response = await googleMapsClient.directions({
      params: {
        origin: depart,
        destination: destination,
        key: 'VOTRE_CLE_API'
      }
    });
    const distance = response.data.routes[0].legs[0].distance.value / 1000; // Distance en kilomètres
    const tarifBase = 500; // 500 Francs par kilomètre
    const prix = distance * tarifBase;

    const newCommande = {
      id: commandes.length + 1,
      depart,
      destination,
      distance: `${distance} km`,
      prix: `${prix} Francs`,
      date: new Date()
    };
    commandes.push(newCommande);
    res.status(201).send(newCommande);
  } catch (error) {
    console.error('Erreur Google Maps API:', error);
    res.status(500).send('Erreur de traitement de la commande');
  }
});

// Gestion des positions des chauffeurs en temps réel
io.on('connection', (socket) => {
  console.log('Un client est connecté');

  socket.on('updatePosition', (data) => {
    console.log(`Position mise à jour pour le chauffeur ${data.chauffeurId} : ${data.position}`);
    socket.broadcast.emit('positionUpdated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});


// Démarrer le serveur
server.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${port}`);
});
