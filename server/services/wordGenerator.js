/**
 * 词汇生成服务
 * 根据字符串生成百科词汇
 */

import crypto from 'crypto';
import axios from 'axios';

/**
 * 将字符串转换为中文Unicode字符
 * @param {string} str - 输入字符串
 * @returns {string} 生成的中文字符
 */
function generateChineseFromHash(str) {
    // 计算 SHA256 哈希
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    
    // 中文Unicode范围: 0x4E00 - 0x9FFF (常用汉字)
    const MIN_CHINESE = 0x4E00;
    const MAX_CHINESE = 0x9FFF;
    const RANGE = MAX_CHINESE - MIN_CHINESE;
    
    let result = '';
    
    // 每4个字符转换为一个中文字符
    for (let i = 0; i < Math.min(hash.length, 16); i += 4) {
        const segment = hash.substring(i, i + 4);
        const num = parseInt(segment, 16);
        const chineseCode = MIN_CHINESE + (num % RANGE);
        result += String.fromCharCode(chineseCode);
    }
    
    return result;
}

/**
 * 使用LLM生成词汇
 * @param {string} seedString - 种子字符串
 * @param {Array<string>} excludeWords - 需要排除的词汇列表
 * @param {Object} aiConfig - AI配置对象
 * @returns {Promise<string>} 生成的词汇
 */
