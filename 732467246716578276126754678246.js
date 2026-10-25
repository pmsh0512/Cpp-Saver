(function () {
  'use strict';

  /* =========================================================
   *  配置与常量
   * ========================================================= */
  const SUPABASE_URL      = 'https://cgsgoomfeamjxmawbuxn.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_oC2B_fBatS0f2dVAgcxoGw_LnXRH8N1'.trim();
  const EMAIL_DOMAIN = 'cpplib.local';
  const CLOUD = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
  let sb = null;
  let cloudUser = null;

  if (CLOUD) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const $ = (s) => document.querySelector(s);
  const KEY = 'cpp-templates-v13';
  const SETTINGS_KEY = 'cpp-templates-settings-v1';
  const OLD_KEYS = ['cpp-templates-v12','cpp-templates-v11','cpp-templates-v10','cpp-templates-v9','cpp-templates-v8','cpp-templates-v7','cpp-templates-v6','cpp-templates-v5','cpp-templates-v4','cpp-templates-v3','cpp-templates-v2','code-templates-v1'];
  const MAX_HIGHLIGHT = 400 * 1024;
  const INDENT_UNIT = '    ';

  const FONTS = {
    system: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
    yahei:  '"Microsoft YaHei","PingFang SC",sans-serif',
    serif:  'Georgia,"Times New Roman","Songti SC","SimSun",serif',
    kai:    '"Kaiti SC","STKaiti",KaiTi,"楷体",serif',
    mono:   'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace'
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function formatSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }
  function sanitizeFilename(name) {
    let s = String(name || 'template').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
    s = s.replace(/\s+/g, ' ');
    return s || 'template';
  }
  function bindTabIndent(ta) {
    ta.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + INDENT_UNIT + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + INDENT_UNIT.length;
      ta.dispatchEvent(new Event('input'));
    });
  }

  /* =========================================================
   *  C++ 语法高亮 & Markdown 渲染
   * ========================================================= */
  const CPP_KEYWORDS = new Set(('alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq').split(' '));
  const CPP_TYPES = new Set(('std string vector map set unordered_map unordered_set multiset multimap pair queue deque stack priority_queue array bitset tuple complex size_t ptrdiff_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t ll ull INF MOD eps INT_MAX INT_MIN LLONG_MAX LLONG_MIN').split(' '));
  
  const CPP_RE = new RegExp(
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)' +
    '|(^[ \\t]*#[ \\t]*[A-Za-z_]+)' +
    '|("(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')' +
    '|(\\b(?:0[xX][0-9a-fA-F]+|\\d+\\.?\\d*(?:[eE][+-]?\\d+)?)[uUlLfF]*\\b)' +
    '|([A-Za-z_]\\w*)', 'gm'
  );

  function highlightCpp(code) {
    if (!code) return '';
    let out = '', last = 0, m;
    CPP_RE.lastIndex = 0;
    while ((m = CPP_RE.exec(code)) !== null) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      if (m[1])      out += '<span class="c-com">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="c-pre">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="c-str">' + esc(m[3]) + '</span>';
      else if (m[4]) out += '<span class="c-num">' + esc(m[4]) + '</span>';
      else {
        const w = m[5];
        let j = CPP_RE.lastIndex;
        while (j < code.length && (code[j] === ' ' || code[j] === '\t')) j++;
        if (CPP_KEYWORDS.has(w))   out += '<span class="c-kw">' + esc(w) + '</span>';
        else if (CPP_TYPES.has(w)) out += '<span class="c-ty">' + esc(w) + '</span>';
        else if (code[j] === '(')  out += '<span class="c-fn">' + esc(w) + '</span>';
        else                       out += esc(w);
      }
      last = CPP_RE.lastIndex;
    }
    out += esc(code.slice(last));
    return out;
  }

  const CPP_LANGS = ['cpp','c++','c','cc','cxx','h','hpp','hxx','ipp','ino','cp'];

  function renderCodeBlock(code, lang) {
    const lc = (lang || '').toLowerCase();
    const isCpp = CPP_LANGS.indexOf(lc) !== -1;
    const body = (isCpp && code.length <= MAX_HIGHLIGHT) ? highlightCpp(code) : esc(code);
    return '<div class="code-block"><div class="code-head"><span class="code-lang">' + esc(lang || 'text') + '</span><button class="copy-code" type="button" data-code="' + encodeURIComponent(code) + '">复制</button></div><pre class="code-body"><code>' + body + '</code></pre></div>';
  }

  function renderTextBox(content, lang) {
    const label = String(lang == null ? '' : lang).trim() || 'text';
    const lc = label.toLowerCase();
    const isCpp = CPP_LANGS.indexOf(lc) !== -1;
    const body = (isCpp && content.length <= MAX_HIGHLIGHT) ? highlightCpp(content) : esc(content);
    return '<div class="code-block text-box"><div class="code-head"><span class="code-lang">' + esc(label) + '</span><button class="copy-code" type="button" data-code="' + encodeURIComponent(content) + '">复制</button></div><pre class="code-body"><code>' + body + '</code></pre></div>';
  }

  function renderMiniCodeInline(code) {
    const body = (code.length <= MAX_HIGHLIGHT) ? highlightCpp(code) : esc(code);
    return '<span class="mini-code-inline"><code>' + body + '</code></span>';
  }

  function mdInline(text) {
    const inlineBlocks = [];
    let raw = String(text).replace(/``([^`]+)``/g, (_, p1) => {
      inlineBlocks.push(p1);
      return '\u0000' + (inlineBlocks.length - 1) + '\u0000';
    });
    let s = esc(raw);
    const inlineCodes = [];
    s = s.replace(/`([^`]+)`/g, (_, p1) => {
      inlineCodes.push(p1);
      return '\u0001' + (inlineCodes.length - 1) + '\u0001';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => '<code class="md-code">' + inlineCodes[Number(i)] + '</code>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => renderMiniCodeInline(inlineBlocks[Number(i)]));
    return s;
  }

  function splitTableRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|'))   s = s.slice(0, -1);
    return s.split('|').map((x) => x.trim());
  }

  function renderTable(headerLine, alignLine, rows) {
    const headers = splitTableRow(headerLine);
    const aligns = splitTableRow(alignLine).map((a) => {
      a = a.trim();
      const l = a.startsWith(':'), r = a.endsWith(':');
      if (l && r) return 'center';
      if (r) return 'right';
      return 'left';
    });
    let html = '<div class="table-wrap"><table><thead><tr>';
    headers.forEach((h, idx) => { html += '<th style="text-align:' + (aligns[idx] || 'left') + '">' + mdInline(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
      const cells = splitTableRow(row);
      html += '<tr>';
      headers.forEach((_, idx) => { html += '<td style="text-align:' + (aligns[idx] || 'left') + '">' + mdInline(cells[idx] || '') + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderMarkdown(md) {
    const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\s*(`{3,}|~{3,})\s*(.*)$/);
      if (fence) {
        const marker = fence[1][0];
        const lang = (fence[2] || '').trim().split(/\s+/)[0];
        const buf = [];
        i++;
        const closeRe = new RegExp('^\\s*' + marker + '{3,}\\s*$');
        while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push(renderCodeBlock(buf.join('\n'), lang));
        continue;
      }
      if (/^\s*``(?!`)/.test(line)) {
        const trimmed = line.trim();
        const single = trimmed.match(/^``([\s\S]*?)``\s*$/);
        if (single && single[1].indexOf('``') === -1) { out.push(renderTextBox(single[1], 'text')); i++; continue; }
        const open = trimmed.match(/^``\s*([^\s`]*)\s*$/);
        if (open) {
          const lang = open[1] || 'text';
          const buf = [];
          i++;
          while (i < lines.length && !/^\s*``\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
          i++;
          out.push(renderTextBox(buf.join('\n'), lang));
          continue;
        }
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        const headerLine = line; const alignLine  = lines[i + 1]; i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        out.push(renderTable(headerLine, alignLine, rows));
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { out.push('<h' + Math.min(h[1].length, 4) + '>' + mdInline(h[2]) + '</h' + Math.min(h[1].length, 4) + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + renderMarkdown(buf.join('\n')) + '</blockquote>');
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
        out.push('<ul>' + buf.map((t) => '<li>' + mdInline(t) + '</li>').join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        out.push('<ol>' + buf.map((t) => '<li>' + mdInline(t) + '</li>').join('') + '</ol>');
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(`{3,}|~{3,})/.test(lines[i]) && !/^\s*``(?!`)/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) && !/^\s*\|.*\|\s*$/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      out.push('<p>' + buf.map(mdInline).join('<br>') + '</p>');
    }
    return out.join('');
  }

  /* =========================================================
   *  状态与 DOM
   * ========================================================= */
  const els = {
    list: $('#list'), search: $('#search'), count: $('#count'), empty: $('#empty'),
    viewer: $('#viewer'), viewTitle: $('#view-title'), viewTitleInput: $('#view-title-input'), viewMeta: $('#view-meta'),
    contentScroll: $('#content-scroll'), descView: $('#desc-view'), codeEmbed: $('#code-embed'),
    descEditor: $('#desc-editor'), descEditName: $('#desc-edit-name'), descMdInput: $('#desc-md-input'), descPreview: $('#desc-preview'), descPreviewHint: $('#desc-preview-hint'),
    editor: $('#editor'), editName: $('#edit-name'), editCode: $('#edit-code'), hlLayer: $('#hl-layer'), hlCode: $('#hl-code'), lineNumbers: $('#line-numbers'),
    fileInput: $('#file-input'), toast: $('#toast'), settingsPanel: $('#settings-panel'),
    exportModal: $('#export-modal'), exportList: $('#export-list'), chkAll: $('#chk-all'), selCount: $('#sel-count'), totalCount: $('#total-count'),
    groupModal: $('#group-modal'), groupModalTitle: $('#group-modal-title'), groupNameInput: $('#group-name-input'), groupKwInput: $('#group-kw-input')
  };

  let templates = [], groups = [], currentId = null, editingId = null, descEditingId = null;
  let toastTimer = null, exportSet = new Set(), titleCancelling = false;
  let settings = { font: 'system', size: 14 };
  let groupPicker = null, editingGroupId = undefined, pendingParentId = null;
  let pushTimer = null, pushing = false, pendingPush = false;

  // 提示词定义
  const MSG_DOWNLOAD = [
    '正在同服务器建立链接…',
    '正在验证链接…',
    '正在获取数据…',
    '正在验证用户凭证…',
    '正在下载数据…'
  ];
  const MSG_UPLOAD = [
    '正在同服务器建立链接…',
    '正在整理数据…',
    '正在计算链接…',
    '正在验证用户凭证…',
    '正在上传数据…'
  ];

  function current() { return templates.find((t) => t.id === currentId) || null; }

  /* =========================================================
   *  云端与账号相关逻辑
   * ========================================================= */
  function usernameToEmail(u) { return u.trim().toLowerCase() + '@' + EMAIL_DOMAIN; }
  function emailToUsername(e) { return String(e || '').replace('@' + EMAIL_DOMAIN, ''); }

  function setUser(user) {
    cloudUser = user || null;
    const st  = $('#acc-status'), lo  = $('#btn-login'), out = $('#btn-logout');
    if (!CLOUD) { st.textContent = '云端未配置'; st.classList.remove('online'); lo.hidden = true; out.hidden = true; return; }
    if (user) {
      st.textContent = emailToUsername(user.email); st.title = user.email; st.classList.add('online'); lo.hidden = true; out.hidden = false;
    } else {
      st.textContent = '未登录'; st.classList.remove('online'); lo.hidden = false; out.hidden = true;
    }
  }

  function openAuthModal() {
    if (!CLOUD) { toast('请在代码里填入 SUPABASE_URL 与 ANON KEY'); return; }
    $('#auth-hint').textContent = '首次使用请先点「注册」，注册成功会自动登录。';
    $('#auth-pass').value = '';
    $('#auth-modal').hidden = false;
    setTimeout(() => $('#auth-user').focus(), 30);
  }

  function translateAuthError(msg) {
    const m = String(msg || '');
    if (/Invalid login credentials/i.test(m)) return '账号或密码错误';
    if (/User already registered/i.test(m)) return '账号已存在，请直接登录';
    if (/Email not confirmed/i.test(m)) return '请到 Supabase 后台关闭「Confirm email」';
    if (/Password should be at least/i.test(m)) return '密码太短（至少 6 位）';
    if (/Unable to validate email/i.test(m)) return '账号格式不支持，请用字母数字下划线';
    if (/Failed to fetch|NetworkError/i.test(m)) return '网络异常，请检查网络或稍后再试';
    return m;
  }

  async function doAuth(mode) {
    if (!CLOUD) { toast('云端未配置'); return; }
    const u = $('#auth-user').value.trim(), p = $('#auth-pass').value, hint = $('#auth-hint');
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(u)) { hint.textContent = '账号需为 2-32 位字母、数字、_ 或 -'; return; }
    if (p.length < 6) { hint.textContent = '密码至少 6 位'; return; }

    const email = usernameToEmail(u);
    let success = false, lastError = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      hint.textContent = MSG_UPLOAD[attempt - 1];
      try {
        if (mode === 'register') {
          const { error } = await sb.auth.signUp({ email, password: p });
          if (error) throw error;
          const { error: e2 } = await sb.auth.signInWithPassword({ email, password: p });
          if (e2) { hint.textContent = '注册成功，请手动登录。'; return; }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password: p });
          if (error) throw error;
        }
        success = true; lastError = null; break;
      } catch (e) {
        lastError = e;
        if (lastError.message && lastError.message.includes('Invalid login credentials')) break; 
        if (attempt < 5) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (success) {
      $('#auth-modal').hidden = true; toast(mode === 'register' ? '注册成功' : '登录成功');
      if (!templates.length) await pullCloud(true);
    } else {
      hint.textContent = translateAuthError(lastError?.message || '网络异常');
    }
  }

  async function doLogout() {
    if (!CLOUD) return;
    // 增加醒目的数据清除提示
    if (!confirm('确定要退出登录吗？\n\n⚠️ 退出将清空当前设备上的所有本地模板数据！\n（如果您已同步到云端，下次登录即可恢复）')) return;
    
    clearTimeout(pushTimer);
    
    // 1. 清空内存数据
    templates = [];
    groups = [];
    currentId = null;
    editingId = null;
    descEditingId = null;

    // 2. 抹除 localStorage 中的模板数据
    try { localStorage.removeItem(KEY); } catch (e) {}

    // 3. 强制清理 Supabase 登录凭证（防止残留）
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    // 4. 立即更新 UI，让界面变空
    setUser(null);
    showEmpty();
    renderTree();
    toast('已退出登录并清空本地数据');

    // 5. 在后台静默通知服务器注销（即使断网也不会卡住）
    sb.auth.signOut().catch(e => console.warn('远端注销异常:', e));
  }

  async function computeShortId(str) {
    const norm = String(str || '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
  }

  // 保存时，严格确保代码被写入了 snippets 表，失败则抛错
  async function syncTemplateToCloud(t) {
    if (!CLOUD || !cloudUser) return;
    const currentHash = await computeShortId(t.name + '\n' + (t.desc || '') + '\n' + t.code);
    
    // 如果哈希没变，说明内容一样，不用重复传了，直接复用
    if (t.short_id === currentHash && t.author_name) return;
    
    t.short_id = currentHash;
    t.author_name = emailToUsername(cloudUser.email);
    
    // 强制 upsert，必须有 UPDATE 权限
    const { error } = await sb.from('snippets').upsert({
      short_id: currentHash,
      name: t.name,
      desc_text: t.desc || '',
      code: t.code,
      created_by: cloudUser.id,
      author_name: t.author_name
    }, { onConflict: 'short_id' });

    if (error) {
      console.error('同步代码到 snippets 失败:', error);
      throw new Error('分享链接生成失败');
    }
  }

  async function shareCurrent() {
    const t = current();
    if (!t) return;
    if (!CLOUD) { toast('云端未配置，无法分享'); return; }
    if (!els.editor.hidden) { toast('请先保存代码再分享'); return; }
    if (!cloudUser) { openAuthModal(); return; }
    if (!(t.code || '').trim()) { toast('代码为空，无法分享'); return; }

    const btn = $('#btn-share'); const oldText = btn.textContent;
    btn.disabled = true; btn.style.opacity = '0.7';
    btn.textContent = MSG_UPLOAD[0];

    try {
      await syncTemplateToCloud(t);
      showShareResult(t.short_id, true);
    } catch (e) {
      toast('分享失败，请检查网络');
    } finally {
      btn.disabled = false; btn.style.opacity = ''; btn.textContent = oldText;
    }
  }

  function showShareResult(shortId, existed) {
    const url = location.origin + location.pathname + '#s=' + shortId;
    $('#share-id').value = shortId; $('#share-url').value = url;
    $('#share-tip').textContent = existed ? '您的模板在保存时已自动生成链接，相同内容天然去重。' : '把编号或链接发给别人，他们点「🔗 打开分享」即可导入。';
    $('#share-modal').hidden = false;
  }

  async function openSharedById(raw, silent) {
    if (!CLOUD) { toast('云端未配置'); return; }
    const id = String(raw || '').trim().toLowerCase();
    if (!/^[0-9a-f]{6,64}$/.test(id)) { if (!silent) toast('编号格式不正确'); return; }

    let data = null, lastError = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (!silent) toast(MSG_DOWNLOAD[attempt - 1], 2000);
      try {
        const res = await sb.from('snippets').select('short_id,name,desc_text,code,author_name').eq('short_id', id).maybeSingle();
        if (res.error) throw res.error;
        data = res.data; break;
      } catch (e) {
        lastError = e;
        if (attempt < 5) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (lastError) { toast('获取失败：网络异常'); return; }
    if (!data) { if (!silent) toast('未找到编号 ' + id); return; }

    const t = { 
      id: uid(), 
      name: uniqueName(data.name || ('分享 ' + id)), 
      desc: data.desc_text || '', 
      code: data.code || '', 
      updated: Date.now(),
      short_id: data.short_id,
      author_name: data.author_name || '未知'
    };
    templates.unshift(t); persist(); renderTree(); viewTemplate(t.id);
    if (!silent) toast('已成功导入分享模板');
  }

  function scheduleCloudPush() {
    if (!CLOUD || !cloudUser) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushCloud(true), 1500);
  }

  // 修复核心：先确保 snippets 表里的数据全部写入成功，再写 user_libs
  async function pushCloud(silent) {
    if (!CLOUD || !cloudUser) return;
    if (pushing) { pendingPush = true; return; }
    pushing = true;
    
    let success = false, lastError = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      if (!silent) toast(MSG_UPLOAD[attempt - 1], 2000);
      try {
        // 1. 强制并发生成/检查所有代码是否都在 snippets 表里
        await Promise.all(templates.map(t => syncTemplateToCloud(t)));
        
        // 2. 组装轻量数据
        const template_ids = templates.map(t => t.short_id).filter(Boolean);
        const dataToUpload = { template_ids, groups };

        // 3. 保存到 user_libs（这是缓存映射，作为本地库的索引）
        const { error } = await sb.from('user_libs').upsert({
          user_id: cloudUser.id, 
          data: dataToUpload, 
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
        if (error) throw error;
        success = true; break;
      } catch (e) {
        lastError = e;
        if (attempt < 5) await new Promise(r => setTimeout(r, 1000));
      }
    }

    pushing = false;
    if (success) { if (!silent) toast('已成功上传到云端'); } 
    else { if (!silent) toast('上传失败，网络异常'); else console.warn('cloud push failed:', lastError); }
    if (pendingPush) { pendingPush = false; scheduleCloudPush(); }
  }

  // 下载时，通过 user_libs 的 ids 去拉取 snippets
  async function pullCloud(silent) {
    if (!CLOUD) { toast('云端未配置'); return false; }
    if (!cloudUser) { toast('请先登录'); return false; }

    let userLib = null, lastError = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (!silent) toast(MSG_DOWNLOAD[attempt - 1], 2000);
      try {
        const res = await sb.from('user_libs').select('data,updated_at').eq('user_id', cloudUser.id).maybeSingle();
        if (res.error) throw res.error;
        userLib = res.data; lastError = null; break;
      } catch (e) {
        lastError = e;
        if (attempt < 5) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (lastError) { toast('下载失败，网络异常'); return false; }
    if (!userLib || !userLib.data) { if (!silent) toast('云端还没有数据'); return false; }

    const { template_ids, groups: cloudGroups } = userLib.data;
    groups = Array.isArray(cloudGroups) ? normalizeGroups(cloudGroups) : [];
    
    if (!template_ids || !template_ids.length) {
      templates = [];
      try { localStorage.setItem(KEY, JSON.stringify({ templates, groups })); } catch (e) {}
      currentId = null; renderTree(); showEmpty();
      if (!silent) toast('已从云端下载完毕');
      return true;
    }

    let snippetsData = null, snippetError = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (!silent) toast(MSG_DOWNLOAD[attempt - 1], 2000);
      try {
        const res = await sb.from('snippets').select('short_id,name,desc_text,code,author_name').in('short_id', template_ids);
        if (res.error) throw res.error;
        snippetsData = res.data; snippetError = null; break;
      } catch (e) {
        snippetError = e;
        if (attempt < 5) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (snippetError) { toast('获取模板失败，网络异常'); return false; }

    const map = new Map(snippetsData.map(d => [d.short_id, d]));
    templates = template_ids.map(id => {
      const d = map.get(id);
      if (!d) return null;
      return {
        id: uid(),
        short_id: d.short_id,
        name: d.name,
        desc: d.desc_text,
        code: d.code,
        author_name: d.author_name,
        updated: Date.now()
      };
    }).filter(Boolean);

    try { localStorage.setItem(KEY, JSON.stringify({ templates, groups })); } catch (e) {}
    currentId = templates[0] ? templates[0].id : null;
    renderTree();
    if (currentId) viewTemplate(currentId); else showEmpty();
    if (!silent) toast('已从云端下载完毕');
    return true;
  }

  function openSyncModal() {
    if (!CLOUD) { toast('云端未配置'); return; }
    if (!cloudUser) { openAuthModal(); return; }
    $('#sync-info').textContent = '当前账号：' + emailToUsername(cloudUser.email) + '　本地：' + templates.length + ' 个模板 / ' + groups.length + ' 个分组';
    $('#sync-modal').hidden = false;
  }

  /* =========================================================
   *  本地持久化 & 设置
   * ========================================================= */
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ templates, groups })); } catch (e) { toast('保存失败：' + e.message); }
    scheduleCloudPush();
  }

  function extractFirstCodeBlock(md) {
    const m = /```[^\n]*\n([\s\S]*?)```/.exec(md || '');
    return m ? m[1].replace(/\n+$/, '') : null;
  }
  function normalizeTemplates(arr) {
    return arr.filter((t) => t && typeof t === 'object').map((t) => {
      const item = { 
        id: t.id || uid(), 
        name: t.name || t.title || '未命名', 
        desc: typeof t.desc === 'string' ? t.desc : '', 
        code: typeof t.code === 'string' ? t.code : (extractFirstCodeBlock(t.content) || ''), 
        updated: t.updated || Date.now(),
        short_id: t.short_id || null,
        author_name: t.author_name || null
      };
      if ('manualGroupId' in t) item.manualGroupId = t.manualGroupId;
      return item;
    });
  }
  function normalizeGroups(arr) {
    return arr.filter((g) => g && typeof g === 'object').map((g) => ({
      id: g.id || uid(), name: g.name || '未命名分组', parentId: g.parentId || null, collapsed: !!g.collapsed, keywords: Array.isArray(g.keywords) ? g.keywords.filter((k) => typeof k === 'string') : []
    }));
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && Array.isArray(data.templates)) {
          templates = normalizeTemplates(data.templates); groups = Array.isArray(data.groups) ? normalizeGroups(data.groups) : []; return;
        }
      }
    } catch (e) {}
    for (const k of OLD_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) { templates = normalizeTemplates(arr); groups = []; persist(); return; }
      } catch (e) {}
    }
    templates = []; groups = [];
  }
  function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--ui-font', FONTS[settings.font] || FONTS.system);
    root.style.setProperty('--ui-size', settings.size + 'px');
    root.style.setProperty('--md-size', (settings.size * 0.96).toFixed(2) + 'px');
    root.style.setProperty('--code-size', (settings.size * 0.93).toFixed(2) + 'px');
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') { settings.font = FONTS[s.font] ? s.font : 'system'; settings.size = Math.max(12, Math.min(20, Number(s.size) || 14)); }
      }
    } catch (e) {}
    applySettings(); $('#set-size').value = settings.size; $('#set-size-val').textContent = settings.size + 'px'; $('#set-font').value = settings.font;
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
    applySettings(); if (!els.editor.hidden) renderCodeHighlight();
  }

  /* =========================================================
   *  UI 渲染（树、视图、编辑器）
   * ========================================================= */
  function toast(msg, duration = 1800) {
    els.toast.textContent = msg; els.toast.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), duration);
  }
  function copyText(text, msg) {
    const done = () => toast(msg || '已复制到剪贴板');
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); ok ? done() : toast('复制失败，请手动选择复制');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(fallback);
    else fallback();
  }

  function getEffectiveGroup(t) {
    if (t.manualGroupId !== undefined) {
      if (t.manualGroupId === null) return null;
      if (groups.some((g) => g.id === t.manualGroupId)) return t.manualGroupId;
    }
    if (!groups.length) return null;
    const hay = ((t.name || '') + ' ' + (t.desc || '')).toLowerCase();
    for (const g of groups) {
      if (g.keywords && g.keywords.length) {
        for (const kw of g.keywords) { if (kw && hay.indexOf(kw.toLowerCase()) !== -1) return g.id; }
      }
    }
    return null;
  }
  function collectGroupIds(gid) {
    const set = new Set([gid]); let changed = true;
    while (changed) { changed = false; groups.forEach((g) => { if (g.parentId && set.has(g.parentId) && !set.has(g.id)) { set.add(g.id); changed = true; } }); }
    return set;
  }

  function matchSearch(t, q) {
    if (!q) return true;
    return ((t.name || '') + '\n' + (t.desc || '') + '\n' + (t.code || '')).toLowerCase().indexOf(q) !== -1;
  }
  function renderTree() {
    const q = els.search.value.trim().toLowerCase();
    const templatesByGroup = new Map(), ungrouped = [];
    templates.forEach((t) => {
      if (!matchSearch(t, q)) return;
      const gid = getEffectiveGroup(t);
      if (gid) { if (!templatesByGroup.has(gid)) templatesByGroup.set(gid, []); templatesByGroup.get(gid).push(t); } 
      else ungrouped.push(t);
    });
    const groupTotal = new Map();
    function calcTotal(gid) {
      let n = (templatesByGroup.get(gid) || []).length;
      groups.filter((g) => g.parentId === gid).forEach((cg) => { n += calcTotal(cg.id); });
      groupTotal.set(gid, n); return n;
    }
    groups.filter((g) => g.parentId === null).forEach((g) => calcTotal(g.id));

    const out = [];
    function renderGroup(g, depth) {
      const childGroups = groups.filter((x) => x.parentId === g.id);
      const directTemplates = templatesByGroup.get(g.id) || [];
      const total = groupTotal.get(g.id) || 0;
      if (q && total === 0) return;
      const expanded = q ? true : !g.collapsed; const pad = depth * 16;
      out.push(
        '<div class="tree-node group-node" style="padding-left:' + (pad + 10) + 'px" data-gid="' + g.id + '">' +
          '<span class="arrow">' + (expanded ? '▾' : '▸') + '</span><span class="folder-icon">' + (expanded ? '📂' : '📁') + '</span>' +
          '<span class="node-name" title="' + esc(g.name) + '">' + esc(g.name) + '</span><span class="node-count">(' + total + ')</span>' +
          '<div class="node-ops"><button class="node-op" data-gop="add-sub" title="新建子分组">＋</button><button class="node-op" data-gop="edit" title="编辑分组">⚙</button><button class="node-op" data-gop="export" title="导出分组">📤</button><button class="node-op danger" data-gop="delete" title="删除分组">✕</button></div>' +
        '</div>'
      );
      if (expanded) {
        childGroups.forEach((cg) => renderGroup(cg, depth + 1));
        directTemplates.forEach((t) => renderTemplate(t, depth + 1));
      }
    }
    function renderTemplate(t, depth) {
      const pad = depth * 16; const active = t.id === currentId ? ' active' : '';
      out.push(
        '<div class="tree-node template-node' + active + '" style="padding-left:' + (pad + 10) + 'px" data-tid="' + t.id + '">' +
          '<span class="arrow"></span><span class="file-icon">📄</span><span class="node-name" title="' + esc(t.name) + '">' + esc(t.name) + '</span>' +
          '<div class="node-ops"><button class="node-op" data-top="rename" title="编辑名称">✎</button><button class="node-op" data-top="copy" title="复制代码">⧉</button><button class="node-op" data-top="move" title="移动到分组">⇄</button><button class="node-op danger" data-top="delete" title="删除">✕</button></div>' +
        '</div>'
      );
    }
    groups.filter((g) => g.parentId === null || !groups.some((p) => p.id === g.parentId)).forEach((g) => renderGroup(g, 0));
    if (ungrouped.length) {
      out.push('<div class="tree-node group-node" style="padding-left:10px" data-virtual="ungrouped"><span class="arrow"></span><span class="folder-icon">📄</span><span class="node-name" style="color:#9aa4b2">未分组</span><span class="node-count">(' + ungrouped.length + ')</span></div>');
      ungrouped.forEach((t) => renderTemplate(t, 1));
    }
    if (!out.length) {
      const empty = !templates.length && !groups.length;
      els.list.innerHTML = empty ? '<div class="list-empty">还没有模板或分组\n点击「＋ 新建」/「📥 导入」开始\n或点「📁 分组」建立分组</div>' : '<div class="list-empty">' + (q ? '没有匹配的内容' : '没有内容') + '</div>';
    } else { els.list.innerHTML = out.join(''); }
    els.count.textContent = templates.length + ' 个模板 · ' + groups.length + ' 个分组';
  }

  function showEmpty()  { els.empty.hidden=false; els.viewer.hidden=true;  els.editor.hidden=true; els.descEditor.hidden=true; }
  function showViewer() { els.empty.hidden=true;  els.viewer.hidden=false; els.editor.hidden=true; els.descEditor.hidden=true; }
  function showCodeEditor() { els.empty.hidden=true; els.viewer.hidden=true; els.editor.hidden=false; els.descEditor.hidden=true; }
  function showDescEditor() { els.empty.hidden=true; els.viewer.hidden=true; els.editor.hidden=true; els.descEditor.hidden=false; }

  function commitTitleIfEditing() {
    if (els.viewTitleInput.hidden) return;
    const t = current();
    if (t) {
      const v = els.viewTitleInput.value.trim() || '未命名';
      if (v !== t.name) { t.name = v; t.updated = Date.now(); persist(); renderTree(); syncTemplateToCloud(t); }
      els.viewTitle.textContent = t.name; els.viewTitle.title = t.name;
    }
    els.viewTitle.hidden = false; els.viewTitleInput.hidden = true;
  }
  function enterTitleEdit() {
    const t = current(); if (!t) return;
    if (!els.editor.hidden || !els.descEditor.hidden) { showViewer(); renderViewerBody(t); }
    els.viewTitle.hidden = true; els.viewTitleInput.hidden = false; els.viewTitleInput.value = t.name;
    els.viewTitleInput.focus(); els.viewTitleInput.select();
  }
  function exitTitleEdit(save) {
    const t = current();
    if (save && t) {
      const v = els.viewTitleInput.value.trim() || '未命名';
      if (v !== t.name) { t.name = v; t.updated = Date.now(); persist(); renderTree(); syncTemplateToCloud(t); toast('名称已更新'); }
      els.viewTitle.textContent = t.name; els.viewTitle.title = t.name;
    } else if (t) { els.viewTitle.textContent = t.name; }
    els.viewTitle.hidden = false; els.viewTitleInput.hidden = true;
  }

  function renderDesc(t) {
    const text = (t.desc || '').trim();
    if (text) { els.descView.innerHTML = renderMarkdown(text); els.descView.classList.remove('empty'); els.descView.hidden = false; } 
    else { els.descView.innerHTML = '暂无简介（点击「✎ 编辑简介」用 Markdown 补充说明）'; els.descView.classList.add('empty'); els.descView.hidden = false; }
  }
  function renderCodeEmbed(t) { els.codeEmbed.innerHTML = renderCodeBlock(t.code || '', 'cpp'); }
  function renderViewerBody(t) { renderDesc(t); renderCodeEmbed(t); }

  function viewTemplate(id) {
    commitTitleIfEditing();
    const t = templates.find((x) => x.id === id); if (!t) return;
    currentId = id; els.viewTitle.textContent = t.name; els.viewTitle.title = t.name; els.viewTitle.hidden = false; els.viewTitleInput.hidden = true;
    
    const lines = t.code ? t.code.split('\n').length : 0; 
    let metaText = lines + ' 行 · ' + formatSize(t.code.length);
    if (t.author_name && cloudUser && t.author_name !== emailToUsername(cloudUser.email)) {
      metaText += ' · 作者: ' + t.author_name;
    } else if (t.author_name && !cloudUser) {
      metaText += ' · 作者: ' + t.author_name;
    }
    els.viewMeta.textContent = metaText;
    
    renderViewerBody(t); els.contentScroll.scrollTop = 0; showViewer(); renderTree();
  }

  let descRafPending = false;
  function renderDescPreviewNow() {
    const md = els.descMdInput.value;
    if (md.trim()) { els.descPreview.innerHTML = renderMarkdown(md); els.descPreviewHint.textContent = md.split('\n').length + ' 行'; } 
    else { els.descPreview.innerHTML = '<span style="color:#4d5563;font-style:italic">暂无内容</span>'; els.descPreviewHint.textContent = '空'; }
  }
  function scheduleDescPreview() {
    if (descRafPending) return; descRafPending = true;
    requestAnimationFrame(() => { descRafPending = false; renderDescPreviewNow(); });
  }
  function openDescEditor() {
    const t = current(); if (!t) return;
    commitTitleIfEditing(); descEditingId = t.id; els.descEditName.textContent = t.name; els.descMdInput.value = t.desc || '';
    showDescEditor(); renderDescPreviewNow(); els.descMdInput.focus();
  }
  function saveDescEditor() {
    if (!descEditingId) { cancelDescEditor(); return; }
    const t = templates.find((x) => x.id === descEditingId);
    if (t) { t.desc = els.descMdInput.value; t.updated = Date.now(); syncTemplateToCloud(t); }
    descEditingId = null; persist(); viewTemplate(currentId); toast('简介已保存');
  }
  function cancelDescEditor() {
    descEditingId = null;
    if (currentId && templates.some((t) => t.id === currentId)) viewTemplate(currentId);
    else { currentId = null; showEmpty(); renderTree(); }
  }

  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);
  let codeRafPending = false;
  function renderLineNumbers() {
    const val = els.editCode.value, n = val.split('\n').length;
    let s = ''; for (let i = 1; i <= n; i++) s += i + '\n'; els.lineNumbers.textContent = s.slice(0, -1);
  }
  function renderCodeHighlight() {
    const code = els.editCode.value;
    if (code.length > MAX_HIGHLIGHT) els.hlCode.textContent = code + '\n';
    else els.hlCode.innerHTML = highlightCpp(code) + '\n';
    renderLineNumbers(); syncScroll();
  }
  function syncScroll() {
    els.hlLayer.scrollTop = els.editCode.scrollTop; els.hlLayer.scrollLeft = els.editCode.scrollLeft; els.lineNumbers.scrollTop = els.editCode.scrollTop;
  }
  function scheduleCodeHighlight() {
    if (codeRafPending) return; codeRafPending = true;
    requestAnimationFrame(() => { codeRafPending = false; renderCodeHighlight(); });
  }
  function onCodeInput() { scheduleCodeHighlight(); }

  function handleCodeEnter(ta) {
    const start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const lineText = val.slice(lineStart, start); const indentMatch = lineText.match(/^[ \t]*/); const indent = indentMatch ? indentMatch[0] : '';
    const before = val.slice(0, start).replace(/[ \t]+$/, ''); const lastChar = before.slice(-1); const nextChar = val[end];
    let insertText = '\n' + indent, cursorOffset = insertText.length;
    if (lastChar === '{') {
      if (nextChar === '}') { insertText = '\n' + indent + INDENT_UNIT + '\n' + indent; cursorOffset = ('\n' + indent + INDENT_UNIT).length; } 
      else { insertText = '\n' + indent + INDENT_UNIT; cursorOffset = insertText.length; }
    } else if (lastChar === '(' || lastChar === '[') {
      if ((lastChar === '(' && nextChar === ')') || (lastChar === '[' && nextChar === ']')) { insertText = '\n' + indent + INDENT_UNIT + '\n' + indent; cursorOffset = ('\n' + indent + INDENT_UNIT).length; } 
      else { insertText = '\n' + indent + INDENT_UNIT; cursorOffset = insertText.length; }
    }
    ta.value = val.slice(0, start) + insertText + val.slice(end); ta.selectionStart = ta.selectionEnd = start + cursorOffset; onCodeInput();
  }

  function handleCodeKeyDown(e) {
    const ta = e.target, start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (PAIRS[e.key]) {
      e.preventDefault(); const selected = val.slice(start, end);
      if (selected) { ta.value = val.slice(0, start) + e.key + selected + PAIRS[e.key] + val.slice(end); ta.selectionStart = start + 1; ta.selectionEnd = start + 1 + selected.length; } 
      else { ta.value = val.slice(0, start) + e.key + PAIRS[e.key] + val.slice(end); ta.selectionStart = ta.selectionEnd = start + 1; }
      onCodeInput(); return;
    }
    if (CLOSERS.has(e.key)) { if (start === end && val[start] === e.key) { e.preventDefault(); ta.selectionStart = ta.selectionEnd = start + 1; } return; }
    if (e.key === 'Backspace' && start === end && start > 0) {
      const b = val[start - 1], a = val[start];
      if (PAIRS[b] && PAIRS[b] === a) { e.preventDefault(); ta.value = val.slice(0, start - 1) + val.slice(start + 1); ta.selectionStart = ta.selectionEnd = start - 1; onCodeInput(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCodeEnter(ta); return; }
    if (e.key === '}' && start === end) {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1, lineBefore = val.slice(lineStart, start);
      if (/^[ \t]+$/.test(lineBefore)) {
        e.preventDefault(); let indent = lineBefore;
        if (indent.endsWith(INDENT_UNIT)) indent = indent.slice(0, -INDENT_UNIT.length);
        else if (indent.endsWith('\t')) indent = indent.slice(0, -1);
        else indent = indent.slice(0, -1);
        if (val[start] === '}') { ta.value = val.slice(0, lineStart) + indent + val.slice(start + 1); ta.selectionStart = ta.selectionEnd = lineStart + indent.length; } 
        else { ta.value = val.slice(0, lineStart) + indent + '}' + val.slice(start); ta.selectionStart = ta.selectionEnd = lineStart + indent.length + 1; }
        onCodeInput(); return;
      }
    }
  }

  function openCodeEditor(id) {
    const t = templates.find((x) => x.id === id); if (!t) return;
    commitTitleIfEditing(); editingId = id; currentId = id; els.editName.textContent = t.name; els.editCode.value = t.code;
    els.editCode.scrollTop = 0; els.editCode.scrollLeft = 0; showCodeEditor(); renderTree(); renderCodeHighlight(); els.editCode.focus();
  }
  function saveCodeEditor() {
    if (!editingId) { cancelCodeEditor(); return; }
    const t = templates.find((x) => x.id === editingId);
    if (t) { t.code = els.editCode.value; t.updated = Date.now(); syncTemplateToCloud(t); }
    editingId = null; persist(); viewTemplate(currentId); toast('代码已保存');
  }
  function cancelCodeEditor() {
    editingId = null;
    if (currentId && templates.some((t) => t.id === currentId)) viewTemplate(currentId);
    else { currentId = null; showEmpty(); renderTree(); }
  }

  /* =========================================================
   *  分组操作 & 事件
   * ========================================================= */
  function openGroupModal(gid, parentId) {
    editingGroupId = gid === undefined ? null : gid; pendingParentId = parentId || null;
    if (editingGroupId) {
      const g = groups.find((x) => x.id === editingGroupId); if (!g) return;
      els.groupModalTitle.textContent = '编辑分组'; els.groupNameInput.value = g.name; els.groupKwInput.value = (g.keywords || []).join(', ');
    } else {
      const parent = pendingParentId ? groups.find((x) => x.id === pendingParentId) : null;
      els.groupModalTitle.textContent = parent ? ('新建子分组 · ' + parent.name) : '新建分组'; els.groupNameInput.value = ''; els.groupKwInput.value = '';
    }
    els.groupModal.hidden = false; els.groupNameInput.focus(); els.groupNameInput.select();
  }
  function closeGroupModal() { els.groupModal.hidden = true; editingGroupId = undefined; pendingParentId = null; }
  function saveGroupModal() {
    const name = els.groupNameInput.value.trim() || '新分组';
    const keywords = els.groupKwInput.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (editingGroupId) { const g = groups.find((x) => x.id === editingGroupId); if (g) { g.name = name; g.keywords = keywords; } } 
    else { groups.push({ id: uid(), name: name, parentId: pendingParentId, collapsed: false, keywords: keywords }); }
    persist(); closeGroupModal(); renderTree(); toast('分组已保存');
  }
  function deleteGroup(g) {
    const ids = collectGroupIds(g.id), affected = templates.filter((t) => t.manualGroupId && ids.has(t.manualGroupId));
    const parts = ['确定删除分组「' + g.name + '」吗？'];
    if (ids.size > 1) parts.push('将同时删除 ' + (ids.size - 1) + ' 个子分组');
    if (affected.length) parts.push(affected.length + ' 个模板将移回未分组');
    if (!confirm(parts.join('\n'))) return;
    affected.forEach((t) => { t.manualGroupId = null; });
    groups = groups.filter((x) => !ids.has(x.id)); persist(); renderTree(); toast('分组已删除');
  }
  async function exportGroup(g) {
    const ids = collectGroupIds(g.id), list = templates.filter((t) => { const gid = getEffectiveGroup(t); return gid && ids.has(gid); });
    if (!list.length) { toast('该分组下没有模板'); return; } await downloadTemplates(list);
  }
  function closeGroupPicker() { if (groupPicker) { groupPicker.remove(); groupPicker = null; } }
  function showGroupPicker(tid, anchor) {
    closeGroupPicker(); const t = templates.find((x) => x.id === tid); if (!t) return;
    const picker = document.createElement('div'); picker.className = 'group-picker'; const effectiveGid = getEffectiveGroup(t);
    function addItem(gid, label, depth) {
      const item = document.createElement('div'); item.className = 'picker-item' + (gid === effectiveGid ? ' selected' : '');
      item.style.paddingLeft = (12 + depth * 14) + 'px'; item.textContent = (gid === null ? '○' : '📁') + ' ' + label;
      item.addEventListener('click', () => { t.manualGroupId = gid; t.updated = Date.now(); persist(); closeGroupPicker(); renderTree(); toast('已移动到 ' + label); });
      picker.appendChild(item);
    }
    addItem(null, '未分组', 0);
    function addGroup(g, depth) { addItem(g.id, g.name, depth); groups.filter((x) => x.parentId === g.id).forEach((cg) => addGroup(cg, depth + 1)); }
    groups.filter((g) => g.parentId === null).forEach((g) => addGroup(g, 0));
    if (!groups.length) { const hint = document.createElement('div'); hint.className = 'picker-empty'; hint.textContent = '还没有分组'; picker.appendChild(hint); }
    const rect = anchor.getBoundingClientRect();
    picker.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px'; picker.style.top = Math.min(rect.bottom + 4, window.innerHeight - 260) + 'px';
    document.body.appendChild(picker); groupPicker = picker;
  }

  function deleteTemplate(id) {
    const t = templates.find((x) => x.id === id); if (!t) return;
    if (!confirm('确定删除模板「' + t.name + '」吗？此操作不可撤销。')) return;
    const idx = templates.findIndex((x) => x.id === id); templates.splice(idx, 1); persist();
    if (editingId === id) editingId = null; if (descEditingId === id) descEditingId = null; exportSet.delete(id);
    if (currentId === id) {
      const next = templates[Math.min(idx, templates.length - 1)];
      if (next) { currentId = next.id; viewTemplate(next.id); } else { currentId = null; showEmpty(); }
    }
    renderTree(); toast('已删除');
  }

  function uniqueName(base) {
    let name = base, i = 2;
    while (templates.some((t) => t.name === name)) { name = base + '(' + i + ')'; i++; }
    return name;
  }
  async function importFiles(files) {
    if (!files || !files.length) return;
    let okCount = 0; const newIds = [];
    for (const file of files) {
      try {
        const text = await file.text(); const base = file.name.replace(/\.[^./\\]+$/, '') || file.name;
        const t = { id: uid(), name: uniqueName(base), desc: '', code: text, updated: Date.now() };
        templates.unshift(t); newIds.push(t.id); okCount++;
        syncTemplateToCloud(t);
      } catch (e) { console.error('导入失败：', file.name, e); }
    }
    if (!okCount) { toast('导入失败'); return; }
    persist(); renderTree(); const firstId = newIds[newIds.length - 1];
    if (firstId) viewTemplate(firstId); toast('已导入 ' + okCount + ' 个模板');
  }

  function buildExportContent(t) {
    const desc = (t.desc || '').trim(); let out = '';
    if (desc) { const safe = desc.replace(/\*\//g, '* /'); out += '/*\n'; safe.split('\n').forEach((line) => { out += ' * ' + line + '\n'; }); out += ' */\n\n'; }
    out += (t.code || ''); return out;
  }
  function buildMarkdown(t) {
    const desc = (t.desc || '').trim(); const code = (t.code || '').replace(/\n+$/, '');
    let out = desc ? desc + '\n\n' : ''; out += '```cpp\n' + code + '\n```\n'; return out;
  }
  function download(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function downloadTemplates(list) {
    if (!list.length) { toast('没有可导出的模板'); return; }
    if (list.length > 5) { if (!confirm('将依次下载 ' + list.length + ' 个 .cpp 文件。\n浏览器可能提示「允许多文件下载」，请选择允许。继续？')) return; }
    const usedNames = new Set();
    for (let i = 0; i < list.length; i++) {
      const t = list[i]; const base = sanitizeFilename(t.name);
      let filename = base + '.cpp'; let k = 2;
      while (usedNames.has(filename.toLowerCase())) { filename = base + '(' + k + ').cpp'; k++; }
      usedNames.add(filename.toLowerCase()); download(filename, buildExportContent(t));
      await new Promise((r) => setTimeout(r, 280));
    }
    toast('已导出 ' + list.length + ' 个文件');
  }

  function renderExportList() {
    els.exportList.innerHTML = ''; els.totalCount.textContent = templates.length;
    if (!templates.length) { const li = document.createElement('li'); li.className = 'export-empty'; li.textContent = '还没有模板可以导出'; els.exportList.appendChild(li); return; }
    templates.forEach((t) => {
      const li = document.createElement('li'); li.dataset.id = t.id;
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = exportSet.has(t.id);
      const name = document.createElement('span'); name.className = 'ex-name'; name.textContent = t.name;
      const meta = document.createElement('span'); meta.className = 'ex-meta'; meta.textContent = t.code ? (t.code.split('\n').length + ' 行') : '空';
      li.appendChild(cb); li.appendChild(name); li.appendChild(meta);
      li.addEventListener('click', (e) => {
        if (e.target !== cb) cb.checked = !cb.checked;
        if (cb.checked) exportSet.add(t.id); else exportSet.delete(t.id); syncExportToolbar();
      });
      els.exportList.appendChild(li);
    });
    syncExportToolbar();
  }
  function syncExportToolbar() {
    const total = templates.length, sel = templates.filter((t) => exportSet.has(t.id)).length;
    els.selCount.textContent = sel; els.chkAll.checked = (total > 0 && sel === total); els.chkAll.indeterminate = (sel > 0 && sel < total);
  }
  function openExportModal() {
    if (!templates.length) { toast('还没有模板可以导出'); return; }
    exportSet = new Set(templates.map((t) => t.id)); renderExportList(); els.exportModal.hidden = false;
  }
  function closeExportModal() { els.exportModal.hidden = true; }
  async function exportSelected() {
    const selected = templates.filter((t) => exportSet.has(t.id));
    if (!selected.length) { toast('请至少选择一个模板'); return; }
    closeExportModal(); await downloadTemplates(selected);
  }

  /* =========================================================
   *  事件绑定
   * ========================================================= */
  $('#btn-login').addEventListener('click', openAuthModal);
  $('#btn-logout').addEventListener('click', doLogout);
  $('#auth-close').addEventListener('click', () => { $('#auth-modal').hidden = true; });
  $('#auth-modal').addEventListener('click', (e) => { if (e.target === $('#auth-modal')) $('#auth-modal').hidden = true; });
  $('#auth-register').addEventListener('click', () => doAuth('register'));
  $('#auth-login-btn').addEventListener('click', () => doAuth('login'));
  $('#auth-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAuth('login'); } });

  $('#btn-share').addEventListener('click', shareCurrent);
  $('#share-close').addEventListener('click', () => { $('#share-modal').hidden = true; });
  $('#share-modal').addEventListener('click', (e) => { if (e.target === $('#share-modal')) $('#share-modal').hidden = true; });
  $('#share-copy-id').addEventListener('click', () => copyText($('#share-id').value, '编号已复制'));
  $('#share-copy-url').addEventListener('click', () => copyText($('#share-url').value, '链接已复制'));

  $('#btn-open-share').addEventListener('click', () => { if (!CLOUD) { toast('云端未配置'); return; } $('#open-modal').hidden = false; setTimeout(() => $('#open-id').focus(), 30); });
  $('#open-close').addEventListener('click', () => { $('#open-modal').hidden = true; });
  $('#open-cancel').addEventListener('click', () => { $('#open-modal').hidden = true; });
  $('#open-modal').addEventListener('click', (e) => { if (e.target === $('#open-modal')) $('#open-modal').hidden = true; });
  $('#open-confirm').addEventListener('click', async () => { const id = $('#open-id').value.trim(); if (!id) { toast('请输入编号'); return; } $('#open-modal').hidden = true; await openSharedById(id); });
  $('#open-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#open-confirm').click(); } });

  $('#btn-sync').addEventListener('click', openSyncModal);
  $('#sync-close').addEventListener('click', () => { $('#sync-modal').hidden = true; });
  $('#sync-modal').addEventListener('click', (e) => { if (e.target === $('#sync-modal')) $('#sync-modal').hidden = true; });
  $('#sync-push').addEventListener('click', async () => { $('#sync-modal').hidden = true; await pushCloud(false); });
  $('#sync-pull').addEventListener('click', async () => { if (!confirm('从云端下载会覆盖当前本地数据，确定继续？')) return; $('#sync-modal').hidden = true; await pullCloud(false); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['#auth-modal', '#share-modal', '#open-modal', '#sync-modal'].forEach((sel) => { const el = $(sel); if (el && !el.hidden) el.hidden = true; });
  });

  $('#btn-new').addEventListener('click', () => {
    const t = { id: uid(), name: uniqueName('新建模板'), desc: '', code: '', updated: Date.now() };
    templates.unshift(t); persist(); currentId = t.id; renderTree(); viewTemplate(t.id); enterTitleEdit();
  });

  $('#btn-import').addEventListener('click', () => els.fileInput.click());
  $('#btn-export').addEventListener('click', openExportModal);
  $('#btn-group').addEventListener('click', () => createGroup(null));
  function createGroup(parentId) { openGroupModal(null, parentId || null); }

  els.fileInput.addEventListener('change', () => { const files = Array.from(els.fileInput.files || []); els.fileInput.value = ''; if (files.length) importFiles(files); });
  els.search.addEventListener('input', renderTree);

  $('#btn-edit').addEventListener('click', () => { if (currentId) openCodeEditor(currentId); });
  $('#btn-copy').addEventListener('click', () => { const t = current(); if (t) copyText(t.code, '代码已复制'); });
  $('#btn-copy-md').addEventListener('click', () => { const t = current(); if (t) copyText(buildMarkdown(t), 'Markdown已复制'); });
  $('#btn-del').addEventListener('click', () => { if (currentId) deleteTemplate(currentId); });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-code'); if (!btn) return;
    const code = decodeURIComponent(btn.dataset.code || ''); copyText(code, '代码已复制');
    const old = btn.textContent; btn.textContent = '已复制 ✓'; setTimeout(() => { btn.textContent = old; }, 1200);
  });

  els.chkAll.addEventListener('change', () => {
    if (els.chkAll.checked) exportSet = new Set(templates.map((t) => t.id)); else exportSet.clear();
    els.exportList.querySelectorAll('li[data-id]').forEach((li) => { const cb = li.querySelector('input[type=checkbox]'); if (cb) cb.checked = exportSet.has(li.dataset.id); });
    syncExportToolbar();
  });
  $('#modal-close').addEventListener('click', closeExportModal);
  $('#export-cancel').addEventListener('click', closeExportModal);
  $('#export-confirm').addEventListener('click', exportSelected);
  els.exportModal.addEventListener('click', (e) => { if (e.target === els.exportModal) closeExportModal(); });

  $('#btn-settings').addEventListener('click', (e) => { e.stopPropagation(); els.settingsPanel.hidden = !els.settingsPanel.hidden; });
  document.addEventListener('click', (e) => { if (els.settingsPanel.hidden) return; if (els.settingsPanel.contains(e.target) || e.target.closest('#btn-settings')) return; els.settingsPanel.hidden = true; });
  $('#set-size').addEventListener('input', () => { settings.size = Number($('#set-size').value) || 14; $('#set-size-val').textContent = settings.size + 'px'; saveSettings(); });
  $('#set-font').addEventListener('change', () => { settings.font = $('#set-font').value; saveSettings(); });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!els.editor.hidden) saveCodeEditor(); else if (!els.descEditor.hidden) saveDescEditor(); else if (!els.groupModal.hidden) saveGroupModal(); return;
    }
    if (e.key === 'Escape') {
      if (!els.exportModal.hidden) { closeExportModal(); return; }
      if (!els.groupModal.hidden) { closeGroupModal(); return; }
      if (!els.settingsPanel.hidden) { els.settingsPanel.hidden = true; return; }
    }
  });

  els.viewTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); els.viewTitleInput.blur(); } 
    else if (e.key === 'Escape') { e.preventDefault(); titleCancelling = true; els.viewTitleInput.blur(); }
  });
  els.viewTitleInput.addEventListener('blur', () => { if (titleCancelling) { titleCancelling = false; exitTitleEdit(false); } else { exitTitleEdit(true); } });
  
  els.descMdInput.addEventListener('input', scheduleDescPreview);
  els.descMdInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cancelDescEditor(); } });
  bindTabIndent(els.descMdInput);
  $('#btn-desc-save').addEventListener('click', saveDescEditor);
  $('#btn-desc-cancel').addEventListener('click', cancelDescEditor);
  $('#btn-desc').addEventListener('click', openDescEditor);

  els.editCode.addEventListener('input', onCodeInput);
  els.editCode.addEventListener('keydown', handleCodeKeyDown);
  els.editCode.addEventListener('scroll', syncScroll);
  els.editCode.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cancelCodeEditor(); } });
  $('#btn-save').addEventListener('click', saveCodeEditor);
  $('#btn-cancel').addEventListener('click', cancelCodeEditor);

  $('#group-modal-close').addEventListener('click', closeGroupModal);
  $('#group-modal-cancel').addEventListener('click', closeGroupModal);
  $('#group-modal-save').addEventListener('click', saveGroupModal);
  els.groupModal.addEventListener('click', (e) => { if (e.target === els.groupModal) closeGroupModal(); });
  els.groupNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.groupKwInput.focus(); } else if (e.key === 'Escape') { e.preventDefault(); closeGroupModal(); } });
  els.groupKwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveGroupModal(); } else if (e.key === 'Escape') { e.preventDefault(); closeGroupModal(); } });

  document.addEventListener('click', (e) => { if (groupPicker && !groupPicker.contains(e.target)) closeGroupPicker(); });

  els.list.addEventListener('click', (e) => {
    const groupNode = e.target.closest('.group-node'), templateNode = e.target.closest('.template-node'), op = e.target.closest('.node-op');
    if (op) {
      e.stopPropagation();
      if (groupNode) {
        const g = groups.find((x) => x.id === groupNode.dataset.gid); if (!g) return;
        const gop = op.dataset.gop;
        if (gop === 'add-sub') createGroup(g.id);
        else if (gop === 'edit') openGroupModal(g.id);
        else if (gop === 'export') exportGroup(g);
        else if (gop === 'delete') deleteGroup(g);
      } else if (templateNode) {
        const t = templates.find((x) => x.id === templateNode.dataset.tid); if (!t) return;
        const top = op.dataset.top;
        if (top === 'rename') { viewTemplate(t.id); enterTitleEdit(); }
        else if (top === 'copy') copyText(t.code, '代码已复制');
        else if (top === 'move') showGroupPicker(t.id, op);
        else if (top === 'delete') deleteTemplate(t.id);
      }
      return;
    }
    if (groupNode) {
      if (groupNode.dataset.virtual === 'ungrouped') return;
      const g = groups.find((x) => x.id === groupNode.dataset.gid);
      if (g) { g.collapsed = !g.collapsed; persist(); renderTree(); }
      return;
    }
    if (templateNode) viewTemplate(templateNode.dataset.tid);
  });

  /* =========================================================
   *  启动
   * ========================================================= */
  loadSettings(); load(); renderTree();

  (async function initCloud() {
    if (!CLOUD) { setUser(null); return; }
    try {
      const { data } = await sb.auth.getSession();
      setUser(data.session ? data.session.user : null);
      sb.auth.onAuthStateChange((_event, session) => { setUser(session ? session.user : null); });
    } catch (e) { setUser(null); }
  })();

  if (templates.length) { currentId = templates[0].id; viewTemplate(currentId); } else { showEmpty(); }

  const m = location.hash.match(/^#s=([0-9a-fA-F]{6,64})$/);
  if (m && CLOUD) setTimeout(() => openSharedById(m[1]), 300);

  window.addEventListener('resize', () => { if (!els.editor.hidden) renderCodeHighlight(); });
})();
