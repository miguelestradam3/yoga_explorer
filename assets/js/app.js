const API_BASE = "https://yoga-api-nzy4.onrender.com/v1";
const POSES_URL = `${API_BASE}/poses`;
const CATEGORIES_URL = `${API_BASE}/categories`;
const FAVORITES_KEY = "yogaPoseExplorerFavorites";

const posesContainer = document.getElementById("poses");
const paginationContainer = document.getElementById("pagination");
const searchInput = document.getElementById("searchInput");
const difficultyFilter = document.getElementById("difficultyFilter");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
const pageSizeSelect = document.getElementById("pageSize");
const favoritesOnly = document.getElementById("favoritesOnly");
const resultsCount = document.getElementById("resultsCount");
const modalElement = document.getElementById("poseModal");
const poseModal = new bootstrap.Modal(modalElement);

let poses = [];
let filteredPoses = [];
let currentPage = 1;
let posesPerPage = Number(pageSizeSelect.value);
let favorites = loadFavorites();

function loadFavorites() {
    try {
        return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]").map(String));
    } catch {
        return new Set();
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    updateStats();
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
}

function normalize(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function getPoseId(pose) {
    return String(pose.id ?? pose.english_name);
}

function getDifficulty(pose) {
    return pose.difficulty_level || pose.level || "Not specified";
}

function getCategory(pose) {
    return pose.category_name || pose.category || "Uncategorized";
}

function showLoading() {
    posesContainer.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border loading-spinner" role="status"><span class="visually-hidden">Loading...</span></div>
            <p class="mt-3 text-secondary">Loading the pose library...</p>
        </div>`;
}

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The API returned an error (${response.status}).`);
    return response.json();
}

async function getPoses() {
    showLoading();
    try {
        const [poseData, categoryResult] = await Promise.all([
            fetchJSON(POSES_URL),
            fetchJSON(CATEGORIES_URL).catch(() => [])
        ]);

        poses = Array.isArray(poseData) ? poseData : (poseData.poses || []);
        // The categories endpoint contains pose difficulty/category metadata.
        const metadata = new Map();
        (Array.isArray(categoryResult) ? categoryResult : []).forEach(category => {
            (category.poses || []).forEach(pose => {
                metadata.set(String(pose.id), {
                    category_name: pose.category_name || category.category_name,
                    difficulty_level: pose.difficulty_level
                });
            });
        });

        poses = poses.map(pose => ({ ...metadata.get(String(pose.id)), ...pose }));
        populateCategoryFilter();
        updateStats();
        applyFilters();
    } catch (error) {
        posesContainer.innerHTML = `
            <div class="col-12"><div class="empty-state">
                <i class="bi bi-cloud-slash"></i>
                <h3>We couldn't load the poses</h3>
                <p>${escapeHTML(error.message)} Check your connection and try again.</p>
                <button class="btn btn-accent" id="retryButton"><i class="bi bi-arrow-repeat me-1"></i> Try again</button>
            </div></div>`;
        document.getElementById("retryButton").addEventListener("click", getPoses);
        resultsCount.textContent = "Unable to load data";
    }
}

function populateCategoryFilter() {
    const categories = [...new Set(poses.map(getCategory).filter(value => value !== "Uncategorized"))]
        .sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML = '<option value="">All categories</option>' +
        categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
}

function updateStats() {
    document.getElementById("totalPoses").textContent = poses.length;
    document.getElementById("totalCategories").textContent = new Set(poses.map(getCategory)).size;
    document.getElementById("totalFavorites").textContent = favorites.size;
}

function getSearchableText(pose) {
    return [
        pose.english_name, pose.sanskrit_name, pose.sanskrit_name_adapted,
        pose.translation_name, pose.pose_description, pose.pose_benefits,
        getDifficulty(pose), getCategory(pose)
    ].join(" ");
}

