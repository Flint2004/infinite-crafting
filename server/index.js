import Fastify from 'fastify'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from "url";
import path from "path";
import cors from '@fastify/cors'
import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';

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

// 预设路径
const PRESETS_PATH = process.env.PRESETS_PATH || path.join(__dirname, 'data', 'presets.json');
const PROMPT_RULES_PATH = process.env.PROMPT_RULES_PATH || path.join(__dirname, 'data', 'prompt_rules.txt');

// 管理员密钥
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// 全局系统提示词
let fewShotExamples = [];

// 合成配置
// CRAFT_ORDER_MATTERS=true 表示顺序重要，A+B和B+A会产生不同结果
// 未设置或设为其他值 (如 'false') 表示顺序不重要，A+B和B+A统一按字典序排列（默认）
const CRAFT_ORDER_MATTERS = process.env.CRAFT_ORDER_MATTERS === 'false';
const LANGUAGE_MODE = process.env.LANGUAGE_MODE || 'both'; // 'both', 'cn', 'en'

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
    
    // 初始化基础五行元素 -  现在由 loadPresets 处理
}

// 默认基础元素（当presets.json不存在时使用）
const defaultBaseElements = [
    { id: 'base_metal', name_cn: '金', name_en: 'Metal', emoji: '⚙️' },
    { id: 'base_wood', name_cn: '木', name_en: 'Wood', emoji: '🌲' },
    { id: 'base_water', name_cn: '水', name_en: 'Water', emoji: '💧' },
    { id: 'base_fire', name_cn: '火', name_en: 'Fire', emoji: '🔥' },
    { id: 'base_earth', name_cn: '土', name_en: 'Earth', emoji: '🌍' }
];

