
/* =========================================================
   THE EDGES FRAGRANCE
   Public Storefront
   Flask API + MySQL Catalogue
========================================================= */

/* =========================
   CONFIGURATION
========================= */

const API_URL = "/api/products";

const WHATSAPP_NUMBER = "233538699373";
const CURRENCY = "GH₵";

const STORAGE_KEY = "tef-shopping-bag-v1";

let products = [];
let cart = loadCart();
let pendingOrder = null;


/* =========================
   HELPER FUNCTIONS
========================= */

const $ = (selector) => document.querySelector(selector);

const money = (amount) =>
    `${CURRENCY} ${Number(amount).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

const productById = (id) =>
    products.find(product => String(product.id) === String(id));

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


/* =========================
   PRODUCT API
========================= */

async function loadProducts() {

    const productGrid = $("#productGrid");

    productGrid.innerHTML = `
        <p class="loading-products">Loading fragrances...</p>
    `;

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Could not retrieve products from the server.");
        }

        const data = await response.json();

        if (data.status !== "success") {
            throw new Error(data.message || "Product loading failed.");
        }

        products = Array.isArray(data.products)
            ? data.products
            : [];

        // Remove products that have been deleted by the admin.
        cart = cart.filter(item => productById(item.id));

        saveCart();

        renderProducts();
        renderCart();

        console.log(
            "TEF products successfully loaded:",
            products.length
        );

    } catch (error) {

        console.error("Product loading error:", error);

        productGrid.innerHTML = `
            <p class="loading-products">
                We could not load our fragrances.
                Please refresh the page.
            </p>
        `;

        $("#productCount").textContent = "COLLECTION UNAVAILABLE";
    }
}


/* =========================
   CART STORAGE
========================= */

function loadCart() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        return Array.isArray(saved)
            ? saved.filter(item =>
                item &&
                typeof item.id === "string" &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            )
            : [];

    } catch {

        return [];

    }
}


function saveCart() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cart)
    );

}


/* =========================
   PRODUCT PRICING
========================= */

function productPrice(product) {

    if (
        !product ||
        product.price === null ||
        product.price === undefined ||
        product.price === ""
    ) {
        return null;
    }

    const price = Number(product.price);

    return Number.isFinite(price) && price >= 0
        ? price
        : null;
}


function priceLabel(product) {

    const price = productPrice(product);

    return price === null
        ? "Price to be confirmed"
        : money(price);

}


function cartTotal() {

    return cart.reduce((sum, item) => {

        const product = productById(item.id);

        return sum +
            (productPrice(product) ?? 0) * item.quantity;

    }, 0);

}


function cartCount() {

    return cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

}


/* =========================
   DISPLAY PRODUCTS
========================= */

function renderProducts() {

    const productGrid = $("#productGrid");

    $("#productCount").textContent =
        `THE EDIT / ${String(products.length).padStart(2, "0")} PIECES`;

    if (!products.length) {

        productGrid.innerHTML = `
            <p class="loading-products">
                No fragrances are available at the moment.
                Please check back soon.
            </p>
        `;

        return;
    }

    productGrid.innerHTML = products.map(product => {

        const price = productPrice(product);

        return `
            <article class="product-card">

                <div class="product-image-wrap">

                    <img
                        class="product-image"
                        src="${escapeHTML(product.image || "")}"
                        alt="${escapeHTML(product.name)} perfume"
                        loading="lazy"
                    >

                    <span class="product-tag">
                        ${escapeHTML(product.tag || "THE TEF EDIT")}
                    </span>

                    <button
                        class="quick-add"
                        data-add="${escapeHTML(product.id)}"
                        ${price === null
                            ? 'disabled title="Price to be confirmed"'
                            : ""}
                    >
                        ${price === null
                            ? "Price coming soon"
                            : "Add to bag +"}
                    </button>

                </div>

                <div class="product-info">

                    <h3>${escapeHTML(product.name)}</h3>

                    <p>
                        ${escapeHTML(product.description || "")}
                    </p>

                    <span class="product-price">
                        ${priceLabel(product)}
                    </span>

                </div>

            </article>
        `;

    }).join("");

}


/* =========================
   ADD PRODUCTS TO CART
========================= */

function addToCart(id) {

    const product = productById(id);

    if (!product || productPrice(product) === null) {

        showToast(
            "This product's price will be confirmed soon."
        );

        return;
    }

    const existing = cart.find(
        item => item.id === String(id)
    );

    if (existing) {

        existing.quantity++;

    } else {

        cart.push({
            id: String(id),
            quantity: 1
        });

    }

    saveCart();

    renderCart();

    openCart();

    showToast(
        `${product.name} added to your bag.`
    );

}


/* =========================
   UPDATE CART QUANTITY
========================= */

function updateQuantity(id, delta) {

    const item = cart.find(
        entry => entry.id === String(id)
    );

    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {

        cart = cart.filter(
            entry => entry.id !== String(id)
        );

    }

    saveCart();

    renderCart();

}


/* =========================
   REMOVE CART ITEM
========================= */

function removeFromCart(id) {

    cart = cart.filter(
        item => item.id !== String(id)
    );

    saveCart();

    renderCart();

}


/* =========================
   DISPLAY SHOPPING CART
========================= */

function renderCart() {

    $("#cartCount").textContent = cartCount();

    $("#drawerCount").textContent =
        `(${cartCount()})`;

    $("#cartSubtotal").textContent =
        money(cartTotal());

    $("#checkoutTotal").textContent =
        money(cartTotal());


    if (!cart.length) {

        $("#cartItems").innerHTML = `
            <p class="empty-cart">
                Your bag is waiting for something beautiful.
            </p>
        `;

        $("#checkoutButton").disabled = true;

        return;
    }


    $("#checkoutButton").disabled = false;


    $("#cartItems").innerHTML = cart.map(item => {

        const product = productById(item.id);

        if (!product) return "";

        const price = productPrice(product);

        return `

            <div class="cart-row">

                <img
                    src="${escapeHTML(product.image || "")}"
                    alt="${escapeHTML(product.name)}"
                >

                <div>

                    <h3>
                        ${escapeHTML(product.name)}
                    </h3>

                    <p>
                        ${price === null
                            ? "Price to be confirmed"
                            : `${money(price)} each`}
                    </p>

                    <div class="quantity-control">

                        <button
                            data-qty="${escapeHTML(product.id)}"
                            data-delta="-1"
                            aria-label="Decrease ${escapeHTML(product.name)} quantity"
                        >
                            −
                        </button>

                        <span>${item.quantity}</span>

                        <button
                            data-qty="${escapeHTML(product.id)}"
                            data-delta="1"
                            aria-label="Increase ${escapeHTML(product.name)} quantity"
                        >
                            +
                        </button>

                    </div>

                    <button
                        class="remove-item"
                        data-remove="${escapeHTML(product.id)}"
                    >
                        Remove
                    </button>

                </div>

                <strong class="cart-row-price">

                    ${price === null
                        ? "TBC"
                        : money(price * item.quantity)}

                </strong>

            </div>

        `;

    }).join("");

}


/* =========================
   SHOPPING CART DRAWER
========================= */

function openCart() {

    $("#cartDrawer").classList.add("open");

    $("#overlay").classList.add("visible");

    $("#cartDrawer").setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow = "hidden";

}


function closeCart() {

    $("#cartDrawer").classList.remove("open");

    $("#overlay").classList.remove("visible");

    $("#cartDrawer").setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

}


/* =========================
   MODALS
========================= */

function openModal(selector) {

    $(selector).classList.add("open");

    $(selector).setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow = "hidden";

}


function closeModal(selector) {

    $(selector).classList.remove("open");

    $(selector).setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

}


/* =========================
   NOTIFICATION TOAST
========================= */

function showToast(message) {

    const toast = $("#toast");

    toast.textContent = message;

    toast.classList.add("show");

    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}


/* =========================
   WHATSAPP ORDER MESSAGE
========================= */

function buildWhatsAppMessage(order) {

    const lines = order.items.map(item => `• ${item.name}
  Qty: ${item.quantity} × ${money(item.price)} = ${money(item.price * item.quantity)}`);

    return `THE EDGES FRAGRANCE — ORDER ENQUIRY

