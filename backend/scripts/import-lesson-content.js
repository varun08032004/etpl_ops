'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const LESSONS_DIR = path.join(__dirname, '..', '..', 'CARBON_ACADEMY_LESSONS');

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Starting lesson content import...');
    
    // Get all lessons from database
    const { rows: dbLessons } = await client.query(`
      SELECT l.id, l.code, l.title
      FROM training_lessons l
      JOIN training_modules m ON m.id = l.module_id
      JOIN training_courses c ON c.id = m.course_id
      WHERE c.programme_id = (SELECT id FROM training_programmes WHERE code = 'CA-2026')
      ORDER BY l.code
    `);
    
    console.log(`📚 Found ${dbLessons.length} lessons in database`);
    
    // Create lookup map
    const dbByCode = new Map();
    for (const lesson of dbLessons) {
      dbByCode.set(lesson.code, lesson);
    }
    
    // Get lesson files
    const lessonFiles = fs.readdirSync(LESSONS_DIR)
      .filter(f => f.endsWith('_Lessons.md'))
      .sort();
    
    console.log(`📁 Found ${lessonFiles.length} lesson markdown files`);
    
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Process each file ONE AT A TIME
    for (const file of fs.readdirSync(LESSONS_DIR).filter(f => f.endsWith('_Lessons.md')).sort()) {
      const filePath = path.join(LESSONS_DIR, file);
      console.log(`  📄 ${file}...`);
      
      // Read file line by line using readline
      await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: fs.createReadStream(path.join(LESSONS_DIR, file), { encoding: 'utf8' }),
          crlfDelay: Infinity
        });
        
        let currentLesson = null;
        let lessonContent = [];
        const lessonCodes = [];
        
        rl.on('line', (line) => {
          // Check for lesson code pattern
          const codeMatch = line.match(/\*\*Lesson Code:\*\*\s*(C?[\d.]+)/);
          if (codeMatch) {
            // Save previous lesson
            if (currentLesson !== null) {
              lessonCodes.push({
                code: currentLesson.code,
                content: currentLesson.content.join('\n')
              });
            }
            
            // Start new lesson
            const rawCode = codeMatch[1].trim();
            // Normalize: remove leading C, remove leading zeros from each segment
            // Markdown: C01.2.1 or 01.2.1 -> DB: 1.2.1
            let cleanCode = codeMatch[1].replace(/^C/, '').trim();
            cleanCode = cleanCode.split('.').map(seg => seg.replace(/^0+/, '') || '0').join('.');
            currentLesson = {
              code: cleanCode,
              content: [line]
            };
          } else if (currentLesson !== null) {
            currentLesson.content.push(line);
          }
        });
        
        rl.on('close', async () => {
          // Save last lesson
          if (currentLesson !== null) {
            lessonCodes.push({
              code: currentLesson.code,
              content: currentLesson.content.join('\n')
            });
          }
          
          console.log(`  📄 ${file}: ${lessonCodes.length} lessons`);
          
          for (const lesson of lessonCodes) {
            const dbLesson = dbByCode.get(lesson.code);
            
            if (!dbLesson) {
              console.log(`    ⚠️ Skip: ${lesson.code} (no DB match)`);
              continue;
            }
            
            try {
              // Store content with 'text' field for frontend compatibility
              const contentJson = JSON.stringify({
                text: lesson.content.trim(),
                format: 'markdown',
                version: '1.2'
              });
              
              await client.query(
                `UPDATE training_lessons SET content = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ text: lesson.content.trim(), format: 'markdown', version: '1.2' }), dbByCode.get(lesson.code).id]
              );
              console.log(`    ✅ ${lesson.code} (${dbByCode.get(lesson.code)?.title || 'unknown'})`);
            } catch (err) {
              console.error(`    ❌ ${lesson.code}: ${err.message}`);
            }
          }
          
          resolve();
        });
        
        rl.on('error', (err) => {
          console.error(`Error reading file: ${err.message}`);
          resolve();
        });
      });
      
      await new Promise(r => setTimeout(r, 100)); // Small delay between files
    }
    
    console.log('\n✅ Import complete!');
    
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));