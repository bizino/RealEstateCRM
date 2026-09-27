require('dotenv').config()
const db = require('./db/config')
const app = require('./app');
const port = process.env.PORT || 5001

if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET is not set, falling back to the insecure default key. Set JWT_SECRET in server/.env for production.');
}

// Get port from environment and store in Express.

const server = app.listen(port, () => {
    const protocol = (process.env.HTTPS === 'true' || process.env.NODE_ENV === 'production') ? 'https' : 'http';
    const { address, port } = server.address();
    const host = address === '::' ? '127.0.0.1' : address;
    console.log(`Server listening at ${protocol}://${host}:${port}`);
});


// Connect to MongoDB
const DATABASE_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017'
// const DATABASE_URL = 'mongodb://127.0.0.1:27017'
const DATABASE = process.env.DB || 'Prolink'

db(DATABASE_URL, DATABASE);
