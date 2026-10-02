const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const route = require('./controllers/route');
const { errorHandler } = require('./middelwares/errorHandler');

//Setup Express App
const app = express();
// Middleware (imports of customers send up to a few thousand rows at once)
app.use(bodyParser.json({ limit: '5mb' }));
// Set up CORS; the name of downloaded files is read by the web client
app.use(cors({ exposedHeaders: ['Content-Disposition'] }))
//API Routes
app.use('/api', route);

app.get('/', async (req, res) => {
    res.send('Welcome to my world...')
});

// Must be registered after all routes
app.use(errorHandler);

module.exports = app;
