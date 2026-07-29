const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('c:/it-helpdesk/laporan/Laporan_TugasAkhir_bagasatria.4342211001.pdf');

function decodeTJString(s) {
  // Decode octal escapes and basic escapes
  return s.replace(/\\(\d{3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)))
           .replace(/\\n/g, ' ').replace(/\\r/g, ' ')
           .replace(/\\\\/g, '\\').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
}

function extractTextFromStream(streamText) {
  const lines = [];
  let inBT = false;
  const btBlocks = streamText.split(/\bBT\b/);
  
  for (let i = 1; i < btBlocks.length; i++) {
    const block = btBlocks[i].split(/\bET\b/)[0];
    const blockText = [];
    
    // Extract TJ arrays: [(text)num(text)...] TJ
    const tjArrRegex = /\[([^\]]*)\]\s*TJ/g;
    let m;
    while ((m = tjArrRegex.exec(block)) !== null) {
      const inner = m[1];
      const parts = [];
      const pRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let pm;
      while ((pm = pRegex.exec(inner)) !== null) {
        parts.push(decodeTJString(pm[1]));
      }
      const joined = parts.join('');
      if (joined.trim()) blockText.push(joined);
    }
    
    // Extract simple Tj: (text) Tj
    const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    while ((m = tjRegex.exec(block)) !== null) {
      const t = decodeTJString(m[1]);
      if (t.trim()) blockText.push(t);
    }
    
    if (blockText.length > 0) {
      lines.push(blockText.join(' '));
    }
  }
  return lines.join('\n');
}

// Process all streams
const allText = [];
let pos = 0;
let streamCount = 0;

while (pos < buf.length) {
  let streamStart = buf.indexOf('stream\r\n', pos);
  let markerLen = 8;
  if (streamStart === -1) {
    streamStart = buf.indexOf('stream\n', pos);
    markerLen = 7;
  }
  if (streamStart === -1) break;

  const contentStart = streamStart + markerLen;
  const streamEnd = buf.indexOf('endstream', contentStart);
  if (streamEnd === -1) break;

  const streamData = buf.slice(contentStart, streamEnd);
  
  try {
    const decompressed = zlib.inflateSync(streamData);
    const text = decompressed.toString('latin1');
    if (text.includes('BT') && text.includes('ET')) {
      const extracted = extractTextFromStream(text);
      if (extracted.trim()) {
        allText.push(extracted);
      }
    }
  } catch(e) {
    // Not compressed or different compression
    const text = streamData.toString('latin1');
    if (text.includes('BT') && text.includes('ET')) {
      const extracted = extractTextFromStream(text);
      if (extracted.trim()) {
        allText.push(extracted);
      }
    }
  }
  
  streamCount++;
  pos = streamEnd + 9;
}

const result = allText.join('\n\n--- PAGE BREAK ---\n\n');
fs.writeFileSync('c:/it-helpdesk/laporan/extracted_text.txt', result, 'utf8');
console.log('Streams processed:', streamCount);
console.log('Text pages extracted:', allText.length);
console.log('Total chars:', result.length);
console.log('\n=== PREVIEW (first 5000 chars) ===\n');
console.log(result.substring(0, 5000));
