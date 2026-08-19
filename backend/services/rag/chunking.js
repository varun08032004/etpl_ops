'use strict';

const DEFAULT_CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE || '512', 10);
const DEFAULT_CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP || '50', 10);

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function splitByHeadings(text) {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections = [];
  let lastIndex = 0;
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    const headingLevel = match[1].length;
    const headingText = match[2].trim();
    const headingStart = match.index;

    if (headingStart > lastIndex) {
      const content = text.slice(lastIndex, headingStart).trim();
      if (content) {
        sections.push({ type: 'content', content, headingLevel: 0, heading: null });
      }
    }

    sections.push({ type: 'heading', content: headingText, headingLevel, heading: headingText });
    lastIndex = headingRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const content = text.slice(lastIndex).trim();
    if (content) {
      sections.push({ type: 'content', content, headingLevel: 0, heading: null });
    }
  }

  return sections;
}

function buildSectionPath(sections, currentIndex) {
  const path = [];
  for (let i = currentIndex; i >= 0; i--) {
    if (sections[i].type === 'heading') {
      path.unshift(sections[i].heading);
    }
  }
  return path.join(' → ') || 'General';
}

function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap || DEFAULT_CHUNK_OVERLAP;
  const preserveHeadings = options.preserveHeadings !== false;

  if (!text || !text.trim()) return [];

  const sections = preserveHeadings ? splitByHeadings(text) : [{ type: 'content', content: text, headingLevel: 0, heading: null }];

  const chunks = [];
  let currentChunk = '';
  let currentSectionPath = '';
  let chunkIndex = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (section.type === 'heading') {
      if (currentChunk.trim()) {
        const tokens = estimateTokens(currentChunk);
        if (tokens > chunkSize) {
          const splitChunks = splitLargeChunk(currentChunk, chunkSize, chunkOverlap, currentSectionPath, chunkIndex);
          chunks.push(...splitChunks);
          chunkIndex += splitChunks.length;
        } else {
          chunks.push({
            chunkIndex: chunkIndex++,
            section: currentSectionPath || 'General',
            content: currentChunk.trim(),
          });
        }
        currentChunk = '';
      }
      currentSectionPath = buildSectionPath(sections, i);
      continue;
    }

    const sectionContent = section.content;
    const combinedLength = estimateTokens(currentChunk + '\n\n' + sectionContent);

    if (combinedLength > chunkSize && currentChunk.trim()) {
      const tokens = estimateTokens(currentChunk);
      if (tokens > chunkSize) {
        const splitChunks = splitLargeChunk(currentChunk, chunkSize, chunkOverlap, currentSectionPath, chunkIndex);
        chunks.push(...splitChunks);
        chunkIndex += splitChunks.length;
      } else {
        chunks.push({
          chunkIndex: chunkIndex++,
          section: currentSectionPath || 'General',
          content: currentChunk.trim(),
        });
      }

      const overlapText = getOverlapText(currentChunk, chunkOverlap);
      currentChunk = overlapText + '\n\n' + sectionContent;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + sectionContent : sectionContent;
    }
  }

  if (currentChunk.trim()) {
    const tokens = estimateTokens(currentChunk);
    if (tokens > chunkSize) {
      const splitChunks = splitLargeChunk(currentChunk, chunkSize, chunkOverlap, currentSectionPath, chunkIndex);
      chunks.push(...splitChunks);
    } else {
      chunks.push({
        chunkIndex: chunkIndex++,
        section: currentSectionPath || 'General',
        content: currentChunk.trim(),
      });
    }
  }

  return chunks;
}

function splitLargeChunk(text, chunkSize, chunkOverlap, section, startIndex) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  let chunkIndex = startIndex;

  for (const sentence of sentences) {
    const testChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    if (estimateTokens(testChunk) > chunkSize && currentChunk) {
      chunks.push({
        chunkIndex: chunkIndex++,
        section,
        content: currentChunk.trim(),
      });
      currentChunk = getOverlapText(currentChunk, chunkOverlap) + ' ' + sentence;
    } else {
      currentChunk = testChunk;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      chunkIndex: chunkIndex++,
      section,
      content: currentChunk.trim(),
    });
  }

  return chunks;
}

function getOverlapText(text, overlapTokens) {
  const words = text.split(/\s+/);
  const overlapWords = Math.ceil(overlapTokens * 0.75);
  return words.slice(-overlapWords).join(' ');
}

function chunkMarkdown(markdown, options = {}) {
  return chunkText(markdown, { ...options, preserveHeadings: true });
}

function chunkPlainText(text, options = {}) {
  return chunkText(text, { ...options, preserveHeadings: false });
}

function chunkJson(jsonObject, options = {}) {
  const text = JSON.stringify(jsonObject, null, 2);
  return chunkText(text, { ...options, preserveHeadings: false });
}

module.exports = {
  chunkText,
  chunkMarkdown,
  chunkPlainText,
  chunkJson,
  estimateTokens,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
};