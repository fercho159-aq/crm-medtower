require('dotenv').config();
const { query } = require('./config/db');
async function test() {
    try {
        const [rows] = await query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE conrelid = 'leads'::regclass");
        console.log("CONSTRAINTS:", rows);
        
        const [indexes] = await query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'leads'");
        console.log("INDEXES:", indexes);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
