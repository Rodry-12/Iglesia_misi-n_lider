$(function () {
    $(window).scroll(function () {
        var header = $(".nav-main");
        header.toggleClass("scroll", window.scrollY > 0);
    });
});