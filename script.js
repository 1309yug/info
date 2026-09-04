const API_URL =
  "https://script.google.com/macros/s/AKfycbw0z7wg7D7wt0CcjZJgrkUzylbzCS0Ap7rxzhuZ6h8MhyRA65fkrkATHsgZ7eo1w14dOg/exec";

let token = localStorage.getItem("vaultToken") || "";
let user = JSON.parse(localStorage.getItem("vaultUser") || "null");

document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
  setupLogout();
  setupUpload();
  setupUserManagement();

  if (token && user) {
    showDashboard();
  } else {
    showLogin();
  }
});


/* =========================
   API
========================= */

async function api(action, data = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid server response. Redeploy Code.gs as a Web App."
    );
  }

  if (!result.success) {
    throw new Error(result.message || "Request failed.");
  }

  return result;
}


/* =========================
   LOGIN
========================= */

function setupLogin() {
  const form = document.getElementById("login-form");
  const button = document.getElementById("login-btn");

  if (!form) {
    console.error("login-form not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password =
      document.getElementById("login-password")?.value.trim();

    if (!password) {
      setLoginMessage("Enter your password.");
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Signing In...";
    }

    setLoginMessage("Checking password...");

    try {
      const result = await api("login", {
        password
      });

      token = result.token;
      user = result.user;

      localStorage.setItem("vaultToken", token);
      localStorage.setItem(
        "vaultUser",
        JSON.stringify(user)
      );

      document.getElementById("login-password").value = "";

      showDashboard();

    } catch (error) {
      console.error(error);

      setLoginMessage(error.message);

      if (button) {
        button.disabled = false;
        button.textContent = "Sign In";
      }
    }
  });
}


function setLoginMessage(message) {
  const box =
    document.getElementById("login-message");

  if (box) {
    box.textContent = message;
  }
}


/* =========================
   SCREEN
========================= */

function showLogin() {
  const login =
    document.getElementById("login-screen");

  const dash =
    document.getElementById("dashboard");

  if (login) {
    login.style.display = "flex";
  }

  if (dash) {
    dash.style.display = "none";
  }
}


function showDashboard() {
  const login =
    document.getElementById("login-screen");

  const dash =
    document.getElementById("dashboard");

  if (login) {
    login.style.display = "none";
  }

  if (dash) {
    dash.style.display = "block";
  }

  updateUser();

  loadFiles();

  if (user && user.role === "owner") {
    const management =
      document.getElementById("user-management");

    if (management) {
      management.style.display = "block";
    }

    loadUsers();
  }
}


function updateUser() {
  if (!user) return;

  const username =
    document.getElementById("username-display");

  const role =
    document.getElementById("role-display");

  if (username) {
    username.textContent = user.username;
  }

  if (role) {
    role.textContent =
      user.role === "owner"
        ? "Administrator"
        : "User";
  }
}


/* =========================
   LOGOUT
========================= */

function setupLogout() {
  const button =
    document.getElementById("logout-btn");

  if (!button) return;

  button.addEventListener("click", async () => {
    try {
      if (token) {
        await api("logout", { token });
      }
    } catch (e) {
      console.log(e);
    }

    token = "";
    user = null;

    localStorage.removeItem("vaultToken");
    localStorage.removeItem("vaultUser");

    showLogin();
  });
}


/* =========================
   FILE UPLOAD
========================= */

function setupUpload() {
  const input =
    document.getElementById("file-input");

  const button =
    document.getElementById("upload-btn");

  if (input) {
    input.addEventListener("change", () => {
      const files = [...input.files];

      const selected =
        document.getElementById("selected-files");

      if (selected) {
        selected.innerHTML =
          files.map(
            f => `<div>${escapeHtml(f.name)}</div>`
          ).join("");
      }
    });
  }

  if (button) {
    button.addEventListener(
      "click",
      uploadFiles
    );
  }
}


async function uploadFiles() {
  const input =
    document.getElementById("file-input");

  const button =
    document.getElementById("upload-btn");

  const status =
    document.getElementById("upload-status");

  if (!input || !input.files.length) {
    alert("Select a file first.");
    return;
  }

  button.disabled = true;
  button.textContent = "Uploading...";

  try {
    for (const file of input.files) {
      if (status) {
        status.textContent =
          "Uploading " + file.name + "...";
      }

      const data =
        await fileToBase64(file);

      await api("upload", {
        token,
        fileName: file.name,
        mimeType:
          file.type || "application/octet-stream",
        fileData: data
      });
    }

    input.value = "";

    const selected =
      document.getElementById("selected-files");

    if (selected) {
      selected.innerHTML = "";
    }

    if (status) {
      status.textContent =
        "Upload complete.";
    }

    await loadFiles();

  } catch (error) {
    console.error(error);

    alert(error.message);

    if (status) {
      status.textContent =
        "Upload failed.";
    }

  } finally {
    button.disabled = false;
    button.textContent = "Upload Files";
  }
}


function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader =
      new FileReader();

    reader.onload = () => {
      const result =
        reader.result;

      resolve(
        result.split(",")[1]
      );
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}


/* =========================
   FILE LIST
========================= */

