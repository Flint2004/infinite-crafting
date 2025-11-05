import Fastify from 'fastify'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from "url";
import path from "path";
import cors from '@fastify/cors'
import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';
import { registerCraftRoutes } from './routes/craft.js';
import { registerGuessRoutes } from './routes/guess.js';

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
            word_cn TEXT,
            word_en TEXT,
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
    
    // 猜百科游戏 - 题目表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS guess_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seed_string TEXT UNIQUE NOT NULL,
            word TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 猜百科游戏 - 用户猜测记录表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS guess_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            character TEXT NOT NULL,
            is_in_title INTEGER DEFAULT 0,
            position TEXT DEFAULT '',
            content_position TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (question_id) REFERENCES guess_questions(id),
            UNIQUE(user_id, question_id, character)
        )
    `);
    
    // 猜百科游戏 - 完成记录表（排行榜）
    await db.exec(`
        CREATE TABLE IF NOT EXISTS guess_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            guess_count INTEGER NOT NULL,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (question_id) REFERENCES guess_questions(id),
            UNIQUE(user_id, question_id)
        )
    `);
    
    // 用户出题授权表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS question_creators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            granted_by TEXT,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // 初始化基础五行元素 -  现在由 loadPresets 处理
}

// 默认基础元素（当presets.json不存在时使用）
const defaultBaseElements = [
    { id: 'base_metal', word_cn: '金', word_en: 'Metal', emoji: '⚙️' },
    { id: 'base_wood', word_cn: '木', word_en: 'Wood', emoji: '🌲' },
    { id: 'base_water', word_cn: '水', word_en: 'Water', emoji: '💧' },
    { id: 'base_fire', word_cn: '火', word_en: 'Fire', emoji: '🔥' },
    { id: 'base_earth', word_cn: '土', word_en: 'Earth', emoji: '🌍' }
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
                    'INSERT INTO elements (id, word_cn, word_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                    [element.id, element.word_cn, element.word_en, element.emoji, '系统']
                );
            }
        }
        
        // 加载配方
        if (presets.recipes && presets.recipes.length > 0) {
            for (const recipe of presets.recipes) {
                let resultElement = await db.get('SELECT * FROM elements WHERE word_cn = ?', [recipe.result.word_cn]);
                if (!resultElement) {
                    const newId = generateUniqueId();
                    await db.run(
                        'INSERT INTO elements (id, word_cn, word_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                        [newId, recipe.result.word_cn, recipe.result.word_en, recipe.result.emoji, '预设']
                    );
                    resultElement = await db.get('SELECT * FROM elements WHERE id = ?', [newId]);
                    console.log(`   - [元素] ${recipe.result.word_cn} (新)`);
                } else {
                    console.log(`   - [元素] ${recipe.result.word_cn} (已存在)`);
                }

                const firstElement = await db.get('SELECT * FROM elements WHERE word_cn = ?', [recipe.element1_cn]);
                const secondElement = await db.get('SELECT * FROM elements WHERE word_cn = ?', [recipe.element2_cn]);

                if (firstElement && secondElement && resultElement) {
                    if (recipe.is_few_shot) {
                        const e1 = LANGUAGE_MODE === 'en' ? firstElement.word_en : firstElement.word_cn;
                        const e2 = LANGUAGE_MODE === 'en' ? secondElement.word_en : secondElement.word_cn;
                        const both_e1 = ` (${firstElement.word_en})`;
                        const both_e2 = ` (${secondElement.word_en})`;

                        const input = `输入：\n${e1}${LANGUAGE_MODE === 'both' ? both_e1 : ''} + ${e2}${LANGUAGE_MODE === 'both' ? both_e2 : ''}`;

                        console.log(`   - [Few-shot] 添加示例: ${input}`);
                        
                        let output_template = { emoji: recipe.result.emoji };
                        if (LANGUAGE_MODE === 'both') {
                            output_template.word_cn = recipe.result.word_cn;
                            output_template.word_en = recipe.result.word_en;
                        } else if (LANGUAGE_MODE === 'cn') {
                            output_template.word = recipe.result.word_cn;
                        } else { // 'en'
                            output_template.word = recipe.result.word_en;
                        }

                        fewShotExamples.push({
                            input: input,
                            output: JSON.stringify(output_template)
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
                        console.log(`     - [配方] ${recipe.element1_cn} + ${recipe.element2_cn} -> ${recipe.result.word_cn} (新)`);
                    } else {
                        console.log(`     - [配方] ${recipe.element1_cn} + ${recipe.element2_cn} -> ${recipe.result.word_cn} (已存在)`);
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
                    'INSERT INTO elements (id, word_cn, word_en, emoji, discoverer_name) VALUES (?, ?, ?, ?, ?)',
                    [element.id, element.word_cn, element.word_en, element.emoji, '系统']
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

        console.log(`合成: ${firstElement.word_cn}(${firstElement.word_en}) + ${secondElement.word_cn}(${secondElement.word_en})`);
        
        const result = await generateElement(firstElement, secondElement);

        if (result) {
            const { word_cn, word_en, emoji } = result;
            let existing;

            // 根据语言模式，用不同方式检查元素是否存在
            if (LANGUAGE_MODE === 'cn' && word_cn) {
                existing = await db.get('SELECT * FROM elements WHERE word_cn = ?', [word_cn]);
            } else if (LANGUAGE_MODE === 'en' && word_en) {
                existing = await db.get('SELECT * FROM elements WHERE word_en = ?', [word_en]);
            } else if (word_cn && word_en) {
                existing = await db.get('SELECT * FROM elements WHERE word_cn = ? AND word_en = ?', [word_cn, word_en]);
            } else if (word_cn) {
                existing = await db.get('SELECT * FROM elements WHERE word_cn = ?', [word_cn]);
            } else if (word_en) {
                existing = await db.get('SELECT * FROM elements WHERE word_en = ?', [word_en]);
            }

            if (!existing && !word_cn && !word_en) {
                 console.error('AI未返回有效名称');
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
                    'INSERT INTO elements (id, word_cn, word_en, emoji, discoverer_id, discoverer_name) VALUES (?, ?, ?, ?, ?, ?)',
                    [elementId, word_cn, word_en, emoji, user.id, user.username]
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

        let properties = { "emoji": {"type": "string"} };
        if (LANGUAGE_MODE === 'both') {
            properties.word_cn = {"type": "string"};
            properties.word_en = {"type": "string"};
        } else {
            properties.word = {"type": "string"};
        }

    const grammar = new LlamaJsonSchemaGrammar({
        "type": "object",
            "properties": properties
        });
        
        const systemPrompt = '你是合成魔法师，可以根据想象生成任何物品。根据用户提示使用json返回物品名称和单个emoji';

        let prompt = `<s>[INST] ${systemPrompt} [/INST]</s>\n`;

        for (const example of fewShotExamples) {
            const { input, output } = example;
            const parsedOutput = JSON.parse(output);
            let newOutput = { emoji: parsedOutput.emoji };
            
            if (LANGUAGE_MODE === 'both') {
                newOutput.word_cn = parsedOutput.word_cn;
                newOutput.word_en = parsedOutput.word_en;
            } else {
                newOutput.word = parsedOutput.word;
            }
            
            const assistantOutput = JSON.stringify(newOutput);
            prompt += `<s>[INST] ${input} [/INST] ${assistantOutput} </s>\n`;
        }
        
        const e1 = LANGUAGE_MODE === 'en' ? firstElement.word_en : firstElement.word_cn;
        const e2 = LANGUAGE_MODE === 'en' ? secondElement.word_en : secondElement.word_cn;
        const both_e1 = ` (${firstElement.word_en})`;
        const both_e2 = ` (${secondElement.word_en})`;

        const currentUserInput = `输入：\n${e1}${LANGUAGE_MODE === 'both' ? both_e1 : ''} + ${e2}${LANGUAGE_MODE === 'both' ? both_e2 : ''}`;
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
        if (!parsed.word_cn && !parsed.word_en && !parsed.word) {
            return { word_cn: null, word_en: null, emoji: '' };
        }

        // 确保只有一个emoji
        let emoji = parsed.emoji || '⭐';
        // 只取第一个emoji字符
        const emojiMatch = emoji.match(/\p{Emoji}/u);
        if (emojiMatch) {
            emoji = emojiMatch[0];
        }

        let word_cn = parsed.word_cn;
        let word_en = parsed.word_en;

        if (LANGUAGE_MODE === 'cn') {
            word_cn = parsed.word;
        } else if (LANGUAGE_MODE === 'en') {
            word_en = parsed.word;
        }

        return {
            word_cn,
            word_en,
            emoji: emoji
        };
    }

    // 使用API生成元素
    async function generateElementAPI(firstElement, secondElement) {
        if (!SILICONFLOW_API_KEY) {
            throw new Error('SILICONFLOW_API_KEY 环境变量未设置');
        }

        let nameFields = [];
        if (LANGUAGE_MODE === 'both') {
            nameFields = ['`word_cn` (中文)', '`word_en` (英文)'];
        } else {
            nameFields = ['`word`'];
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
                newOutput.word_cn = parsedOutput.word_cn;
                newOutput.word_en = parsedOutput.word_en;
            } else {
                newOutput.word = parsedOutput.word;
            }
            const assistantOutput = JSON.stringify(newOutput);

            messages.push({ role: 'user', content: example.input });
            messages.push({ role: 'assistant', content: assistantOutput });
        }

        const e1 = LANGUAGE_MODE === 'en' ? firstElement.word_en : firstElement.word_cn;
        const e2 = LANGUAGE_MODE === 'en' ? secondElement.word_en : secondElement.word_cn;
        const both_e1 = ` (${firstElement.word_en})`;
        const both_e2 = ` (${secondElement.word_en})`;
        
        const userPrompt = `输入：\n${e1}${LANGUAGE_MODE === 'both' ? both_e1 : ''} + ${e2}${LANGUAGE_MODE === 'both' ? both_e2 : ''}`;
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
            if (!parsed.word_cn && !parsed.word_en && !parsed.word) {
                console.error('AI返回格式错误:', parsed);
                return { word_cn: null, word_en: null, emoji: '' };
            }
            
            // 确保只有一个emoji
            let emoji = parsed.emoji || '⭐';
            // 只取第一个emoji字符
            const emojiMatch = emoji.match(/\p{Emoji}/u);
            if (emojiMatch) {
                emoji = emojiMatch[0];
            }

            let word_cn = parsed.word_cn;
            let word_en = parsed.word_en;

            if (LANGUAGE_MODE === 'cn') {
                word_cn = parsed.word;
            } else if (LANGUAGE_MODE === 'en') {
                word_en = parsed.word;
            }

            return {
                word_cn,
                word_en,
                emoji: emoji
            };
        } catch (error) {
            console.error('调用硅基流动API失败:', error.response?.data || error.message);
            throw error;
        }
    }


    // 注册合成游戏路由
    registerCraftRoutes(fastify, { 
        db, 
        authenticateUser, 
        craftNewElement,
        loadPresetsAndBaseElements 
    });
    
    // 注册猜百科游戏路由
    const aiConfig = {
        mode: AI_MODE,
        apiUrl: SILICONFLOW_API_URL,
        apiKey: SILICONFLOW_API_KEY,
        model: MODEL_NAME
    };
    registerGuessRoutes(fastify, { 
        db, 
        authenticateUser,
        aiConfig 
    });

    const PORT = process.env.PORT || 3000;

    try {
        await fastify.listen({port: PORT, host: '0.0.0.0'})
        console.log(`✅ 服务器启动成功`)
        console.log(`   端口: ${PORT}`)
        console.log(`   AI模式: ${AI_MODE === 'local' ? '本地模型' : 'API调用'}`)
        console.log(`   语言模式: ${LANGUAGE_MODE}`)
        
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
