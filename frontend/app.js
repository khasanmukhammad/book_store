// ---- Yordamchi funksiyalar ----

const app = document.getElementById("app");
const topnav = document.getElementById("topnav");
const userLine = document.getElementById("user-line");

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3500);
}

function navigate(path) {
  location.hash = path;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("uz-UZ") + " so'm";
}

// Backend ba'zi javoblarda rasmning to'liq manzilini emas, faqat nisbiy
// yo'lini qaytarishi mumkin (masalan /books/category/ javobida). Bunday
// holatda oldiga backend manzilini qo'shib to'g'irlab olamiz.
function normalizeImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function bookCoverHtml(image) {
  const url = normalizeImageUrl(image);
  return url
    ? `<img src="${escapeHtml(url)}" alt="" />`
    : `<span>Rasm yo'q</span>`;
}

// ---- Kunduzgi / tungi rejim ----

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  renderNav();
}

function themeToggleBtn() {
  const icon = currentTheme() === "dark" ? "☀️" : "🌙";
  return `<button type="button" id="theme-toggle" title="Kunduzgi/tungi rejim">${icon}</button>`;
}

// ---- Navigatsiya paneli ----

let adminChecked = false;

function renderNav() {
  if (Auth.isLoggedIn()) {
    const name = Auth.getFullName() || "Profil";
    const adminLink = Auth.isAdmin() ? `<a href="#/admin/manage">Admin panel</a>` : "";
    topnav.innerHTML = `
      <a href="#/">Kitoblar</a>
      ${adminLink}
      ${themeToggleBtn()}
      <button type="button" id="logout-btn">Chiqish</button>
    `;
    userLine.innerHTML = `
      <span class="user-name">${escapeHtml(name)}</span>
      <a href="#/profile" class="profile-btn" title="Profilni tahrirlash">⚙</a>
    `;
    document.getElementById("logout-btn").addEventListener("click", handleLogout);
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    if (!adminChecked) {
      adminChecked = true;
      checkAdminAccess().then(() => renderNav());
    }
  } else {
    topnav.innerHTML = `
      <a href="#/">Kitoblar</a>
      <a href="#/login">Kirish</a>
      <a href="#/signup" class="accent">Ro'yxatdan o'tish</a>
      ${themeToggleBtn()}
    `;
    userLine.innerHTML = "";
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  }
}

async function handleLogout() {
  try {
    await UsersAPI.logout();
  } catch (e) {
    // token allaqachon eskirgan bo'lishi mumkin, baribir lokal holatni tozalaymiz
  }
  Auth.clear();
  adminChecked = false;
  renderNav();
  showToast("Tizimdan chiqdingiz");
  navigate("/login");
}

// ---- Router ----

const routes = [
  { pattern: /^\/?$/, handler: () => pageHome() },
  { pattern: /^\/signup$/, handler: () => pageSignup() },
  { pattern: /^\/verify$/, handler: () => pageVerify() },
  { pattern: /^\/complete-profile$/, handler: () => pageCompleteProfile() },
  { pattern: /^\/login$/, handler: () => pageLogin() },
  { pattern: /^\/profile$/, handler: () => pageProfileEdit() },
  { pattern: /^\/book\/([^/]+)$/, handler: (m) => pageBookDetail(m[1]) },
  { pattern: /^\/admin\/add$/, handler: () => pageAdminAdd() },
  { pattern: /^\/admin\/manage$/, handler: () => pageAdminManage() },
];

function router() {
  const path = location.hash.replace(/^#/, "") || "/";
  renderNav();
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      route.handler(match);
      return;
    }
  }
  app.innerHTML = `<div class="empty-state">Sahifa topilmadi.</div>`;
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

// ================= AUTH SAHIFALARI =================

