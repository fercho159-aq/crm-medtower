const { query } = require('./config/db');

async function test() {
    try {
        await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS cover_image_url TEXT");
        console.log("Column cover_image_url added.");
        
        const res = await query(`
            INSERT INTO parrilla_cards (title, description, status, content_type, tags, funnel_stage, media_url, reference_url, publish_date, cover_image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, ['Test', 'Desc', 'Marca', 'TikTok', 'Edu', 'TOFU', null, null, null, null]);
        console.log("Insert success:", res[0]);
    } catch (e) {
        console.error("Insert failed:", e);
    }
    process.exit();
}

test();
