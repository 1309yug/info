const API_URL =
  "https://script.google.com/macros/s/AKfycbziL4bQk-9Xsm798fChimUrnJNZJalMivULIG3hnFmBjvODEYJ0P1pnuQyLJ0cBg6QBeQ/exec";

let token = "";
let user = null;


// =========================
// API
// =========================

async function api(action, data = {}) {
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        ...data
      })
    });

    return await r.json();

  } catch (e) {
    return {
      success: false,
      message: "Server connection failed."
    };
  }
}


// =========================
// LOGIN
// =========================

async function login(e) {
  e.preventDefault();

  const input = document.getElementById("password");
  const password = input.value;

  if (!password) {
    status("Enter your password.", "error");
    return;
  }

  status("Signing in...", "info");

  const r = await api("login", {
    password
  });

  if (!r.success) {
    status(r.message || "Incorrect password.", "error");
    return;
  }

  token = r.token;
  user = r.user;

  showDashboard();
  await loadFiles();

  if (user.role === "owner") {
    await loadUsers();
  }

  input.value = "";
  status("Signed in successfully.", "success");
}


// =========================
// DASHBOARD
// =========================

function showDashboard() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("dashboard").style.display = "block";

  const name = document.getElementById("currentUsername");

  if (name) {
    name.textContent = user.username;
  }

  const email = document.getElementById("currentEmail");

  if (email) {
    email.textContent = user.email || "";
  }

  const management =
    document.getElementById("userManagement");

  if (management) {
    management.style.display =
      user.role === "owner" ? "block" : "none";
  }
}


// =========================
// LOGOUT
// =========================

async function logout() {
  if (token) {
    await api("logout", { token });
  }

  token = "";
  user = null;

  document.getElementById("dashboard").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";

  document.getElementById("password").value = "";

  status("", "");
}


// =========================
// FILES
// =========================

async function loadFiles() {
  const box = document.getElementById("fileList");

  if (!box || !token) return;

  box.innerHTML = "Loading...";

  const r = await api("getFiles", {
    token
  });

  if (!r.success) {
    box.innerHTML = "Unable to load files.";
    return;
  }

  if (!r.files || !r.files.length) {
    box.innerHTML = "No files uploaded.";
    return;
  }

  box.innerHTML = r.files.map(f => `
    <div class="file-card">

      <div>
        <strong>${esc(f.name)}</strong>

        <small>
          ${bytes(f.size)}
          ${f.owner ? " • By " + esc(f.owner) : ""}
        </small>
      </div>

      <div>
        <button onclick="downloadFile('${js(f.id)}')">
          Download
        </button>

        ${
          user.role === "owner"
            ? `<button onclick="deleteFile('${js(f.id)}')">
                 Delete
               </button>`
            : ""
        }
      </div>

    </div>
  `).join("");
}


// =========================
// UPLOAD
// =========================

async function uploadFiles(e) {
  e.preventDefault();

  const input =
    document.getElementById("fileInput");

  if (!input.files.length) {
    status("Select a file first.", "error");
    return;
  }

  for (const file of input.files) {

    status(
      "Uploading " + file.name + "...",
      "info"
    );

    const data = await readFile(file);

    const r = await api("upload", {
      token,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data
    });

    if (!r.success) {
      status(
        r.message || "Upload failed.",
        "error"
      );
      return;
    }
  }

  input.value = "";

  await loadFiles();

  status(
    "Upload completed.",
    "success"
  );
}


