const fs = require('fs');
const file = 'src/app/chat/chat-client.tsx';
let c = fs.readFileSync(file, 'utf8');

const target = "                   <button \n                     onClick={() => setChatSearchOpen(!chatSearchOpen)}";
const targetCRLF = "                   <button \r\n                     onClick={() => setChatSearchOpen(!chatSearchOpen)}";

const replacement = `                   {activeChat.profile.uid === 'edunook-ai' && (
                    <>
                      <button 
                        onClick={toggleCamera}
                        title={cameraActive ? 'Disable AI Vision' : 'Enable AI Vision'}
                        className={\`p-3 rounded-2xl border transition-all \${cameraActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30 animate-pulse' : 'bg-foreground/5 text-foreground/40 border-border hover:text-foreground'}\`}
                      >
                        {cameraActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      {cameraActive && (
                        <button 
                          onClick={flipCamera}
                          title="Switch Camera"
                          className="p-3 rounded-2xl border bg-foreground/5 text-foreground/40 border-border hover:text-foreground transition-all"
                        >
                          <SwitchCamera className="w-5 h-5" />
                        </button>
                      )}
                    </>
                   )}
                   <button 
                     onClick={() => setChatSearchOpen(!chatSearchOpen)}`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  console.log('Found LF target');
} else if (c.includes(targetCRLF)) {
  c = c.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
  console.log('Found CRLF target');
} else {
  // Try a more fuzzy match
  const fuzzy = /<button\s+onClick=\{\(\)\s+=>\s+setChatSearchOpen\(!chatSearchOpen\)\}/;
  if (fuzzy.test(c)) {
     console.log('Found fuzzy target');
     // Since fuzzy is hard to replace accurately with exact indentation, let's just use the view_file info
  }
  console.log('Target not found');
}

fs.writeFileSync(file, c);
