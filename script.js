(function () {
  const root = document.documentElement;

  // ---- Theme toggle (remembered per browser) ----
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const saved = store.get('theme');
  if (saved) root.setAttribute('data-theme', saved);
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    const current = root.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('theme', next);
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  // ---- Nav border on scroll + active section ----
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const links = [...document.querySelectorAll('.nav nav a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));

    const reveal = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  // ---- Writeups, loaded live from the GitHub repo ----
  const OWNER = 'Gorga-code';
  const REPO = 'WriteUps';
  const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
  const list = document.getElementById('writeups-list');
  const tools = document.querySelector('.writeup-tools');
  const search = document.getElementById('writeup-search');
  const count = document.getElementById('writeup-count');

  const CATEGORIES = ['web', 'crypto', 'pwn', 'rev', 'reverse', 'forensic', 'forensics', 'misc', 'osint', 'stego', 'blockchain', 'binary'];
  const pretty = s => s.replace(/\.(md|markdown|pdf|txt|ipynb)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fallback(msg) {
    tools.hidden = true;
    list.innerHTML = `<div class="wu-fallback">${msg} Browse them directly on
      <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub ↗</a>.</div>`;
  }

  function build(tree, branch) {
    // A writeup = a markdown/pdf file, or a folder containing a README/writeup file.
    const files = tree.filter(t => t.type === 'blob' && /\.(md|markdown|pdf|ipynb)$/i.test(t.path));
    const entries = new Map(); // key: path of writeup -> {title, url, group, tag}

    files.forEach(f => {
      const parts = f.path.split('/');
      if (parts.length === 1) {
        if (/^readme/i.test(parts[0])) return; // repo README
        entries.set(f.path, { group: 'General', title: pretty(parts[0]), path: f.path, kind: 'blob', tagSrc: [] });
        return;
      }
      const group = parts[0];
      const file = parts[parts.length - 1];
      const isReadme = /^(readme|writeup|solution|solve)\.(md|markdown)$/i.test(file);
      // A README inside a challenge folder represents that folder.
      const titleParts = isReadme ? parts.slice(1, -1) : parts.slice(1);
      if (titleParts.length === 0) return; // group-level README
      const key = isReadme ? parts.slice(0, -1).join('/') : f.path;
      if (entries.has(key)) return;
      entries.set(key, {
        group,
        title: pretty(titleParts[titleParts.length - 1]),
        path: isReadme ? key : f.path,
        kind: isReadme ? 'tree' : 'blob',
        tagSrc: titleParts.slice(0, -1).concat(parts[0]),
      });
    });

    if (!entries.size) return fallback('No writeups found in the repository yet.');

    const groups = new Map();
    entries.forEach(e => {
      const tag = e.tagSrc.map(s => s.toLowerCase()).find(s => CATEGORIES.includes(s)) || '';
      e.tag = tag;
      e.url = `${REPO_URL}/${e.kind}/${branch}/${e.path.split('/').map(encodeURIComponent).join('/')}`;
      if (!groups.has(e.group)) groups.set(e.group, []);
      groups.get(e.group).push(e);
    });

    const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    list.innerHTML = sorted.map(([g, items], i) => `
      <details class="wu-group" ${i < 2 ? 'open' : ''} data-group="${esc(g.toLowerCase())}">
        <summary>
          <span class="wu-name">${esc(pretty(g))}</span>
          <span class="wu-n">${items.length} writeup${items.length === 1 ? '' : 's'}</span>
        </summary>
        <ul>
          ${items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })).map(it => `
            <li data-text="${esc((it.title + ' ' + it.tag + ' ' + g).toLowerCase())}">
              <a href="${it.url}" target="_blank" rel="noopener">${esc(it.title)}</a>
              ${it.tag ? `<span class="wu-tag">${esc(it.tag)}</span>` : ''}
            </li>`).join('')}
        </ul>
      </details>`).join('');

    const total = entries.size;
    tools.hidden = false;
    count.textContent = `${total} total`;

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      list.querySelectorAll('.wu-group').forEach(d => {
        let n = 0;
        d.querySelectorAll('li').forEach(li => {
          const hit = !q || li.dataset.text.includes(q) || d.dataset.group.includes(q);
          li.hidden = !hit;
          if (hit) n++;
        });
        d.hidden = n === 0;
        if (q && n) d.open = true;
        shown += n;
      });
      count.textContent = q ? `${shown} / ${total}` : `${total} total`;
    });
  }

  async function loadWriteups() {
    const cacheKey = 'writeups-v1';
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (cached) return build(cached.tree, cached.branch);
    } catch (e) {}

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`);
      if (repoRes.status === 404) return fallback('The writeups repository isn’t public yet.');
      if (!repoRes.ok) throw new Error(repoRes.status);
      const branch = (await repoRes.json()).default_branch || 'main';
      const treeRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${branch}?recursive=1`);
      if (!treeRes.ok) throw new Error(treeRes.status);
      const tree = (await treeRes.json()).tree || [];
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ tree, branch })); } catch (e) {}
      build(tree, branch);
    } catch (e) {
      fallback('Couldn’t load the writeup list right now.');
    }
  }

  loadWriteups();
})();