function readFile(file) {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {
      const s = reader.result;
      resolve(s.substring(s.indexOf(",") + 1));
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}


// =========================
// DOWNLOAD
// =========================

async function downloadFile(id) {

  status("Preparing download...", "info");

  const r = await api("download", {
    token,
    fileId: id
  });

  if (!r.success) {
    status(
      r.message || "Download failed.",
      "error"
    );
    return;
  }

  const binary = atob(r.data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: r.mimeType || "application/octet-stream"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = r.name || "download";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  status("Download started.", "success");
}


// =========================
// DELETE FILE
// =========================

async function deleteFile(id) {

  if (user.role !== "owner") {
    status("Owner only.", "error");
    return;
  }

  if (!confirm("Delete this file?")) return;

  const r = await api("delete", {
    token,
    fileId: id
  });

  if (!r.success) {
    status(
      r.message || "Delete failed.",
      "error"
    );
    return;
  }

  await loadFiles();

  status("File deleted.", "success");
}


// =========================
// USERS
// =========================

async function loadUsers() {

  if (!user || user.role !== "owner") return;

  const box =
    document.getElementById("userList");

  if (!box) return;

  box.innerHTML = "Loading...";

  const r = await api("getUsers", {
    token
  });

  if (!r.success) {
    box.innerHTML = "Unable to load users.";
    return;
  }

  box.innerHTML = (r.users || []).map(u => {

    const canDelete =
      u.username !== "Administrator" &&
      u.username !== user.username;

    return `
      <div class="user-row">

        <div>
          <strong>${esc(u.username)}</strong>
          <small>${esc(u.email)}</small>
          <small>
            ${esc(u.role)} • ${esc(u.status)}
          </small>
        </div>

        ${
          canDelete
            ? `<button onclick="deleteUser('${js(u.username)}')">
                 Delete
               </button>`
            : ""
        }

      </div>
    `;

  }).join("");
}


// =========================
// CREATE USER
// =========================

async function createUser(e) {

  e.preventDefault();

  if (!user || user.role !== "owner") {
    status("Owner only.", "error");
    return;
  }

  const username =
    document.getElementById("newUsername").value.trim();

  const email =
    document.getElementById("newEmail").value.trim();

  const role =
    document.getElementById("newRole")
      ? document.getElementById("newRole").value
      : "user";

  // Do NOT trim password.
  const password =
    document.getElementById("newPassword").value;

  if (!username || !email || !password) {
    status(
      "Username, email and password are required.",
      "error"
    );
    return;
  }

  const r = await api("createUser", {
    token,
    username,
    email,
    role,
    password
  });

  if (!r.success) {
    status(
      r.message || "User creation failed.",
      "error"
    );
    return;
  }

  document.getElementById("newUsername").value = "";
  document.getElementById("newEmail").value = "";
  document.getElementById("newPassword").value = "";

  await loadUsers();

  status(
    "User created successfully.",
    "success"
  );
}


// =========================
// DELETE USER
// =========================

async function deleteUser(username) {

  if (!user || user.role !== "owner") return;

  if (!confirm(
    "Delete user " + username + "?"
  )) return;

  const r = await api("deleteUser", {
    token,
    username
  });

  if (!r.success) {
    status(
      r.message || "User deletion failed.",
      "error"
    );
    return;
  }

  await loadUsers();

  status(
    "User deleted.",
    "success"
  );
}


// =========================
// HELPERS
// =========================

function status(text, type) {

  const box =
    document.getElementById("status");

  if (!box) return;

  box.textContent = text;
  box.className = "status " + type;
}


function bytes(n) {

  n = Number(n);

  if (!n) return "0 Bytes";

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  const i =
    Math.floor(
      Math.log(n) / Math.log(1024)
    );

  return (
    (n / Math.pow(1024, i))
      .toFixed(i ? 2 : 0)
    + " "
    + units[i]
  );
}


function esc(s) {

  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function js(s) {

  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}


// =========================
// DRAG & DROP
// =========================

document.addEventListener("DOMContentLoaded", () => {

  const zone =
    document.getElementById("dropZone");

  const input =
    document.getElementById("fileInput");

  if (!zone || !input) return;

  zone.onclick = () => input.click();

  ["dragenter", "dragover"].forEach(e => {
    zone.addEventListener(e, x => {
      x.preventDefault();
      zone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach(e => {
    zone.addEventListener(e, x => {
      x.preventDefault();
      zone.classList.remove("drag-active");
    });
  });

  zone.addEventListener("drop", e => {
    input.files = e.dataTransfer.files;
    status(
      input.files.length + " file(s) selected.",
      "success"
    );
  });

});


// =========================
// GLOBAL FUNCTIONS
// =========================

window.login = login;
window.logout = logout;
window.loadFiles = loadFiles;
window.uploadFiles = uploadFiles;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;
window.loadUsers = loadUsers;
window.createUser = createUser;
window.deleteUser = deleteUser;
