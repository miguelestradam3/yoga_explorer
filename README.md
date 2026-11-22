# 🧘 Yoga Pose Explorer

A responsive yoga pose discovery application built with **HTML, CSS, Bootstrap 5, and vanilla JavaScript**. It consumes the public Yoga API and provides a searchable, filterable library of yoga poses.

## ✨ Features

- 🔎 **Full-text search** across English names, Sanskrit names, adapted Sanskrit names, translations, descriptions, benefits, difficulty, and category.
- 🎚️ **Combined filters** for difficulty level and category.
- ↕️ **Sorting** by English name, reverse name, difficulty, or Sanskrit name.
- ❤️ **Favorites** saved in browser `localStorage`, including a favorites-only view.
- 🎲 **Random pose** picker based on the current filtered results.
- 📖 **Pose details modal** with image, Sanskrit name, translation, description, benefits, difficulty, and category.
- 📄 **Configurable pagination** (6, 9, 12, or 18 results per page).
- 📊 **Library statistics** for poses, categories, and saved favorites.
- ⌨️ **Keyboard shortcut**: `Ctrl + K` / `Cmd + K` focuses the search field.
- 📱 Responsive layout, loading state, empty state, API error handling, and retry action.
- 🛡️ Dynamic text is escaped before being inserted into the page.

## 🛠️ Built With

- HTML5
- CSS3
- JavaScript (ES6+)
- Bootstrap 5
- Bootstrap Icons
- Fetch API
- Browser Local Storage

## 🚀 Getting Started

1. Download or clone this repository.
2. Open the project folder in Visual Studio Code or your preferred editor.
3. Run `index.html` using a local development server (for example, the VS Code Live Server extension).
4. The application will request pose and category data from the API.

No build tools, npm, or framework are required.

## 📡 API

This project uses the [Yoga API](https://github.com/alexcumplido/yoga-api).

- Poses: `https://yoga-api-nzy4.onrender.com/v1/poses`
- Categories: `https://yoga-api-nzy4.onrender.com/v1/categories`

The categories endpoint is used to enrich poses with category and difficulty metadata when available. The application still loads the main pose collection if category metadata cannot be retrieved.

## 📁 Project Structure

```text
yoga/
├── assets/
│   ├── css/
│   │   └── main.css
│   ├── img/
│   │   └── logo.svg
│   ├── js/
│   │   └── app.js
│   └── vendor/
│       └── bootstrap/
├── index.html
└── README.md
```

## 💾 Favorites

Favorites are stored locally in the browser under the `yogaPoseExplorerFavorites` key. They are not uploaded to a server and will remain available in the same browser unless its site data is cleared.

## ⚠️ Notes

- API availability and response times depend on the third-party service.
- Some poses may not include every metadata field. Missing values are handled with fallback labels.
- Yoga information is provided for general educational exploration and is not medical advice.

## 📜 Credits

Pose data and illustrations are provided by [Yoga API](https://github.com/alexcumplido/yoga-api). Please review the API repository for its license and image attribution requirements.
