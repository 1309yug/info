/* =========================================================
   SECURE CLOUD VAULT - GITHUB PAGES FRONTEND
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzL8uTKTyXaCzNX6WTcBQ-ofYiVrJxclU6na4_d1B7RdjTeLwALM49BhHS1h9bzM1AS/exec";

let currentUser = null;
let sessionToken = null;
let selectedFiles = [];
let allFiles = [];

/* =========================================================
   DOM
   ========================================================= */

const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const loginMessage = document.getElementById("login-message");

const usernameDisplay = document.getElementById("username-display");
const roleDisplay = document.getElementById("role-display");

const logoutBtn = document.getElementById("logout-btn");

const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const selectedFilesContainer =
  document.getElementById("selected-files");

const uploadBtn = document.getElementById("upload-btn");
const uploadStatus = document.getElementById("upload-status");

const filesGrid = document.getElementById("files-grid");
const filesEmpty = document.getElementById("files-empty");

const userManagement = document.getElementById("user-management");

const createUserForm = document.getElementById("create-user-form");
const newUsername = document.getElementById("new-username");
const newEmail = document.getElementById("new-email");
const newRole = document.getElementById("new-role");
const newPassword = document.getElementById("new-password");

const usersTable = document.getElementById("users-table");

const decryptModal = document.getElementById("decrypt-modal");
const decryptPassword = document.getElementById("decrypt-password");
const decryptBtn = document.getElementById("decrypt-btn");
const decryptCancelBtn = document.getElementById("decrypt-cancel-btn");

let decryptingFile = null;

/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
  setupUpload();
  setupUserManagement();
  setupModal();
  setupLogout();

  restoreSession();
});

/* =========================================================
   API
   ========================================================= */

async function apiCall(action, data = {}) {
  const payload = {
    action,
    ...data
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(
        "Server returned an invalid response. Check your Apps Script deployment."
      );
    }

    if (!result.success) {
      throw new Error(result.message || "Request failed.");
    }

    return result;

  } catch (error) {
    console.error("API error:", error);
    throw error;
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

function setupLogin() {
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await login();
  });

  if (loginBtn) {
    loginBtn.type = "submit";
  }
}

async function login() {
  const password = passwordInput ? passwordInput.value.trim() : "";

  if (!password) {
    showLoginMessage("Enter your password.", true);
    return;
  }

  setLoginLoading(true);
  showLoginMessage("Signing in...", false);

  try {
    const result = await apiCall("login", {
      password
    });

    currentUser = result.user;
    sessionToken = result.token;

    localStorage.setItem(
      "vaultSession",
      JSON.stringify({
        user: currentUser,
        token: sessionToken
      })
    );

    showDashboard();

  } catch (error) {
    showLoginMessage(error.message, true);

    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.focus();
    }

  } finally {
    setLoginLoading(false);
  }
}

function showLoginMessage(message, error) {
  if (!loginMessage) return;

  loginMessage.textContent = message;
  loginMessage.classList.toggle("error", !!error);
  loginMessage.classList.toggle("success", !error);
}

function setLoginLoading(loading) {
  if (!loginBtn) return;

  loginBtn.disabled = loading;

  loginBtn.textContent = loading
    ? "Signing In..."
    : "Sign In";
}

/* =========================================================
   SESSION
   ========================================================= */

async function restoreSession() {
  const saved = localStorage.getItem("vaultSession");

  if (!saved) {
    showLogin();
    return;
  }

  try {
    const session = JSON.parse(saved);

    if (!session.token || !session.user) {
      throw new Error("Invalid session");
    }

    const result = await apiCall("validateSession", {
      token: session.token
    });

    currentUser = result.user;
    sessionToken = session.token;

    showDashboard();

  } catch (error) {
    console.log("Session expired.");

    localStorage.removeItem("vaultSession");

    currentUser = null;
    sessionToken = null;

    showLogin();
  }
}

function showDashboard() {
  if (loginScreen) {
    loginScreen.style.display = "none";
  }

  if (dashboard) {
    dashboard.style.display = "block";
  }

  updateUserDisplay();

  loadFiles();

  if (currentUser && currentUser.role === "owner") {
    if (userManagement) {
      userManagement.style.display = "block";
    }

    loadUsers();
  } else {
    if (userManagement) {
      userManagement.style.display = "none";
    }
  }
}

function showLogin() {
  if (dashboard) {
    dashboard.style.display = "none";
  }

  if (loginScreen) {
    loginScreen.style.display = "flex";
  }

  if (passwordInput) {
    passwordInput.value = "";
  }
}

function updateUserDisplay() {
  if (!currentUser) return;

  if (usernameDisplay) {
    usernameDisplay.textContent = currentUser.username;
  }

  if (roleDisplay) {
    roleDisplay.textContent =
      currentUser.role === "owner"
        ? "Administrator"
        : "User";
  }
}

/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    try {
      if (sessionToken) {
        await apiCall("logout", {
          token: sessionToken
        });
      }
    } catch (error) {
      console.log(error);
    }

    localStorage.removeItem("vaultSession");

    currentUser = null;
    sessionToken = null;
    allFiles = [];

    showLogin();
  });
}

