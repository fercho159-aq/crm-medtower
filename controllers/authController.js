const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const [rows] = await query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || 'vendedor';
        
        return res.json({ success: true, message: 'Logged in successfully' });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        return res.json({ success: true, message: 'Logged out successfully' });
    });
};

const checkSession = (req, res) => {
    if (req.session && req.session.userId) {
        return res.json({ 
            authenticated: true, 
            username: req.session.username,
            role: req.session.role || 'vendedor',
            userId: req.session.userId
        });
    }
    return res.json({ authenticated: false });
};

module.exports = {
    login,
    logout,
    checkSession
};
