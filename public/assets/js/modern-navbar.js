// Modern Navbar JavaScript with GSAP animations

// Initialize once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if GSAP is available
    if (typeof gsap !== 'undefined') {
        initNavbarAnimations();
    } else {
        initBasicAnimations();
    }
    
    // Initialize mobile menu toggle
    initMobileMenu();
    
    // Initialize scroll effects
    initScrollEffects();
});

// GSAP-powered animations
function initNavbarAnimations() {
    // Initial animation for navbar elements
    gsap.from('.navbar-title', {
        y: -50,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    });
    
    gsap.from('.navbar-logo', {
        x: -30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    });
    
    gsap.from('.navbar-username, .navbar-link', {
        y: -20,
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power2.out'
    });
    
    // Hover effects for navbar links
    const navLinks = document.querySelectorAll('.navbar-link');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            gsap.to(link, {
                y: -2,
                duration: 0.2,
                ease: 'power1.out'
            });
        });
        
        link.addEventListener('mouseleave', () => {
            gsap.to(link, {
                y: 0,
                duration: 0.2,
                ease: 'power1.in'
            });
        });
    });
}

// Fallback basic animations without GSAP
function initBasicAnimations() {
    // Add a class to trigger CSS animations
    const navbar = document.querySelector('.modern-navbar');
    if (navbar) {
        navbar.classList.add('animated');
    }
}

// Mobile menu toggle functionality
function initMobileMenu() {
    const menuToggle = document.querySelector('.navbar-toggle');
    const mobileMenu = document.querySelector('.navbar-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            
            // Animate using GSAP if available
            if (typeof gsap !== 'undefined' && mobileMenu.classList.contains('active')) {
                gsap.from('.navbar-menu .navbar-link', {
                    y: 20,
                    opacity: 0,
                    stagger: 0.1,
                    duration: 0.4,
                    ease: 'power2.out'
                });
            }
        });
    }
}

// Scroll effects for navbar
function initScrollEffects() {
    const navbar = document.querySelector('.modern-navbar');
    if (!navbar) return;
    
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add/remove shrink class based on scroll position
        if (scrollTop > 50) {
            navbar.classList.add('navbar-shrink');
        } else {
            navbar.classList.remove('navbar-shrink');
        }
        
        lastScrollTop = scrollTop;
    });
}