/* =========================================================
   UPLOAD
   ========================================================= */

function setupUpload() {
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      addFiles(fileInput.files);
    });
  }

  if (dropZone) {
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragging");
    });

    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();

      dropZone.classList.remove("dragging");

      addFiles(event.dataTransfer.files);
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", uploadSelectedFiles);
  }
}

function addFiles(files) {
  if (!files || !files.length) return;

  for (const file of files) {
    selectedFiles.push(file);
  }

  renderSelectedFiles();
}

function renderSelectedFiles() {
  if (!selectedFilesContainer) return;

  selectedFilesContainer.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");

    item.className = "selected-file";

    item.innerHTML = `
      <span>${escapeHtml(file.name)}</span>
      <span>${formatBytes(file.size)}</span>
      <button type="button" data-index="${index}">
        Remove
      </button>
    `;

    const removeButton = item.querySelector("button");

    removeButton.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderSelectedFiles();
    });

    selectedFilesContainer.appendChild(item);
  });
}

async function uploadSelectedFiles() {
  if (!sessionToken) {
    alert("Your session has expired. Please sign in again.");
    return;
  }

  if (!selectedFiles.length) {
    alert("Select at least one file.");
    return;
  }

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
  }

  if (uploadStatus) {
    uploadStatus.textContent = "Uploading files...";
  }

  try {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      if (uploadStatus) {
        uploadStatus.textContent =
          `Uploading ${i + 1} of ${selectedFiles.length}: ${file.name}`;
      }

      const base64 = await fileToBase64(file);

      await apiCall("upload", {
        token: sessionToken,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileData: base64
      });
    }

    selectedFiles = [];

    if (fileInput) {
      fileInput.value = "";
    }

    renderSelectedFiles();

    if (uploadStatus) {
      uploadStatus.textContent = "Upload completed successfully.";
    }

    await loadFiles();

  } catch (error) {
    console.error(error);

    if (uploadStatus) {
      uploadStatus.textContent =
        "Upload failed: " + error.message;
    }

    alert(error.message);

  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Files";
    }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      const commaIndex = result.indexOf(",");

      resolve(
        commaIndex >= 0
          ? result.substring(commaIndex + 1)
          : result
      );
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

/* =========================================================
   LOAD FILES
   ========================================================= */