function pageSignup() {
  app.innerHTML = `
    <div class="card auth-card">
      <h1 class="auth-title">Ro'yxatdan o'tish</h1>
      <p class="auth-sub">1-qadam: aloqa ma'lumoti</p>
      <form id="signup-form">
        <div class="field">
          <label>Email yoki telefon raqam</label>
          <input type="text" id="signup-input" placeholder="email@example.com yoki +998901234567" required />
        </div>
        <div id="signup-error" class="error-text" hidden></div>
        <button type="submit" class="primary block">Kod yuborish</button>
      </form>
      <p class="auth-foot">Hisobingiz bormi? <a href="#/login">Kirish</a></p>
    </div>
  `;

  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("signup-error");
    errorBox.hidden = true;
    const value = document.getElementById("signup-input").value.trim();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const data = await UsersAPI.signup(value);
      Auth.setTokens(data);
      Auth.setAuthStatus(data.auth_status);
      showToast("Tasdiqlash kodi yuborildi");
      navigate("/verify");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function pageVerify() {
  if (!Auth.getAccess()) { navigate("/signup"); return; }

  app.innerHTML = `
    <div class="card auth-card">
      <h1 class="auth-title">Kodni tasdiqlang</h1>
      <p class="auth-sub">Email yoki telefoningizga yuborilgan 4 xonali kod</p>
      <form id="verify-form">
        <div class="otp-row">
          <input type="text" maxlength="1" class="otp-digit" inputmode="numeric" />
          <input type="text" maxlength="1" class="otp-digit" inputmode="numeric" />
          <input type="text" maxlength="1" class="otp-digit" inputmode="numeric" />
          <input type="text" maxlength="1" class="otp-digit" inputmode="numeric" />
        </div>
        <div id="verify-error" class="error-text" hidden></div>
        <button type="submit" class="primary block">Tasdiqlash</button>
      </form>
      <p class="auth-foot">Kod kelmadimi? <a href="#" id="resend-link">Qayta yuborish</a></p>
    </div>
  `;

  const digits = [...document.querySelectorAll(".otp-digit")];
  digits.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
      if (input.value && digits[i + 1]) digits[i + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && digits[i - 1]) digits[i - 1].focus();
    });
  });
  digits[0].focus();

  document.getElementById("verify-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("verify-error");
    errorBox.hidden = true;
    const code = digits.map(d => d.value).join("");
    if (code.length !== 4) {
      errorBox.textContent = "Iltimos, 4 xonali kodni to'liq kiriting.";
      errorBox.hidden = false;
      return;
    }
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const data = await UsersAPI.verify(code);
      Auth.setTokens(data);
      Auth.setAuthStatus(data.auth_status);
      showToast("Kod tasdiqlandi");
      navigate("/complete-profile");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("resend-link").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await UsersAPI.resendCode();
      showToast("Kod qayta yuborildi");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function pageCompleteProfile() {
  if (!Auth.getAccess()) { navigate("/login"); return; }

  app.innerHTML = `
    <div class="card auth-card">
      <h1 class="auth-title">Profilni to'ldiring</h1>
      <p class="auth-sub">Oxirgi qadam</p>
      <form id="profile-form">
        <div class="field-row">
          <div class="field">
            <label>Ism</label>
            <input type="text" id="first_name" required />
          </div>
          <div class="field">
            <label>Familiya</label>
            <input type="text" id="last_name" required />
          </div>
        </div>
        <div class="field">
          <label>Foydalanuvchi nomi</label>
          <input type="text" id="username" required />
        </div>
        <div class="field">
          <label>Parol</label>
          <input type="password" id="password" required />
        </div>
        <div class="field">
          <label>Parolni tasdiqlang</label>
          <input type="password" id="confirm_password" required />
        </div>
        <div id="profile-error" class="error-text" hidden></div>
        <button type="submit" class="primary block">Yakunlash</button>
      </form>
    </div>
  `;

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("profile-error");
    errorBox.hidden = true;
    const payload = {
      first_name: document.getElementById("first_name").value.trim(),
      last_name: document.getElementById("last_name").value.trim(),
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value,
      confirm_password: document.getElementById("confirm_password").value,
    };
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await UsersAPI.completeProfile(payload);
      Auth.clear(); // yangi login talab qilinadi, chunki bu endpoint token qaytarmaydi
      showToast("Ro'yxatdan o'tish yakunlandi. Endi kiring.");
      navigate("/login");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function pageLogin() {
  app.innerHTML = `
    <div class="card auth-card">
      <h1 class="auth-title">Kitob do'koni</h1>
      <p class="auth-sub">Hisobingizga kiring</p>
      <form id="login-form">
        <div class="field">
          <label>Username, email yoki telefon</label>
          <input type="text" id="userinput" required />
        </div>
        <div class="field">
          <label>Parol</label>
          <input type="password" id="password" required />
        </div>
        <div id="login-error" class="error-text" hidden></div>
        <button type="submit" class="primary block">Kirish</button>
      </form>
      <p class="auth-foot"><a href="#/signup">Ro'yxatdan o'tish</a></p>
    </div>
  `;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("login-error");
    errorBox.hidden = true;
    const userinput = document.getElementById("userinput").value.trim();
    const password = document.getElementById("password").value;
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const data = await UsersAPI.login(userinput, password);
      Auth.setTokens(data);
      Auth.setAuthStatus(data.auth_status);
      Auth.setFullName(data.full_name);
      adminChecked = false;
      renderNav();
      showToast("Xush kelibsiz!");
      navigate("/");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function pageProfileEdit() {
  if (!Auth.isLoggedIn()) { navigate("/login"); return; }

  app.innerHTML = `
    <div class="card auth-card">
      <h1 class="auth-title">Profilni tahrirlash</h1>
      <p class="auth-sub">Ma'lumotlaringizni yangilang</p>
      <form id="edit-profile-form">
        <div class="field-row">
          <div class="field">
            <label>Ism</label>
            <input type="text" id="first_name" required />
          </div>
          <div class="field">
            <label>Familiya</label>
            <input type="text" id="last_name" required />
          </div>
        </div>
        <div class="field">
          <label>Foydalanuvchi nomi</label>
          <input type="text" id="username" required />
        </div>
        <div class="field">
          <label>Yangi parol</label>
          <input type="password" id="password" required />
        </div>
        <div class="field">
          <label>Parolni tasdiqlang</label>
          <input type="password" id="confirm_password" required />
        </div>
        <div id="edit-profile-error" class="error-text" hidden></div>
        <button type="submit" class="primary block">Saqlash</button>
      </form>
    </div>
  `;

  document.getElementById("edit-profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("edit-profile-error");
    errorBox.hidden = true;
    const first_name = document.getElementById("first_name").value.trim();
    const last_name = document.getElementById("last_name").value.trim();
    const payload = {
      first_name,
      last_name,
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value,
      confirm_password: document.getElementById("confirm_password").value,
    };
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await UsersAPI.completeProfile(payload);
      Auth.setFullName(`${first_name} ${last_name}`.trim());
      renderNav();
      showToast("Profil yangilandi");
      navigate("/");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

// ================= KITOBLAR =================

let currentCategory = "all";
let currentPage = 1;

async function pageHome() {
  app.innerHTML = `
    <div class="page-head"><h1>Kitoblar</h1></div>
    <div class="chips" id="chips"></div>
    <div id="book-area"><div class="empty-state">Yuklanmoqda...</div></div>
  `;

  const chips = document.getElementById("chips");
  const allCats = [["all", "Barchasi"], ...Object.entries(CATEGORY_LABELS)];
  chips.innerHTML = allCats.map(([key, label]) =>
    `<span class="chip ${key === currentCategory ? "active" : ""}" data-cat="${key}">${label}</span>`
  ).join("");

  chips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      currentCategory = chip.dataset.cat;
      currentPage = 1;
      pageHome();
    });
  });

  const area = document.getElementById("book-area");
  try {
    if (currentCategory === "all") {
      const data = await BooksAPI.list(currentPage);
      renderBookGrid(area, data.results, { next: data.next, previous: data.previous });
    } else {
      const data = await BooksAPI.byCategory(currentCategory);
      renderBookGrid(area, data.data, null);
    }
  } catch (err) {
    area.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderBookGrid(container, books, pagination) {
  if (!books || books.length === 0) {
    container.innerHTML = `<div class="empty-state">Bu bo'limda hozircha kitob yo'q.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="book-grid">
      ${books.map(b => `
        <a class="book-card" href="#/book/${b.id}">
          <div class="book-cover">${bookCoverHtml(b.image)}</div>
          <div class="book-body">
            <p class="book-title">${escapeHtml(b.title)}</p>
            <span class="badge ${b.status}">${STATUS_LABELS[b.status] || b.status}</span>
          </div>
        </a>
      `).join("")}
    </div>
    ${pagination ? `
      <div class="pagination">
        <button id="prev-page" ${!pagination.previous ? "disabled" : ""}>Oldingi</button>
        <button id="next-page" ${!pagination.next ? "disabled" : ""}>Keyingi</button>
      </div>
    ` : ""}
  `;

  if (pagination) {
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    if (prevBtn) prevBtn.addEventListener("click", () => { currentPage--; pageHome(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { currentPage++; pageHome(); });
  }
}

async function pageBookDetail(id) {
  app.innerHTML = `<div class="empty-state">Yuklanmoqda...</div>`;
  let book;
  try {
    book = await BooksAPI.detail(id);
  } catch (err) {
    app.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    return;
  }

  const isAvailable = book.status === "available";

  app.innerHTML = `
    <div class="detail-layout">
      <div class="detail-cover">${bookCoverHtml(book.image)}</div>
      <div>
        <p class="detail-category">${CATEGORY_LABELS[book.category] || book.category}</p>
        <h1 class="detail-title">${escapeHtml(book.title)}</h1>
        <p class="detail-desc">${escapeHtml(book.description)}</p>
        <div class="price-row">
          <div>
            <p class="price-label">Ijara narxi</p>
            <p class="price-value">${formatPrice(book.rental_price)}</p>
          </div>
          <div>
            <p class="price-label">Sotib olish</p>
            <p class="price-value">${formatPrice(book.purchase_price)}</p>
          </div>
        </div>
        <button id="book-btn" class="primary" ${isAvailable ? "" : "disabled"}>
          ${isAvailable ? "Band qilish" : "Band qilingan"}
        </button>
        <div id="book-error" class="error-text" hidden></div>
        <div class="status-row">
          <span class="status-dot ${book.status}"></span>
          <span>${isAvailable ? "Hozir mavjud" : "Hozircha band"}</span>
        </div>
      </div>
    </div>
  `;

  const bookBtn = document.getElementById("book-btn");
  if (isAvailable) {
    bookBtn.addEventListener("click", async () => {
      if (!Auth.isLoggedIn()) {
        showToast("Band qilish uchun avval tizimga kiring", "error");
        navigate("/login");
        return;
      }
      const errorBox = document.getElementById("book-error");
      errorBox.hidden = true;
      bookBtn.disabled = true;
      try {
        const res = await BooksAPI.book(id);
        showToast(res.message || "Kitob band qilindi");
        pageBookDetail(id);
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        bookBtn.disabled = false;
      }
    });
  }
}

// ================= ADMIN =================

function adminNavHtml(active) {
  return `
    <div class="admin-nav">
      <a href="#/admin/add" class="${active === "add" ? "active" : ""}">Kitob qo'shish</a>
      <a href="#/admin/manage" class="${active === "manage" ? "active" : ""}">Kitoblar</a>
    </div>
  `;
}

async function ensureAdminOrDeny() {
  const isAdmin = adminChecked ? Auth.isAdmin() : await checkAdminAccess();
  adminChecked = true;
  if (!isAdmin) {
    app.innerHTML = `<div class="empty-state">Bu bo'limga faqat adminlar kira oladi.</div>`;
    return false;
  }
  return true;
}

async function pageAdminAdd() {
  if (!Auth.isLoggedIn()) { navigate("/login"); return; }
  if (!(await ensureAdminOrDeny())) return;

  app.innerHTML = `
    <div class="admin-layout">
      ${adminNavHtml("add")}
      <div class="card">
        <h1 class="auth-title" style="margin-bottom:20px;">Yangi kitob qo'shish</h1>
        <form id="add-form">
          <div class="field-row">
            <div class="field">
              <label>Sarlavha</label>
              <input type="text" id="title" required />
            </div>
            <div class="field">
              <label>Kategoriya</label>
              <select id="category" required>
                ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label>Tavsif</label>
            <textarea id="description" rows="3" required></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Ijara narxi (so'm)</label>
              <input type="number" id="rental_price" required />
            </div>
            <div class="field">
              <label>Sotib olish narxi (so'm)</label>
              <input type="number" id="purchase_price" required />
            </div>
          </div>
          <div class="field">
            <label>Rasm (jpg, png, jpeg, webp)</label>
            <div class="upload-box" id="upload-box">Rasmni tanlash uchun bosing</div>
            <input type="file" id="image" accept=".jpg,.jpeg,.png,.webp" required hidden />
          </div>
          <div id="add-error" class="error-text" hidden></div>
          <button type="submit" class="primary">Saqlash</button>
        </form>
      </div>
    </div>
  `;

  const uploadBox = document.getElementById("upload-box");
  const imageInput = document.getElementById("image");
  uploadBox.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadBox.innerHTML = `<img src="${reader.result}" alt="" /><div>${escapeHtml(file.name)}</div>`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("add-error");
    errorBox.hidden = true;
    const formData = new FormData();
    formData.append("title", document.getElementById("title").value.trim());
    formData.append("description", document.getElementById("description").value.trim());
    formData.append("category", document.getElementById("category").value);
    formData.append("rental_price", document.getElementById("rental_price").value);
    formData.append("purchase_price", document.getElementById("purchase_price").value);
    if (imageInput.files[0]) formData.append("image", imageInput.files[0]);

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await BooksAPI.add(formData);
      showToast("Kitob qo'shildi");
      navigate("/admin/manage");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

async function pageAdminManage() {
  if (!Auth.isLoggedIn()) { navigate("/login"); return; }
  if (!(await ensureAdminOrDeny())) return;

  app.innerHTML = `
    <div class="admin-layout">
      ${adminNavHtml("manage")}
      <div>
        <h1 class="auth-title" style="margin-bottom:16px;">Barcha kitoblar</h1>
        <div id="manage-area"><div class="empty-state">Yuklanmoqda...</div></div>
      </div>
    </div>
  `;

  await loadManageTable();
}

async function loadManageTable() {
  const area = document.getElementById("manage-area");
  try {
    const data = await BooksAPI.list(1);
    if (!data.results || data.results.length === 0) {
      area.innerHTML = `<div class="empty-state">Hozircha kitob yo'q.</div>`;
      return;
    }
    area.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>Sarlavha</th><th>Status</th><th class="actions">Amallar</th></tr>
        </thead>
        <tbody>
          ${data.results.map(b => `
            <tr data-id="${b.id}">
              <td>${escapeHtml(b.title)}</td>
              <td><span class="badge ${b.status}">${STATUS_LABELS[b.status] || b.status}</span></td>
              <td class="actions">
                <button class="edit-btn" data-id="${b.id}" data-title="${escapeHtml(b.title)}" data-status="${b.status}">Tahrirlash</button>
                <button class="danger delete-btn" data-id="${b.id}">O'chirish</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    area.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", () => openEditForm(btn.dataset.id, btn.dataset.title, btn.dataset.status));
    });
    area.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", () => handleDelete(btn.dataset.id));
    });
  } catch (err) {
    area.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function openEditForm(id, title, status) {
  const area = document.getElementById("manage-area");
  area.insertAdjacentHTML("afterbegin", `
    <div class="card" id="edit-card" style="margin-bottom:16px;">
      <h2 class="auth-title" style="font-size:16px;">Tahrirlash</h2>
      <form id="edit-form">
        <div class="field">
          <label>Sarlavha</label>
          <input type="text" id="edit-title" value="${escapeHtml(title)}" required />
        </div>
        <div class="field">
          <label>Status</label>
          <select id="edit-status">
            <option value="available" ${status === "available" ? "selected" : ""}>Bor</option>
            <option value="booked" ${status === "booked" ? "selected" : ""}>Band</option>
          </select>
        </div>
        <div class="field">
          <label>Yangi rasm (ixtiyoriy)</label>
          <input type="file" id="edit-image" accept=".jpg,.jpeg,.png,.webp" />
        </div>
        <div id="edit-error" class="error-text" hidden></div>
        <div style="display:flex; gap:8px;">
          <button type="submit" class="primary">Saqlash</button>
          <button type="button" id="cancel-edit">Bekor qilish</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("cancel-edit").addEventListener("click", () => {
    document.getElementById("edit-card").remove();
  });

  document.getElementById("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("edit-error");
    errorBox.hidden = true;
    const formData = new FormData();
    formData.append("title", document.getElementById("edit-title").value.trim());
    formData.append("status", document.getElementById("edit-status").value);
    const imgFile = document.getElementById("edit-image").files[0];
    if (imgFile) formData.append("image", imgFile);

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await BooksAPI.update(id, formData);
      showToast("Kitob yangilandi");
      document.getElementById("edit-card").remove();
      loadManageTable();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

async function handleDelete(id) {
  if (!confirm("Kitobni o'chirishni tasdiqlaysizmi?")) return;
  try {
    await BooksAPI.remove(id);
    showToast("Kitob o'chirildi");
    loadManageTable();
  } catch (err) {
    showToast(err.message, "error");
  }
}
