const API_BASE = "https://yoga-api-nzy4.onrender.com/v1";
const POSES_URL = `${API_BASE}/poses`;
const CATEGORIES_URL = `${API_BASE}/categories`;
const FAVORITES_KEY = "yogaPoseExplorerFavorites";
const ROUTINE_KEY = "yogaPoseExplorerRoutine";
const SAVED_ROUTINES_KEY = "yogaPoseExplorerSavedRoutines";

const $ = (id) => document.getElementById(id);
const posesContainer = $("poses");
const paginationContainer = $("pagination");
const searchInput = $("searchInput");
const difficultyFilter = $("difficultyFilter");
const categoryFilter = $("categoryFilter");
const sortFilter = $("sortFilter");
const pageSizeSelect = $("pageSize");
const favoritesOnly = $("favoritesOnly");
const resultsCount = $("resultsCount");
const poseModal = new bootstrap.Modal($("poseModal"));

let poses = [];
let filteredPoses = [];
let currentPage = 1;
let posesPerPage = Number(pageSizeSelect.value);
let favorites = loadSet(FAVORITES_KEY);
let routine = loadRoutine();
let savedRoutines = loadSavedRoutines();

function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]").map(String)); }
    catch { return new Set(); }
}
function loadRoutine() {
    try {
        const value = JSON.parse(localStorage.getItem(ROUTINE_KEY) || "[]");
        return Array.isArray(value) ? value.filter(item => item && item.id).map(item => ({ id: String(item.id), minutes: Math.max(1, Number(item.minutes) || 3) })) : [];
    } catch { return []; }
}
function loadSavedRoutines() {
    try { const value = JSON.parse(localStorage.getItem(SAVED_ROUTINES_KEY) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
}
function persistRoutine() { localStorage.setItem(ROUTINE_KEY, JSON.stringify(routine)); }
function persistSavedRoutines() { localStorage.setItem(SAVED_ROUTINES_KEY, JSON.stringify(savedRoutines)); }
function saveFavorites() { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); updateStats(); }

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function getPoseId(pose) { return String(pose.id ?? pose.english_name); }

// API releases have used several names/labels for difficulty. Normalize aliases
// before comparing them so e.g. "Advanced" and "Expert" behave consistently.
function getDifficultyRaw(pose) {
    return pose.difficulty_level ?? pose.level ?? pose.difficulty ?? pose.experience_level ?? "Not specified";
}
function getDifficultyKey(poseOrValue) {
    const raw = typeof poseOrValue === "object" ? getDifficultyRaw(poseOrValue) : poseOrValue;
    const value = normalize(raw).replace(/[\s_-]+/g, "");
    if (["beginner", "basic", "easy", "novice", "1"].includes(value)) return "beginner";
    if (["intermediate", "moderate", "medium", "2"].includes(value)) return "intermediate";
    if (["advanced", "expert", "difficult", "hard", "3"].includes(value)) return "advanced";
    if (["alllevels", "all", "any"].includes(value)) return "all";
    return value || "unknown";
}
function getDifficulty(pose) {
    const raw = String(getDifficultyRaw(pose));
    const key = getDifficultyKey(raw);
    if (key === "advanced") return /expert/i.test(raw) ? "Expert" : "Advanced";
    if (key === "beginner") return "Beginner";
    if (key === "intermediate") return "Intermediate";
    if (key === "all") return "All levels";
    return raw;
}
function getCategory(pose) { return pose.category_name || pose.category || "Uncategorized"; }
function getImage(pose) { return pose.url_svg || pose.url_png || pose.url_svg_alt || ""; }

function showLoading() {
    posesContainer.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border loading-spinner" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-3 text-secondary">Loading the pose library...</p></div>`;
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
            fetchJSON(POSES_URL), fetchJSON(CATEGORIES_URL).catch(() => [])
        ]);
        const rawPoses = Array.isArray(poseData) ? poseData : (poseData.poses || []);
        const metadata = new Map();
        const categories = Array.isArray(categoryResult) ? categoryResult : (categoryResult.categories || []);
        categories.forEach(category => {
            (category.poses || []).forEach(item => {
                const id = item.id ?? item.pose_id;
                if (id != null) metadata.set(String(id), {
                    category_name: item.category_name || category.category_name || category.name,
                    difficulty_level: item.difficulty_level ?? item.level ?? category.difficulty_level
                });
            });
        });
        poses = rawPoses.map(pose => {
            const extra = metadata.get(String(pose.id)) || metadata.get(String(pose.pose_id)) || {};
            // Preserve real pose fields, but fill missing/blank metadata from categories.
            const merged = { ...extra, ...pose };
            if (!merged.difficulty_level && !merged.level && !merged.difficulty) merged.difficulty_level = extra.difficulty_level;
            if (!merged.category_name && !merged.category) merged.category_name = extra.category_name;
            return merged;
        });
        populateDifficultyFilter();
        populateCategoryFilter();
        updateStats();
        renderRoutine();
        applyFilters();
    } catch (error) {
        posesContainer.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-cloud-slash"></i><h3>We couldn't load the poses</h3><p>${escapeHTML(error.message)} Check your connection and try again.</p><button class="btn btn-accent" id="retryButton"><i class="bi bi-arrow-repeat me-1"></i> Try again</button></div></div>`;
        $("retryButton").addEventListener("click", getPoses);
        resultsCount.textContent = "Unable to load data";
    }
}
function populateDifficultyFilter() {
    const labels = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced / Expert", all: "All levels" };
    const found = new Set(poses.map(pose => getDifficultyKey(pose)).filter(key => key !== "unknown" && key !== "all"));
    const order = ["beginner", "intermediate", "advanced"];
    const options = order.filter(key => found.has(key)).map(key => `<option value="${key}">${labels[key]}</option>`);
    [...found].filter(key => !order.includes(key)).sort().forEach(key => options.push(`<option value="${escapeHTML(key)}">${escapeHTML(key.replace(/([a-z])([0-9])/i, "$1 $2"))}</option>`));
    difficultyFilter.innerHTML = '<option value="">All levels</option>' + options.join("");
}
function populateCategoryFilter() {
    const categories = [...new Set(poses.map(getCategory).filter(value => value !== "Uncategorized"))].sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML = '<option value="">All categories</option>' + categories.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
}
function updateStats() {
    $("totalPoses").textContent = poses.length;
    $("totalCategories").textContent = new Set(poses.map(getCategory)).size;
    $("totalFavorites").textContent = favorites.size;
}
function getSearchableText(pose) {
    return [pose.english_name, pose.sanskrit_name, pose.sanskrit_name_adapted, pose.translation_name,
        pose.pose_description, pose.pose_benefits, getDifficulty(pose), getCategory(pose)].join(" ");
}
function applyFilters() {
    const query = normalize(searchInput.value);
    const difficulty = difficultyFilter.value;
    const category = categoryFilter.value;
    const onlyFavorites = favoritesOnly.checked;
    filteredPoses = poses.filter(pose => {
        const matchesSearch = !query || normalize(getSearchableText(pose)).includes(query);
        const level = getDifficultyKey(pose);
        const matchesDifficulty = !difficulty || difficulty === "all" || level === difficulty;
        const matchesCategory = !category || getCategory(pose) === category;
        const matchesFavorite = !onlyFavorites || favorites.has(getPoseId(pose));
        return matchesSearch && matchesDifficulty && matchesCategory && matchesFavorite;
    });
    sortPoses(); currentPage = 1; displayPoses();
}
function sortPoses() {
    const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3, all: 4, unknown: 99 };
    const sortBy = sortFilter.value;
    filteredPoses.sort((a, b) => {
        if (sortBy === "name-desc") return (b.english_name || "").localeCompare(a.english_name || "");
        if (sortBy === "difficulty") return (difficultyOrder[getDifficultyKey(a)] || 99) - (difficultyOrder[getDifficultyKey(b)] || 99);
        if (sortBy === "sanskrit") return (a.sanskrit_name_adapted || a.sanskrit_name || "").localeCompare(b.sanskrit_name_adapted || b.sanskrit_name || "");
        return (a.english_name || "").localeCompare(b.english_name || "");
    });
}
function displayPoses() {
    const total = filteredPoses.length;
    const totalPages = Math.ceil(total / posesPerPage);
    if (totalPages && currentPage > totalPages) currentPage = totalPages;
    const pagePoses = filteredPoses.slice((currentPage - 1) * posesPerPage, currentPage * posesPerPage);
    resultsCount.textContent = total === 1 ? "1 pose found" : `${total} poses found`;
    if (!pagePoses.length) {
        posesContainer.innerHTML = `<div class="col-12"><div class="empty-state"><i class="bi bi-search"></i><h3>No poses found</h3><p>Try changing your search or removing one of the filters.</p><button class="btn btn-accent" id="emptyReset">Clear filters</button></div></div>`;
        $("emptyReset").addEventListener("click", resetFilters);
    } else posesContainer.innerHTML = pagePoses.map(createPoseCard).join("");
    createPagination(totalPages);
}
function createPoseCard(pose) {
    const id = getPoseId(pose), favorite = favorites.has(id), inRoutine = routine.some(item => item.id === id);
    const image = getImage(pose), name = escapeHTML(pose.english_name || "Unnamed pose");
    const description = pose.pose_description || "No description available.";
    const benefits = pose.pose_benefits || "No benefits information available.";
    return `<div class="col-sm-6 col-lg-4"><article class="card pose-card h-100">
        <div class="pose-image-wrap">${image ? `<img src="${escapeHTML(image)}" class="pose-image" alt="${name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">` : ""}
            <div class="image-fallback" ${image ? 'style="display:none"' : ""}><i class="bi bi-flower1"></i></div>
            <span class="difficulty-badge">${escapeHTML(getDifficulty(pose))}</span>
            <button class="favorite-button ${favorite ? "is-favorite" : ""}" data-favorite="${escapeHTML(id)}" aria-label="${favorite ? "Remove from" : "Add to"} favorites" aria-pressed="${favorite}"><i class="bi ${favorite ? "bi-heart-fill" : "bi-heart"}"></i></button>
        </div><div class="card-body d-flex flex-column"><h3 class="card-title">${name}</h3>
            <p class="sanskrit-name">${escapeHTML(pose.sanskrit_name_adapted || pose.sanskrit_name || "Sanskrit name unavailable")}</p>
            <span class="category-label"><i class="bi bi-grid me-1"></i>${escapeHTML(getCategory(pose))}</span>
            <p class="card-description">${escapeHTML(description)}</p><div class="benefit-preview"><strong><i class="bi bi-heart-pulse me-1"></i>Benefits</strong><p>${escapeHTML(benefits)}</p></div>
            <div class="d-flex gap-2 mt-auto"><button class="btn btn-outline-light flex-grow-1 view-details" data-pose="${escapeHTML(id)}">Details</button>
            <button class="btn btn-routine ${inRoutine ? "added" : ""}" data-add-routine="${escapeHTML(id)}" aria-label="${inRoutine ? "Remove from" : "Add to"} routine" title="${inRoutine ? "Remove from routine" : "Add to routine"}"><i class="bi ${inRoutine ? "bi-check-lg" : "bi-plus-lg"}"></i></button></div>
        </div></article></div>`;
}
function createPagination(totalPages) {
    paginationContainer.innerHTML = ""; if (totalPages <= 1) return;
    const button = (label, page, disabled = false, active = false, aria = label) => `<button class="page-button ${active ? "active" : ""}" data-page="${page}" ${disabled ? "disabled" : ""} aria-label="${aria}" ${active ? 'aria-current="page"' : ""}>${label}</button>`;
    paginationContainer.innerHTML = button('<i class="bi bi-chevron-left"></i>', currentPage - 1, currentPage === 1, false, "Previous page") +
        Array.from({ length: totalPages }, (_, i) => i + 1).filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
            .map((page, i, visible) => (visible[i - 1] && page - visible[i - 1] > 1 ? '<span class="page-ellipsis">…</span>' : "") + button(page, page, false, page === currentPage)).join("") +
        button('<i class="bi bi-chevron-right"></i>', currentPage + 1, currentPage === totalPages, false, "Next page");
}
function showPoseDetails(pose) {
    const image = getImage(pose), id = getPoseId(pose), inRoutine = routine.some(item => item.id === id);
    $("poseModalTitle").textContent = pose.english_name || "Pose details";
    $("poseModalBody").innerHTML = `<div class="detail-layout">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(pose.english_name)}" class="detail-image">` : ""}<div>
        <p class="sanskrit-name fs-5">${escapeHTML(pose.sanskrit_name || pose.sanskrit_name_adapted || "")}</p><p class="text-secondary">${escapeHTML(pose.sanskrit_name_adapted || "")}</p>
        <span class="difficulty-badge position-static">${escapeHTML(getDifficulty(pose))}</span> <span class="category-label ms-2">${escapeHTML(getCategory(pose))}</span>
        <button class="btn btn-routine mt-3 d-block ${inRoutine ? "added" : ""}" data-add-routine="${escapeHTML(id)}"><i class="bi ${inRoutine ? "bi-check-lg" : "bi-plus-lg"} me-1"></i>${inRoutine ? "In your routine" : "Add to my routine"}</button></div></div>
        <hr class="modal-divider"><h3 class="detail-heading"><i class="bi bi-book me-2"></i>Translation</h3><p>${escapeHTML(pose.translation_name || "No translation available.")}</p>
        <h3 class="detail-heading"><i class="bi bi-card-text me-2"></i>Description</h3><p class="detail-copy">${escapeHTML(pose.pose_description || "No description available.")}</p>
        <h3 class="detail-heading"><i class="bi bi-heart-pulse me-2"></i>Benefits</h3><p class="detail-copy">${escapeHTML(pose.pose_benefits || "No benefits information available.")}</p>`;
    poseModal.show();
}
function resetFilters() {
    searchInput.value = ""; difficultyFilter.value = ""; categoryFilter.value = ""; sortFilter.value = "name-asc"; favoritesOnly.checked = false; applyFilters();
}
function goToPage(page) { currentPage = page; displayPoses(); $(".filter-panel").scrollIntoView({ behavior: "smooth", block: "start" }); }
function toggleFavorite(id) { favorites.has(id) ? favorites.delete(id) : favorites.add(id); saveFavorites(); applyFilters(); }
function chooseRandomPose() { const source = filteredPoses.length ? filteredPoses : poses; if (source.length) showPoseDetails(source[Math.floor(Math.random() * source.length)]); }

// Routine builder
function addToRoutine(id) {
    const index = routine.findIndex(item => item.id === id);
    if (index >= 0) routine.splice(index, 1);
    else routine.push({ id, minutes: 3 });
    persistRoutine(); renderRoutine(); applyFilters();
    const modalButton = document.querySelector('#poseModalBody [data-add-routine]');
    if (modalButton && modalButton.dataset.addRoutine === id) {
        const added = routine.some(item => item.id === id);
        modalButton.classList.toggle("added", added);
        modalButton.innerHTML = `<i class="bi ${added ? "bi-check-lg" : "bi-plus-lg"} me-1"></i>${added ? "In your routine" : "Add to my routine"}`;
    }
}
function getRoutinePoses() {
    return routine.map(item => ({ ...item, pose: poses.find(pose => getPoseId(pose) === item.id) })).filter(item => item.pose);
}
function renderRoutine() {
    const list = $("routineList");
    if (!list) return;
    const items = getRoutinePoses();
    const totalMinutes = items.reduce((sum, item) => sum + item.minutes, 0);
    $("routineCount").textContent = items.length;
    $("routineDuration").textContent = `${totalMinutes} min`;
    if (!items.length) list.innerHTML = `<div class="routine-empty"><i class="bi bi-calendar2-heart"></i><p>Your routine is empty. Add poses from the library or generate a sequence below.</p></div>`;
    else list.innerHTML = items.map((item, index) => `<div class="routine-item"><span class="routine-number">${index + 1}</span><div class="routine-item-info"><strong>${escapeHTML(item.pose.english_name)}</strong><small>${escapeHTML(getDifficulty(item.pose))} · ${escapeHTML(getCategory(item.pose))}</small></div>
        <label class="visually-hidden" for="routine-time-${index}">Minutes for ${escapeHTML(item.pose.english_name)}</label><select class="routine-time" id="routine-time-${index}" data-routine-time="${escapeHTML(item.id)}" aria-label="Minutes for ${escapeHTML(item.pose.english_name)}">${[1,2,3,4,5,7,10,15].map(n => `<option value="${n}" ${item.minutes === n ? "selected" : ""}>${n}m</option>`).join("")}</select>
        <button class="routine-remove" data-remove-routine="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.pose.english_name)}"><i class="bi bi-x-lg"></i></button></div>`).join("");
    const saved = $("savedRoutineSelect");
    if (saved) saved.innerHTML = '<option value="">Load saved routine...</option>' + savedRoutines.map((item, i) => `<option value="${i}">${escapeHTML(item.name)}</option>`).join("");
}
function generateRoutine() {
    const level = $("routineLevel").value;
    const goal = $("routineGoal").value;
    const duration = Number($("routineTarget").value);
    const maxLevel = { beginner: 1, intermediate: 2, advanced: 3 }[level] || 1;
    const goalTerms = {
        flexibility: /flexib|stretch|hip|hamstring|shoulder|back|spine|mobility/i,
        strength: /strength|strengthen|core|arm|leg|muscle|power/i,
        balance: /balance|stability|standing|one.?leg/i,
        relaxation: /relax|calm|stress|restor|breath|meditat|gentle/i,
        general: null
    };
    const candidates = poses.filter(pose => {
        const key = getDifficultyKey(pose);
        const rank = { beginner: 1, intermediate: 2, advanced: 3, all: 1, unknown: 1 }[key] || 1;
        return rank <= maxLevel;
    });
    if (!candidates.length) { alert("No poses match that difficulty. Try another level."); return; }
    const regex = goalTerms[goal];
    const ranked = candidates.map(pose => {
        const text = `${getCategory(pose)} ${pose.pose_description || ""} ${pose.pose_benefits || ""} ${pose.english_name || ""}`;
        const score = !regex || regex.test(text) ? (goal === "general" ? 1 : 3) : 0;
        return { pose, score };
    }).sort((a, b) => b.score - a.score || Math.random() - 0.5);
    const chosen = [];
    const seen = new Set();
    const targetCount = Math.max(3, Math.min(12, Math.round(duration / 3)));
    // Try to avoid repeating the same category in adjacent positions.
    for (const item of ranked) {
        const id = getPoseId(item.pose);
        if (seen.has(id)) continue;
        if (chosen.length && getCategory(chosen[chosen.length - 1]) === getCategory(item.pose) && ranked.length > targetCount) continue;
        chosen.push(item.pose); seen.add(id);
        if (chosen.length >= targetCount) break;
    }
    if (chosen.length < targetCount) {
        for (const item of ranked) if (!seen.has(getPoseId(item.pose))) { chosen.push(item.pose); seen.add(getPoseId(item.pose)); if (chosen.length >= targetCount) break; }
    }
    routine = chosen.map(pose => ({ id: getPoseId(pose), minutes: Math.max(1, Math.floor(duration / chosen.length)) }));
    const remainder = duration - routine.reduce((sum, item) => sum + item.minutes, 0);
    if (remainder > 0 && routine.length) routine[0].minutes += remainder;
    persistRoutine(); renderRoutine(); applyFilters();
    $("routineFeedback").textContent = `Created a ${duration}-minute ${goal === "general" ? "balanced" : goal} sequence with ${routine.length} poses.`;
    $("routineSection").scrollIntoView({ behavior: "smooth", block: "start" });
}
function saveCurrentRoutine() {
    if (!routine.length) { alert("Add at least one pose before saving your routine."); return; }
    const name = $("routineName").value.trim() || `My yoga routine ${savedRoutines.length + 1}`;
    savedRoutines.push({ name, items: routine.map(item => ({ ...item })), createdAt: new Date().toISOString() });
    persistSavedRoutines(); renderRoutine(); $("routineFeedback").textContent = `Saved “${name}”.`;
}
function loadSelectedRoutine() {
    const index = $("savedRoutineSelect").value;
    if (index === "") return;
    const selected = savedRoutines[Number(index)];
    if (!selected) return;
    routine = selected.items.map(item => ({ id: String(item.id), minutes: Math.max(1, Number(item.minutes) || 3) }));
    persistRoutine(); renderRoutine(); applyFilters(); $("routineFeedback").textContent = `Loaded “${selected.name}”.`;
}
function exportRoutine() {
    const items = getRoutinePoses();
    if (!items.length) { alert("Your routine is empty."); return; }
    const text = ["Yoga Pose Explorer — My Routine", "", ...items.map((item, index) => `${index + 1}. ${item.pose.english_name} (${item.minutes} min) — ${getDifficulty(item.pose)}`), "", `Total: ${items.reduce((sum, item) => sum + item.minutes, 0)} minutes`].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "my-yoga-routine.txt"; link.click(); URL.revokeObjectURL(url);
}

searchInput.addEventListener("input", applyFilters);
[difficultyFilter, categoryFilter, sortFilter].forEach(control => control.addEventListener("change", applyFilters));
favoritesOnly.addEventListener("change", applyFilters);
pageSizeSelect.addEventListener("change", () => { posesPerPage = Number(pageSizeSelect.value); currentPage = 1; displayPoses(); });
$("resetFilters").addEventListener("click", resetFilters);
$("randomPose").addEventListener("click", chooseRandomPose);
posesContainer.addEventListener("click", event => {
    const favorite = event.target.closest("[data-favorite]"); if (favorite) { toggleFavorite(favorite.dataset.favorite); return; }
    const add = event.target.closest("[data-add-routine]"); if (add) { addToRoutine(add.dataset.addRoutine); return; }
    const details = event.target.closest("[data-pose]"); if (details) { const pose = poses.find(item => getPoseId(item) === details.dataset.pose); if (pose) showPoseDetails(pose); }
});
$("poseModalBody").addEventListener("click", event => { const add = event.target.closest("[data-add-routine]"); if (add) addToRoutine(add.dataset.addRoutine); });
paginationContainer.addEventListener("click", event => { const button = event.target.closest("[data-page]"); if (button && !button.disabled) goToPage(Number(button.dataset.page)); });
$("routineList").addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-routine]");
    if (remove) { routine = routine.filter(item => item.id !== remove.dataset.removeRoutine); persistRoutine(); renderRoutine(); applyFilters(); }
});
$("routineList").addEventListener("change", event => {
    const select = event.target.closest("[data-routine-time]");
    if (select) { const item = routine.find(entry => entry.id === select.dataset.routineTime); if (item) { item.minutes = Number(select.value); persistRoutine(); renderRoutine(); } }
});
$("generateRoutine").addEventListener("click", generateRoutine);
$("saveRoutine").addEventListener("click", saveCurrentRoutine);
$("loadRoutine").addEventListener("click", loadSelectedRoutine);
$("exportRoutine").addEventListener("click", exportRoutine);
$("clearRoutine").addEventListener("click", () => { routine = []; persistRoutine(); renderRoutine(); applyFilters(); $("routineFeedback").textContent = "Your routine has been cleared."; });

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
});
renderRoutine();
getPoses();
