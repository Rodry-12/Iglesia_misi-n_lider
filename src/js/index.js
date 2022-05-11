$(function () {

    const glider = new Glider(document.querySelector('.carousel-lista'), {
        slidesToShow: 1,
        slidesToScroll: 1,
        dots: ".carousel-indicador",
        scrollLockDelay: 250,
        arrows: {
            prev: ".carousel-anterior",
            next: ".carousel-siguiente",
        },
        // responsive: [
        //     {
        //         // screens greater than >= 775px
        //         breakpoint: 800,
        //         settings: {
        //             // Set to `auto` and provide item width to adjust to viewport
        //             slidesToShow: 1,
        //             slidesToScroll: 1
        //         }
        //     }, {
        //         // screens greater than >= 1024px
        //         breakpoint: 1024,
        //         settings: {
        //             slidesToShow: 1,
        //             slidesToScroll: 1
        //         }
        //     }
        // ]
    });

    function sliderAuto(slider, miliseconds) {
        const slidesCount = slider.track.childElementCount;
        let slideTimeout = null;
        let nextIndex = 1;

        function slide() {
            slideTimeout = setTimeout(function () {
                if (nextIndex >= slidesCount) {
                    nextIndex = 0;
                }
                slider.scrollItem(nextIndex++);
            }, miliseconds);
        }

        slider.ele.addEventListener("glider-animated", function () {
            window.clearInterval(slideTimeout);
            slide();
        });

        slide();
    }

    sliderAuto(glider, 3000);


    $(window).scroll(function () {
        var navMain = $(".nav-main");
        navMain.toggleClass("scroll", window.scrollY > 80);
    });

    // Menu desplegable
    var menu = document.getElementById('menu-btn');
    var navBar = document.querySelector('.nav-bar');

    menu.addEventListener("click", () => {
        navBar.classList.toggle("show");
    });
});