async function loadFiles() {
  if (!token) return;

  const grid =
    document.getElementById("files-grid");

  try {
    const result =
      await api("getFiles", {
        token
      });

    if (!grid) return;

    grid.innerHTML = "";

    if (!result.files.length) {
      grid.innerHTML =
        "<p>No files stored yet.</p>";
      return;
    }

    result.files.forEach(file => {
      grid.appendChild(
        createFileCard(file)
      );
    });

  } catch (error) {
    console.error(error);

    if (grid) {
      grid.innerHTML =
        `<p>${escapeHtml(error.message)}</p>`;
    }
  }
}


function createFileCard(file) {
  const card =
    document.createElement("div");

  card.className = "file-card";

  const canDelete =
    user && user.role === "owner";

  card.innerHTML = `
    <div class="file-icon">
      ${icon(file.mimeType)}
    </div>

    <div class="file-info">
      <h3>${escapeHtml(file.name)}</h3>

      <p>${formatBytes(file.size)}</p>

      <p>By ${escapeHtml(file.owner)}</p>

      <p>${escapeHtml(file.date)}</p>
    </div>

    <div class="file-actions">

      <button
        type="button"
        class="download-btn"
      >
        Download
      </button>

      ${
        canDelete
          ? `
          <button
            type="button"
            class="delete-btn"
          >
            Delete
          </button>
          `
          : ""
      }

    </div>
  `;

  card
    .querySelector(".download-btn")
    .addEventListener(
      "click",
      () => downloadFile(file)
    );

  const deleteButton =
    card.querySelector(".delete-btn");

  if (deleteButton) {
    deleteButton.addEventListener(
      "click",
      () =>
        deleteFile(
          file,
          deleteButton,
          card
        )
    );
  }

  return card;
}


/* =========================
   DELETE
========================= */

async function deleteFile(
  file,
  button,
  card
) {
  const yes =
    confirm(
      `Delete "${file.name}"?\n\n` +
      "The file will be moved to Google Drive Trash."
    );

  if (!yes) return;

  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    await api("delete", {
      token,
      fileId: file.id
    });

    /*
      Only remove the website card AFTER
      Google Drive confirms deletion.
    */

    card.remove();

  } catch (error) {
    console.error(error);

    alert(
      "Delete failed:\n\n" +
      error.message
    );

    button.disabled = false;
    button.textContent = "Delete";
  }
}


/* =========================
   DOWNLOAD
========================= */

async function downloadFile(file) {
  try {
    const result =
      await api("download", {
        token,
        fileId: file.id
      });

    const binary =
      atob(result.fileData);

    const bytes =
      new Uint8Array(binary.length);

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] =
        binary.charCodeAt(i);
    }

    const blob =
      new Blob(
        [bytes],
        {
          type:
            result.mimeType ||
            "application/octet-stream"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      result.fileName;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);

  } catch (error) {
    alert(
      "Download failed:\n\n" +
      error.message
    );
  }
}


/* =========================
   USER MANAGEMENT
========================= */

function setupUserManagement() {
  const form =
    document.getElementById(
      "create-user-form"
    );

  if (!form) return;

  form.addEventListener(
    "submit",
    async e => {
      e.preventDefault();

      try {
        const username =
          document.getElementById(
            "new-username"
          ).value.trim();

        const email =
          document.getElementById(
            "new-email"
          ).value.trim();

        const role =
          document.getElementById(
            "new-role"
          ).value;

        const password =
          document.getElementById(
            "new-password"
          ).value.trim();

        await api("createUser", {
          token,
          username,
          email,
          role,
          password
        });

        alert("User created.");

        form.reset();

        loadUsers();

      } catch (error) {
        alert(error.message);
      }
    }
  );
}


async function loadUsers() {
  try {
    const result =
      await api("getUsers", {
        token
      });

    const table =
      document.getElementById(
        "users-table"
      );

    if (!table) return;

    table.innerHTML =
      result.users.map(
        u => `
          <div class="user-row">

            <strong>
              ${escapeHtml(u.username)}
            </strong>

            <span>
              ${escapeHtml(u.email)}
            </span>

            <span>
              ${escapeHtml(u.role)}
            </span>

            ${
              u.username !== user.username
                ? `
                  <button
                    type="button"
                    onclick="deleteUser('${escapeJs(u.username)}')"
                  >
                    Delete
                  </button>
                `
                : "<span>Current</span>"
            }

          </div>
        `
      ).join("");

  } catch (error) {
    console.error(error);
  }
}


async function deleteUser(username) {
  if (
    !confirm(
      `Delete user "${username}"?`
    )
  ) {
    return;
  }

  try {
    await api("deleteUser", {
      token,
      username
    });

    loadUsers();

  } catch (error) {
    alert(error.message);
  }
}


/* =========================
   HELPERS
========================= */

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units =
    ["B", "KB", "MB", "GB"];

  const i =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    );

  return (
    (bytes /
      Math.pow(1024, i))
      .toFixed(i ? 2 : 0)
    + " " +
    units[i]
  );
}


function icon(type) {
  if (!type) return "📄";

  if (type.includes("pdf")) return "📕";
  if (type.includes("image")) return "🖼️";
  if (type.includes("video")) return "🎬";
  if (type.includes("audio")) return "🎵";
  if (type.includes("zip")) return "🗜️";

  return "📄";
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
           }
