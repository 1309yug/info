// ============================================================
// Secure Cloud Vault - GitHub Pages frontend
// ============================================================

// Replace this with your deployed Apps Script Web App URL.
const API_URL = "https://script.google.com/macros/s/AKfycbwkO4wXnuNQ6GbrUu7X3cY7B_HfSJFUr9SegrZUkUIbQZTLE92NiXejg-6-0H1ee4AnzA/exec";

let authToken = sessionStorage.getItem("vault_token") || "";
let currentUser = null;
let selectedFiles = [];
let deleteTarget = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("vault_theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;
  $("theme-btn").textContent = savedTheme === "dark" ? "☀️ Light" : "🌙 Dark";

  $("theme-btn").onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("vault_theme", next);
    $("theme-btn").textContent = next === "dark" ? "☀️ Light" : "🌙 Dark";
  };

  $("login-btn").onclick = login;
  $("login-form").onsubmit = e => { e.preventDefault(); login(); };
  $("logout-btn").onclick = logout;
  $("refresh-btn").onclick = loadFiles;

  $("file-input").onchange = e => addFiles(e.target.files);
  $("drop-zone").onclick = e => {
    if (e.target.tagName !== "LABEL") $("file-input").click();
  };
  ["dragenter","dragover"].forEach(ev => $("drop-zone").addEventListener(ev, e => {
    e.preventDefault(); $("drop-zone").classList.add("drag");
  }));
  ["dragleave","drop"].forEach(ev => $("drop-zone").addEventListener(ev, e => {
    e.preventDefault(); $("drop-zone").classList.remove("drag");
  }));
  $("drop-zone").addEventListener("drop", e => addFiles(e.dataTransfer.files));
  $("upload-btn").onclick = uploadFiles;

  $("password-form").onsubmit = async e => {
    e.preventDefault();
    const oldPass = $("current-password").value;
    const newPass = $("new-password-change").value;
    const confirm = $("confirm-password-change").value;
    $("password-status").textContent = "";
    if (newPass.length < 8) return setStatus("password-status","New password must be at least 8 characters.");
    if (newPass !== confirm) return setStatus("password-status","New passwords do not match.");
    const r = await api("changePassword", {currentPassword: oldPass, newPassword: newPass});
    setStatus("password-status", r.message || (r.success ? "Password changed." : "Password change failed."));
    if (r.success) $("password-form").reset();
  };

  $("create-user-form").onsubmit = async e => {
    e.preventDefault();
    const payload = {
      username: $("new-username").value.trim(),
      email: $("new-email").value.trim(),
      role: $("new-role").value,
      password: $("new-password").value
    };
    const r = await api("createUser", payload);
    alert(r.message || (r.success ? "User created." : "Creation failed."));
    if (r.success) { $("create-user-form").reset(); loadUsers(); }
  };

  $("cancel-delete").onclick = closeDelete;
  $("confirm-delete").onclick = async () => {
    if (!deleteTarget) return;
    const r = await api("deleteFile", {fileId: deleteTarget.id});
    closeDelete();
    if (!r.success) alert(r.message || "Delete failed.");
    await loadFiles();
  };

  if (authToken) validateSession();
});

async function api(action, data = {}) {
  if (!API_URL || API_URL.includes("PASTE_YOUR")) {
    return {success:false, message:"Set API_URL in script.js first."};
  }
  try {
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action, token:authToken, ...data})
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return {success:false,message:"Server returned invalid JSON."}; }
  } catch (e) {
    console.error(e);
    return {success:false,message:"Unable to connect to the server."};
  }
}

async function login() {
  const password = $("login-password").value.trim();
  $("login-error").textContent = "";
  if (password.length < 8) {
    $("login-error").textContent = "Password must be at least 8 characters.";
    return;
  }
  $("login-btn").disabled = true;
  $("login-text").textContent = "Signing In...";
  $("login-spinner").classList.remove("hidden");
  const r = await api("login", {password});
  $("login-btn").disabled = false;
  $("login-text").textContent = "Sign In";
  $("login-spinner").classList.add("hidden");

  if (!r.success) {
    $("login-error").textContent = r.message || "Invalid password.";
    return;
  }
  authToken = r.token;
  sessionStorage.setItem("vault_token", authToken);
  currentUser = r.user;
  showDashboard();
}

async function validateSession() {
  const r = await api("session");
  if (r.success) {
    currentUser = r.user;
    showDashboard();
  } else {
    sessionStorage.removeItem("vault_token");
    authToken = "";
  }
}