Customer: ${order.name}
Phone: ${order.phone}
Delivery location: ${order.location}

ORDER DETAILS
${lines.join("\n")}

TOTAL: ${money(order.total)}
${order.notes
    ? `\nAdditional notes: ${order.notes}\n`
    : "\n"}Please confirm availability, delivery fee and payment details. Thank you.`;

}


/* =========================
   REVIEW ORDER
========================= */

function reviewOrder(formData) {

    const items = cart.map(item => {

        const product = productById(item.id);

        if (!product) return null;

        return {
            name: product.name,
            quantity: item.quantity,
            price: productPrice(product)
        };

    }).filter(Boolean);


    if (
        !items.length ||
        items.length !== cart.length ||
        items.some(item => item.price === null)
    ) {

        showToast(
            "Please confirm all product prices before checkout."
        );

        return;
    }


    pendingOrder = {

        name: formData.get("customerName").trim(),

        phone: formData.get("customerPhone").trim(),

        location: formData.get("customerLocation").trim(),

        notes: formData.get("orderNotes").trim(),

        items,

        total: cartTotal()

    };


    const content = $("#reviewContent");


    content.innerHTML = `

        <div class="review-customer">

            <strong>
                ${escapeHTML(pendingOrder.name)}
            </strong>

            <br>

            ${escapeHTML(pendingOrder.phone)}

            <br>

            ${escapeHTML(pendingOrder.location)}

            ${pendingOrder.notes
                ? `<br>Note: ${escapeHTML(pendingOrder.notes)}`
                : ""}

        </div>


        <div class="review-content-list">

            ${items.map(item => `

                <div class="review-line">

                    <span>
                        ${escapeHTML(item.name)} × ${item.quantity}
                    </span>

                    <strong>
                        ${money(item.price * item.quantity)}
                    </strong>

                </div>

            `).join("")}


            <div class="review-total">

                <span>Total</span>

                <strong>
                    ${money(pendingOrder.total)}
                </strong>

            </div>

        </div>

    `;


    closeModal("#checkoutModal");

    openModal("#reviewModal");

}


/* =========================
   SEND ORDER TO WHATSAPP
========================= */

function sendWhatsAppOrder() {

    if (!pendingOrder) return;

    const url =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            buildWhatsAppMessage(pendingOrder)
        )}`;

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    // Keep the cart until the customer confirms their order.

    closeModal("#reviewModal");

    closeCart();

    showToast(
        "WhatsApp opened. Send your message there to submit the order."
    );

}


