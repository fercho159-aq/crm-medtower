const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

// List all users for assignments
const listSellers = async (req, res) => {
    try {
        const [rows] = await query("SELECT id, username, role FROM users ORDER BY username ASC");
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error listing sellers:', error);
        res.status(500).json({ error: 'Failed to retrieve sellers' });
    }
};

// Create a new seller user
const createSeller = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }

        // Check if username already exists
        const [existing] = await query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        const assignedRole = role === 'content_manager' ? 'content_manager' : 'vendedor';

        // Insert new seller
        await query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
            [cleanUsername, passwordHash, assignedRole]
        );

        res.json({ success: true, message: 'Seller created successfully' });
    } catch (error) {
        console.error('Error creating seller:', error);
        res.status(500).json({ error: 'Failed to create seller' });
    }
};

// Delete a seller by ID
const deleteSeller = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify it is a seller (cannot delete admins)
        const [rows] = await query("SELECT role FROM users WHERE id = $1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (rows[0].role !== 'vendedor' && rows[0].role !== 'content_manager') {
            return res.status(400).json({ error: 'Cannot delete an administrator account' });
        }

        // Delete user
        await query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'Seller deleted successfully' });
    } catch (error) {
        console.error('Error deleting seller:', error);
        res.status(500).json({ error: 'Failed to delete seller' });
    }
};

// Get monthly sales goals count for sellers
const getSellersGoals = async (req, res) => {
    try {
        const { userId, role } = req.session;

        let sql = '';
        let params = [];

        if (role === 'admin') {
            // Admin sees all sellers and their monthly sales
            sql = `
                SELECT 
                    u.id AS vendedor_id, 
                    u.username AS vendedor_nombre,
                    COALESCE(g.sold_count, 0) AS sold_count
                FROM users u
                LEFT JOIN (
                    SELECT vendedor_id, COUNT(*) as sold_count 
                    FROM leads 
                    WHERE estado_vendedor = 'ATENDIDO'
                      AND date_trunc('month', fecha_actualizacion) = date_trunc('month', CURRENT_DATE)
                    GROUP BY vendedor_id
                ) g ON u.id = g.vendedor_id
                WHERE u.role = 'vendedor'
                ORDER BY sold_count DESC, u.username ASC
            `;
        } else {
            // Seller sees only their own sales progress
            sql = `
                SELECT
                    u.id AS vendedor_id,
                    u.username AS vendedor_nombre,
                    COALESCE(g.sold_count, 0) AS sold_count
                FROM users u
                LEFT JOIN (
                    SELECT vendedor_id, COUNT(*) as sold_count
                    FROM leads
                    WHERE estado_vendedor = 'ATENDIDO'
                      AND date_trunc('month', fecha_actualizacion) = date_trunc('month', CURRENT_DATE)
                    GROUP BY vendedor_id
                ) g ON u.id = g.vendedor_id
                WHERE u.id = $1
            `;
            params.push(userId);
        }

        const [rows] = await query(sql, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching sellers goals:', error);
        res.status(500).json({ error: 'Failed to retrieve sellers goals' });
    }
};

module.exports = {
    listSellers,
    createSeller,
    deleteSeller,
    getSellersGoals
};
