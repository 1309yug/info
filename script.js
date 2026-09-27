const API_URL =
  "https://script.google.com/macros/s/AKfycbxxgy22-G35_R-Bz0YWPcBivlDfm9-oeeWvo6k6vPxoRVVel-FO1oDYZaqpXxQ3A9qm4A/exec";

let token = "";
let currentUser = null;


/* =========================================
   START
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("login-form")
    .addEventListener("submit", login);

  document
    .getElementById("logout-btn")
    .addEventListener("click", logout);

  document
    .getElementById("upload-btn")
    .addEventListener("click", uploadFiles);

  document
    .getElementById("file-input")
    .addEventListener(
      "change",
      showSelectedFiles
    );

  document
    .getElementById("create-user-form")
    .addEventListener(
      "submit",
      createUser
    );

  showLogin();
});


/* =========================================
   API
========================================= */

async function callAPI(action, data = {}) {

  const response = await fetch(
    API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },

      body: JSON.stringify({
        action,
        ...data
      })
    }
  );

  const text =
    await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    console.error(text);

    throw new Error(
      "Apps Script did not return JSON. " +
      "Check the Web App deployment."
    );
  }

  if (!result.success) {
    throw new Error(
      result.message ||
      "Request failed."
    );
  }

  return result;
}


/* =========================================
   LOGIN
========================================= */

async function login(event) {

  event.preventDefault();

  const password =
    document
      .getElementById("login-password")
      .value
      .trim();

  const button =
    document.getElementById("login-btn");

  const message =
    document.getElementById("login-message");

  if (!password) {
    message.textContent =
      "Enter your password.";
    return;
  }

  button.disabled = true;
  button.textContent =
    "Signing In...";

  message.textContent =
    "Connecting...";

  try {

    const result =
      await callAPI(
        "login",
        {
          password
        }
      );

    token =
      result.token;

    currentUser =
      result.user;

    message.textContent = "";

    document
      .getElementById(
        "login-password"
      )
      .value = "";

    showDashboard();

  } catch (error) {

    console.error(error);

    message.textContent =
      error.message;

  } finally {

    button.disabled = false;
    button.textContent =
      "Sign In";
  }
}


/* =========================================
   SCREEN
========================================= */

function showLogin() {

  document
    .getElementById(
      "login-screen"
    )
    .style.display = "flex";

  document
    .getElementById(
      "dashboard"
    )
    .style.display = "none";
}


function showDashboard() {

  document
    .getElementById(
      "login-screen"
    )
    .style.display = "none";

  document
    .getElementById(
      "dashboard"
    )
    .style.display = "block";

  document
    .getElementById(
      "username-display"
    )
    .textContent =
      currentUser.username;

  loadFiles();

  if (
    currentUser.role === "owner"
  ) {

    document
      .getElementById(
        "user-management"
      )
      .style.display = "block";

    loadUsers();
  }
}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

  try {

    if (token) {
      await callAPI(
        "logout",
        { token }
      );
    }

  } catch (error) {
    console.log(error);
  }

  token = "";
  currentUser = null;

  showLogin();
}


/* =========================================
   SELECTED FILES
========================================= */

function showSelectedFiles() {

  const input =
    document.getElementById(
      "file-input"
    );

  const box =
    document.getElementById(
      "selected-files"
    );

  box.innerHTML = "";

  for (
    const file of input.files
  ) {

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "selected-item";

    item.textContent =
      file.name;

    box.appendChild(item);
  }
}


/* =========================================
   UPLOAD
========================================= */

async function uploadFiles() {

  const input =
    document.getElementById(
      "file-input"
    );

  const button =
    document.getElementById(
      "upload-btn"
    );

  const status =
    document.getElementById(
      "upload-status"
    );

  if (!input.files.length) {

    alert(
      "Please select a file."
    );

    return;
  }

  button.disabled = true;

  try {

    for (
      const file of input.files
    ) {

      status.textContent =
        "Uploading " +
        file.name +
        "...";

      const base64 =
        await readFile(file);

      await callAPI(
        "upload",
        {
          token,
          fileName: file.name,
          mimeType:
            file.type ||
            "application/octet-stream",
          fileData: base64
        }
      );
    }

    input.value = "";

    document
      .getElementById(
        "selected-files"
      )
      .innerHTML = "";

    status.textContent =
      "Upload complete.";

    loadFiles();

  } catch (error) {

    console.error(error);

    status.textContent =
      "Upload failed.";

    alert(error.message);

  } finally {

    button.disabled = false;
  }
}


function readFile(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onload = () => {

        const result =
          reader.result;

        resolve(
          result.split(",")[1]
        );
      };

      reader.onerror =
        reject;

      reader.readAsDataURL(file);
    }
  );
}


