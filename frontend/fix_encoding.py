import re, sys

# Suppress stdout encoding issues
sys.stdout.reconfigure(encoding='utf-8')

filepath = r'D:\Xuzj\ky\Project\industrial_vision_behavior_windows\frontend\app\page.js'

with open(filepath, 'rb') as f:
    data = bytearray(f.read())

# Manual fixes for known non-CJK corrupted sequences
# These are 3-byte UTF-8 chars where the 3rd byte was replaced with 0x3F
MANUAL_FIXES = {
    # Arrow: → (U+2192) = E2 86 92
    (0xE2, 0x86): 0x92,
    # Black circle: ● (U+25CF) = E2 97 8F
    (0xE2, 0x97): 0x8F,
    # Fullwidth punctuation (context-dependent)
    # ！ (U+FF01) = EF BC 81
    # ？ (U+FF1F) = EF BC 9F
    # 。 (U+3002) = E3 80 82
    (0xE3, 0x80): 0x82,
    # Warning: ⚠ (U+26A0) = E2 9A A0
    (0xE2, 0x9A): 0xA0,
    # Em dash: — (U+2014) = E2 80 94
    (0xE2, 0x80): 0x94,
    # Checkmark: ✓ (U+2713) = E2 9C 93 or ✅ (U+2705) = E2 9C 85
    (0xE2, 0x9C): 0x85,
}

# Context-based manual fixes for specific positions
# Map: (position, expected_char_byte)
CONTEXT_FIXES = {
    # ！ (fullwidth exclamation) vs ？ (fullwidth question mark)
    # ef bc 81 = ！, ef bc 9f = ？
    # Position analysis from context:
    35478: 0x81,   # 头打开失败！→ ！
    38617: 0x82,   # ？→ should be ： but actually this is ：(ef bc 9a)
    38839: 0x82,   # ？
    38850: 0x82,   # ？
    63934: 0x82,   # 。
    64240: 0x82,   # 。
    67006: 0x82,   # 。
    97996: 0x81,   # ！
    98809: 0x81,   # ！
    100619: 0x82,  # 。
    109722: 0x9a,  # ：(U+FF1A) = EF BC 9A
    110073: 0x9a,  # ：
    110417: 0x9a,  # ：
    110420: 0x9a,  # ：
    136295: 0x81,  # ！
    138671: 0x81,  # ！
    142746: 0x9a,  # ：
    # ef bc 9a = ：
}

# For ef bc prefixed chars, determine correct byte from context
EF_BC_CONTEXT = {
    0x81: '！',  # fullwidth exclamation
    0x9a: '：',  # fullwidth colon  
    0x9f: '？',  # fullwidth question mark
    0x8c: '，',  # fullwidth comma
}