async function generateWordWithLLM(seedString, excludeWords = [], aiConfig) {
    const chineseChars = generateChineseFromHash(seedString);
    
    let excludePrompt = '';
    if (excludeWords.length > 0) {
        excludePrompt = `\n注意：以下词汇已被使用，请不要生成：${excludeWords.join('、')}`;
    }
    
    const systemPrompt = `你是一个百科词条生成器。你需要根据提供的汉字联想，生成一个真实存在的、在百度百科中可以找到的常见词汇或概念。
要求：
1. 生成的词汇必须是真实存在的、常见的词条
2. 必须是纯中文（2-6个字）
3. 尽可能与提供的汉字有某种联系（谐音、字形、意义相关等）
4. 只返回词汇本身，不要任何解释
5. 优先选择日常生活中常见的事物、概念或名词${excludePrompt}`;
    
    const userPrompt = `参考这些汉字：${chineseChars}\n请生成一个合适的百科词条（纯中文，2-6个字）：`;
    
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
    
    try {
        if (aiConfig.mode === 'api') {
            const response = await axios.post(
                aiConfig.apiUrl,
                {
                    model: aiConfig.model,
                    messages: messages,
                    temperature: 0.8,
                    max_tokens: 50
                },
                {
                    headers: {
                        'Authorization': `Bearer ${aiConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const content = response.data.choices[0].message.content.trim();
            // 提取纯中文
            const chineseMatch = content.match(/[\u4e00-\u9fff]+/);
            return chineseMatch ? chineseMatch[0] : content;
        } else {
            // 本地模式 - 这里需要根据实际的本地模型调用方式实现
            throw new Error('本地模式暂不支持词汇生成');
        }
    } catch (error) {
        console.error('LLM词汇生成失败:', error.message);
        throw error;
    }
}

/**
 * 生成词汇（带重试机制）
 * @param {string} seedString - 种子字符串
 * @param {Object} db - 数据库连接
 * @param {Object} aiConfig - AI配置
 * @returns {Promise<string>} 生成的唯一词汇
 */
export async function generateUniqueWord(seedString, db, aiConfig) {
    const maxRetries = 3;
    const excludeWords = [];
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const word = await generateWordWithLLM(seedString, excludeWords, aiConfig);
            
            // 检查数据库中是否已存在
            const existing = await db.get(
                'SELECT id FROM guess_questions WHERE word = ?',
                [word]
            );
            
            if (!existing) {
                console.log(`✅ 成功生成唯一词汇: ${word} (尝试 ${i + 1}/${maxRetries})`);
                return word;
            }
            
            console.log(`⚠️  词汇 "${word}" 已存在，重试... (${i + 1}/${maxRetries})`);
            excludeWords.push(word);
            
        } catch (error) {
            console.error(`第 ${i + 1} 次生成失败:`, error.message);
            if (i === maxRetries - 1) {
                throw new Error('生成词汇失败，已达到最大重试次数');
            }
        }
    }
    
    throw new Error('无法生成唯一词汇');
}

/**
 * 从 Minecraft Wiki 获取随机页面内容
 * @param {Object} db - 数据库连接
 * @returns {Promise<Object>} { title, description }
 */
async function fetchMinecraftWikiContent(db) {
    const maxRetries = 10;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // 访问随机页面，允许重定向
            const response = await axios.get('https://zh.minecraft.wiki/Special:%E9%9A%8F%E6%9C%BA%E9%A1%B5%E9%9D%A2/Minecraft', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                maxRedirects: 10,
                validateStatus: (status) => status >= 200 && status < 400
            });
            
            const html = response.data;
            
            // 提取页面标题
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            let title = titleMatch ? titleMatch[1].replace(/ - Minecraft Wiki.*$/, '').trim() : '';
            
            // 检查标题是否包含"教程"
            if (title.includes('教程')) {
                console.log(`⚠️  跳过包含"教程"的页面: ${title} (尝试 ${i + 1}/${maxRetries})`);
                continue;
            }
            
            // 检查数据库是否已存在
            const existing = await db.get(
                'SELECT id FROM guess_questions WHERE title = ?',
                [title]
            );
            
            if (existing) {
                console.log(`⚠️  页面已存在: ${title} (尝试 ${i + 1}/${maxRetries})`);
                continue;
            }
            
            // 提取第一段描述（<p>标签内容）
            const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            let description = '';
            
            if (paragraphMatch) {
                // 移除HTML标签
                description = paragraphMatch[1]
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // 限制长度
                if (description.length > 200) {
                    description = description.substring(0, 200) + '...';
                }
            }
            
            if (!title || !description) {
                console.log(`⚠️  页面信息不完整 (尝试 ${i + 1}/${maxRetries})`);
                continue;
            }
            
            console.log(`✅ 成功获取 Minecraft Wiki 内容: ${title}`);
            return {
                title: title,
                description: description
            };
            
        } catch (error) {
            console.error(`获取 Minecraft Wiki 失败 (尝试 ${i + 1}/${maxRetries}):`, error.message);
        }
    }
    
    throw new Error('无法从 Minecraft Wiki 获取合适的页面');
}

/**
 * 获取百度百科内容
 * @param {string} word - 词条
 * @returns {Promise<Object>} { title, description }
 */
export async function fetchBaikeContent(word) {
    try {
        const url = `https://baike.baidu.com/item/${encodeURIComponent(word)}`;
        
        // 发送请求，允许重定向
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        });
        
        const html = response.data;
        
        // 提取 og:description meta 标签
        const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/);
        const description = descMatch ? descMatch[1] : '';
        
        // 提取标题
        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
        const title = titleMatch ? titleMatch[1] : word;
        
        if (!description) {
            throw new Error('无法提取百科描述');
        }
        
        console.log(`✅ 成功获取百科内容: ${title}`);
        return {
            title: title,
            description: description
        };
        
    } catch (error) {
        console.error(`获取百科内容失败 (${word}):`, error.message);
        throw new Error(`无法获取词条"${word}"的百科内容`);
    }
}

/**
 * 获取内容（根据种子字符串判断使用哪个来源）
 * @param {string} seedString - 种子字符串
 * @param {string} word - 词条（普通百科使用）
 * @param {Object} db - 数据库连接
 * @returns {Promise<Object>} { title, description }
 */
export async function fetchContent(seedString, word, db) {
    // 如果以 mc- 开头，从 Minecraft Wiki 获取
    if (seedString.startsWith('mc-')) {
        return await fetchMinecraftWikiContent(db);
    } else {
        return await fetchBaikeContent(word);
    }
}