/* =========================================
   FILES
========================================= */

async function loadFiles() {

  const grid =
    document.getElementById(
      "files-grid"
    );

  grid.innerHTML =
    "<p>Loading files...</p>";

  try {

    const result =
      await callAPI(
        "getFiles",
        { token }
      );

    grid.innerHTML = "";

    if (
      result.files.length === 0
    ) {

      grid.innerHTML =
        "<p>No files yet.</p>";

      return;
    }

    result.files.forEach(
      file => {

        const card =
          document.createElement(
            "div"
          );

        card.className =
          "file-card";

        card.innerHTML = `
          <div class="file-icon">
            📄
          </div>

          <div class="file-info">
            <h3></h3>
            <p></p>
            <p></p>
          </div>

          <div class="file-actions">
            <button
              type="button"
              class="download-btn"
            >
              Download
            </button>

            ${
              currentUser.role === "owner"
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

        card.querySelector("h3")
          .textContent =
            file.name;

        card.querySelectorAll("p")[0]
          .textContent =
            formatBytes(file.size);

        card.querySelectorAll("p")[1]
          .textContent =
            "By " + file.owner;

        card
          .querySelector(
            ".download-btn"
          )
          .addEventListener(
            "click",
            () => downloadFile(file)
          );

        const deleteButton =
          card.querySelector(
            ".delete-btn"
          );

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

        grid.appendChild(card);
      }
    );

  } catch (error) {

    console.error(error);

    grid.innerHTML =
      `<p>${error.message}</p>`;
  }
}


/* =========================================
   DELETE
========================================= */

async function deleteFile(
  file,
  button,
  card
) {

  if (
    !confirm(
      "Delete " +
      file.name +
      "?"
    )
  ) {
    return;
  }

  button.disabled = true;
  button.textContent =
    "Deleting...";

  try {

    await callAPI(
      "delete",
      {
        token,
        fileId: file.id
      }
    );

    card.remove();

  } catch (error) {

    alert(error.message);

    button.disabled = false;
    button.textContent =
      "Delete";
  }
}


/* =========================================
   DOWNLOAD
========================================= */

async function downloadFile(file) {

  try {

    const result =
      await callAPI(
        "download",
        {
          token,
          fileId: file.id
        }
      );

    const binary =
      atob(result.fileData);

    const bytes =
      new Uint8Array(
        binary.length
      );

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
            result.mimeType
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      result.fileName;

    link.click();

    URL.revokeObjectURL(
      url
    );

  } catch (error) {

    alert(
      "Download failed: " +
      error.message
    );
  }
}


/* =========================================
   CREATE USER
========================================= */

async function createUser(event) {

  event.preventDefault();

  try {

    const username =
      document
        .getElementById(
          "new-username"
        )
        .value
        .trim();

    const email =
      document
        .getElementById(
          "new-email"
        )
        .value
        .trim();

    const role =
      document
        .getElementById(
          "new-role"
        )
        .value;

    const password =
      document
        .getElementById(
          "new-password"
        )
        .value
        .trim();

    await callAPI(
      "createUser",
      {
        token,
        username,
        email,
        role,
        password
      }
    );

    alert(
      "User created successfully."
    );

    event.target.reset();

    loadUsers();

  } catch (error) {

    alert(error.message);
  }
}


/* =========================================
   USERS
========================================= */

async function loadUsers() {

  try {

    const result =
      await callAPI(
        "getUsers",
        { token }
      );

    const box =
      document.getElementById(
        "users-table"
      );

    box.innerHTML = "";

    result.users.forEach(
      u => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "user-row";

        row.innerHTML = `
          <strong></strong>
          <span></span>
          <span></span>
          <button
            type="button"
            class="user-delete"
          >
            Delete
          </button>
        `;

        row.children[0]
          .textContent =
            u.username;

        row.children[1]
          .textContent =
            u.email;

        row.children[2]
          .textContent =
            u.role;

        if (
          u.username ===
          currentUser.username
        ) {

          row.children[3]
            .style.display =
              "none";
        } else {

          row.children[3]
            .addEventListener(
              "click",
              () =>
                deleteUser(
                  u.username
                )
            );
        }

        box.appendChild(row);
      }
    );

  } catch (error) {

    console.error(error);
  }
}


async function deleteUser(username) {

  if (
    !confirm(
      "Delete user " +
      username +
      "?"
    )
  ) {
    return;
  }

  try {

    await callAPI(
      "deleteUser",
      {
        token,
        username
      }
    );

    loadUsers();

  } catch (error) {

    alert(error.message);
  }
}
