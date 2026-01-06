import Home from "../Pages/Home/Home.jsx";
import Login from "../Pages/Login/Login.jsx";
import Progress from "../Pages/Progress/Progress.jsx";
import Subjects from "../Pages/Subjects/Subjects.jsx";
import About from "../Pages/About/About.jsx";
import ForumPage from "../Pages/ForumPage/ForumPage.jsx";
// УБЕРИТЕ импорт Subject отсюда, если он есть

let items = [
    {
        id: 1,
        title: "Home",
        path: "/",
        element: <Home />
    },
    {
        id: 2,
        title: "Subjects",
        path: "subjects",
        element: <Subjects />
    },
    {
        id: 3, 
        title: "Progress",
        path: "progress",
        element: <Progress />
    },
    {
        id: 4,
        title: "About",
        path: "about", 
        element: <About />
    },
    {
        id: 5,
        title: "Forum",
        path: "forum", 
        element: <ForumPage />
    },
]

export default items