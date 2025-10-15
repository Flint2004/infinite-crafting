import Fastify from 'fastify'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from "url";
import path from "path";
import cors from '@fastify/cors'
import crypto from 'crypto';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;
let llamaModel = null;
let llamaContext = null;

// AI模式配置
const AI_MODE = process.env.AI_MODE || 'api'; // 'local' 或 'api'

// API模式配置
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_API_URL = process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL_NAME = process.env.AI_MODEL || 'deepseek-ai/DeepSeek-V3.2-Exp';

// 本地模型配置
const LOCAL_MODEL_PATH = process.env.LOCAL_MODEL_PATH || path.join(__dirname, "models", "mistral-7b-instruct-v0.1.Q8_0.gguf");
const HF_ENDPOINT = process.env.HF_ENDPOINT || 'https://hf-mirror.com';

// 通用AI配置
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '200');

// 合成配置
// CRAFT_ORDER_MATTERS=true 表示顺序重要，A+B和B+A会产生不同结果
// 未设置或设为其他值 (如 'false') 表示顺序不重要，A+B和B+A统一按字典序排列（默认）
const CRAFT_ORDER_MATTERS = process.env.CRAFT_ORDER_MATTERS === 'false';

// 设置HuggingFace镜像
if (HF_ENDPOINT && AI_MODE === 'local') {
    process.env.HF_ENDPOINT = HF_ENDPOINT;
}

// 生成唯一ID
function generateUniqueId() {
    return crypto.randomBytes(16).toString('hex');
}

// 生成token（6位字符）
function generateToken() {
    // 生成6位大写字母和数字的token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
        const randomByte = crypto.randomBytes(1)[0];
        token += chars[randomByte % chars.length];
    }
    return token;
}