function showDashboard() {
  $("login-screen").classList.add("hidden");
  $("dashboard-screen").classList.remove("hidden");
  $("username-label").textContent = currentUser.username;
  $("role-label").textContent = currentUser.role;
  const isOwner = ["owner","admin"].includes(String(currentUser.role).toLowerCase());
  $("admin-section").classList.toggle("hidden", !isOwner);
  loadFiles();
  if (isOwner) loadUsers();
}

function logout() {
  api("logout").catch(()=>{});
  authToken = "";
  sessionStorage.removeItem("vault_token");
  currentUser = null;
  selectedFiles = [];
  $("dashboard-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  $("login-password").value = "";
  $("login-error").textContent = "";
}

function addFiles(fileList) {
  for (const file of fileList) selectedFiles.push(file);
  renderQueue();
  $("file-input").value = "";
}

function renderQueue() {
  const q = $("queue");
  q.innerHTML = "";
  selectedFiles.forEach((file,i) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${file.name} (${formatBytes(file.size)})`;
    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.onclick = () => { selectedFiles.splice(i,1); renderQueue(); };
    li.append(name,btn); q.appendChild(li);
  });
  $("upload-btn").disabled = selectedFiles.length === 0;
}

async function uploadFiles() {
  if (!selectedFiles.length) return;
  $("upload-btn").disabled = true;
  for (let i=0;i<selectedFiles.length;i++) {
    const file = selectedFiles[i];
    $("upload-status").textContent = `Uploading ${i+1}/${selectedFiles.length}: ${file.name}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base64 = bytesToBase64(bytes);
      const r = await api("upload", {
        filename:file.name,
        mimeType:file.type || "application/octet-stream",
        fileData:base64
      });
      if (!r.success) alert(`Upload failed for ${file.name}: ${r.message}`);
    } catch(e) {
      alert(`Upload failed for ${file.name}.`);
    }
  }
  selectedFiles = [];
  renderQueue();
  $("upload-status").textContent = "Upload complete.";
  await loadFiles();
}

async function loadFiles() {
  $("files-grid").innerHTML = `<p class="muted">Loading files...</p>`;
  const r = await api("getFiles");
  if (!r.success) {
    $("files-grid").innerHTML = `<p class="error">${escapeHtml(r.message || "Unable to load files.")}</p>`;
    return;
  }
  if (!r.files.length) {
    $("files-grid").innerHTML = `<p class="muted">No files stored yet.</p>`;
    return;
  }
  $("files-grid").innerHTML = "";
  r.files.forEach(file => {
    const card = document.createElement("article");
    card.className = "file";
    const name = document.createElement("div");
    name.className = "file-name";
    name.title = file.name;
    name.textContent = file.name;
    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.textContent = `${formatBytes(file.size)} • By ${file.uploadedBy} • ${file.created}`;
    const buttons = document.createElement("div");
    buttons.className = "file-buttons";
    const dl = document.createElement("button");
    dl.className = "primary";
    dl.textContent = "Download";
    dl.onclick = () => downloadFile(file);
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.onclick = () => openDelete(file);
    buttons.append(dl,del);
    card.append(name,meta,buttons);
    $("files-grid").appendChild(card);
  });
}

async function downloadFile(file) {
  const r = await api("download", {fileId:file.id});
  if (!r.success) return alert(r.message || "Download failed.");
  const binary = atob(r.data);
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], {type:r.mimeType || "application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = r.name || file.name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function openDelete(file) {
  deleteTarget = file;
  $("delete-text").textContent = `Delete "${file.name}"?`;
  $("modal").classList.remove("hidden");
}
function closeDelete() {
  deleteTarget = null;
  $("modal").classList.add("hidden");
}

async function loadUsers() {
  const r = await api("getUsers");
  if (!r.success) return;
  $("users-list").innerHTML = "";
  r.users.forEach(u => {
    const row = document.createElement("div");
    row.className = "user-row";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = u.username;
    const sub = document.createElement("small");
    sub.textContent = ` • ${u.email} • ${u.role}`;
    info.append(title,sub);
    const btn = document.createElement("button");
    btn.className = "danger";
    btn.textContent = "Delete";
    btn.disabled = u.username === currentUser.username;
    btn.onclick = async () => {
      if (!confirm(`Delete user ${u.username}?`)) return;
      const x = await api("deleteUser",{username:u.username});
      alert(x.message || "");
      if (x.success) loadUsers();
    };
    row.append(info,btn);
    $("users-list").appendChild(row);
  });
}

function setStatus(id,text){ $(id).textContent=text; }
function formatBytes(n) {
  if (!n) return "0 B";
  const units=["B","KB","MB","GB","TB"];
  const i=Math.floor(Math.log(n)/Math.log(1024));
  return `${(n/Math.pow(1024,i)).toFixed(i?1:0)} ${units[i]}`;
}
function bytesToBase64(bytes) {
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)
    binary += String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  return btoa(binary);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
