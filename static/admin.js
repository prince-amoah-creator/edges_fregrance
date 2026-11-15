
/* THE EDGES FRAGRANCE
   Admin dashboard connected to Flask + MySQL.
*/

const API_URL = "/api/products";
const AUTH_KEY = "tef-admin-password-hash";
const SESSION_KEY = "tef-admin-unlocked";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const $ = selector => document.querySelector(selector);

let selectedImage = null;
let existingImage = "";
let productsCache = [];

// ------------------------------
// GENERAL HELPERS
// ------------------------------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function formatMoney(value) {
    return `GH₵ ${Number(value).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function toast(message) {
    const el = $("#adminToast");

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        el.classList.remove("show");
    }, 2600);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

// ------------------------------
// PRODUCT API
// ------------------------------

async function getAllProducts() {
    const data = await apiRequest(API_URL);

    productsCache = data.products || [];

    return productsCache;
}

async function renderAdminProducts() {
    try {
        const items = await getAllProducts();

        $("#statProducts").textContent = items.length;

        $("#statPriced").textContent = items.filter(
            p => p.price !== null && Number(p.price) > 0
        ).length;

        $("#catalogueCount").textContent = `${items.length} ITEMS`;

        $("#adminProductList").innerHTML = items.length
            ? items.map(p => `
                <article class="admin-product">
                    <img
                        src="${escapeHTML(p.image || "")}"
                        alt="${escapeHTML(p.name)}"
                    >

                    <div>
                        <h3>${escapeHTML(p.name)}</h3>

                        <p>${escapeHTML(
                            p.description || "No description added"
                        )}</p>

                        <strong>
                            ${p.price === null
                                ? "Price not set"
                                : formatMoney(p.price)}
                        </strong>
                    </div>

                    <div class="product-actions">
                        <button data-edit="${escapeHTML(p.id)}">
                            Edit
                        </button>

                        <button
                            class="delete-btn"
                            data-delete="${escapeHTML(p.id)}"
                        >
                            Delete
                        </button>
                    </div>
                </article>
            `).join("")
            : '<p class="empty-list">No products yet. Add your first fragrance using the form.</p>';

    } catch (error) {
        $("#adminProductList").innerHTML =
            `<p class="empty-list">${escapeHTML(error.message)}</p>`;

        toast("Could not load products.");
    }
}

// ------------------------------
// LOCAL LOGIN (TEMPORARY)
// ------------------------------

async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);

    const hash = await crypto.subtle.digest("SHA-256", bytes);

    return [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function showDashboard() {
    $("#loginCard").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");

    sessionStorage.setItem(SESSION_KEY, "yes");

    renderAdminProducts();
}

function showLogin() {
    $("#dashboard").classList.add("hidden");
    $("#loginCard").classList.remove("hidden");

    sessionStorage.removeItem(SESSION_KEY);
}

async function initAuth() {
    const hasPassword = !!localStorage.getItem(AUTH_KEY);

    $("#loginTitle").innerHTML = hasPassword
        ? 'Welcome <em>back.</em>'
        : 'Create your <em>admin password.</em>';

    $("#loginCopy").textContent = hasPassword
        ? "Enter your admin password to manage your fragrance collection."
        : "Set a password of at least 8 characters.";

    $("#passwordLabel").textContent = hasPassword
        ? "Admin password"
        : "Create password";

    $("#loginButton").innerHTML = hasPassword
        ? 'Unlock dashboard <span>→</span>'
        : 'Set password & unlock <span>→</span>';

    $("#adminPassword").autocomplete = hasPassword
        ? "current-password"
        : "new-password";

    if (sessionStorage.getItem(SESSION_KEY) === "yes") {
        showDashboard();
    }
}

$("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const password = $("#adminPassword").value;

    if (password.length < 8) {
        $("#loginMessage").textContent =
            "Use at least 8 characters.";
        return;
    }

    const saved = localStorage.getItem(AUTH_KEY);
    const hash = await hashPassword(password);

    if (!saved) {
        localStorage.setItem(AUTH_KEY, hash);

        showDashboard();

        $("#adminPassword").value = "";
        return;
    }

    if (hash !== saved) {
        $("#loginMessage").textContent =
            "That password is not correct.";
        return;
    }

    $("#loginMessage").textContent = "";

    showDashboard();

    $("#adminPassword").value = "";
});

$("#logoutButton").addEventListener("click", showLogin);

// ------------------------------
// IMAGE PREVIEW
// ------------------------------

$("#productImage").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        $("#productMessage").textContent =
            "Only JPG, PNG and WEBP images are allowed.";

        event.target.value = "";
        return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
        $("#productMessage").textContent =
            "Image is larger than 8 MB.";

        event.target.value = "";
        return;
    }

    selectedImage = file;

    const previewURL = URL.createObjectURL(file);

    $("#imagePreview").src = previewURL;
    $("#previewWrap").classList.remove("hidden");

    $("#productMessage").textContent = "Image ready to upload.";
});

$("#clearImage").addEventListener("click", () => {
    selectedImage = null;
    existingImage = "";

    $("#productImage").value = "";

    $("#previewWrap").classList.add("hidden");
});

// ------------------------------
// RESET FORM
// ------------------------------

function resetForm() {
    $("#productForm").reset();

    $("#productId").value = "";

    selectedImage = null;
    existingImage = "";

    $("#previewWrap").classList.add("hidden");

    $("#editorTitle").textContent = "Add a product";

    $("#saveProductButton").innerHTML =
        'Save product <span>→</span>';

    $("#cancelEdit").classList.add("hidden");

    $("#productMessage").textContent = "";
}

$("#cancelEdit").addEventListener("click", resetForm);

// ------------------------------
// EDIT PRODUCT
// ------------------------------

async function editProduct(id) {
    const product = productsCache.find(p => p.id === id);

    if (!product) return;

    $("#productId").value = product.id;

    $("#productName").value = product.name;
    $("#productDescription").value = product.description || "";

    $("#productPrice").value = product.price ?? "";
    $("#productTag").value = product.tag || "";

    existingImage = product.image || "";
    selectedImage = null;

    $("#imagePreview").src = existingImage;

    $("#previewWrap").classList.remove("hidden");

    $("#editorTitle").textContent = "Edit product";

    $("#saveProductButton").innerHTML =
        'Update product <span>→</span>';

    $("#cancelEdit").classList.remove("hidden");

    $("#productMessage").textContent = "";

    $("#productName").focus();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ------------------------------
// SAVE / UPDATE PRODUCT
// ------------------------------

$("#productForm").addEventListener("submit", async event => {
    event.preventDefault();

    const id = $("#productId").value;

    const name = $("#productName").value.trim();
    const description = $("#productDescription").value.trim();
    const price = $("#productPrice").value;
    const tag = $("#productTag").value.trim();

    if (!name || !price || Number(price) <= 0) {
        $("#productMessage").textContent =
            "Enter a product name and a valid price.";

        return;
    }

    if (!id && !selectedImage) {
        $("#productMessage").textContent =
            "Please upload a product photograph.";

        return;
    }

    if (id && selectedImage) {
        $("#productMessage").textContent =
            "Photo replacement will be enabled in the next backend update. Save without selecting a new photo.";

        return;
    }

    const button = $("#saveProductButton");

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        let result;

        if (id) {
            // UPDATE EXISTING PRODUCT

            result = await apiRequest(`${API_URL}/${encodeURIComponent(id)}`, {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    description,
                    price: Number(price),
                    tag: tag || null
                })
            });

        } else {
            // CREATE NEW PRODUCT

            const formData = new FormData();

            formData.append("name", name);
            formData.append("description", description);
            formData.append("price", price);
            formData.append("tag", tag || "THE TEF EDIT");
            formData.append("image", selectedImage);

            result = await apiRequest(API_URL, {
                method: "POST",
                body: formData
            });
        }

        resetForm();

        await renderAdminProducts();

        toast(result.message || "Product saved successfully.");

    } catch (error) {
        $("#productMessage").textContent = error.message;

    } finally {
        button.disabled = false;

        if ($("#productId").value) {
            button.innerHTML = 'Update product <span>→</span>';
        } else {
            button.innerHTML = 'Save product <span>→</span>';
        }
    }
});

// ------------------------------
// EDIT / DELETE BUTTONS
// ------------------------------

$("#adminProductList").addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
        await editProduct(edit.dataset.edit);
    }

    if (del) {
        const product = productsCache.find(
            p => p.id === del.dataset.delete
        );

        if (!product) return;

        if (!confirm(`Delete "${product.name}" from your catalogue?`)) {
            return;
        }

        try {
            const result = await apiRequest(
                `${API_URL}/${encodeURIComponent(product.id)}`,
                { method: "DELETE" }
            );

            await renderAdminProducts();

            toast(result.message || "Product deleted.");

        } catch (error) {
            toast(error.message);
        }
    }
});

// ------------------------------
// EXPORT BACKUP
// ------------------------------

$("#exportCatalogue").addEventListener("click", async () => {
    try {
        const data = await getAllProducts();

        const blob = new Blob([
            JSON.stringify({
                brand: "THE EDGES FRAGRANCE",
                exportedAt: new Date().toISOString(),
                products: data
            }, null, 2)
        ], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = "tef-catalogue-backup.json";
        a.click();

        URL.revokeObjectURL(url);

        toast("Catalogue backup exported.");

    } catch (error) {
        toast(error.message);
    }
});

// ------------------------------
// RESTORE / IMPORT
// ------------------------------

$("#restoreSamples").addEventListener("click", () => {
    toast("Starter examples are not available through the server yet.");
});

$("#importFile").addEventListener("change", event => {
    event.target.value = "";

    toast("Server catalogue import will be implemented separately.");
});

// ------------------------------
// INITIALIZE
// ------------------------------

(async function initializeAdmin() {
    try {
        await initAuth();

    } catch (error) {
        console.error(error);

        $("#loginMessage").textContent =
            "Could not initialize the admin dashboard.";
    }
})();
