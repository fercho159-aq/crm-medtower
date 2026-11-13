const express = require('express');
const router = express.Router();
const path = require('path');
const { isAuthenticated } = require('../middlewares/auth');

// Public route for login page (or just serve index.html directly since frontend handles auth state)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Any specific page routing for the frontend can go here
// For an SPA, we usually send index.html for all undefined GET routes

module.exports = router;
