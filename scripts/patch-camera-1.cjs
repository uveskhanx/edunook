const fs = require('fs');
const file = 'src/app/chat/chat-client.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Add icons to the import
c = c.replace(
  'MoreVertical, Info, ShieldCheck, Search, X, Trash2, Settings, MoreHorizontal, ShieldAlert',
  'MoreVertical, Info, ShieldCheck, Search, X, Trash2, Settings, MoreHorizontal, ShieldAlert, Eye, EyeOff, SwitchCamera'
);

// 2. Add camera state variables before typingTimeoutRef
const stateInsert = [
  '  const [cameraActive, setCameraActive] = useState(false);',
  "  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');",
  '  const cameraStreamRef = useRef<MediaStream | null>(null);',
  '  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);',
  '',
].join('\n');

c = c.replace(
  '  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);',
  stateInsert + '  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);'
);

fs.writeFileSync(file, c);
console.log('Step 1 done');