function applyFilters() {
    const query = normalize(searchInput.value);
    const difficulty = normalize(difficultyFilter.value);
    const category = categoryFilter.value;
    const onlyFavorites = favoritesOnly.checked;

    filteredPoses = poses.filter(pose => {
        const matchesSearch = !query || normalize(getSearchableText(pose)).includes(query);
        const matchesDifficulty = !difficulty || normalize(getDifficulty(pose)) === difficulty;
        const matchesCategory = !category || getCategory(pose) === category;
        const matchesFavorite = !onlyFavorites || favorites.has(getPoseId(pose));
        return matchesSearch && matchesDifficulty && matchesCategory && matchesFavorite;
    });

    sortPoses();
    currentPage = 1;
    displayPoses();
}

function sortPoses() {
    const difficultyOrder = { beginner: 1, intermediate: 2, expert: 3 };
    const sortBy = sortFilter.value;
    filteredPoses.sort((a, b) => {
        if (sortBy === "name-desc") return (b.english_name || "").localeCompare(a.english_name || "");
        if (sortBy === "difficulty") {
            return (difficultyOrder[normalize(getDifficulty(a))] || 99) -
                   (difficultyOrder[normalize(getDifficulty(b))] || 99);
        }
        if (sortBy === "sanskrit") return (a.sanskrit_name_adapted || a.sanskrit_name || "")
            .localeCompare(b.sanskrit_name_adapted || b.sanskrit_name || "");
        return (a.english_name || "").localeCompare(b.english_name || "");
    });
}