async function loadFiles() {
  if (!sessionToken) return;

  if (filesGrid) {
    filesGrid.innerHTML = `
      <div class="loading-files">
        Loading files...
      </div>
    `;
  }

  try {
    const result = await apiCall("getFiles", {
      token: sessionToken
    });

    allFiles = result.files || [];

    renderFiles();

  } catch (error) {
    console.error(error);

    if (filesGrid) {
      filesGrid.innerHTML = `
        <div class="error-message">
          ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}

function renderFiles() {
  if (!filesGrid) return;

  filesGrid.innerHTML = "";

  if (!allFiles.length) {
    if (filesEmpty) {
      filesEmpty.style.display = "block";
    }

    return;
  }

  if (filesEmpty) {
    filesEmpty.style.display = "none";
  }

  allFiles.forEach((file) => {
    filesGrid.appendChild(createFileCard(file));
  });
}

function createFileCard(file) {
  const card = document.createElement("div");

  card.className = "file-card";

  const deleteAllowed =
    currentUser &&
    currentUser.role === "owner";

  card.innerHTML = `
    <div class="file-icon">
      ${getFileIcon(file.mimeType)}
    </div>

    <div class="file-info">
      <h3 title="${escapeHtml(file.name)}">
        ${escapeHtml(file.name)}
      </h3>

      <p>
        ${formatBytes(file.size)}
      </p>

      <p>
        By ${escapeHtml(file.owner || "Unknown")}
      </p>

      <p>
        ${escapeHtml(file.date || "")}
      </p>
    </div>

    <div class="file-actions">

      <button
        type="button"
        class="download-file-btn"
        data-id="${escapeHtml(file.id)}"
      >
        Download
      </button>

      ${
        deleteAllowed
          ? `
            <button
              type="button"
              class="delete-file-btn"
              data-id="${escapeHtml(file.id)}"
            >
              Delete
            </button>
          `
          : ""
      }

    </div>
  `;

  const downloadBtn =
    card.querySelector(".download-file-btn");

  downloadBtn.addEventListener("click", () => {
    downloadFile(file);
  });

  const deleteBtn =
    card.querySelector(".delete-file-btn");

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      handleDeleteFile(file, deleteBtn, card);
    });
  }

  return card;
}

/* =========================================================
   DELETE FILE
   ========================================================= */

async function handleDeleteFile(file, button, card) {
  if (!file || !file.id) {
    alert("File ID is missing.");
    return;
  }

  if (!sessionToken) {
    alert("Your session has expired.");
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to delete "${file.name}"?\n\n` +
    "The file will be removed from the vault and moved to Google Drive Trash."
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    /*
      IMPORTANT:
      Send the REAL Drive file ID to Apps Script.
      Apps Script then calls file.setTrashed(true).
    */

    const result = await apiCall("delete", {
      token: sessionToken,
      fileId: file.id
    });

    if (!result.success) {
      throw new Error(
        result.message || "Delete failed."
      );
    }

    /*
      Remove the card only after Drive deletion succeeds.
    */

    if (card) {
      card.remove();
    }

    allFiles = allFiles.filter(
      (item) => item.id !== file.id
    );

    if (!allFiles.length && filesEmpty) {
      filesEmpty.style.display = "block";
    }

  } catch (error) {
    console.error("Delete error:", error);

    alert(
      "Could not delete the file.\n\n" +
      error.message
    );

    button.disabled = false;
    button.textContent = "Delete";
  }
}

/* =========================================================
   DOWNLOAD
   ========================================================= */

async function downloadFile(file) {
  if (!sessionToken) {
    alert("Your session has expired.");
    return;
  }

  try {
    const result = await apiCall("download", {
      token: sessionToken,
      fileId: file.id
    });

    if (!result.fileData) {
      throw new Error("No file data returned.");
    }

    const binary = atob(result.fileData);

    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob(
      [bytes],
      {
        type:
          result.mimeType ||
          "application/octet-stream"
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download =
      result.fileName ||
      file.name;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

  } catch (error) {
    console.error(error);

    alert(
      "Download failed:\n\n" +
      error.message
    );
  }
}

/* =========================================================
   USER MANAGEMENT
   ========================================================= */

function setupUserManagement() {
  if (!createUserForm) return;

  createUserForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      await createUser();
    }
  );
}

async function createUser() {
  if (!currentUser || currentUser.role !== "owner") {
    alert("Administrator access required.");
    return;
  }

  const username =
    newUsername.value.trim();

  const email =
    newEmail.value.trim();

  const role =
    newRole.value;

  const password =
    newPassword.value.trim();

  if (!username || !email) {
    alert("Username and email are required.");
    return;
  }

  if (!password) {
    alert("Enter a password.");
    return;
  }

  try {
    const result = await apiCall("createUser", {
      token: sessionToken,
      username,
      email,
      role,
      password
    });

    alert(
      "User created successfully.\n\n" +
      `Username: ${result.user.username}`
    );

    createUserForm.reset();

    await loadUsers();

  } catch (error) {
    alert(
      "Could not create user:\n\n" +
      error.message
    );
  }
}

async function loadUsers() {
  if (!sessionToken) return;

  try {
    const result = await apiCall("getUsers", {
      token: sessionToken
    });

    renderUsers(result.users || []);

  } catch (error) {
    console.error(error);

    if (usersTable) {
      usersTable.innerHTML =
        `<p>${escapeHtml(error.message)}</p>`;
    }
  }
}

function renderUsers(users) {
  if (!usersTable) return;

  usersTable.innerHTML = "";

  if (!users.length) {
    usersTable.innerHTML =
      "<p>No users found.</p>";

    return;
  }

  users.forEach((user) => {
    const row = document.createElement("div");

    row.className = "user-row";

    const canDelete =
      user.username !== currentUser.username;

    row.innerHTML = `
      <div>
        <strong>
          ${escapeHtml(user.username)}
        </strong>
      </div>

      <div>
        ${escapeHtml(user.email)}
      </div>

      <div>
        ${escapeHtml(user.role)}
      </div>

      <div>
        ${
          canDelete
            ? `
              <button
                type="button"
                class="delete-user-btn"
              >
                Delete
              </button>
            `
            : "Current account"
        }
      </div>
    `;

    const deleteButton =
      row.querySelector(".delete-user-btn");

    if (deleteButton) {
      deleteButton.addEventListener(
        "click",
        () => deleteUser(user.username, deleteButton)
      );
    }

    usersTable.appendChild(row);
  });
}

async function deleteUser(username, button) {
  if (!confirm(
    `Delete user "${username}"?`
  )) {
    return;
  }

  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    await apiCall("deleteUser", {
      token: sessionToken,
      username
    });

    await loadUsers();

  } catch (error) {
    alert(
      "Could not delete user:\n\n" +
      error.message
    );

    button.disabled = false;
    button.textContent = "Delete";
  }
}

/* =========================================================
   MODAL
   ========================================================= */

function setupModal() {
  if (decryptCancelBtn) {
    decryptCancelBtn.addEventListener(
      "click",
      closeDecryptModal
    );
  }

  if (decryptModal) {
    decryptModal.addEventListener(
      "click",
      (event) => {
        if (event.target === decryptModal) {
          closeDecryptModal();
        }
      }
    );
  }

  if (decryptBtn) {
    decryptBtn.addEventListener(
      "click",
      decryptSelectedFile
    );
  }
}

function openDecryptModal(file) {
  decryptingFile = file;

  if (decryptPassword) {
    decryptPassword.value = "";
  }

  if (decryptModal) {
    decryptModal.style.display = "flex";
  }
}

function closeDecryptModal() {
  decryptingFile = null;

  if (decryptModal) {
    decryptModal.style.display = "none";
  }
}

async function decryptSelectedFile() {
  /*
    Reserved for encrypted-file support.
 
