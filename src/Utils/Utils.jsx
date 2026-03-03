// Utils/Utils.js
import Home from "../Pages/Home/Home.jsx";
import Login from "../Pages/Login/Login.jsx";
import Progress from "../Pages/Progress/Progress.jsx";
import Subjects from "../Pages/Subjects/Subjects.jsx";
import About from "../Pages/About/About.jsx";
import ForumPage from "../Pages/ForumPage/ForumPage.jsx";

// Создаем массив с ключами переводов вместо статичного текста
let items = [
    {
        id: 1,
        title: "home", // Ключ перевода, а не текст
        path: "/",
        element: <Home />
    },
    {
        id: 2,
        title: "subjects", // Ключ перевода
        path: "subjects",
        element: <Subjects />
    },
    {
        id: 3, 
        title: "progress", // Ключ перевода
        path: "progress",
        element: <Progress />
    },
    {
        id: 4,
        title: "about", // Ключ перевода
        path: "about", 
        element: <About />
    },
]

export default items;