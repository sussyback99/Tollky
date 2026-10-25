const BIN_ID = "6ade1987ac6210605a50f28e";
const API_KEY = "$2a$10$HoVh7lqU9I4tGxR.J.6sCudF5gICqVwTELdQcUkBxYKpJI9FzJ0jC";
const API = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const $ = id => document.getElementById(id);
const state = { data: null, sub: null, q: "", votes: JSON.parse(localStorage.getItem("votes") || "{}") };
const saveVotes = () => localStorage.setItem("votes", JSON.stringify(state.votes));

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const when = ts => {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "только что";
  if (d < 3600) return Math.floor(d/60) + " мин назад";
  if (d < 86400) return Math.floor(d/3600) + " ч назад";
  return new Date(ts).toLocaleDateString();
};
const shortId = id => String(id).slice(-6);

async function load() {
  const r = await fetch(`${API}/latest`, { headers: { "X-Master-Key": API_KEY } });
  const j = await r.json();
  state.data = j.record;
  if (!state.data.subs) state.data.subs = [];
  if (!state.data.posts) state.data.posts = [];
}

async function save() {
  await fetch(API, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
    body: JSON.stringify(state.data)
  });
}

function renderSubs() {
  $("subNav").innerHTML = state.data.subs.map(s =>
    `<a href="#/r/${encodeURIComponent(s)}" class="${state.sub === s ? "active" : ""}">/${esc(s)}</a>`
  ).join(" ");
}

function renderFeed() {
  let posts = [...state.data.posts].sort((a,b) => b.created - a.created);
  if (state.sub) posts = posts.filter(p => p.sub === state.sub);
  if (state.q) {
    const q = state.q.toLowerCase();
    posts = posts.filter(p => p.title.toLowerCase().includes(q) || (p.text||"").toLowerCase().includes(q));
  }
  if (!posts.length) {
    $("feed").innerHTML = `<div class="post"><div class="body">Тут пусто. Создай первый пост!</div></div>`;
    return;
  }
  $("feed").innerHTML = posts.map(p => {
    const v = state.votes[p.id] || 0;
    return `<div class="post" data-id="${p.id}">
      <div class="meta">
        <a class="sub" href="#/r/${encodeURIComponent(p.sub)}">/${esc(p.sub)}</a>
        <span class="date">${when(p.created)}</span>
        <span class="id">No.${shortId(p.id)}</span>
      </div>
      ${p.title ? `<div class="subject">${esc(p.title)}</div>` : ""}
      <div class="body">${esc(p.text)}</div>
      <div class="votes">
        <button data-dir="1" class="${v===1?"up":""}">▲ ${p.score}</button>
        <button data-dir="-1" class="${v===-1?"down":""}">▼</button>
      </div>
    </div>`;
  }).join("");
  document.querySelectorAll(".post").forEach(el => {
    const id = el.dataset.id;
    el.querySelectorAll(".votes button").forEach(btn => {
      btn.onclick = () => vote(id, Number(btn.dataset.dir));
    });
  });
}

async function vote(postId, dir) {
  const post = state.data.posts.find(p => String(p.id) === String(postId));
  if (!post) return;
  const old = state.votes[postId] || 0;
  let delta;
  if (old === dir) { delete state.votes[postId]; delta = -dir; }
  else if (old === 0) { state.votes[postId] = dir; delta = dir; }
  else { state.votes[postId] = dir; delta = dir * 2; }
  post.score += delta;
  saveVotes();
  renderFeed();
  await save();
}

async function createPost() {
  const sub = $("postSub").value;
  const title = $("postTitle").value.trim();
  const text = $("postText").value.trim();
  if (!title && !text) return alert("Заполни заголовок или текст");
  state.data.posts.push({ id: Date.now(), sub, title, text, score: 0, created: Date.now() });
  await save();
  closeModal();
  renderFeed();
}

async function createSub() {
  const name = prompt("Название ветки (a-z, 0-9, _):");
  if (!name) return;
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!clean) return alert("Только a-z, 0-9, _");
  if (state.data.subs.includes(clean)) return alert("Уже есть");
  state.data.subs.push(clean);
  await save();
  renderSubs();
  renderSelect();
  location.hash = `#/r/${clean}`;
}

function renderSelect() {
  $("postSub").innerHTML = state.data.subs.map(s =>
    `<option value="${esc(s)}" ${s === state.sub ? "selected" : ""}>/${esc(s)}</option>`
  ).join("");
}

function openModal() {
  renderSelect();
  $("postTitle").value = "";
  $("postText").value = "";
  $("modal").classList.remove("hidden");
  $("postTitle").focus();
}
function closeModal() { $("modal").classList.add("hidden"); }

async function route() {
  const m = (location.hash.slice(1) || "/").match(/^\/r\/([^/]+)/);
  state.sub = m ? decodeURIComponent(m[1]) : null;
  renderSubs();
  renderFeed();
}

$("newPostBtn").onclick = openModal;
$("newSubBtn").onclick = createSub;
$("cancelBtn").onclick = closeModal;
$("submitPost").onclick = createPost;
$("search").oninput = e => { state.q = e.target.value; renderFeed(); };
$("modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
window.onhashchange = route;
$("year").textContent = new Date().getFullYear();

(async () => {
  await load();
  renderSubs();
  renderSelect();
  route();
})();
