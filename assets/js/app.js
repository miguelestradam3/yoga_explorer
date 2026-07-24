const API_URL = "https://yoga-api-nzy4.onrender.com/v1/poses";

const posesContainer = document.getElementById("poses");
document.getElementById("searchInput").addEventListener("input", applyFilters);
const posesPerPage = 6;

let currentPage = 1;
let poses = [];

let filteredposes = [];

function showLoading() {

    posesContainer.innerHTML = `
        <div class="col-12 text-center my-5">

            <div class="spinner-border text-success"
                 role="status">
                <span class="visually-hidden">Loading...</span>
            </div>

            <p class="mt-3">Loading Studio Ghibli poses...</p>

        </div>
    `;

}

async function getposes() {

    try {
        showLoading();
        const response = await fetch(API_URL);
        poses = await response.json();
        console.log(poses);
        filteredposes = poses;

        displayposes();

    } catch (error) {

        posesContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger text-center">
                    ${error.message}
                </div>
            </div>
        `;

    }

}

function displayposes() {

    const start = (currentPage - 1) * posesPerPage;
    const end = start + posesPerPage;

    const posesToShow = filteredposes.slice(start, end);

    posesContainer.innerHTML = posesToShow
        .map(movie => createMovieCard(movie))
        .join("");

    createPagination();
}

function createMovieCard(pose) {

    return `
        <div class="col-md-4">

            <div class="card h-100 shadow-sm movie-card">

                <!-- Movie Image -->
                <img src="${pose.url_svg_alt || pose.url_svg}"
                     class="card-img-top"
                     alt="${pose.english_name}">

                <div class="card-body d-flex flex-column">

                    <!-- Title -->
                    <h5 class="card-title mb-1">
                        ${pose.english_name}
                    </h5>

                    <p class="mb-2">
                        <span class="badge bg-secondary">${pose.sanskrit_name}</span>
                    </p>

                    <h6 class="text-dark mb-2">
                        ${pose.sanskrit_name_adapted}
                    </h6>

                    <hr>

                    <h6 class="text-dark"><strong>Description</strong></h6>

                    <p class="mb-2">
                        ${pose.pose_description}
                    </p>

                    <hr>

                    <h6 class="text-dark"><strong>Benefits</strong></h6>

                    <p class="mb-2">
                        ${pose.pose_benefits}
                    </p>


                </div>
            </div>

        </div>
    `;
}


function createPagination() {

    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    const totalPages = Math.ceil(filteredposes.length / posesPerPage);

    for (let i = 1; i <= totalPages; i++) {

        pagination.innerHTML += `
            <button class="btn mx-1 ${i === currentPage ? "active" : ""}"
                    onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }
}

function goToPage(page) {

    currentPage = page;

    displayposes();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

function applyFilters() {

    const searchValue = document.getElementById("searchInput").value.toLowerCase();

    filteredposes = poses.filter(movie => {

        const matchesSearch =
            movie.english_name.toLowerCase().includes(searchValue);

        return matchesSearch;
    });

    currentPage = 1;
    displayposes();
}

getposes();