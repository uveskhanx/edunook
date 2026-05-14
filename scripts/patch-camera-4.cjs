const fs = require('fs');
const file = 'src/app/chat/chat-client.tsx';
let c = fs.readFileSync(file, 'utf8');

const target = "        const txt = text.toLowerCase();\n        if (media?.type === 'image') state = 'Analyzing image...';\n        else if (txt.includes('search') || txt.includes('find') || txt.includes('look for')) state = 'Searching database...';\n        else if (txt.includes('calculate') || txt.includes('math') || txt.includes('solve')) state = 'Calculating...';";

const replacement = `        const txt = text.toLowerCase();
        
        // Auto-trigger camera for visual inquiries
        const visualKeywords = ['wear', 'wearing', 'look', 'see', 'look like', 'around', 'behind', 'holding', 'shirt', 'pant', 'clothes', 'environment', 'background', 'this'];
        const isVisualInquiry = visualKeywords.some(kw => txt.includes(kw));
        
        if (isVisualInquiry && !cameraActive) {
          await startCamera(cameraFacing);
          // Wait a tiny bit for the first frame
          await new Promise(r => setTimeout(r, 800));
        }

        if (media?.type === 'image') state = 'Analyzing image...';
        else if (txt.includes('search') || txt.includes('find') || txt.includes('look for')) state = 'Searching database...';
        else if (txt.includes('calculate') || txt.includes('math') || txt.includes('solve')) state = 'Calculating...';`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
} else {
  const targetCRLF = target.replace(/\n/g, '\r\n');
  if (c.includes(targetCRLF)) {
    c = c.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
  } else {
    // Try a more flexible match if needed, but the strings should match now.
    console.log('Target not found');
  }
}

fs.writeFileSync(file, c);
console.log('Done');
