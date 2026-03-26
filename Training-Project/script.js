let menu = document.querySelector('#menu-icon');
let navlist = document.querySelector('.navlist');

if(menu) {
    menu.onclick = () => {
        menu.classList.toggle('bx-x');
        navlist.classList.toggle('open');
    };
}

// Keep original Scroll Reveal but add graceful degradation check
if (typeof ScrollReveal !== 'undefined') {
    const sr = ScrollReveal({
        distance: '65px',
        duration: 2600,
        delay: 450,
        reset: true
    });
    
    sr.reveal('.hero-content, .section-header',{delay:200, origin:'top'});
    sr.reveal('.hero-visual, .card-grid, .team-grid',{delay:450, origin:'bottom'});
    sr.reveal('.social-icons',{delay:500, origin:'left'});
    sr.reveal('.scroll-indicator',{delay:500, origin:'right'});
}