// 加载预设合成表及基础元素
async function loadPresetsAndBaseElements() {
    let baseElementsToLoad = [];
    let presetsLoaded = false;

    // 1. 尝试从 presets.json 加载
    try {
        await fs.access(PRESETS_PATH);
        console.log(`🔄 正在加载预设文件: ${PRESETS_PATH}`);
        const presetsFile = await fs.readFile(PRESETS_PATH, 'utf8');
        const presets = JSON.parse(presetsFile);
        presetsLoaded = true;

        if (presets.base_elements && presets.base_elements.length > 0) {
            console.log('   - 发现自定义基础元素');
            baseElementsToLoad = presets.base_elements;
        } else {
            console.log('   - 未发现自定义基础元素，使用默认配置');
            baseElementsToLoad = defaultBaseElements;
        }
        
        // 加载元素
        for (const element of baseElementsToLoad) {
            const exists = await db.get('SELECT id FROM elements WHERE id = ?', [element.id]);
            if (!exists) {
                await db.run(
                    'INSERT INTO elements (id, name_cn, name_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                    [element.id, element.name_cn, element.name_en, element.emoji, '系统']
                );
            }
        }
        
        // 加载配方
        if (presets.recipes && presets.recipes.length > 0) {
            for (const recipe of presets.recipes) {
                let resultElement = await db.get('SELECT * FROM elements WHERE name_cn = ?', [recipe.result.name_cn]);
                if (!resultElement) {
                    const newId = generateUniqueId();
                    await db.run(
                        'INSERT INTO elements (id, name_cn, name_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                        [newId, recipe.result.name_cn, recipe.result.name_en, recipe.result.emoji, '预设']
                    );
                    resultElement = await db.get('SELECT * FROM elements WHERE id = ?', [newId]);
                    console.log(`   - [元素] ${recipe.result.name_cn} (新)`);
                } else {
                    console.log(`   - [元素] ${recipe.result.name_cn} (已存在)`);
                }

                const firstElement = await db.get('SELECT * FROM elements WHERE name_cn = ?', [recipe.element1_cn]);
                const secondElement = await db.get('SELECT * FROM elements WHERE name_cn = ?', [recipe.element2_cn]);

                if (firstElement && secondElement && resultElement) {
                    if (recipe.is_few_shot) {
                        const input = `输入：\n${firstElement.name_cn} (${firstElement.name_en}) + ${secondElement.name_cn} (${secondElement.name_en})`;
                        console.log(`   - [Few-shot] 添加示例: ${input}`);
                        fewShotExamples.push({
                            input: input,
                            output: JSON.stringify({
                                name_cn: recipe.result.name_cn,
                                name_en: recipe.result.name_en,
                                emoji: recipe.result.emoji
                            })
                        });
                    }
                    const existingCraft = await db.get(
                        'SELECT id FROM craft_cache WHERE (first_element_id = ? AND second_element_id = ?) OR (first_element_id = ? AND second_element_id = ?)',
                        [firstElement.id, secondElement.id, secondElement.id, firstElement.id]
                    );

                    if (!existingCraft) {
                        await db.run(
                            'INSERT INTO craft_cache (first_element_id, second_element_id, result_element_id) VALUES (?, ?, ?)',
                            [firstElement.id, secondElement.id, resultElement.id]
                        );
                        console.log(`     - [配方] ${recipe.element1_cn} + ${recipe.element2_cn} -> ${recipe.result.name_cn} (新)`);
                    } else {
                        console.log(`     - [配方] ${recipe.element1_cn} + ${recipe.element2_cn} -> ${recipe.result.name_cn} (已存在)`);
                    }
                } else {
                    console.warn(`   - [警告] 配方 "${recipe.element1_cn} + ${recipe.element2_cn}" 中的一个或多个元素不存在，跳过。`);
                }
            }
        }
        console.log('✅ 预设文件加载完成');

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`ℹ️  未找到预设文件，使用默认基础元素。路径: ${PRESETS_PATH}`);
            baseElementsToLoad = defaultBaseElements;
        } else {
            console.error('❌ 加载预设文件失败，将使用默认基础元素:', error);
            baseElementsToLoad = defaultBaseElements;
        }
    }

    // 2. 如果预设文件加载失败，确保默认基础元素被加载
    if (!presetsLoaded) {
        for (const element of baseElementsToLoad) {
            const exists = await db.get('SELECT id FROM elements WHERE id = ?', [element.id]);
            if (!exists) {
                await db.run(
                    'INSERT INTO elements (id, name_cn, name_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                    [element.id, element.name_cn, element.name_en, element.emoji, '系统']
                );
            }
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

async function startServer() {
    // 1. 初始化数据库（仅建表）
    await initializeDatabase();
    
    // 2. 加载基础元素和预设
    await loadPresetsAndBaseElements();
    
    // 3. 如果是本地模式，初始化模型
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

        if (result) {
            const { name_cn, name_en, emoji } = result;
            let existing;

            // 根据语言模式，用不同方式检查元素是否存在
            if (LANGUAGE_MODE === 'cn' && name_cn) {
                existing = await db.get('SELECT * FROM elements WHERE name_cn = ?', [name_cn]);
            } else if (LANGUAGE_MODE === 'en' && name_en) {
                existing = await db.get('SELECT * FROM elements WHERE name_en = ?', [name_en]);
            } else if (LANGUAGE_MODE === 'both' && name_cn && name_en) {
                existing = await db.get('SELECT * FROM elements WHERE name_cn = ? AND name_en = ?', [name_cn, name_en]);
            } else if (!name_cn && !name_en) {
                // 如果AI没有返回任何名称，则合成失败
                return null;
            }
            
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
                    [elementId, name_cn || '', name_en || '', emoji, user.id, user.username]
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
        
        const properties = {};
        if (LANGUAGE_MODE === 'both') {
            properties.name_cn = { "type": "string" };
            properties.name_en = { "type": "string" };
        } else {
            properties.name = { "type": "string" };
        }
        
        const grammar = new LlamaJsonSchemaGrammar({
            "type": "object",
            "properties": {
                ...properties,
                "emoji": {"type": "string"}
            }
        });
        
        const nameFields = [];
        if (LANGUAGE_MODE === 'both') {
            nameFields.push("`name_cn` (中文名)和`name_en` (英文名)");
        } else {
            nameFields.push("`name`");
        }
        const systemPrompt = `你是合成魔法师，可以根据想象生成任何物品。根据用户提示使用json返回一个包含 ${nameFields.join('和')} 以及一个 \`emoji\` 字段的对象。`;

        let prompt = `<s>[INST] ${systemPrompt} [/INST]</s>\n`;

        for (const example of fewShotExamples) {
            const { input, output } = example;
            const parsedOutput = JSON.parse(output);
            let newOutput = { emoji: parsedOutput.emoji };
            
            if (LANGUAGE_MODE === 'both') {
                newOutput.name_cn = parsedOutput.name_cn;
                newOutput.name_en = parsedOutput.name_en;
            } else if (LANGUAGE_MODE === 'cn') {
                newOutput.name = parsedOutput.name_cn;
            } else if (LANGUAGE_MODE === 'en') {
                newOutput.name = parsedOutput.name_en;
            }
            
            const assistantOutput = JSON.stringify(newOutput);
            prompt += `<s>[INST] ${input} [/INST] ${assistantOutput} </s>\n`;
        }
        
        let currentUserInput;
        if (LANGUAGE_MODE === 'both') {
            currentUserInput = `输入：\n${firstElement.name_cn} (${firstElement.name_en}) + ${secondElement.name_cn} (${secondElement.name_en})`;
        } else {
            const input1 = LANGUAGE_MODE === 'en' ? firstElement.name_en : firstElement.name_cn;
            const input2 = LANGUAGE_MODE === 'en' ? secondElement.name_en : secondElement.name_cn;
            currentUserInput = `输入：\n${input1} + ${input2}`;
        }
        prompt += `<s>[INST] ${currentUserInput} [/INST]`;

        const startTime = Date.now();
        const result = await session.prompt(prompt, {
            grammar,
            maxTokens: AI_MAX_TOKENS
        });
        const duration = Date.now() - startTime;
        console.log(`[LLM Local] Name generation took ${duration}ms`);

        const parsed = JSON.parse(result);
        
        // 验证结果
        if (!parsed.name_cn && !parsed.name_en && !parsed.name) {
            return { name_cn: null, name_en: null, emoji: '' };
        }

        // 确保只有一个emoji
        let emoji = parsed.emoji || '⭐';
        // 只取第一个emoji字符
        const emojiMatch = emoji.match(/\p{Emoji}/u);
        if (emojiMatch) {
            emoji = emojiMatch[0];
        }

        let name_cn = parsed.name_cn;
        let name_en = parsed.name_en;

        if (LANGUAGE_MODE === 'cn') {
            name_cn = parsed.name;
        } else if (LANGUAGE_MODE === 'en') {
            name_en = parsed.name;
        }

        return {
            name_cn,
            name_en,
            emoji: emoji
        };
    }

    // 使用API生成元素
    async function generateElementAPI(firstElement, secondElement) {
        if (!SILICONFLOW_API_KEY) {
            throw new Error('SILICONFLOW_API_KEY 环境变量未设置');
        }

        const nameFields = [];
        if (LANGUAGE_MODE === 'both') {
            nameFields.push("`name_cn` (中文名)、`name_en` (英文名)");
        } else {
            nameFields.push("`name`");
        }
        const systemPrompt = `你是合成魔法师，可以根据想象生成任何物品。根据用户提示使用json返回一个包含 ${nameFields.join('和')} 以及一个 \`emoji\` 字段的对象。`;


        const messages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];

        for (const example of fewShotExamples) {
            const parsedOutput = JSON.parse(example.output);
            let newOutput = { emoji: parsedOutput.emoji };

            if (LANGUAGE_MODE === 'both') {
                newOutput.name_cn = parsedOutput.name_cn;
                newOutput.name_en = parsedOutput.name_en;
            } else if (LANGUAGE_MODE === 'cn') {
                newOutput.name = parsedOutput.name_cn;
            } else if (LANGUAGE_MODE === 'en') {
                newOutput.name = parsedOutput.name_en;
            }
            const assistantOutput = JSON.stringify(newOutput);

            messages.push({ role: 'user', content: example.input });
            messages.push({ role: 'assistant', content: assistantOutput });
        }
        
        let userPrompt;
        if (LANGUAGE_MODE === 'both') {
            userPrompt = `输入：\n${firstElement.name_cn} (${firstElement.name_en}) + ${secondElement.name_cn} (${secondElement.name_en})`;
        } else {
            const input1 = LANGUAGE_MODE === 'en' ? firstElement.name_en : firstElement.name_cn;
            const input2 = LANGUAGE_MODE === 'en' ? secondElement.name_en : secondElement.name_cn;
            userPrompt = `输入：\n${input1} + ${input2}`;
        }
        messages.push({ role: 'user', content: userPrompt });

        try {
            const startTime = Date.now();
            const response = await axios.post(
                SILICONFLOW_API_URL,
                {
                    model: MODEL_NAME,
                    messages: messages,
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
            const duration = Date.now() - startTime;

            const usage = response.data.usage;
            console.log(`[LLM API] Request took ${duration}ms. Tokens: ${usage.total_tokens} (Prompt: ${usage.prompt_tokens}, Completion: ${usage.completion_tokens})`);

            const content = response.data.choices[0].message.content;
            const parsed = JSON.parse(content);
            
            // 验证结果
            if (!parsed.name_cn && !parsed.name_en && !parsed.name) {
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

            let name_cn = parsed.name_cn;
            let name_en = parsed.name_en;

            if (LANGUAGE_MODE === 'cn') {
                name_cn = parsed.name;
            } else if (LANGUAGE_MODE === 'en') {
                name_en = parsed.name;
            }

            return {
                name_cn,
                name_en,
                emoji: emoji
            };
        } catch (error) {
            console.error('调用硅基流动API失败:', error.response?.data || error.message);
            throw error;
        }
    }


    // 获取配置信息
    fastify.route({
        method: 'GET',
        url: '/config',
        handler: async (request, reply) => {
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

    // 管理接口：清除所有配方并重新加载预设
    fastify.route({
        method: 'POST',
        url: '/admin/reload',
        handler: async (request, reply) => {
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
}

startServer();
