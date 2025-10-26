/**
 * 合成游戏相关路由
 */

export function registerCraftRoutes(fastify, { db, authenticateUser, craftNewElement, loadPresetsAndBaseElements }) {
    // 获取配置信息
    fastify.route({
        method: 'GET',
        url: '/config',
        handler: async (request, reply) => {
            const LANGUAGE_MODE = process.env.LANGUAGE_MODE || 'both';
            return {
                languageMode: LANGUAGE_MODE,
            };
        }
    });

    // 注册接口
    fastify.route({
        method: 'POST',
        url: '/register',
        handler: async (request, reply) => {
            const { username } = request.body;
            
            if (!username || username.trim().length < 2) {
                return reply.code(400).send({ error: '用户名至少需要2个字符' });
            }
            
            // 检查用户名是否已存在
            const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);
            if (existing) {
                return reply.code(400).send({ error: '用户名已存在' });
            }
            
            // 创建新用户
            const crypto = await import('crypto');
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let token = '';
            for (let i = 0; i < 6; i++) {
                const randomByte = crypto.randomBytes(1)[0];
                token += chars[randomByte % chars.length];
            }
            
            await db.run(
                'INSERT INTO users (username, token) VALUES (?, ?)',
                [username, token]
            );
            
            const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    token: user.token
                }
            };
        }
    });

    // 登录接口（使用token）
    fastify.route({
        method: 'POST',
        url: '/login',
        handler: async (request, reply) => {
            const { token } = request.body;
            
            if (!token) {
                return reply.code(400).send({ error: '请提供token' });
            }
            
            const user = await db.get('SELECT * FROM users WHERE token = ?', [token]);
            if (!user) {
                return reply.code(401).send({ error: 'token无效' });
            }
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    token: user.token
                }
            };
        }
    });

    // 获取基础元素列表
    fastify.route({
        method: 'GET',
        url: '/elements/base',
        handler: async (request, reply) => {
            const elements = await db.all('SELECT * FROM elements WHERE id LIKE "base_%"');
            return { elements };
        }
    });

    // 获取元素详情（包括首次发现配方）
    fastify.route({
        method: 'GET',
        url: '/elements/:id/details',
        handler: async (request, reply) => {
            const { id } = request.params;
            
            const element = await db.get('SELECT * FROM elements WHERE id = ?', [id]);
            if (!element) {
                return reply.code(404).send({ error: '元素不存在' });
            }
            
            // 获取首次发现配方
            const discovery = await db.get(`
                SELECT 
                    fd.*,
                    e1.word_cn as first_element_cn,
                    e1.word_en as first_element_en,
                    e1.emoji as first_element_emoji,
                    e2.word_cn as second_element_cn,
                    e2.word_en as second_element_en,
                    e2.emoji as second_element_emoji
                FROM first_discoveries fd
                LEFT JOIN elements e1 ON fd.first_element_id = e1.id
                LEFT JOIN elements e2 ON fd.second_element_id = e2.id
                WHERE fd.element_id = ?
            `, [id]);
            
            return {
                element,
                discovery: discovery || null
            };
        }
    });

    // 获取用户发现的所有元素
    fastify.route({
        method: 'GET',
        url: '/elements/discovered',
        handler: async (request, reply) => {
            const user = await authenticateUser(request, reply);
            if (!user) return;
            
            // 获取用户通过合成发现的所有元素
            const elements = await db.all(`
                SELECT DISTINCT e.* FROM elements e
                INNER JOIN craft_cache cc ON (e.id = cc.result_element_id)
                INNER JOIN users u ON u.id = ?
                WHERE cc.id IN (
                    SELECT cc2.id FROM craft_cache cc2
                    INNER JOIN elements e1 ON cc2.first_element_id = e1.id
                    INNER JOIN elements e2 ON cc2.second_element_id = e2.id
                )
            `, [user.id]);
            
            return { elements };
        }
    });

    // 合成元素接口
    fastify.route({
        method: 'POST',
        url: '/craft',
        handler: async (request, reply) => {
            const user = await authenticateUser(request, reply);
            if (!user) return;
            
            let { firstElementId, secondElementId } = request.body;
            
            if (!firstElementId || !secondElementId) {
                return reply.code(400).send({ error: '请提供两个元素ID' });
            }
            
            const CRAFT_ORDER_MATTERS = process.env.CRAFT_ORDER_MATTERS === 'false';
            
            // 如果顺序不重要，则按字典序排列
            if (!CRAFT_ORDER_MATTERS) {
                if (firstElementId > secondElementId) {
                    [firstElementId, secondElementId] = [secondElementId, firstElementId];
                }
            }
            
            // 获取元素信息
            const firstElement = await db.get('SELECT * FROM elements WHERE id = ?', [firstElementId]);
            const secondElement = await db.get('SELECT * FROM elements WHERE id = ?', [secondElementId]);
            
            if (!firstElement || !secondElement) {
                return reply.code(404).send({ error: '元素不存在' });
            }
            
            // 合成新元素
            const result = await craftNewElement(firstElement, secondElement, user);
            
            if (!result) {
                return reply.code(500).send({ error: '合成失败' });
            }
            
            return {
                success: true,
                element: result,
                isNew: result.discoverer_id === user.id && result.discovered_at // 判断是否为首次发现
            };
        }
    });

    // 管理接口：清除所有配方并重新加载预设
    fastify.route({
        method: 'POST',
        url: '/admin/reload',
        handler: async (request, reply) => {
            const ADMIN_KEY = process.env.ADMIN_KEY || '';
            const adminKey = request.headers.authorization?.replace('Bearer ', '');

            if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
                return reply.code(401).send({ error: '未经授权' });
            }

            try {
                console.log('🔄 [管理员] 正在清除旧数据...');
                // 1. 清除合成缓存
                await db.exec('DELETE FROM craft_cache');
                console.log('   - craft_cache 已清除');
                // 2. 清除非基础元素
                await db.exec("DELETE FROM elements WHERE id NOT LIKE 'base_%'");
                console.log('   - elements (非基础) 已清除');
                // 3. 清除首次发现记录
                await db.exec('DELETE FROM first_discoveries');
                console.log('   - first_discoveries 已清除');
                
                console.log('🔄 [管理员] 正在重新加载预设数据...');
                await loadPresetsAndBaseElements();
                
                return { success: true, message: '数据已清除并成功重新加载预设。' };
            } catch (error) {
                console.error('❌ [管理员] 操作失败:', error);
                return reply.code(500).send({ error: '操作失败', details: error.message });
            }
        }
    });
}

