const API_URL =
  "https://script.google.com/macros/s/AKfycbzL8uTKTyXaCzNX6WTcBQ-ofYiVrJxclU6na4_d1B7RdjTeLwALM49BhHS1h9bzM1AS/exec";


let authToken = localStorage.getItem("vaultToken") || "";
let currentUser = JSON.parse(localStorage.getItem("vaultUser") || "null");

let selectedFiles = [];
let fileToDownload = null;


/* =========================
   START
========================= */

document.addEventListener("DOMContentLoaded", () => {

  document
    .getElementById("loginForm")
    .addEventListener("submit", login);

  document
    .getElementById("logoutButton")
    .addEventListener("click", logout);

  document
    .getElementById("fileInput")
    .addEventListener("change", handleFileSelection);

  document
    .getElementById("uploadButton")
    .addEventListener("click", uploadFiles);

  document
    .getElementById("refreshFilesButton")
    .addEventListener("click", loadFiles);

  document
    .getElementById("createUserForm")
    .addEventListener("submit", createUser);

  document
    .getElementById("cancelDownload")
    .addEventListener("click", closeDownloadModal);

  document
    .getElementById("confirmDownload")
    .addEventListener("click", confirmDownload);


  setupDragAndDrop();


  if (authToken && currentUser) {
    showDashboard();
    loadFiles();

    if (currentUser.role === "owner") {
      loadUsers();
    }
  } else {
    showLogin();
  }

});


/* =========================
   API
========================= */

async function callAPI(action, data = {}) {

  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },

    body: JSON.stringify({
      action: action,
      ...data
    })
  });


  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Server returned an invalid response. Check your Apps Script deployment."
    );
  }


  if (!result.success) {
    throw new Error(result.message || "Something went wrong.");
  }


  return result;
}


/* =========================
   LOGIN
========================= */

async function login(event) {

  event.preventDefault();


  const passwordInput =
    document.getElementById("loginPassword");

  const password =
    passwordInput.value;


  if (!password.trim()) {
    setStatus(
      "loginStatus",
      "Please enter your password."
    );

    return;
  }


  const button =
    document.getElementById("loginButton");

  button.disabled = true;
  button.textContent = "Signing in...";


  try {

    const result = await callAPI(
      "login",
      {
        password: password
      }
    );


    authToken = result.token;
    currentUser = result.user;


    localStorage.setItem(
      "vaultToken",
      authToken
    );

    localStorage.setItem(
      "vaultUser",
      JSON.stringify(currentUser)
    );


    passwordInput.value = "";

    showDashboard();

    await loadFiles();


    if (currentUser.role === "owner") {
      await loadUsers();
    }


  } catch (error) {

    setStatus(
      "loginStatus",
      error.message
    );

  } finally {

    button.disabled = false;
    button.textContent = "Sign In";

  }
}


/* =========================
   SHOW LOGIN
========================= */

function showLogin() {

  document
    .getElementById("loginPage")
    .classList.remove("hidden");

  document
    .getElementById("dashboardPage")
    .classList.add("hidden");

}


/* =========================
   SHOW DASHBOARD
========================= */

function showDashboard() {

  document
    .getElementById("loginPage")
    .classList.add("hidden");

  document
    .getElementById("dashboardPage")
    .classList.remove("hidden");


  document
    .getElementById("signedInAs")
    .textContent =
      "Signed in as " +
      currentUser.username;


  const management =
    document.getElementById("userManagement");


  if (currentUser.role === "owner") {
    management.classList.remove("hidden");
  } else {
    management.classList.add("hidden");
  }

}


/* =========================
   LOGOUT
========================= */

async function logout() {

  try {

    if (authToken) {
      await callAPI(
        "logout",
        {
          token: authToken
        }
      );
    }

  } catch (error) {
    console.log(error);
  }


  authToken = "";
  currentUser = null;


  localStorage.removeItem("vaultToken");
  localStorage.removeItem("vaultUser");


  showLogin();
}


/* =========================
   FILE SELECTION
========================= */

function handleFileSelection(event) {

  selectedFiles =
    Array.from(event.target.files);

  renderSelectedFiles();
}


function renderSelectedFiles() {

  const container =
    document.getElementById("selectedFiles");

  container.innerHTML = "";


  selectedFiles.forEach(file => {

    const div =
      document.createElement("div");

    div.className = "selected-file";

    div.textContent =
      file.name +
      " — " +
      formatBytes(file.size);

    container.appendChild(div);

  });
}


/* =========================
   DRAG AND DROP
========================= */

