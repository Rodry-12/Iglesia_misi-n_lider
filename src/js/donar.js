// Menu desplegable
var menu = document.getElementById("menu-btn");
var navBar = document.querySelector(".nav-bar");
var navItems = document.querySelectorAll(".nav-bar a");

menu.addEventListener("click", () => {
  navBar.classList.toggle("show");
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navBar.classList.toggle("show");
  });
});
