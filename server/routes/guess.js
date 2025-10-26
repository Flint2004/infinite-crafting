/**
 * 猜百科游戏相关路由
 */

import { generateUniqueWord, fetchBaikeContent } from '../services/wordGenerator.js';

export function registerGuessRoutes(fastify, { db, authenticateUser, aiConfig }) {
    
    // 生成/获取题目
    fastify.route({
        method: 'GET',
        url: '/guess/:str',
        handler: async (request, reply) => {
            const user = await authenticateUser(request, reply);
            if (!user) return;
            
            const { str } = request.params;
            
            if (!str || str.trim().length === 0) {
                return reply.code(400).send({ error: '请提供有效的字符串' });
            }
            
            try {
                // 检查该字符串对应的题目是否已存在
                let question = await db.get(
                    'SELECT * FROM guess_questions WHERE seed_string = ?',
                    [str]
                );
                
                if (!question) {
                    // 检查是否为今天的日期格式 (YYYY-MM-DD)
                    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                    const isDateFormat = datePattern.test(str);
                    
                    // 获取今天的日期
                    const today = new Date();
                    const todayStr = today.getFullYear() + '-' + 
                                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                                     String(today.getDate()).padStart(2, '0');
                    
                    const isTodayDate = isDateFormat && str === todayStr;
                    
                    if (!isTodayDate) {
                        // 非今日日期的关键词需要预先生成
                        return reply.code(404).send({ 
                            error: '题目不存在', 
                            message: `该关键词的题目尚未生成。只有今日日期（${todayStr}）可以自动生成题目，其他关键词请联系管理员预先生成。` 
                        });
                    }
                    
                    // 今日日期可以自动生成新题目
                    console.log(`🎮 为今日日期 "${str}" 生成新题目...`);
                    
                    // 1. 生成词汇
                    const word = await generateUniqueWord(str, db, aiConfig);
                    
                    // 2. 获取百科内容
                    const { title, description } = await fetchBaikeContent(word);
                    
                    // 3. 存入数据库
                    await db.run(
                        `INSERT INTO guess_questions (seed_string, word, title, description, created_at) 
                         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [str, word, title, description]
                    );
                    
                    question = await db.get(
                        'SELECT * FROM guess_questions WHERE seed_string = ?',
                        [str]
                    );
                    
                    console.log(`✅ 题目生成成功: ${word}`);
                }
                
                // 获取用户对该题目的猜测记录
                const guesses = await db.all(
                    `SELECT character, position, content_position, is_in_title, created_at 
                     FROM guess_records 
                     WHERE user_id = ? AND question_id = ? 
                     ORDER BY created_at ASC`,
                    [user.id, question.id]
                );
                
                // 遮挡内容：除标点符号外全部替换为 ■
                const maskedTitle = question.title.replace(/[^\u3000-\u303F\uFF00-\uFFEF]/g, '■');
                const maskedDescription = question.description.replace(/[^\u3000-\u303F\uFF00-\uFFEF]/g, '■');
                
                // 检查用户是否已完成该题目
                const userCompleted = await db.get(
                    'SELECT * FROM guess_results WHERE user_id = ? AND question_id = ?',
                    [user.id, question.id]
                );
                
                // 获取排行榜（完成该题目的前10名）
                const leaderboard = await db.all(
                    `SELECT u.username, gr.guess_count, gr.completed_at 
                     FROM guess_results gr
                     JOIN users u ON gr.user_id = u.id
                     WHERE gr.question_id = ? 
                     ORDER BY gr.guess_count ASC, gr.completed_at ASC
                     LIMIT 10`,
                    [question.id]
                );
                
                // 只有完成的用户才能看到答案和原始内容
                const responseData = {
                    question: {
                        id: question.id,
                        seedString: question.seed_string,
                        title: maskedTitle,
                        description: maskedDescription,
                    },
                    guesses: guesses,
                    leaderboard: leaderboard,
                    isCompleted: !!userCompleted
                };
                
                // 只有完成的用户才返回答案
                if (userCompleted) {
                    responseData.question.word = question.word;
                    responseData.question.originalTitle = question.title;
                    responseData.question.originalDescription = question.description;
                }
                
                return responseData;
                
            } catch (error) {
                console.error('生成/获取题目失败:', error);
                return reply.code(500).send({ 
                    error: '生成题目失败', 
                    details: error.message 
                });
            }
        }
    });
    
    // 提交猜测（单个字符）
    fastify.route({
        method: 'POST',
        url: '/guess/:questionId/submit',
        handler: async (request, reply) => {
            const user = await authenticateUser(request, reply);
            if (!user) return;
            
            const { questionId } = request.params;
            const { character } = request.body;
            
            if (!character || character.length !== 1) {
                return reply.code(400).send({ error: '请提供单个汉字' });
            }
            
            try {
                // 获取题目
                const question = await db.get(
                    'SELECT * FROM guess_questions WHERE id = ?',
                    [questionId]
                );
                
                if (!question) {
                    return reply.code(404).send({ error: '题目不存在' });
                }
                
                // 检查是否已经猜过这个字
                const existing = await db.get(
                    'SELECT * FROM guess_records WHERE user_id = ? AND question_id = ? AND character = ?',
                    [user.id, questionId, character]
                );
                
                if (existing) {
                    return reply.code(400).send({ error: '该字符已经猜过了' });
                }
                
                // 检查字符是否在标题和内容中
                const titlePositions = [];
                const contentPositions = [];
                const isInTitle = question.title.includes(character);
                const isInContent = question.description.includes(character);
                
                if (isInTitle) {
                    // 找出标题中所有位置
                    for (let i = 0; i < question.title.length; i++) {
                        if (question.title[i] === character) {
                            titlePositions.push(i);
                        }
                    }
                }
                
                if (isInContent) {
                    // 找出内容中所有位置
                    for (let i = 0; i < question.description.length; i++) {
                        if (question.description[i] === character) {
                            contentPositions.push(i);
                        }
                    }
                }
                
                // 记录猜测（position存标题位置，content_position存内容位置）
                await db.run(
                    `INSERT INTO guess_records (user_id, question_id, character, is_in_title, position, content_position, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [user.id, questionId, character, isInTitle ? 1 : 0, titlePositions.join(','), contentPositions.join(',')]
                );
                
                // 检查是否完成（标题所有字符都猜对）
                const guessedChars = await db.all(
                    'SELECT DISTINCT character FROM guess_records WHERE user_id = ? AND question_id = ? AND is_in_title = 1',
                    [user.id, questionId]
                );
                
                const guessedSet = new Set(guessedChars.map(g => g.character));
                const titleChars = new Set(question.title.split('').filter(c => /[\u4e00-\u9fff]/.test(c)));
                
                const isCompleted = Array.from(titleChars).every(c => guessedSet.has(c));
                
                if (isCompleted) {
                    // 计算总猜测次数
                    const totalGuesses = await db.get(
                        'SELECT COUNT(*) as count FROM guess_records WHERE user_id = ? AND question_id = ?',
                        [user.id, questionId]
                    );
                    
                    // 检查是否已记录结果
                    const existingResult = await db.get(
                        'SELECT * FROM guess_results WHERE user_id = ? AND question_id = ?',
                        [user.id, questionId]
                    );
                    
                    if (!existingResult) {
                        await db.run(
                            `INSERT INTO guess_results (user_id, question_id, guess_count, completed_at) 
                             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                            [user.id, questionId, totalGuesses.count]
                        );
                    }
                }
                
                return {
                    success: true,
                    character: character,
                    isInTitle: isInTitle,
                    titlePositions: titlePositions,
                    isInContent: isInContent,
                    contentPositions: contentPositions,
                    isCompleted: isCompleted
                };
                
            } catch (error) {
                console.error('提交猜测失败:', error);
                return reply.code(500).send({ 
                    error: '提交失败', 
                    details: error.message 
                });
            }
        }
    });
    
    // 批量提交猜测（用于页面刷新时恢复状态）
    fastify.route({
        method: 'POST',
        url: '/guess/:questionId/batch-submit',
        handler: async (request, reply) => {
            const user = await authenticateUser(request, reply);
            if (!user) return;
            
            const { questionId } = request.params;
            const { characters } = request.body;
            
            if (!Array.isArray(characters) || characters.length === 0) {
                return reply.code(400).send({ error: '请提供字符数组' });
            }
            
            try {
                const question = await db.get(
                    'SELECT * FROM guess_questions WHERE id = ?',
                    [questionId]
                );
                
                if (!question) {
                    return reply.code(404).send({ error: '题目不存在' });
                }
                
                const results = [];
                
                for (const character of characters) {
                    if (character.length !== 1) continue;
                    
                    // 检查是否已经猜过
                    const existing = await db.get(
                        'SELECT * FROM guess_records WHERE user_id = ? AND question_id = ? AND character = ?',
                        [user.id, questionId, character]
                    );
                    
                    if (existing) {
                        results.push({
                            character: character,
                            isInTitle: existing.is_in_title === 1,
                            titlePositions: existing.position ? existing.position.split(',').map(Number) : [],
                            isInContent: existing.content_position && existing.content_position.length > 0,
                            contentPositions: existing.content_position ? existing.content_position.split(',').map(Number) : []
                        });
                        continue;
                    }
                    
                    // 新的猜测
                    const titlePositions = [];
                    const contentPositions = [];
                    const isInTitle = question.title.includes(character);
                    const isInContent = question.description.includes(character);
                    
                    if (isInTitle) {
                        for (let i = 0; i < question.title.length; i++) {
                            if (question.title[i] === character) {
                                titlePositions.push(i);
                            }
                        }
                    }
                    
                    if (isInContent) {
                        for (let i = 0; i < question.description.length; i++) {
                            if (question.description[i] === character) {
                                contentPositions.push(i);
                            }
                        }
                    }
                    
                    await db.run(
                        `INSERT INTO guess_records (user_id, question_id, character, is_in_title, position, content_position, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [user.id, questionId, character, isInTitle ? 1 : 0, titlePositions.join(','), contentPositions.join(',')]
                    );
                    
                    results.push({
                        character: character,
                        isInTitle: isInTitle,
                        titlePositions: titlePositions,
                        isInContent: isInContent,
                        contentPositions: contentPositions
                    });
                }
                
                return {
                    success: true,
                    results: results
                };
                
            } catch (error) {
                console.error('批量提交失败:', error);
                return reply.code(500).send({ 
                    error: '批量提交失败', 
                    details: error.message 
                });
            }
        }
    });
    
    // 获取用户的游戏历史
    fastify.route({
        method: 'GET',
        url: '/guess/history',
        handler: async (request, reply) => {
            const user = await authenticateUser(request, reply);
            if (!user) return;
            
            try {
                const history = await db.all(
                    `SELECT 
                        gq.id, gq.seed_string, 
                        CASE WHEN gr.guess_count IS NOT NULL THEN gq.word ELSE NULL END as word,
                        CASE WHEN gr.guess_count IS NOT NULL THEN gq.title ELSE NULL END as title,
                        gr.guess_count, gr.completed_at,
                        (SELECT COUNT(*) FROM guess_records WHERE user_id = ? AND question_id = gq.id) as attempts
                     FROM guess_questions gq
                     LEFT JOIN guess_results gr ON gq.id = gr.question_id AND gr.user_id = ?
                     WHERE gq.id IN (
                         SELECT DISTINCT question_id FROM guess_records WHERE user_id = ?
                     )
                     ORDER BY gr.completed_at DESC, gq.created_at DESC`,
                    [user.id, user.id, user.id]
                );
                
                return {
                    history: history
                };
                
            } catch (error) {
                console.error('获取历史失败:', error);
                return reply.code(500).send({ 
                    error: '获取历史失败', 
                    details: error.message 
                });
            }
        }
    });
    
    // 管理接口：预生成题目
    fastify.route({
        method: 'POST',
        url: '/admin/guess/generate',
        handler: async (request, reply) => {
            const ADMIN_KEY = process.env.ADMIN_KEY || '';
            const adminKey = request.headers.authorization?.replace('Bearer ', '');

            if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
                return reply.code(401).send({ error: '未经授权' });
            }

            const { seedString } = request.body;
            
            if (!seedString || seedString.trim().length === 0) {
                return reply.code(400).send({ error: '请提供种子字符串' });
            }
            
            try {
                // 检查是否已存在
                const existing = await db.get(
                    'SELECT * FROM guess_questions WHERE seed_string = ?',
                    [seedString]
                );
                
                if (existing) {
                    return reply.code(400).send({ 
                        error: '题目已存在', 
                        question: existing 
                    });
                }
                
                console.log(`🔧 [管理员] 为关键词 "${seedString}" 生成题目...`);
                
                // 1. 生成词汇
                const word = await generateUniqueWord(seedString, db, aiConfig);
                
                // 2. 获取百科内容
                const { title, description } = await fetchBaikeContent(word);
                
                // 3. 存入数据库
                await db.run(
                    `INSERT INTO guess_questions (seed_string, word, title, description, created_at) 
                     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [seedString, word, title, description]
                );
                
                const question = await db.get(
                    'SELECT * FROM guess_questions WHERE seed_string = ?',
                    [seedString]
                );
                
                console.log(`✅ [管理员] 题目生成成功: ${word}`);
                
                return {
                    success: true,
                    message: '题目生成成功',
                    question: question
                };
                
            } catch (error) {
                console.error('❌ [管理员] 生成题目失败:', error);
                return reply.code(500).send({ 
                    error: '生成题目失败', 
                    details: error.message 
                });
            }
        }
    });
    
    // 管理接口：批量生成题目
    fastify.route({
        method: 'POST',
        url: '/admin/guess/batch-generate',
        handler: async (request, reply) => {
            const ADMIN_KEY = process.env.ADMIN_KEY || '';
            const adminKey = request.headers.authorization?.replace('Bearer ', '');

            if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
                return reply.code(401).send({ error: '未经授权' });
            }

            const { seedStrings } = request.body;
            
            if (!Array.isArray(seedStrings) || seedStrings.length === 0) {
                return reply.code(400).send({ error: '请提供种子字符串数组' });
            }
            
            const results = {
                success: [],
                failed: [],
                skipped: []
            };
            
            for (const seedString of seedStrings) {
                try {
                    // 检查是否已存在
                    const existing = await db.get(
                        'SELECT * FROM guess_questions WHERE seed_string = ?',
                        [seedString]
                    );
                    
                    if (existing) {
                        results.skipped.push({
                            seedString,
                            reason: '题目已存在'
                        });
                        continue;
                    }
                    
                    console.log(`🔧 [管理员] 批量生成: "${seedString}"...`);
                    
                    // 生成词汇
                    const word = await generateUniqueWord(seedString, db, aiConfig);
                    
                    // 获取百科内容
                    const { title, description } = await fetchBaikeContent(word);
                    
                    // 存入数据库
                    await db.run(
                        `INSERT INTO guess_questions (seed_string, word, title, description, created_at) 
                         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [seedString, word, title, description]
                    );
                    
                    results.success.push({
                        seedString,
                        word,
                        title
                    });
                    
                    console.log(`✅ [管理员] "${seedString}" -> ${word}`);
                    
                } catch (error) {
                    console.error(`❌ [管理员] 生成失败 "${seedString}":`, error.message);
                    results.failed.push({
                        seedString,
                        error: error.message
                    });
                }
            }
            
            return {
                success: true,
                message: `批量生成完成：成功 ${results.success.length}，失败 ${results.failed.length}，跳过 ${results.skipped.length}`,
                results: results
            };
        }
    });
    
    // 管理接口：获取所有题目列表
    fastify.route({
        method: 'GET',
        url: '/admin/guess/questions',
        handler: async (request, reply) => {
            const ADMIN_KEY = process.env.ADMIN_KEY || '';
            const adminKey = request.headers.authorization?.replace('Bearer ', '');

            if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
                return reply.code(401).send({ error: '未经授权' });
            }
            
            try {
                const questions = await db.all(
                    `SELECT 
                        gq.*,
                        COUNT(DISTINCT gr.user_id) as player_count,
                        COUNT(DISTINCT grs.user_id) as completed_count
                     FROM guess_questions gq
                     LEFT JOIN guess_records gr ON gq.id = gr.question_id
                     LEFT JOIN guess_results grs ON gq.id = grs.question_id
                     GROUP BY gq.id
                     ORDER BY gq.created_at DESC`
                );
                
                return {
                    success: true,
                    count: questions.length,
                    questions: questions
                };
                
            } catch (error) {
                console.error('❌ [管理员] 获取题目列表失败:', error);
                return reply.code(500).send({ 
                    error: '获取题目列表失败', 
                    details: error.message 
                });
            }
        }
    });
}