function displayPoses() {
    const total = filteredPoses.length;
    const totalPages = Math.ceil(total / posesPerPage);
    if (totalPages && currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * posesPerPage;
    const pagePoses = filteredPoses.slice(start, start + posesPerPage);

    resultsCount.textContent = total === 1 ? "1 pose found" : `${total} poses found`;
    if (!pagePoses.length) {
        posesContainer.innerHTML = `<div class="col-12"><div class="empty-state">
            <i class="bi bi-search"></i><h3>No poses found</h3>
            <p>Try changing your search or removing one of the filters.</p>
            <button class="btn btn-accent" id="emptyReset">Clear filters</button>
        </div></div>`;
        document.getElementById("emptyReset").addEventListener("click", resetFilters);
    } else {
        posesContainer.innerHTML = pagePoses.map(createPoseCard).join("");
    }
    createPagination(totalPages);
}

function createPoseCard(pose) {
    const id = getPoseId(pose);
    const isFavorite = favorites.has(id);
    const image = pose.url_svg || pose.url_png || pose.url_svg_alt;
    const name = escapeHTML(pose.english_name || "Unnamed pose");
    const sanskrit = escapeHTML(pose.sanskrit_name_adapted || pose.sanskrit_name || "Sanskrit name unavailable");
    const description = pose.pose_description || "No description available.";
    const benefits = pose.pose_benefits || "No benefits information available.";
    return `
    <div class="col-sm-6 col-lg-4">
        <article class="card pose-card h-100">
            <div class="pose-image-wrap">
                ${image ? `<img src="${escapeHTML(image)}" class="pose-image" alt="${name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">` : ""}
                <div class="image-fallback" ${image ? 'style="display:none"' : ""}><i class="bi bi-flower1"></i></div>
                <span class="difficulty-badge">${escapeHTML(getDifficulty(pose))}</span>
                <button class="favorite-button ${isFavorite ? "is-favorite" : ""}" data-favorite="${escapeHTML(id)}" aria-label="${isFavorite ? "Remove from" : "Add to"} favorites" aria-pressed="${isFavorite}">
                    <i class="bi ${isFavorite ? "bi-heart-fill" : "bi-heart"}"></i>
                </button>
            </div>
            <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div><h3 class="card-title">${name}</h3><p class="sanskrit-name">${sanskrit}</p></div>
                </div>
                <span class="category-label"><i class="bi bi-grid me-1"></i>${escapeHTML(getCategory(pose))}</span>
                <p class="card-description">${escapeHTML(description)}</p>
                <div class="benefit-preview"><strong><i class="bi bi-heart-pulse me-1"></i>Benefits</strong><p>${escapeHTML(benefits)}</p></div>
                <button class="btn btn-outline-light mt-auto view-details" data-pose="${escapeHTML(id)}">View details <i class="bi bi-arrow-right ms-1"></i></button>
            </div>
        </article>
    </div>`;
}

function createPagination(totalPages) {
    paginationContainer.innerHTML = "";
    if (totalPages <= 1) return;
    const makeButton = (label, page, disabled = false, active = false, aria = label) =>
        `<button class="page-button ${active ? "active" : ""}" data-page="${page}" ${disabled ? "disabled" : ""} aria-label="${aria}" ${active ? 'aria-current="page"' : ""}>${label}</button>`;
    paginationContainer.innerHTML =
        makeButton('<i class="bi bi-chevron-left"></i>', currentPage - 1, currentPage === 1, false, "Previous page") +
        Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
            .map((page, index, visible) => {
                const previous = visible[index - 1];
                return (previous && page - previous > 1 ? '<span class="page-ellipsis">…</span>' : "") +
                    makeButton(page, page, false, page === currentPage);
            }).join("") +
        makeButton('<i class="bi bi-chevron-right"></i>', currentPage + 1, currentPage === totalPages, false, "Next page");
}

function showPoseDetails(pose) {
    const image = pose.url_svg || pose.url_png || pose.url_svg_alt;
    document.getElementById("poseModalTitle").textContent = pose.english_name || "Pose details";
    document.getElementById("poseModalBody").innerHTML = `
        <div class="detail-layout">
            ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(pose.english_name)}" class="detail-image">` : ""}
            <div>
                <p class="sanskrit-name fs-5">${escapeHTML(pose.sanskrit_name || pose.sanskrit_name_adapted || "")}</p>
                <p class="text-secondary">${escapeHTML(pose.sanskrit_name_adapted || "")}</p>
                <span class="difficulty-badge position-static">${escapeHTML(getDifficulty(pose))}</span>
                <span class="category-label ms-2">${escapeHTML(getCategory(pose))}</span>
            </div>
        </div>
        <hr class="modal-divider">
        <h3 class="detail-heading"><i class="bi bi-book me-2"></i>Translation</h3>
        <p>${escapeHTML(pose.translation_name || "No translation available.")}</p>
        <h3 class="detail-heading"><i class="bi bi-card-text me-2"></i>Description</h3>
        <p class="detail-copy">${escapeHTML(pose.pose_description || "No description available.")}</p>
        <h3 class="detail-heading"><i class="bi bi-heart-pulse me-2"></i>Benefits</h3>
        <p class="detail-copy">${escapeHTML(pose.pose_benefits || "No benefits information available.")}</p>`;
    poseModal.show();
}

function resetFilters() {
    searchInput.value = "";
    difficultyFilter.value = "";
    categoryFilter.value = "";
    sortFilter.value = "name-asc";
    favoritesOnly.checked = false;
    applyFilters();
}

function goToPage(page) {
    currentPage = page;
    displayPoses();
    document.querySelector(".filter-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites();
    applyFilters();
}

function chooseRandomPose() {
    const source = filteredPoses.length ? filteredPoses : poses;
    if (!source.length) return;
    const pose = source[Math.floor(Math.random() * source.length)];
    showPoseDetails(pose);
}

searchInput.addEventListener("input", applyFilters);
[difficultyFilter, categoryFilter, sortFilter].forEach(control => control.addEventListener("change", applyFilters));
favoritesOnly.addEventListener("change", applyFilters);
pageSizeSelect.addEventListener("change", () => {
    posesPerPage = Number(pageSizeSelect.value);
    currentPage = 1;
    displayPoses();
});
document.getElementById("resetFilters").addEventListener("click", resetFilters);
document.getElementById("randomPose").addEventListener("click", chooseRandomPose);

posesContainer.addEventListener("click", event => {
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) {
        toggleFavorite(favoriteButton.dataset.favorite);
        return;
    }
    const detailsButton = event.target.closest("[data-pose]");
    if (detailsButton) {
        const pose = poses.find(item => getPoseId(item) === detailsButton.dataset.pose);
        if (pose) showPoseDetails(pose);
    }
});

paginationContainer.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (button && !button.disabled) goToPage(Number(button.dataset.page));
});

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.focus();
    }
});

getPoses();