function setupDragAndDrop() {

  const dropZone =
    document.getElementById("dropZone");


  dropZone.addEventListener(
    "dragover",
    event => {

      event.preventDefault();

      dropZone.classList.add("dragover");

    }
  );


  dropZone.addEventListener(
    "dragleave",
    () => {

      dropZone.classList.remove("dragover");

    }
  );


  dropZone.addEventListener(
    "drop",
    event => {

      event.preventDefault();

      dropZone.classList.remove("dragover");


      selectedFiles =
        Array.from(event.dataTransfer.files);

      renderSelectedFiles();

    }
  );

}


/* =========================
   UPLOAD
========================= */

async function uploadFiles() {

  if (!selectedFiles.length) {

    setStatus(
      "uploadStatus",
      "Please select at least one file."
    );

    return;
  }


  const button =
    document.getElementById("uploadButton");

  button.disabled = true;
  button.textContent = "Uploading...";


  try {

    let uploaded = 0;


    for (const file of selectedFiles) {

      setStatus(
        "uploadStatus",
        "Uploading " +
        file.name +
        "..."
      );


      const base64 =
        await readFile(file);


      await callAPI(
        "upload",
        {
          token: authToken,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: base64
        }
      );


      uploaded++;

    }


    selectedFiles = [];

    document.getElementById(
      "fileInput"
    ).value = "";

    renderSelectedFiles();


    setStatus(
      "uploadStatus",
      uploaded +
      " file(s) uploaded successfully."
    );


    await loadFiles();


  } catch (error) {

    setStatus(
      "uploadStatus",
      error.message
    );

  } finally {

    button.disabled = false;
    button.textContent = "Upload Files";

  }

}


/* =========================
   LOAD FILES
========================= */

async function loadFiles() {

  const container =
    document.getElementById("fileGrid");


  container.innerHTML =
    "<p>Loading files...</p>";


  try {

    const result =
      await callAPI(
        "getFiles",
        {
          token: authToken
        }
      );


    container.innerHTML = "";


    if (!result.files.length) {

      container.innerHTML =
        "<p>No files found.</p>";

      return;
    }


    result.files.forEach(file => {

      const card =
        document.createElement("div");

      card.className = "file-card";


      const name =
        document.createElement("div");

      name.className = "file-name";

      name.textContent =
        file.name;


      const info =
        document.createElement("div");

      info.className = "file-info";

      info.innerHTML =
        "Size: " +
        formatBytes(file.size) +
        "<br>" +
        "Type: " +
        escapeHTML(file.mimeType) +
        "<br>" +
        "By: " +
        escapeHTML(file.owner) +
        "<br>" +
        "Date: " +
        escapeHTML(file.date);


      const actions =
        document.createElement("div");

      actions.className =
        "file-actions";


      const downloadButton =
        document.createElement("button");

      downloadButton.className =
        "download-button";

      downloadButton.textContent =
        "Download";


      downloadButton.onclick =
        () => openDownloadModal(file);


      actions.appendChild(downloadButton);


      if (currentUser.role === "owner") {

        const deleteButton =
          document.createElement("button");

        deleteButton.className =
          "delete-button";

        deleteButton.textContent =
          "Delete";


        deleteButton.onclick =
          () =>
            deleteFile(
              file,
              deleteButton,
              card
            );


        actions.appendChild(deleteButton);

      }


      card.appendChild(name);
      card.appendChild(info);
      card.appendChild(actions);


      container.appendChild(card);

    });


  } catch (error) {

    container.innerHTML = "";

    setStatus(
      "filesStatus",
      error.message
    );

  }

}


/* =========================
   DOWNLOAD MODAL
========================= */

function openDownloadModal(file) {

  fileToDownload = file;


  document
    .getElementById("downloadFileName")
    .textContent =
      file.name;


  document
    .getElementById("downloadModal")
    .classList.remove("hidden");

}


function closeDownloadModal() {

  fileToDownload = null;

  document
    .getElementById("downloadModal")
    .classList.add("hidden");

}


async function confirmDownload() {

  if (!fileToDownload) {
    return;
  }


  const button =
    document.getElementById("confirmDownload");

  button.disabled = true;
  button.textContent = "Downloading...";


  try {

    const result =
      await callAPI(
        "download",
        {
          token: authToken,
          fileId: fileToDownload.id
        }
      );


    const binary =
      atob(result.base64);


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


    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      result.fileName;


    document.body.appendChild(link);

    link.click();

    link.remove();


    URL.revokeObjectURL(url);


    closeDownloadModal();


  } catch (error) {

    alert(error.message);

  } finally {

    button.disabled = false;
    button.textContent = "Download";

  }

}