# Now process all corrupted positions
i = 0
fixes_applied = 0
while i < len(data) - 2:
    b1 = data[i]
    b2 = data[i+1]
    b3 = data[i+2]
    
    if (b1 & 0xE0) == 0xE0 and (b2 & 0xC0) == 0x80 and b3 == 0x3F:
        fixed = False
        
        # Check context fixes first
        if i in CONTEXT_FIXES:
            data[i+2] = CONTEXT_FIXES[i]
            fixes_applied += 1
            fixed = True
        # Check manual fixes
        elif (b1, b2) in MANUAL_FIXES:
            data[i+2] = MANUAL_FIXES[(b1, b2)]
            fixes_applied += 1
            fixed = True
        
        if not fixed:
            # Try CJK characters - find all valid candidates
            candidates = []
            for b3_candidate in range(0x80, 0xC0):
                try:
                    char = bytes([b1, b2, b3_candidate]).decode('utf-8')
                    cp = ord(char)
                    if (0x4E00 <= cp <= 0x9FFF or 
                        0x3400 <= cp <= 0x4DBF or 
                        0xF900 <= cp <= 0xFAFF or
                        0x3000 <= cp <= 0x303F or  # CJK Symbols
                        0xFF00 <= cp <= 0xFFEF):    # Fullwidth forms
                        candidates.append((b3_candidate, char, cp))
                except:
                    pass
            
            if len(candidates) == 1:
                data[i+2] = candidates[0][0]
                fixes_applied += 1
            elif len(candidates) > 1:
                # Use context to disambiguate
                # Get surrounding bytes and try to decode
                # Find the word boundaries
                best = None
                
                # Common Chinese word patterns
                CONTEXT_WORDS = {
                    # 控制台
                    '\u63a7\u5236': '\u53f0',
                    # 摄像头
                    '\u6444\u50cf': '\u5934',
                    # 状态
                    '\u72b6\u6001': None,
                    # 管理员
                    '\u7ba1\u7406': '\u5458',
                    # 操作员
                    '\u64cd\u4f5c': '\u5458',
                    # 登录
                    '\u767b\u5f55': None,
                    # 加载
                    '\u52a0\u8f7d': None,
                    # 服务
                    '\u670d\u52a1': None,
                    # 系统
                    '\u7cfb\u7edf': None,
                    # 模型
                    '\u6a21\u578b': None,
                    # 刷新
                    '\u5237\u65b0': None,
                    # 工作服
                    '\u5de5\u4f5c': '\u670d',
                    # 抽烟
                    '\u62bd': '\u70df',
                    # 睡眠
                    '\u7761': '\u7720',
                    # 视频
                    '\u89c6\u9891': None,
                    # 摄像
                    '\u6444\u50cf': '\u5934',
                    # 正常
                    '\u6b63\u5e38': None,
                    # 待处理
                    '\u5f85\u5904': '\u7406',
                    # 员工
                    '\u5458\u5de5': None,
                    # 处理
                    '\u5904\u7406': None,
                    # 已处理
                    '\u5df2\u5904': '\u7406',
                    # 待处理
                    '\u5f85\u5904': '\u7406',
                    # 告警
                    '\u544a\u8b66': None,
                    # 离线
                    '\u79bb\u7ebf': None,
                    # 在线
                    '\u5728\u7ebf': None,
                    # 管理
                    '\u7ba1\u7406': None,
                    # 筛选
                    '\u7b5b\u9009': None,
                    # 已加载
                    '\u5df2\u52a0': '\u8f7d',
                    # 未加载
                    '\u672a\u52a0': '\u8f7d',
                    # 加载中
                    '\u52a0\u8f7d': '\u4e2d',
                    # 违规
                    '\u8fdd\u89c4': None,
                    # 检测
                    '\u68c0\u6d4b': None,
                    # 摄像头
                    '\u50cf': '\u5934',
                    # 模型
                    '\u6a21': '\u578b',
                }
                
                # Get the 2-byte prefix before this position as the "previous char"
                # and try to match known patterns
                for b3_candidate, char, cp in candidates:
                    # Try to form known words with surrounding context
                    # Look at bytes before: try to get the char before
                    if i >= 3:
                        prev_char_bytes = data[i-3:i]
                        if (prev_char_bytes[0] & 0xE0) == 0xE0 and (prev_char_bytes[1] & 0xC0) == 0x80 and (prev_char_bytes[2] & 0xC0) == 0x80:
                            try:
                                prev_char = prev_char_bytes.decode('utf-8')
                                two_char = prev_char + char
                                # Check if this forms a known word
                                for prefix, expected_third in CONTEXT_WORDS.items():
                                    if two_char.startswith(prefix[:1]) or prev_char == prefix:
                                        if expected_third is None or char == expected_third:
                                            best = (b3_candidate, char)
                                            break
                            except:
                                pass
                    
                    if best:
                        break
                
                if not best and candidates:
                    # Fallback: use the most common character
                    # For ambiguous cases, pick the first candidate
                    # (we'll fix any remaining issues manually)
                    best = candidates[0]
                
                if best:
                    data[i+2] = best[0]
                    fixes_applied += 1
            else:
                # No candidates found - try fullwidth/symbol ranges
                pass
    
    i += 1

print(f"Applied {fixes_applied} fixes")

# Verify the result is valid UTF-8
try:
    text = data.decode('utf-8')
    print(f"File is now valid UTF-8! Length: {len(text)} chars")
    
    # Write the fixed file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print("File written successfully!")
    
except UnicodeDecodeError as e:
    print(f"Still has encoding issues at position {e.start}: {e.reason}")
    # Show the problematic bytes
    print(f"Bytes: {data[e.start-5:e.end+5].hex()}")
    # Show context
    try:
        context = data[max(0,e.start-30):e.end+30].decode('utf-8', errors='replace')
        print(f"Context: {context}")
    except:
        pass
