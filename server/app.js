const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const route = require('./controllers/route');
const { errorHandler } = require('./middelwares/errorHandler');

//Setup Express App
const app = express();
// Middleware
app.use(bodyParser.json());
// Set up CORS
app.use(cors())
//API Routes
app.use('/api', route);

app.get('/', async (req, res) => {
    res.send('Welcome to my world...')
});

// Must be registered after all routes
app.use(errorHandler);

module.exports = app;