/* =========================
   DELETE FILE
========================= */

async function deleteFile(
  file,
  button,
  card
) {

  const confirmed =
    confirm(
      'Delete "' +
      file.name +
      '"?'
    );


  if (!confirmed) {
    return;
  }


  button.disabled = true;
  button.textContent = "Deleting...";


  try {

    await callAPI(
      "delete",
      {
        token: authToken,
        fileId: file.id
      }
    );


    card.remove();


  } catch (error) {

    alert(error.message);

    button.disabled = false;
    button.textContent = "Delete";

  }

}


/* =========================
   CREATE USER
========================= */

async function createUser(event) {

  event.preventDefault();


  const username =
    document.getElementById(
      "newUsername"
    ).value.trim();


  const email =
    document.getElementById(
      "newEmail"
    ).value.trim();


  const role =
    document.getElementById(
      "newRole"
    ).value;


  const password =
    document.getElementById(
      "newPassword"
    ).value;


  /*
    NO 8 CHARACTER REQUIREMENT.
    Any non-empty password is allowed.
  */

  if (!password) {

    setStatus(
      "userStatus",
      "Password cannot be empty."
    );

    return;
  }


  try {

    await callAPI(
      "createUser",
      {
        token: authToken,
        username: username,
        email: email,
        role: role,
        password: password
      }
    );


    document
      .getElementById("createUserForm")
      .reset();


    setStatus(
      "userStatus",
      "User created successfully."
    );


    await loadUsers();


  } catch (error) {

    setStatus(
      "userStatus",
      error.message
    );

  }

}


/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

  if (
    !currentUser ||
    currentUser.role !== "owner"
  ) {
    return;
  }


  const container =
    document.getElementById("userList");


  container.innerHTML =
    "<p>Loading users...</p>";


  try {

    const result =
      await callAPI(
        "getUsers",
        {
          token: authToken
        }
      );


    container.innerHTML = "";


    result.users.forEach(user => {

      const row =
        document.createElement("div");

      row.className = "user-row";


      const details =
        document.createElement("div");

      details.className =
        "user-details";


      const name =
        document.createElement("div");

      name.className =
        "user-name";

      name.textContent =
        user.username;


      const email =
        document.createElement("div");

      email.className =
        "user-email";

      email.textContent =
        user.email;


      const role =
        document.createElement("div");

      role.className =
        "user-role";

      role.textContent =
        "Role: " +
        user.role +
        " | Status: " +
        user.status;


      details.appendChild(name);
      details.appendChild(email);
      details.appendChild(role);


      row.appendChild(details);


      if (
        user.username !==
        currentUser.username
      ) {

        const deleteButton =
          document.createElement("button");

        deleteButton.className =
          "user-delete";

        deleteButton.textContent =
          "Delete";


        deleteButton.onclick =
          () => deleteUser(user);


        row.appendChild(deleteButton);

      }


      container.appendChild(row);

    });


  } catch (error) {

    container.innerHTML = "";

    setStatus(
      "userStatus",
      error.message
    );

  }

}


/* =========================
   DELETE USER
========================= */

async function deleteUser(user) {

  const confirmed =
    confirm(
      'Delete user "' +
      user.username +
      '"?'
    );


  if (!confirmed) {
    return;
  }


  try {

    await callAPI(
      "deleteUser",
      {
        token: authToken,
        username: user.username
      }
    );


    await loadUsers();


  } catch (error) {

    alert(error.message);

  }

}


/* =========================
   READ FILE
========================= */

function readFile(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload = () => {

        const result =
          reader.result;


        const base64 =
          result.split(",")[1];


        resolve(base64);

      };


      reader.onerror =
        () =>
          reject(
            new Error(
              "Could not read file."
            )
          );


      reader.readAsDataURL(file);

    }
  );

}


/* =========================
   FORMAT BYTES
========================= */

function formatBytes(bytes) {

  if (!bytes) {
    return "0 Bytes";
  }


  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB"
  ];


  const i =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    );


  return (
    bytes /
    Math.pow(1024, i)
  ).toFixed(
    i === 0 ? 0 : 2
  ) +
  " " +
  units[i];

}


/* =========================
   STATUS
========================= */

function setStatus(
  elementId,
  message
) {

  const element =
    document.getElementById(
      elementId
    );


  if (element) {
    element.textContent =
      message;
  }

}


/* =========================
   HTML ESCAPE
========================= */

function escapeHTML(value) {

  const div =
    document.createElement("div");

  div.textContent =
    value == null
      ? ""
      : String(value);

  return div.innerHTML;

}
