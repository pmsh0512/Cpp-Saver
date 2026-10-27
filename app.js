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
  let userProfile = null;

  if (CLOUD) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $ = (s) => document.querySelector(s);
  const KEY = 'cpp-templates-v15'; 
  const SETTINGS_KEY = 'cpp-templates-settings-v1';
  const CHAT_READ_KEY = 'cpp-templates-chat-read';
  const MAX_HIGHLIGHT = 400 * 1024;
  const INDENT_UNIT = '    ';

  const FONTS = {
    system: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
    yahei:  '"Microsoft YaHei","PingFang SC",sans-serif',
    serif:  'Georgia,"Times New Roman","Songti SC","SimSun",serif',
    kai:    '"Kaiti SC","STKaiti",KaiTi,"楷体",serif',
    mono:   'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace'
  };

  const MSG_DOWNLOAD = ['正在同服务器建立链接…','正在验证链接…','正在获取数据…','正在验证用户凭证…','正在下载数据…'];
  const MSG_UPLOAD = ['正在同服务器建立链接…','正在整理数据…','正在计算链接…','正在验证用户凭证…','正在上传数据…'];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function formatSize(n) { if (n < 1024) return n + ' B'; if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'; return (n / 1024 / 1024).toFixed(2) + ' MB'; }
  function sanitizeFilename(name) { let s = String(name || 'template').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim(); return s.replace(/\s+/g, ' ') || 'template'; }
  
  function toast(msg, duration = 1800) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), duration);
  }

  /* =========================================================
   *  多语言代码高亮
   * ========================================================= */
  const KW_CPP = new Set(('alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq').split(' '));
  const KW_PY = new Set(('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print len range str int float list dict set tuple type object self').split(' '));
  const KW_JAVA = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while String System out println var').split(' '));
  const KW_GO = new Set(('break default func interface select case defer go map struct chan else goto package switch const fallthrough if range type continue for import return var nil true false int string bool byte rune float64 float32 int64 int32 uint64 uint32 make new len cap append panic recover print println fmt').split(' '));
  const TYPES = new Set(('std string vector map set unordered_map pair queue deque stack size_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t ll ull').split(' '));

  function highlightCode(code, lang) {
    if (!code) return '';
    const lc = (lang || '').toLowerCase();
    let kwSet = KW_CPP;
    if (lc === 'python' || lc === 'py') kwSet = KW_PY;
    else if (lc === 'java') kwSet = KW_JAVA;
    else if (lc === 'go' || lc === 'golang') kwSet = KW_GO;
    
    if (lc === 'json') {
      let out = '', last = 0, m;
      const RE = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
      while ((m = RE.exec(code)) !== null) {
        if (m.index > last) out += esc(code.slice(last, m.index));
        if (/^"/.test(m[0])) {
          if (/:$/.test(m[0])) out += '<span class="c-kw">' + esc(m[0]) + '</span>';
          else out += '<span class="c-str">' + esc(m[0]) + '</span>';
        } else if (/true|false|null/.test(m[0])) out += '<span class="c-kw">' + esc(m[0]) + '</span>';
        else out += '<span class="c-num">' + esc(m[0]) + '</span>';
        last = RE.lastIndex;
      }
      return out + esc(code.slice(last));
    }

    const RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b)|([A-Za-z_]\w*)/g;
    let out = '', last = 0, m;
    while ((m = RE.exec(code)) !== null) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      if (m[1]) out += '<span class="c-com">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="c-str">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="c-num">' + esc(m[3]) + '</span>';
      else {
        const w = m[4];
        if (kwSet.has(w)) out += '<span class="c-kw">' + esc(w) + '</span>';
        else if (TYPES.has(w)) out += '<span class="c-ty">' + esc(w) + '</span>';
        else out += esc(w);
      }
      last = RE.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  function renderCodeBlock(code, lang) {
    const body = (code.length <= MAX_HIGHLIGHT) ? highlightCode(code, lang) : esc(code);
    return '<div class="code-block"><div class="code-head"><span class="code-lang">' + esc(lang || 'text') + '</span><button class="copy-code" type="button" data-code="' + encodeURIComponent(code) + '">复制</button></div><pre class="code-body"><code>' + body + '</code></pre></div>';
  }

  /* =========================================================
   *  完整的 Markdown 解析
   * ========================================================= */
  function mdInline(text) {
    let s = esc(text);
    
    // 1. 处理行内代码 `xxx`
    const inlineCodes = [];
    s = s.replace(/`([^`]+)`/g, (_, p1) => {
      inlineCodes.push(p1);
      return '\u0001' + (inlineCodes.length - 1) + '\u0001';
    });
    
    // 2. 加粗、斜体、删除线
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // 3. 超链接
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // 4. 还原行内代码
    s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => '<code class="md-code">' + inlineCodes[Number(i)] + '</code>');
    
    return s;
  }

  function renderMarkdown(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = []; let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // 1. 代码块（支持 2 个及以上反引号或波浪号）
      const fence = line.match(/^\s*(`{2,}|~{2,})\s*(.*)$/);
      if (fence) {
        const marker = fence[1][0]; 
        const count = fence[1].length;
        const lang = (fence[2] || '').trim().split(/\s+/)[0];
        const buf = [];
        i++;
        const closeRe = new RegExp('^\\s*' + marker + '{' + count + ',}\\s*$');
        while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; out.push(renderCodeBlock(buf.join('\n'), lang)); continue;
      }

      // 2. 表格
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const headerLine = line, alignLine = lines[i + 1]; i += 2; const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        
        const headers = headerLine.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
        const aligns = alignLine.trim().replace(/^\||\|$/g, '').split('|').map(a => {
          a = a.trim();
          const l = a.startsWith(':'), r = a.endsWith(':');
          return (l && r) ? 'center' : r ? 'right' : 'left';
        });
        
        let html = '<div class="table-wrap"><table><thead><tr>';
        headers.forEach((h, idx) => { html += '<th style="text-align:' + (aligns[idx] || 'left') + '">' + mdInline(h) + '</th>'; });
        html += '</tr></thead><tbody>';
        rows.forEach(row => {
          const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
          html += '<tr>';
          headers.forEach((_, idx) => { html += '<td style="text-align:' + (aligns[idx] || 'left') + '">' + mdInline(cells[idx] || '') + '</td>'; });
          html += '</tr>';
        });
        out.push(html + '</tbody></table></div>'); continue;
      }

      // 3. 标题
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { out.push('<h' + Math.min(h[1].length, 4) + '>' + mdInline(h[2]) + '</h' + Math.min(h[1].length, 4) + '>'); i++; continue; }
      
      // 4. 分割线
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      
      // 5. 引用
      if (/^\s*>\s?/.test(line)) {
        const buf = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + renderMarkdown(buf.join('\n')) + '</blockquote>'); continue;
      }
      
      // 6. 无序列表
      if (/^\s*[-*+]\s+/.test(line)) {
        const buf = []; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
        out.push('<ul>' + buf.map((t) => '<li>' + mdInline(t) + '</li>').join('') + '</ul>'); continue;
      }
      
      // 7. 有序列表
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const buf = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        out.push('<ol>' + buf.map((t) => '<li>' + mdInline(t) + '</li>').join('') + '</ol>'); continue;
      }
      
      // 8. 空行
      if (/^\s*$/.test(line)) { i++; continue; }
      
      // 9. 普通段落
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(`{2,}|~{2,})/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) && !/^\s*\|.*\|\s*$/.test(lines[i])) { 
        buf.push(lines[i]); i++; 
      }
      out.push('<p>' + buf.map(t => mdInline(t)).join('<br>') + '</p>');
    }
    return out.join('');
  }

  /* =========================================================
   *  数据与状态
   * ========================================================= */
  let templates = [], groups = [], currentId = null, descEditingId = null;
  let exportSet = new Set(), pushTimer = null, pushing = false;
  let chatTimer = null, currentChatTarget = 'public';
  let settings = { font: 'system', size: 14 };
  let editingGroupId = undefined, pendingParentId = null, groupPicker = null;

  let chatReadState = {};
  let chatContactsMap = new Map();
  let userCache = {}; 

  let explorePage = 0, exploreQuery = '', exploreType = 'keyword';

  function loadChatReadState() {
    try { chatReadState = JSON.parse(localStorage.getItem(CHAT_READ_KEY)) || {}; } catch(e) { chatReadState = {}; }
  }
  function saveChatReadState() {
    try { localStorage.setItem(CHAT_READ_KEY, JSON.stringify(chatReadState)); } catch(e) {}
  }

  function normalizeTemplates(arr) {
    return arr.filter(t => t && typeof t === 'object').map(t => ({
      id: t.id || uid(), name: t.name || '未命名', content: t.content || t.desc || (t.code ? '```cpp\n'+t.code+'\n```' : ''),
      is_public: t.is_public !== false, updated: t.updated || Date.now(), short_id: t.short_id || null, author_name: t.author_name || null,
      manualGroupId: t.manualGroupId
    }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem('cpp-templates-v14');
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.templates)) { templates = normalizeTemplates(d.templates); groups = d.groups || []; }
      }
    } catch (e) {}
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ templates, groups })); } catch (e) {}
    scheduleCloudPush();
  }

  async function computeShortId(str) {
    const norm = String(str || '').replace(/\r\n?/g, '\n').trim();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
  }

  async function syncTemplateToCloud(t) {
    if (!CLOUD || !cloudUser) return;
    const currentHash = await computeShortId(t.name + '\n' + t.content);
    if (t.short_id === currentHash && t.author_name) return;
    
    t.short_id = currentHash;
    t.author_name = userProfile ? userProfile.username : cloudUser.email.split('@')[0];
    
    const { error } = await sb.from('snippets').upsert({
      short_id: currentHash, name: t.name, desc_text: t.content, 
      created_by: cloudUser.id, author_name: t.author_name, is_public: t.is_public
    }, { onConflict: 'short_id' });
    if (error) throw error;
  }

  function scheduleCloudPush() {
    if (!CLOUD || !cloudUser) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushCloud(true), 1500);
  }

  async function pushCloud(silent) {
    if (!CLOUD || !cloudUser || pushing) return;
    pushing = true;
    let success = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (!silent) toast(MSG_UPLOAD[attempt - 1], 1500);
      try {
        await Promise.all(templates.map(t => syncTemplateToCloud(t)));
        const template_ids = templates.map(t => t.short_id).filter(Boolean);
        const { error } = await sb.from('user_libs').upsert({
          user_id: cloudUser.id, data: { template_ids, groups }, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) throw error;
        success = true; break;
      } catch (e) { if (attempt < 5) await new Promise(r => setTimeout(r, 1000)); }
    }
    pushing = false;
    if (success && !silent) toast('已成功同步至云端');
  }

  async function pullCloud(silent) {
    if (!CLOUD || !cloudUser) return;
    try {
      const { data: lib } = await sb.from('user_libs').select('data').eq('user_id', cloudUser.id).maybeSingle();
      if (!lib || !lib.data || !lib.data.template_ids) return;
      const ids = lib.data.template_ids;
      if (!ids.length) { templates = []; groups = lib.data.groups || []; persist(); renderTree(); return; }

      const { data: snips } = await sb.from('snippets').select('*').in('short_id', ids);
      const map = new Map(snips.map(d => [d.short_id, d]));
      templates = ids.map(id => {
        const d = map.get(id); if (!d) return null;
        return { id: uid(), short_id: d.short_id, name: d.name, content: d.desc_text || '', author_name: d.author_name, is_public: d.is_public, updated: Date.now() };
      }).filter(Boolean);
      groups = lib.data.groups || [];
      persist(); renderTree();
    } catch (e) {}
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cloudUser && !descEditingId) {
      setTimeout(() => pullCloud(true), 1000);
    }
  });

  /* =========================================================
   *  用户与权限
   * ========================================================= */
  async function fetchProfile(user) {
    if (!user) return null;
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) return data;
      return { id: user.id, username: user.email.split('@')[0], role: user.id === '100dbf8c-9fcb-41cb-89e4-a00cffdb0687' ? 'root' : 'user' };
    } catch (e) { return { id: user.id, username: '未知', role: 'user' }; }
  }

  async function setUser(user) {
    cloudUser = user || null;
    const st = $('#acc-status'), lo = $('#btn-login'), out = $('#btn-logout'), chatBtn = $('#btn-chat');
    if (!CLOUD) { if (st) st.textContent = '云端未配置'; return; }
    
    if (user) {
      if (!userProfile || userProfile.id !== user.id) {
        if (st) st.textContent = '加载中…';
        userProfile = await fetchProfile(user);
        loadChatReadState();
      }
      if (st) {
        st.innerHTML = `<span style="cursor:pointer;font-weight:600;" id="btn-open-profile" title="个人中心">${esc(userProfile.username)}</span> <span style="color:#7d8590;font-size:11px;">[${userProfile.role}]</span>`;
        st.classList.add('online'); lo.hidden = true; out.hidden = false; chatBtn.hidden = false;
        $('#btn-open-profile').onclick = openProfileModal;
      }
      startChatPolling();
    } else {
      userProfile = null;
      if (st) { st.textContent = '未登录'; st.classList.remove('online'); lo.hidden = false; out.hidden = true; chatBtn.hidden = true; }
      stopChatPolling();
    }
  }

  function openProfileModal() {
    if (!userProfile) return;
    $('#pf-email').textContent = cloudUser.email;
    $('#pf-role').textContent = userProfile.role === 'root' ? '超级管理员' : (userProfile.role === 'admin' ? '管理员' : '普通用户');
    $('#pf-uid').textContent = cloudUser.id;
    $('#pf-username').value = userProfile.username;
    if (userProfile.role === 'admin' || userProfile.role === 'root') $('#btn-admin-panel').hidden = false;
    else $('#btn-admin-panel').hidden = true;
    $('#profile-modal').hidden = false;
  }

  async function saveUsername() {
    const newName = $('#pf-username').value.trim();
    if (newName.length < 2) return toast('用户名太短');
    if (newName === userProfile.username) return;
    const btn = $('#btn-save-username'); btn.disabled = true;
    for (let attempt = 1; attempt <= 5; attempt++) {
      toast(MSG_UPLOAD[attempt - 1], 1000);
      try {
        const { error } = await sb.from('profiles').update({ username: newName }).eq('id', cloudUser.id);
        if (error) throw error;
        userProfile.username = newName; setUser(cloudUser); toast('改名成功'); btn.disabled = false; return;
      } catch (e) {
        if (e.code === '23505') { toast('该用户名已被占用'); btn.disabled = false; return; }
        if (attempt === 5) { toast('修改失败'); btn.disabled = false; }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  async function savePassword() {
    const oldPw = $('#pf-old-pw').value, newPw = $('#pf-new-pw').value, confirmPw = $('#pf-confirm-pw').value;
    if (!oldPw) return toast('请输入原密码');
    if (newPw.length < 6) return toast('新密码至少 6 位');
    if (newPw !== confirmPw) return toast('两次密码不一致');
    const btn = $('#btn-save-pw'); btn.disabled = true;
    for (let attempt = 1; attempt <= 5; attempt++) {
      toast(MSG_UPLOAD[attempt - 1], 1000);
      try {
        const { error: authErr } = await sb.auth.signInWithPassword({ email: cloudUser.email, password: oldPw });
        if (authErr) { toast('原密码错误'); btn.disabled = false; return; }
        break;
      } catch (e) { if (attempt === 5) { toast('验证失败'); btn.disabled = false; return; } await new Promise(r => setTimeout(r, 1000)); }
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      toast(MSG_UPLOAD[attempt - 1], 1000);
      try {
        const { error } = await sb.auth.updateUser({ password: newPw });
        if (error) throw error;
        toast('密码修改成功'); btn.disabled = false; return;
      } catch (e) { if (attempt === 5) { toast('修改失败'); btn.disabled = false; } await new Promise(r => setTimeout(r, 1000)); }
    }
  }

  /* =========================================================
   *  管理面板
   * ========================================================= */
  async function openAdminPanel() {
    $('#admin-modal').hidden = false;
    $('#admin-user-list').innerHTML = '<li style="padding:12px;color:#7d8590;font-size:13px">加载中…</li>';
    $('#admin-template-list').innerHTML = '';
    
    let query = sb.from('profiles').select('*');
    if (userProfile.role === 'admin') query = query.eq('role', 'user');
    else if (userProfile.role === 'root') query = query.neq('id', cloudUser.id);

    for (let attempt = 1; attempt <= 5; attempt++) {
      toast(MSG_DOWNLOAD[attempt - 1], 1000);
      try {
        const { data, error } = await query;
        if (error) throw error;
        const ul = $('#admin-user-list'); ul.innerHTML = '';
        (data || []).forEach(u => {
          const li = document.createElement('li'); li.className = 'admin-user-item';
          li.innerHTML = `<span class="u-name">${esc(u.username)}</span>`;
          if (userProfile.role === 'root') {
            li.innerHTML += `<select class="role-select" data-uid="${u.id}">
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
              <option value="root" ${u.role === 'root' ? 'selected' : ''}>root</option>
            </select>`;
          } else {
            li.innerHTML += `<span class="u-role">${u.role}</span>`;
          }
          li.querySelector('.u-name').onclick = () => viewUserTemplates(u);
          
          if (userProfile.role === 'root') {
            li.querySelector('.role-select').onchange = async (e) => {
              const newRole = e.target.value;
              for (let i = 1; i <= 5; i++) {
                toast(MSG_UPLOAD[i - 1], 1000);
                try {
                  const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', u.id);
                  if (error) throw error;
                  toast('权限已更新'); break;
                } catch (err) { if (i === 5) { toast('修改失败'); e.target.value = u.role; } await new Promise(r => setTimeout(r, 1000)); }
              }
            };
          }
          ul.appendChild(li);
        });
        break;
      } catch (e) { if (attempt === 5) toast('加载失败'); await new Promise(r => setTimeout(r, 1000)); }
    }
  }

  async function viewUserTemplates(user) {
    $('#admin-viewer-head').textContent = `正在加载 ${user.username} 的模板…`;
    const ul = $('#admin-template-list'); ul.innerHTML = '';
    try {
      const { data: lib } = await sb.from('user_libs').select('data').eq('user_id', user.id).maybeSingle();
      if (!lib || !lib.data || !lib.data.template_ids) { $('#admin-viewer-head').textContent = `无模板`; return; }
      const { data: snips } = await sb.from('snippets').select('*').in('short_id', lib.data.template_ids);
      
      $('#admin-viewer-head').textContent = `${user.username} 的模板 (${snips.length} 个)`;
      snips.forEach(sn => {
        const li = document.createElement('li'); li.className = 'admin-user-item';
        li.innerHTML = `<span class="u-name">${esc(sn.name)} ${sn.is_public ? '🌐' : '🔒'}</span><span class="u-role">${sn.short_id}</span>`;
        li.onclick = () => {
          const t = { id: uid(), name: sn.name, content: sn.desc_text || '', short_id: sn.short_id, author_name: user.username, is_public: sn.is_public, updated: Date.now() };
          templates.unshift(t); persist(); renderTree(); viewTemplate(t.id); $('#admin-modal').hidden = true;
        };
        ul.appendChild(li);
      });
    } catch (e) { $('#admin-viewer-head').textContent = '加载失败'; }
  }

  /* =========================================================
   *  公共广场
   * ========================================================= */
  function openExploreModal() {
    $('#explore-modal').hidden = false;
    explorePage = 0; exploreQuery = ''; exploreType = 'keyword';
    $('#explore-type').value = 'keyword'; $('#explore-search').value = '';
    loadExplorePage();
  }

  async function loadExplorePage() {
    const ul = $('#explore-list');
    ul.innerHTML = '<li style="padding:12px;color:#7d8590;font-size:13px;text-align:center;">正在获取数据…</li>';
    $('#explore-prev').disabled = true; $('#explore-next').disabled = true;

    const pageSize = 10, start = explorePage * pageSize;
    let query = sb.from('snippets').select('*', { count: 'exact' }).eq('is_public', true);

    if (exploreQuery) {
      if (exploreType === 'keyword') query = query.or(`name.ilike.%${exploreQuery}%,desc_text.ilike.%${exploreQuery}%`);
      else if (exploreType === 'user') query = query.ilike('author_name', `%${exploreQuery}%`);
    }

    try {
      const { data, count, error } = await query.order('created_at', { ascending: false }).range(start, start + pageSize - 1);
      if (error) throw error;
      
      ul.innerHTML = '';
      if (!data || data.length === 0) {
        ul.innerHTML = '<li style="padding:20px;color:#5a6270;font-size:13px;text-align:center;">没有找到公开的模板</li>';
        $('#explore-page-info').textContent = `第 0 页`; return;
      }

      data.forEach(sn => {
        const li = document.createElement('li'); li.className = 'admin-user-item'; li.style.cursor = 'default';
        li.innerHTML = `
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; color:#e6edf3; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(sn.name)}</div>
            <div style="font-size:11px; color:#7d8590; margin-top:4px;">作者: ${esc(sn.author_name || '未知')}</div>
          </div>
          <button class="btn primary" style="padding:4px 12px; font-size:12px;">导入</button>
        `;
        li.querySelector('div').onclick = () => {
          const t = { id: uid(), name: sn.name, content: sn.desc_text || '', short_id: sn.short_id, author_name: sn.author_name, is_public: true, updated: Date.now() };
          templates.unshift(t); persist(); renderTree(); viewTemplate(t.id); $('#explore-modal').hidden = true; toast('已导入该模板');
        };
        li.querySelector('button').onclick = () => {
          const t = { id: uid(), name: sn.name, content: sn.desc_text || '', short_id: sn.short_id, author_name: sn.author_name, is_public: true, updated: Date.now() };
          templates.unshift(t); persist(); renderTree(); viewTemplate(t.id); $('#explore-modal').hidden = true; toast('成功导入到本地');
        };
        ul.appendChild(li);
      });

      const maxPage = Math.ceil(count / pageSize);
      $('#explore-page-info').textContent = `第 ${explorePage + 1} 页 / 共 ${maxPage} 页`;
      $('#explore-prev').disabled = explorePage === 0;
      $('#explore-next').disabled = (start + pageSize) >= count;
    } catch (e) { ul.innerHTML = '<li style="padding:20px;color:#f85149;font-size:13px;text-align:center;">网络异常，加载失败</li>'; }
  }

  /* =========================================================
   *  聊天室 (动态联系人 + 未读红点 + 撤回)
   * ========================================================= */
  function startChatPolling() { if (chatTimer) return; chatTimer = setInterval(pollChat, 3000); pollChat(); }
  function stopChatPolling() { clearInterval(chatTimer); chatTimer = null; }

  async function pollChat() {
    if (!cloudUser) return;
    
    try {
      const { data: msgs } = await sb.from('messages').select('sender_id, receiver_id, created_at')
        .or(`sender_id.eq.${cloudUser.id},receiver_id.eq.${cloudUser.id}`)
        .order('created_at', { ascending: false }).limit(100);
        
      chatContactsMap.clear();
      const missingIds = new Set();

      if (msgs) {
        msgs.forEach(m => {
          const peerId = m.sender_id === cloudUser.id ? m.receiver_id : m.sender_id;
          if (!peerId) return;
          if (!chatContactsMap.has(peerId)) {
            chatContactsMap.set(peerId, { lastMsgTime: new Date(m.created_at).getTime(), username: userCache[peerId] || '加载中...' });
            if (!userCache[peerId]) missingIds.add(peerId);
          }
        });
      }

      if (missingIds.size > 0) {
        const { data: profiles } = await sb.from('profiles').select('id, username').in('id', Array.from(missingIds));
        if (profiles) {
          profiles.forEach(p => {
            userCache[p.id] = p.username;
            if (chatContactsMap.has(p.id)) {
              chatContactsMap.get(p.id).username = p.username;
            }
          });
        }
      }
    } catch(e) { console.warn('获取联系人失败', e); }

    await checkUnreadStatus();

    if (!$('#chat-modal').hidden) {
      await loadChatMessages();
      renderChatContacts();
    }
  }

  async function checkUnreadStatus() {
    const { data: msgs } = await sb.from('messages').select('sender_id, receiver_id, created_at')
      .or(`sender_id.eq.${cloudUser.id},receiver_id.eq.${cloudUser.id}`)
      .order('created_at', { ascending: false }).limit(200);

    let hasUnreadGlobal = false;
    let unreadMap = {};

    if (msgs) {
      msgs.forEach(m => {
        const peerId = m.sender_id === cloudUser.id ? m.receiver_id : m.sender_id;
        const time = new Date(m.created_at).getTime();
        if (m.sender_id !== cloudUser.id) {
          const targetKey = peerId ? peerId : 'public';
          const lastRead = chatReadState[targetKey] || 0;
          if (time > lastRead) {
            unreadMap[targetKey] = true;
            hasUnreadGlobal = true;
          }
        }
      });
    }

    const chatBtn = $('#btn-chat');
    if (chatBtn) {
      if (hasUnreadGlobal) chatBtn.innerHTML = '💬 聊天 <span style="color:#f85149;font-size:16px;">●</span>';
      else chatBtn.innerHTML = '💬 聊天';
    }

    window._unreadMap = unreadMap;
  }

  function renderChatContacts() {
    const ul = $('#chat-contacts');
    if (!ul) return;
    const unreadMap = window._unreadMap || {};
    
    let html = `<li class="admin-user-item ${currentChatTarget === 'public' ? 'active' : ''}" data-uid="public">
      <span class="u-name">🌐 公共聊天室 ${unreadMap['public'] ? '<span style="color:#f85149;">●</span>' : ''}</span>
    </li>`;

    const contacts = Array.from(chatContactsMap.entries())
      .sort((a, b) => b[1].lastMsgTime - a[1].lastMsgTime);

    contacts.forEach(([uid, info]) => {
      const isActive = currentChatTarget === uid ? 'active' : '';
      const hasUnread = unreadMap[uid] ? '<span style="color:#f85149;">●</span>' : '';
      html += `<li class="admin-user-item ${isActive}" data-uid="${uid}" data-username="${esc(info.username)}">
        <span class="u-name">👤 ${esc(info.username)} ${hasUnread}</span>
      </li>`;
    });

    if ($('#chat-search-user').value.trim()) {
       // 搜索时由 searchChatUser 控制 DOM
    } else {
       ul.innerHTML = html;
    }
  }

  async function loadChatMessages() {
    if (!cloudUser || $('#chat-modal').hidden) return;
    let query = sb.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
    
    if (currentChatTarget === 'public') {
      query = query.is('receiver_id', null);
    } else {
      query = query.or(`and(sender_id.eq.${cloudUser.id},receiver_id.eq.${currentChatTarget}),and(sender_id.eq.${currentChatTarget},receiver_id.eq.${cloudUser.id})`);
    }

    try {
      const { data } = await query;
      if (!data) return;
      
      if (data.length > 0) {
        const newestTime = new Date(data[data.length - 1].created_at).getTime();
        if (!chatReadState[currentChatTarget] || newestTime > chatReadState[currentChatTarget]) {
           chatReadState[currentChatTarget] = newestTime;
           saveChatReadState();
        }
      }

      const ul = $('#chat-list'); let html = '';
      data.forEach(m => {
        const isMine = m.sender_id === cloudUser.id;
        const msgDate = new Date(m.created_at).getTime();
        const diffMin = (Date.now() - msgDate) / 1000 / 60;
        
        let contentHtml = esc(m.content);
        let revokeBtn = '';

        if (m.is_deleted) {
          contentHtml = '<span style="color:#7d8590;font-style:italic;">该消息已撤回</span>';
        } else if (isMine && diffMin <= 5) {
          revokeBtn = `<button class="revoke-btn" data-id="${m.id}" style="background:none;border:none;color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer;padding:0;margin-left:8px;text-decoration:underline;">撤回</button>`;
        }

        html += `<li class="chat-msg ${isMine ? 'mine' : 'other'}">
          ${!isMine ? `<div class="chat-sender">${esc(m.sender_name)}</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <span>${contentHtml}</span>
            ${revokeBtn}
          </div>
        </li>`;
      });
      ul.innerHTML = html; ul.parentElement.scrollTop = ul.parentElement.scrollHeight;
    } catch (e) {}
  }

  async function sendChatMessage() {
    const text = $('#chat-input').value.trim();
    if (!text || !cloudUser) return;
    $('#chat-input').value = '';
    try {
      const payload = { sender_id: cloudUser.id, sender_name: userProfile ? userProfile.username : cloudUser.email, content: text };
      if (currentChatTarget !== 'public') payload.receiver_id = currentChatTarget;
      await sb.from('messages').insert(payload);
      loadChatMessages();
    } catch (e) { toast('发送失败'); }
  }

  async function revokeMessage(id) {
    if (!confirm('确定撤回该消息？')) return;
    try {
      const { error } = await sb.from('messages').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      await loadChatMessages();
      toast('已撤回');
    } catch (e) { 
      console.error('撤回失败:', e);
      toast('撤回失败，请检查数据库权限或网络'); 
    }
  }

  async function searchChatUser() {
    const q = $('#chat-search-user').value.trim();
    const ul = $('#chat-contacts');
    
    if (!q) {
      renderChatContacts();
      return;
    }
    
    ul.innerHTML = '<li style="padding:10px;color:#7d8590;font-size:12px;">搜索中...</li>';
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    let query = sb.from('profiles').select('id, username');
    if (isUuid) query = query.eq('id', q);
    else query = query.ilike('username', `%${q}%`);
    
    try {
      const { data } = await query.limit(10);
      if (!data || !data.length) {
        ul.innerHTML = '<li style="padding:10px;color:#5a6270;font-size:12px;">未找到用户</li>';
        return;
      }
      ul.innerHTML = '';
      data.forEach(u => {
        if (u.id === cloudUser.id) return;
        userCache[u.id] = u.username; // 存入缓存
        const li = document.createElement('li');
        li.className = 'admin-user-item';
        li.dataset.uid = u.id;
        li.dataset.username = u.username;
        li.innerHTML = `<span class="u-name">👤 ${esc(u.username)}</span>`;
        ul.appendChild(li);
      });
    } catch (e) {
      ul.innerHTML = '<li style="padding:10px;color:#f85149;font-size:12px;">搜索失败</li>';
    }
  }

  /* =========================================================
   *  树形列表与模板操作
   * ========================================================= */
  function getEffectiveGroup(t) {
    if (t.manualGroupId !== undefined) {
      if (t.manualGroupId === null) return null;
      if (groups.some((g) => g.id === t.manualGroupId)) return t.manualGroupId;
    }
    if (!groups.length) return null;
    const hay = ((t.name || '') + ' ' + (t.content || '')).toLowerCase();
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

  function renderTree() {
    const q = $('#search').value.trim().toLowerCase();
    const templatesByGroup = new Map(), ungrouped = [];
    templates.forEach((t) => {
      if (q && !(t.name + t.content).toLowerCase().includes(q)) return;
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
        `<div class="tree-node group-node" style="padding-left:${pad + 10}px" data-gid="${g.id}">
          <span class="arrow">${expanded ? '▾' : '▸'}</span><span class="folder-icon">${expanded ? '📂' : '📁'}</span>
          <span class="node-name" title="${esc(g.name)}">${esc(g.name)}</span><span class="node-count">(${total})</span>
          <div class="node-ops">
            <button class="node-op" data-gop="add-sub" title="新建子分组">＋</button>
            <button class="node-op" data-gop="edit" title="编辑">⚙</button>
            <button class="node-op" data-gop="export" title="导出">📤</button>
            <button class="node-op danger" data-gop="delete" title="删除">✕</button>
          </div>
        </div>`
      );
      if (expanded) {
        childGroups.forEach((cg) => renderGroup(cg, depth + 1));
        directTemplates.forEach((t) => renderTemplate(t, depth + 1));
      }
    }
    function renderTemplate(t, depth) {
      const pad = depth * 16; const active = t.id === currentId ? ' active' : '';
      out.push(
        `<div class="tree-node template-node${active}" style="padding-left:${pad + 10}px" data-tid="${t.id}">
          <span class="arrow"></span><span class="file-icon">${t.is_public ? '📄' : '🔒'}</span>
          <span class="node-name" title="${esc(t.name)}">${esc(t.name)}</span>
          <div class="node-ops">
            <button class="node-op" data-top="rename" title="改名">✎</button>
            <button class="node-op" data-top="move" title="移动分组">⇄</button>
            <button class="node-op danger" data-top="delete" title="删除">✕</button>
          </div>
        </div>`
      );
    }
    
    groups.filter((g) => g.parentId === null || !groups.some((p) => p.id === g.parentId)).forEach((g) => renderGroup(g, 0));
    if (ungrouped.length) {
      out.push(`<div class="tree-node group-node" style="padding-left:10px" data-virtual="ungrouped"><span class="arrow"></span><span class="folder-icon">📄</span><span class="node-name" style="color:#9aa4b2">未分组</span><span class="node-count">(${ungrouped.length})</span></div>`);
      ungrouped.forEach((t) => renderTemplate(t, 1));
    }
    
    if (!out.length) {
      const empty = !templates.length && !groups.length;
      $('#list').innerHTML = empty ? '<div class="list-empty">没有模板\n点击「新建」开始</div>' : '<div class="list-empty">没有匹配的内容</div>';
    } else { $('#list').innerHTML = out.join(''); }
    $('#count').textContent = templates.length + ' 个模板 · ' + groups.length + ' 个分组';
  }

  function viewTemplate(id) {
    const t = templates.find(x => x.id === id); if (!t) return;
    currentId = id;
    $('#view-title').textContent = t.name;
    let meta = '作者: ' + (t.author_name || '本地');
    if (t.short_id) meta += ' · 分享编号: ' + t.short_id;
    meta += ` · ${t.is_public ? '🌐 公开' : '🔒 私密'}`;
    $('#view-meta').textContent = meta;

    $('#desc-view').innerHTML = renderMarkdown(t.content);
    $('#empty').hidden = true; $('#viewer').hidden = false; $('#desc-editor').hidden = true;

    const toggleBtn = $('#btn-toggle-public');
    if (toggleBtn) {
      toggleBtn.textContent = t.is_public ? '🌐 公开' : '🔒 私密';
      toggleBtn.style.color = t.is_public ? '#3fb950' : '#ff7b72';
    }

    $('#btn-share').onclick = async () => {
      if (!cloudUser) return toast('请先登录');
      try { await syncTemplateToCloud(t); 
        $('#share-id').value = t.short_id; 
        $('#share-url').value = location.origin + location.pathname + '#s=' + t.short_id; 
        $('#share-modal').hidden = false; viewTemplate(id);
      } catch (e) { toast('失败'); }
    };
    renderTree();
  }

  function showEmpty() {
    $('#empty').hidden = false; $('#viewer').hidden = true; $('#desc-editor').hidden = true;
    currentId = null; renderTree();
  }

  function openDescEditor() {
    const t = templates.find(x => x.id === currentId); if (!t) return;
    descEditingId = t.id;
    $('#desc-edit-name').textContent = t.name;
    $('#desc-md-input').value = t.content;
    $('#desc-preview').innerHTML = renderMarkdown(t.content);
    $('#empty').hidden = true; $('#viewer').hidden = true; $('#desc-editor').hidden = false;
    $('#desc-md-input').focus();
  }

  function saveDescEditor() {
    if (!descEditingId) return;
    const t = templates.find(x => x.id === descEditingId);
    if (t) { t.content = $('#desc-md-input').value; t.updated = Date.now(); }
    descEditingId = null; persist(); viewTemplate(currentId); toast('已保存');
  }

  function openGroupModal(gid, parentId) {
    editingGroupId = gid === undefined ? null : gid; pendingParentId = parentId || null;
    if (editingGroupId) {
      const g = groups.find(x => x.id === editingGroupId); if (!g) return;
      $('#group-modal-title').textContent = '编辑分组'; $('#group-name-input').value = g.name; $('#group-kw-input').value = (g.keywords || []).join(', ');
    } else {
      const parent = pendingParentId ? groups.find(x => x.id === pendingParentId) : null;
      $('#group-modal-title').textContent = parent ? ('新建子分组 · ' + parent.name) : '新建分组'; 
      $('#group-name-input').value = ''; $('#group-kw-input').value = '';
    }
    $('#group-modal').hidden = false; $('#group-name-input').focus(); $('#group-name-input').select();
  }

  function closeGroupModal() { $('#group-modal').hidden = true; editingGroupId = undefined; pendingParentId = null; }

  function saveGroupModal() {
    const name = $('#group-name-input').value.trim() || '新分组';
    const keywords = $('#group-kw-input').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (editingGroupId) { 
      const g = groups.find(x => x.id === editingGroupId); if (g) { g.name = name; g.keywords = keywords; } 
    } else { 
      groups.push({ id: uid(), name, parentId: pendingParentId, collapsed: false, keywords }); 
    }
    persist(); closeGroupModal(); renderTree(); toast('分组已保存');
  }

  function deleteGroup(g) {
    const ids = collectGroupIds(g.id), affected = templates.filter((t) => t.manualGroupId && ids.has(t.manualGroupId));
    if (!confirm(`确定删除分组「${g.name}」吗？${affected.length ? affected.length + ' 个模板将移回未分组' : ''}`)) return;
    affected.forEach((t) => { t.manualGroupId = null; });
    groups = groups.filter((x) => !ids.has(x.id)); persist(); renderTree(); toast('分组已删除');
  }

  function showGroupPicker(tid, anchor) {
    if (groupPicker) groupPicker.remove();
    const t = templates.find((x) => x.id === tid); if (!t) return;
    const picker = document.createElement('div'); picker.className = 'group-picker'; const effectiveGid = getEffectiveGroup(t);
    function addItem(gid, label, depth) {
      const item = document.createElement('div'); item.className = 'picker-item' + (gid === effectiveGid ? ' selected' : '');
      item.style.paddingLeft = (12 + depth * 14) + 'px'; item.textContent = (gid === null ? '○' : '📁') + ' ' + label;
      item.onclick = () => { t.manualGroupId = gid; t.updated = Date.now(); persist(); picker.remove(); renderTree(); toast('已移动到 ' + label); };
      picker.appendChild(item);
    }
    addItem(null, '未分组', 0);
    function addGroup(g, depth) { addItem(g.id, g.name, depth); groups.filter(x => x.parentId === g.id).forEach(cg => addGroup(cg, depth + 1)); }
    groups.filter((g) => g.parentId === null).forEach((g) => addGroup(g, 0));
    const rect = anchor.getBoundingClientRect();
    picker.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px'; picker.style.top = Math.min(rect.bottom + 4, window.innerHeight - 260) + 'px';
    document.body.appendChild(picker); groupPicker = picker;
  }

  /* =========================================================
   *  导入导出
   * ========================================================= */
  async function importFiles(files) {
    if (!files || !files.length) return;
    let okCount = 0;
    for (const file of files) {
      try {
        const text = await file.text(); const base = file.name.replace(/\.[^./\\]+$/, '') || file.name;
        templates.unshift({ id: uid(), name: base, content: '```text\n' + text + '\n```', is_public: true, updated: Date.now() });
        okCount++;
      } catch (e) {}
    }
    if (!okCount) { toast('导入失败'); return; }
    persist(); renderTree(); viewTemplate(templates[0].id); toast('已导入 ' + okCount + ' 个模板');
  }

  function download(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function renderExportList() {
    const ul = $('#export-list'); ul.innerHTML = '';
    $('#total-count').textContent = templates.length;
    templates.forEach(t => {
      const li = document.createElement('li'); li.dataset.id = t.id;
      li.innerHTML = `<input type="checkbox" ${exportSet.has(t.id) ? 'checked' : ''}>
        <span class="ex-name">${esc(t.name)}</span><span class="ex-meta">${t.content.length} 字符</span>`;
      li.onclick = (e) => {
        const cb = li.querySelector('input');
        if (e.target !== cb) cb.checked = !cb.checked;
        if (cb.checked) exportSet.add(t.id); else exportSet.delete(t.id);
        $('#sel-count').textContent = exportSet.size;
      };
      ul.appendChild(li);
    });
    $('#sel-count').textContent = exportSet.size;
  }

  async function exportSelected() {
    const list = templates.filter(t => exportSet.has(t.id));
    if (!list.length) return toast('请至少选择一个模板');
    $('#export-modal').hidden = true;
    for (let i = 0; i < list.length; i++) {
      download(sanitizeFilename(list[i].name) + '.md', list[i].content);
      await new Promise(r => setTimeout(r, 280));
    }
    toast('已导出 ' + list.length + ' 个文件');
  }

  /* =========================================================
   *  绑定所有事件
   * ========================================================= */
  function bindEvents() {
    const bind = (id, fn) => { const el = $('#'+id); if (el) el.onclick = fn; };

    bind('btn-new', () => {
      const t = { id: uid(), name: '新建模板', content: '', is_public: true, updated: Date.now() };
      templates.unshift(t); persist(); currentId = t.id; renderTree(); viewTemplate(t.id); openDescEditor();
    });
    bind('btn-import', () => $('#file-input').click());
    bind('btn-export', () => { exportSet = new Set(templates.map(t => t.id)); renderExportList(); $('#export-modal').hidden = false; });
    bind('btn-group', () => openGroupModal(null, null));
    bind('btn-explore', openExploreModal);
    bind('btn-chat', () => { 
      currentChatTarget = 'public'; 
      $('#chat-title').textContent = '公共聊天室'; 
      $('#chat-search-user').value = '';
      $('#chat-modal').hidden = false; 
      pollChat(); 
    });
    bind('btn-open-share', () => { $('#open-modal').hidden = false; });
    bind('btn-sync', () => { $('#sync-info').textContent = `本地: ${templates.length} 个模板`; $('#sync-modal').hidden = false; });
    
    bind('btn-toggle-public', () => {
      const t = templates.find(x => x.id === currentId); if (!t) return;
      t.is_public = !t.is_public;
      persist();
      viewTemplate(t.id);
      toast(t.is_public ? '已设为公开' : '已设为私密');
    });

    $('#file-input').onchange = () => { const files = Array.from($('#file-input').files || []); $('#file-input').value = ''; if (files.length) importFiles(files); };
    $('#search').oninput = renderTree;

    $('#list').onclick = (e) => {
      const groupNode = e.target.closest('.group-node'), templateNode = e.target.closest('.template-node'), op = e.target.closest('.node-op');
      if (op) {
        e.stopPropagation();
        if (groupNode) {
          const g = groups.find(x => x.id === groupNode.dataset.gid); if (!g) return;
          const gop = op.dataset.gop;
          if (gop === 'add-sub') openGroupModal(null, g.id);
          else if (gop === 'edit') openGroupModal(g.id);
          else if (gop === 'export') { exportSet = new Set(templates.filter(t => getEffectiveGroup(t) === g.id).map(t => t.id)); renderExportList(); $('#export-modal').hidden = false; }
          else if (gop === 'delete') deleteGroup(g);
        } else if (templateNode) {
          const t = templates.find(x => x.id === templateNode.dataset.tid); if (!t) return;
          const top = op.dataset.top;
          if (top === 'rename') { const name = prompt('新名称：', t.name); if (name && name.trim()) { t.name = name.trim(); persist(); viewTemplate(t.id); } }
          else if (top === 'move') showGroupPicker(t.id, op);
          else if (top === 'delete') { if (confirm('确定删除？')) { templates = templates.filter(x => x.id !== t.id); if (currentId === t.id) showEmpty(); persist(); renderTree(); } }
        }
        return;
      }
      if (groupNode) {
        if (groupNode.dataset.virtual === 'ungrouped') return;
        const g = groups.find(x => x.id === groupNode.dataset.gid);
        if (g) { g.collapsed = !g.collapsed; persist(); renderTree(); }
        return;
      }
      if (templateNode) viewTemplate(templateNode.dataset.tid);
    };

    bind('btn-desc', openDescEditor);
    bind('btn-desc-save', saveDescEditor);
    bind('btn-desc-cancel', () => { descEditingId = null; viewTemplate(currentId); });
    $('#desc-md-input').oninput = (e) => { $('#desc-preview').innerHTML = renderMarkdown(e.target.value); };
    bind('btn-del', () => { if (currentId && confirm('确定删除？')) { templates = templates.filter(x => x.id !== currentId); showEmpty(); persist(); renderTree(); } });
    bind('btn-copy-md', () => { const t = templates.find(x => x.id === currentId); if (t) { navigator.clipboard.writeText(t.content); toast('已复制'); } });

    bind('btn-login', () => { $('#auth-modal').hidden = false; });
    bind('profile-close', () => { $('#profile-modal').hidden = true; });
    bind('btn-save-username', saveUsername);
    bind('btn-save-pw', savePassword);
    bind('btn-admin-panel', () => { $('#profile-modal').hidden = true; openAdminPanel(); });
    bind('admin-close', () => { $('#admin-modal').hidden = true; });
    
    bind('explore-close', () => { $('#explore-modal').hidden = true; });
    bind('explore-search-btn', () => { exploreQuery = $('#explore-search').value.trim(); exploreType = $('#explore-type').value; explorePage = 0; loadExplorePage(); });
    bind('explore-prev', () => { if (explorePage > 0) { explorePage--; loadExplorePage(); } });
    bind('explore-next', () => { explorePage++; loadExplorePage(); });

    bind('chat-close', () => { $('#chat-modal').hidden = true; });
    bind('chat-send', sendChatMessage);
    $('#chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendChatMessage(); };
    
    $('#chat-search-user').oninput = () => {
      clearTimeout(window._chatSearchT);
      window._chatSearchT = setTimeout(searchChatUser, 400);
    };
    $('#chat-contacts').onclick = (e) => {
      const li = e.target.closest('.admin-user-item'); if (!li) return;
      const uid = li.dataset.uid;
      currentChatTarget = uid;
      const name = uid === 'public' ? '公共聊天室' : (li.dataset.username || '私聊');
      $('#chat-title').textContent = name === '公共聊天室' ? name : ('与 ' + name + ' 私聊');
      $('#chat-list').innerHTML = ''; 
      $('#chat-search-user').value = '';
      loadChatMessages();
      renderChatContacts();
    };
    $('#chat-list').onclick = (e) => {
      if (e.target.classList.contains('revoke-btn')) {
        revokeMessage(e.target.dataset.id);
      }
    };

    bind('modal-close', () => { $('#export-modal').hidden = true; });
    bind('export-cancel', () => { $('#export-modal').hidden = true; });
    bind('export-confirm', exportSelected);
    bind('group-modal-close', closeGroupModal);
    bind('group-modal-cancel', closeGroupModal);
    bind('group-modal-save', saveGroupModal);
    bind('sync-close', () => { $('#sync-modal').hidden = true; });
    bind('sync-push', async () => { $('#sync-modal').hidden = true; await pushCloud(false); });
    bind('sync-pull', async () => { $('#sync-modal').hidden = true; if (confirm('覆盖本地数据？')) await pullCloud(false); });
    
    bind('share-close', () => { $('#share-modal').hidden = true; });
    bind('share-copy-id', () => { navigator.clipboard.writeText($('#share-id').value); toast('编号已复制'); });
    bind('share-copy-url', () => { navigator.clipboard.writeText($('#share-url').value); toast('链接已复制'); });
    bind('open-close', () => { $('#open-modal').hidden = true; });
    bind('open-cancel', () => { $('#open-modal').hidden = true; });
    bind('open-confirm', async () => {
      const id = $('#open-id').value.trim(); if (!id) return;
      try {
        const { data } = await sb.from('snippets').select('*').eq('short_id', id).maybeSingle();
        if (data) {
          const t = { id: uid(), name: data.name, content: data.desc_text, short_id: data.short_id, author_name: data.author_name, is_public: data.is_public, updated: Date.now() };
          templates.unshift(t); persist(); renderTree(); viewTemplate(t.id); $('#open-modal').hidden = true; toast('导入成功');
        } else toast('未找到该编号');
      } catch(e) { toast('网络异常'); }
    });

    bind('auth-close', () => { $('#auth-modal').hidden = true; });
    bind('auth-register', async () => {
      const u = $('#auth-user').value.trim(), p = $('#auth-pass').value;
      if (!u || p.length < 6) return toast('格式错误');
      try { 
        await sb.auth.signUp({ email: u + '@' + EMAIL_DOMAIN, password: p }); 
        await sb.auth.signInWithPassword({ email: u + '@' + EMAIL_DOMAIN, password: p }); 
        $('#auth-modal').hidden = true; toast('注册成功'); 
      } catch (e) { toast(e.message); }
    });
    bind('auth-login-btn', async () => {
      const u = $('#auth-user').value.trim(), p = $('#auth-pass').value;
      try { 
        await sb.auth.signInWithPassword({ email: u + '@' + EMAIL_DOMAIN, password: p }); 
        $('#auth-modal').hidden = true; toast('登录成功'); 
      } catch (e) { toast('账号或密码错误'); }
    });
    bind('btn-logout', async () => {
      if (!confirm('退出并清空本地缓存？')) return;
      templates = []; localStorage.removeItem(KEY); setUser(null); showEmpty(); sb.auth.signOut(); toast('已退出');
    });

    bind('btn-settings', (e) => { e.stopPropagation(); $('#settings-panel').hidden = !$('#settings-panel').hidden; });
    document.addEventListener('click', (e) => { if (!$('#settings-panel').hidden && !$('#settings-panel').contains(e.target) && !e.target.closest('#btn-settings')) $('#settings-panel').hidden = true; });
    $('#set-size').oninput = () => { settings.size = Number($('#set-size').value) || 14; $('#set-size-val').textContent = settings.size + 'px'; saveSettings(); };
    $('#set-font').onchange = () => { settings.font = $('#set-font').value; saveSettings(); };
    
    document.addEventListener('click', (e) => {
      if (groupPicker && !groupPicker.contains(e.target)) groupPicker.remove();
      const btn = e.target.closest('.copy-code');
      if (btn) { const code = decodeURIComponent(btn.dataset.code || ''); navigator.clipboard.writeText(code); toast('已复制'); }
    });
  }

  function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--ui-font', FONTS[settings.font] || FONTS.system);
    root.style.setProperty('--ui-size', settings.size + 'px');
    root.style.setProperty('--md-size', (settings.size * 0.96).toFixed(2) + 'px');
    root.style.setProperty('--code-size', (settings.size * 0.93).toFixed(2) + 'px');
  }
  function loadSettings() {
    try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if (s) { settings.font = s.font || 'system'; settings.size = s.size || 14; } } catch(e){}
    applySettings(); $('#set-size').value = settings.size; $('#set-size-val').textContent = settings.size + 'px'; $('#set-font').value = settings.font;
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); applySettings();
  }

  // 启动
  loadSettings(); load(); bindEvents(); renderTree();
  if (CLOUD) {
    sb.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); });
    sb.auth.onAuthStateChange((_e, s) => { setUser(s?.user || null); });
  }

  const m = location.hash.match(/^#s=([0-9a-fA-F]{6,64})$/);
  if (m && CLOUD) {
    setTimeout(async () => {
      toast('获取分享中...');
      const { data } = await sb.from('snippets').select('*').eq('short_id', m[1]).maybeSingle();
      if (data) {
        const t = { id: uid(), name: data.name, content: data.desc_text, short_id: data.short_id, author_name: data.author_name, is_public: data.is_public, updated: Date.now() };
        templates.unshift(t); persist(); renderTree(); viewTemplate(t.id);
      }
    }, 500);
  }
})();