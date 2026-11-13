const getInstagramFeed = async (req, res) => {
    try {
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        
        if (!token) {
            return res.json({ 
                success: false, 
                error: 'Token no configurado', 
                needsToken: true 
            });
        }

        let mediaUrl = '';
        
        // Determinar si es un token de Graph API (Empresarial) o de Basic Display (Legado)
        if (token.startsWith('EA')) {
            // Paso 1: Buscar la página de Facebook vinculada al IG
            const accountsRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account&access_token=${token}`);
            const accountsData = await accountsRes.json();
            
            if (accountsData.error) {
                console.error('Facebook API Error:', accountsData.error);
                return res.json({ success: false, error: accountsData.error.message, needsToken: true });
            }
            
            const page = accountsData.data?.find(p => p.instagram_business_account);
            if (!page) {
                return res.json({ 
                    success: false, 
                    error: 'Falta conectar tu página de FB o agregar el permiso pages_show_list al token.'
                });
            }
            
            const igAccountId = page.instagram_business_account.id;
            mediaUrl = `https://graph.facebook.com/v20.0/${igAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username&limit=12&access_token=${token}`;
        } else {
            mediaUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username&access_token=${token}&limit=12`;
        }

        const response = await fetch(mediaUrl);
        const data = await response.json();

        if (data.error) {
            console.error('Instagram API Error:', data.error);
            return res.json({ 
                success: false, 
                error: data.error.message || 'Token inválido o expirado',
                needsToken: true
            });
        }

        // Format data to a clean array
        const posts = (data.data || []).map(post => ({
            id: post.id,
            caption: post.caption || '',
            media_type: post.media_type,
            media_url: post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url,
            video_url: post.media_type === 'VIDEO' ? post.media_url : null,
            permalink: post.permalink,
            timestamp: post.timestamp,
            username: post.username
        }));

        res.json({ success: true, posts });
    } catch (error) {
        console.error('Error fetching Instagram feed:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor al conectar con Instagram' });
    }
};

module.exports = {
    getInstagramFeed
};
