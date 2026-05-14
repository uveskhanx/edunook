const fs = require('fs');
const file = 'src/app/chat/chat-client.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Add camera toggle button next to the search button (only for AI chat)
const searchButtonBlock = `<button 
                      onClick={() => setChatSearchOpen(!chatSearchOpen)}`;

const cameraButtonHtml = `{activeChat.profile.uid === 'edunook-ai' && (
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
                   `;

c = c.replace(searchButtonBlock, cameraButtonHtml + searchButtonBlock);

// 2. Add hidden video element + small live preview right after the opening of <main>
const mainTag = "main className={`flex-1 flex flex-col relative min-h-0 min-w-0 ${!activeChat ? 'hidden md:flex' : 'flex'}`}>";

const hiddenVideo = `main className={\`flex-1 flex flex-col relative min-h-0 min-w-0 \${!activeChat ? 'hidden md:flex' : 'flex'}\`}>
          {/* Hidden video element for camera capture */}
          <video ref={cameraVideoRef} playsInline muted autoPlay style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }} />
          {/* Mini camera preview */}
          {cameraActive && cameraStreamRef.current && (
            <div className="absolute top-20 right-4 z-50 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-2xl shadow-emerald-500/30" style={{ width: 120, height: 90 }}>
              <video 
                autoPlay playsInline muted 
                ref={(el) => { if (el && cameraStreamRef.current) el.srcObject = cameraStreamRef.current; }}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-300 font-bold">LIVE</span>
              </div>
            </div>
          )}`;

c = c.replace(mainTag, hiddenVideo);

fs.writeFileSync(file, c);
console.log('Step 3 done');
