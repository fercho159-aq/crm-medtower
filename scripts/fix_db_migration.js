const { query } = require('./config/db');

async function fix() {
  try {
    console.log('Altering tags column to TEXT...');
    await query('ALTER TABLE leads ALTER COLUMN tags TYPE TEXT');

    console.log('Adding seguimiento_24h_enviado column...');
    await query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS seguimiento_24h_enviado BOOLEAN DEFAULT FALSE');

    console.log('Marking all leads who ever received follow-up message...');
    const [updated] = await query(`
      UPDATE leads
      SET seguimiento_24h_enviado = TRUE,
          tags = CASE 
            WHEN tags IS NULL THEN 'SEGUIMIENTO_24H_ENVIADO'
            WHEN tags NOT LIKE '%SEGUIMIENTO_24H_ENVIADO%' THEN tags || ', SEGUIMIENTO_24H_ENVIADO'
            ELSE tags
          END
      WHERE id IN (
        SELECT DISTINCT lead_id FROM mensajes WHERE texto LIKE '%dar seguimiento a tu consulta sobre crédito%'
      )
      RETURNING id, telefono
    `);
    console.log('Successfully marked', updated.length, 'leads as already sent!');
  } catch (err) {
    console.error('Error fixing DB:', err);
  } finally {
    process.exit(0);
  }
}

fix();