/* =========================
   EVENT LISTENERS
========================= */

// Product buttons
$("#productGrid").addEventListener("click", event => {

    const button = event.target.closest("[data-add]");

    if (button && !button.disabled) {

        addToCart(button.dataset.add);

    }

});


// Cart quantity and remove buttons
$("#cartItems").addEventListener("click", event => {

    const qty = event.target.closest("[data-qty]");

    const remove = event.target.closest("[data-remove]");

    if (qty) {

        updateQuantity(
            qty.dataset.qty,
            Number(qty.dataset.delta)
        );

    }

    if (remove) {

        removeFromCart(remove.dataset.remove);

    }

});


// Open and close cart
$("#openCart").addEventListener("click", openCart);

$("#closeCart").addEventListener("click", closeCart);

$("#overlay").addEventListener("click", closeCart);


// Checkout
$("#checkoutButton").addEventListener("click", () => {

    if (!cart.length) return;

    closeCart();

    openModal("#checkoutModal");

});


$("#closeCheckout").addEventListener("click", () => {

    closeModal("#checkoutModal");

});


$("#closeReview").addEventListener("click", () => {

    closeModal("#reviewModal");

});


$("#checkoutForm").addEventListener("submit", event => {

    event.preventDefault();

    if (!event.currentTarget.reportValidity()) return;

    reviewOrder(
        new FormData(event.currentTarget)
    );

});


$("#sendWhatsApp").addEventListener(
    "click",
    sendWhatsAppOrder
);


// Mobile navigation
$("#menuToggle").addEventListener("click", () => {

    const nav = $("#mainNav");

    const open = nav.classList.toggle("open");

    $("#menuToggle").setAttribute(
        "aria-expanded",
        String(open)
    );

});


$("#mainNav").addEventListener("click", event => {

    if (event.target.closest("a")) {

        $("#mainNav").classList.remove("open");

        $("#menuToggle").setAttribute(
            "aria-expanded",
            "false"
        );

    }

});


// Escape key closes open panels
document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        closeCart();

        closeModal("#checkoutModal");

        closeModal("#reviewModal");

    }

});


// Instagram link
document.querySelectorAll('[data-social="instagram"]').forEach(link => {

    link.addEventListener("click", event => {

        event.preventDefault();

        showToast(
            "Add your Instagram profile URL in index.html."
        );

    });

});


/* =========================
   INITIALIZE STOREFRONT
========================= */

$("#year").textContent = new Date().getFullYear();

renderCart();

loadProducts();