async function initializeDatabase() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'cache.db');
    
    // 确保数据目录存在
    const dbDir = path.dirname(dbPath);
    if (!await import('fs').then(fs => fs.promises.access(dbDir).then(() => true).catch(() => false))) {
        await import('fs').then(fs => fs.promises.mkdir(dbDir, { recursive: true }));
    }
    
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    // 用户表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 元素表（新结构）
    await db.exec(`
        CREATE TABLE IF NOT EXISTS elements (
            id TEXT PRIMARY KEY,
            name_cn TEXT NOT NULL,
            name_en TEXT NOT NULL,
            emoji TEXT NOT NULL,
            discoverer_id INTEGER,
            discoverer_name TEXT,
            discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (discoverer_id) REFERENCES users(id)
        )
    `);
    
    // 合成缓存表（新结构）
    await db.exec(`
        CREATE TABLE IF NOT EXISTS craft_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_element_id TEXT NOT NULL,
            second_element_id TEXT NOT NULL,
            result_element_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (first_element_id) REFERENCES elements(id),
            FOREIGN KEY (second_element_id) REFERENCES elements(id),
            FOREIGN KEY (result_element_id) REFERENCES elements(id)
        )
    `);
    
    // 首次发现配方记录表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS first_discoveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            element_id TEXT NOT NULL,
            first_element_id TEXT NOT NULL,
            second_element_id TEXT NOT NULL,
            discoverer_id INTEGER NOT NULL,
            discoverer_name TEXT NOT NULL,
            discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES elements(id),
            FOREIGN KEY (first_element_id) REFERENCES elements(id),
            FOREIGN KEY (second_element_id) REFERENCES elements(id),
            FOREIGN KEY (discoverer_id) REFERENCES users(id),
            UNIQUE(element_id)
        )
    `);
    
    // 初始化基础五行元素
    const baseElements = [
        { id: 'base_metal', name_cn: '金', name_en: 'Metal', emoji: '⚙️' },
        { id: 'base_wood', name_cn: '木', name_en: 'Wood', emoji: '🌲' },
        { id: 'base_water', name_cn: '水', name_en: 'Water', emoji: '💧' },
        { id: 'base_fire', name_cn: '火', name_en: 'Fire', emoji: '🔥' },
        { id: 'base_earth', name_cn: '土', name_en: 'Earth', emoji: '🌍' }
    ];
    
    for (const element of baseElements) {
        const exists = await db.get('SELECT id FROM elements WHERE id = ?', [element.id]);
        if (!exists) {
            await db.run(
                'INSERT INTO elements (id, name_cn, name_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                [element.id, element.name_cn, element.name_en, element.emoji, '系统']
            );
        }
    }
}

// 初始化本地模型
async function initializeLocalModel() {
    if (AI_MODE !== 'local') {
        return;
    }
    
    try {
        console.log('🔄 正在加载本地模型...');
        console.log(`   模型路径: ${LOCAL_MODEL_PATH}`);
        console.log(`   HF镜像: ${HF_ENDPOINT}`);
        
        // 动态导入node-llama-cpp（只在本地模式才需要）
        const { LlamaModel, LlamaContext } = await import('node-llama-cpp');
        
        llamaModel = new LlamaModel({
            modelPath: LOCAL_MODEL_PATH,
        });
        
        llamaContext = new LlamaContext({
            model: llamaModel,
            seed: 0
        });
        
        console.log('✅ 本地模型加载成功');
    } catch (error) {
        console.error('❌ 本地模型加载失败:', error.message);
        console.error('   请确保：');
        console.error('   1. 已安装 node-llama-cpp: npm install node-llama-cpp');
        console.error('   2. 模型文件存在于:', LOCAL_MODEL_PATH);
        console.error('   3. 或切换到API模式: AI_MODE=api');
        process.exit(1);
    }
}

initializeDatabase();

// 如果是本地模式，初始化模型
if (AI_MODE === 'local') {
    await initializeLocalModel();
}

const fastify = Fastify({
    logger: true,
    requestTimeout: AI_MODE === 'local' ? 120 * 1000 : 60 * 1000 // 本地模型需要更长时间
})
await fastify.register(cors, {
    origin: true,
    credentials: true
})

// 用户认证中间件
async function authenticateUser(request, reply) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        reply.code(401).send({ error: '未提供认证token' });
        return null;
    }
    
    const user = await db.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) {
        reply.code(401).send({ error: '无效的token' });
        return null;
    }
    
    return user;
}

// 从缓存查找合成结果
async function craftFromCache(firstElementId, secondElementId) {
    let cached = await db.get(
        'SELECT result_element_id FROM craft_cache WHERE (first_element_id = ? AND second_element_id = ?) OR (first_element_id = ? AND second_element_id = ?)',
        [firstElementId, secondElementId, secondElementId, firstElementId]
    );
    
    if (cached) {
        const element = await db.get('SELECT * FROM elements WHERE id = ?', [cached.result_element_id]);
        return element;
    }
    
    return null;
}

// 保存合成缓存
async function saveCraftCache(firstElementId, secondElementId, resultElementId) {
    await db.run(
        'INSERT INTO craft_cache (first_element_id, second_element_id, result_element_id) VALUES (?, ?, ?)',
        [firstElementId, secondElementId, resultElementId]
    );
}

// 合成新元素
async function craftNewElement(firstElement, secondElement, user) {
    // 检查缓存
    const cached = await craftFromCache(firstElement.id, secondElement.id);
    if (cached) {
        return cached;
    }

    console.log(`合成: ${firstElement.name_cn}(${firstElement.name_en}) + ${secondElement.name_cn}(${secondElement.name_en})`);
    
    const result = await generateElement(firstElement, secondElement);

    if (result.name_cn && result.name_en) {
        // 检查元素是否已存在（基于中文名和英文名）
        const existing = await db.get(
            'SELECT * FROM elements WHERE name_cn = ? AND name_en = ?',
            [result.name_cn, result.name_en]
        );
        
        let elementId;
        let newElement;
        
        if (existing) {
            // 元素已存在，使用现有的
            elementId = existing.id;
            newElement = existing;
        } else {
            // 新元素，记录发现者
            elementId = generateUniqueId();
            await db.run(
                'INSERT INTO elements (id, name_cn, name_en, emoji, discoverer_id, discoverer_name) VALUES (?, ?, ?, ?, ?, ?)',
                [elementId, result.name_cn, result.name_en, result.emoji, user.id, user.username]
            );
            newElement = await db.get('SELECT * FROM elements WHERE id = ?', [elementId]);
            
            // 记录首次发现配方
            try {
                await db.run(
                    'INSERT INTO first_discoveries (element_id, first_element_id, second_element_id, discoverer_id, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                    [elementId, firstElement.id, secondElement.id, user.id, user.username]
                );
            } catch (err) {
                // 忽略重复记录错误
                console.log('首次发现配方已存在');
            }
        }
        
        // 保存合成缓存
        await saveCraftCache(firstElement.id, secondElement.id, elementId);
        
        return newElement;
    }
    
    return null;
}

// 生成新元素（支持本地模型和API两种模式）
async function generateElement(firstElement, secondElement) {
    if (AI_MODE === 'local') {
        return await generateElementLocal(firstElement, secondElement);
    } else {
        return await generateElementAPI(firstElement, secondElement);
    }
}

// 使用本地模型生成元素
async function generateElementLocal(firstElement, secondElement) {
    if (!llamaModel || !llamaContext) {
        throw new Error('本地模型未初始化');
    }
    
    const { LlamaChatSession, LlamaJsonSchemaGrammar } = await import('node-llama-cpp');
    const session = new LlamaChatSession({context: llamaContext});
    
    const grammar = new LlamaJsonSchemaGrammar({
        "type": "object",
        "properties": {
            "name_cn": {"type": "string"},
            "name_en": {"type": "string"}
        }
    });
    
    const systemPrompt = 
        '你是一个帮助人们通过组合两个元素来创造新事物的助手。' +
        '规则：' +
        '1. 答案必须是一个名词。' +
        '2. 答案必须与两个元素都相关，可以是组合产物、相互作用的结果、或者包含关系。' +
        '3. 如果一个元素是另一个元素的组成部分或更小的单位，可以返回更大的那个元素（例如：木+森林=森林，水滴+海洋=海洋）。' +
        '4. 如果两个元素组合没有明显的新事物，可以返回其中一个元素作为结果。' +
        '5. 尽量避免在答案中同时包含两个原始元素的名称。' +
        '请用中文回答名词（name_cn字段），并用英文提供翻译（name_en字段）。';

    const answerPrompt = '请告诉我如果组合"' + firstElement.name_cn + '"（' + firstElement.name_en + '）和"' + secondElement.name_cn + '"（' + secondElement.name_en + '）会产生什么？';

    const prompt = '<s>[INST] ' + systemPrompt + answerPrompt + '[/INST]</s>\n';

    const result = await session.prompt(prompt, {
        grammar,
        maxTokens: AI_MAX_TOKENS
    });

    const parsed = JSON.parse(result);
    
    // 验证结果
    if (!parsed.name_cn || !parsed.name_en) {
        return { name_cn: null, name_en: null, emoji: '' };
    }

    // 生成emoji（必须为一个）
    const emojiGrammar = new LlamaJsonSchemaGrammar({
        "type": "object",
        "properties": {
            "emoji": {"type": "string"}
        }
    });
    
    const emojiPrompt = '<s>[INST] 请为"' + parsed.name_cn + '"这个词选择一个最合适的emoji表情符号。要求：必须只返回一个emoji字符，不要返回多个。[/INST]</s>\n';
    
    const emojiResult = await session.prompt(emojiPrompt, {
        grammar: emojiGrammar,
        maxTokens: 50
    });
    
    const emojiParsed = JSON.parse(emojiResult);
    
    // 确保只有一个emoji
    let emoji = emojiParsed.emoji || '⭐';
    // 只取第一个emoji字符
    const emojiMatch = emoji.match(/\p{Emoji}/u);
    if (emojiMatch) {
        emoji = emojiMatch[0];
    }

    return {
        name_cn: parsed.name_cn,
        name_en: parsed.name_en,
        emoji: emoji
    };
}

// 使用API生成元素
async function generateElementAPI(firstElement, secondElement) {
    if (!SILICONFLOW_API_KEY) {
        throw new Error('SILICONFLOW_API_KEY 环境变量未设置');
    }

    const systemPrompt = 
        '你是一个帮助人们通过组合两个元素来创造新事物的助手。' +
        '规则：' +
        '1. 答案必须是一个名词，可以是：物体、材料、人物、公司、动物、职业、食物、地点、物品、情感、事件、概念、自然现象、身体部位、交通工具、运动、服装、家具、科技、建筑、乐器、饮料、植物、学科、中文梗等。' +
        '2. 答案必须与两个元素都相关，可以是组合产物、相互作用的结果、或者包含关系，尽可能和原来的元素不同。' +
        '3. 必要时可以产生其中一个元素（例如：木+森林=森林，水+海洋=海洋）。' +
        '4. emoji字段必须只包含一个emoji字符，不要返回多个emoji。' +
        '5. 尽量避免在答案中同时包含两个原始元素的名称。' +
        '请严格按照JSON格式回答，包含name_cn（中文名）、name_en（英文翻译）和emoji（一个emoji字符）三个字段。' +
        '示例格式：{"name_cn": "蒸汽", "name_en": "Steam", "emoji": "💨"}';

    const userPrompt = '请告诉我如果组合"' + firstElement.name_cn + '"（' + firstElement.name_en + '）和"' + secondElement.name_cn + '"（' + secondElement.name_en + '）会产生什么？直接返回JSON格式的答案，emoji必须只有一个字符。';

    try {
        const response = await axios.post(
            SILICONFLOW_API_URL,
            {
                model: MODEL_NAME,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: AI_TEMPERATURE,
                max_tokens: AI_MAX_TOKENS,
                response_format: { type: 'json_object' }
            },
            {
                headers: {
                    'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;
        const parsed = JSON.parse(content);
        
        // 验证结果
        if (!parsed.name_cn || !parsed.name_en) {
            console.error('AI返回格式错误:', parsed);
            return { name_cn: null, name_en: null, emoji: '' };
        }
        
        // 确保只有一个emoji
        let emoji = parsed.emoji || '⭐';
        // 只取第一个emoji字符
        const emojiMatch = emoji.match(/\p{Emoji}/u);
        if (emojiMatch) {
            emoji = emojiMatch[0];
        }

        return {
            name_cn: parsed.name_cn,
            name_en: parsed.name_en,
            emoji: emoji
        };
    } catch (error) {
        console.error('调用硅基流动API失败:', error.response?.data || error.message);
        throw error;
    }
}


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
        const token = generateToken();
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
                e1.name_cn as first_element_cn,
                e1.name_en as first_element_en,
                e1.emoji as first_element_emoji,
                e2.name_cn as second_element_cn,
                e2.name_en as second_element_en,
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

const PORT = process.env.PORT || 3000;

try {
    await fastify.listen({port: PORT, host: '0.0.0.0'})
    console.log(`✅ 服务器启动成功`)
    console.log(`   端口: ${PORT}`)
    console.log(`   AI模式: ${AI_MODE === 'local' ? '本地模型' : 'API调用'}`)
    
    if (AI_MODE === 'local') {
        console.log(`   模型路径: ${LOCAL_MODEL_PATH}`)
        console.log(`   HF镜像: ${HF_ENDPOINT}`)
    } else {
        console.log(`   AI模型: ${MODEL_NAME}`)
        console.log(`   API地址: ${SILICONFLOW_API_URL}`)
        if (!SILICONFLOW_API_KEY) {
            console.warn('⚠️  警告: SILICONFLOW_API_KEY 未设置，合成功能将无法使用！')
        } else {
            console.log(`   API Key: ${SILICONFLOW_API_KEY.substring(0, 10)}...`)
        }
    }
} catch (err) {
    fastify.log.error(err)
    process.exit(1)
}
