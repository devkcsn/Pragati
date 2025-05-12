// Modern Navbar JavaScript with GSAP animations

// Initialize once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Ensure elements are visible first
    ensureNavbarVisibility();
    
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
    
    // Run visibility check again after animations
    setTimeout(ensureNavbarVisibility, 1000);
});

// Function to ensure navbar elements are visible
function ensureNavbarVisibility() {
    document.querySelectorAll('.navbar-link, .navbar-username').forEach(el => {
        el.style.opacity = '1';
        el.style.visibility = 'visible';
    });
    
    document.querySelectorAll('.navbar-link i, .navbar-username i').forEach(icon => {
        icon.style.opacity = '1';
        icon.style.visibility = 'visible';
        icon.style.color = '#ffffff';
    });
}

// GSAP-powered animations
function initNavbarAnimations() {
    // Set initial visibility to ensure elements are visible before animations start
    gsap.set('.navbar-username, .navbar-link', {opacity: 1, visibility: 'visible'});
    
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
      // First, set elements to their final position immediately
    gsap.set('.navbar-username, .navbar-link', {
        y: 0,
        opacity: 1, 
        visibility: 'visible'
    });
    
    // Then animate only the opacity for a fade-in effect
    gsap.from('.navbar-username, .navbar-link', {
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: function() {
            // Ensure final state is stable
            gsap.set('.navbar-username, .navbar-link', {
                clearProps: 'opacity,visibility',
                opacity: 1,
                visibility: 'visible'
            });
        }
    });
    
    // Replace position-based hover effects with subtler ones
    const navLinks = document.querySelectorAll('.navbar-link:not(.logout-btn)');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            gsap.to(link, {
                boxShadow: '0 2px 4px rgba(255, 255, 255, 0.1)',
                color: 'var(--navbar-hover)',
                duration: 0.2,
                ease: 'power1.out'
            });
        });
        
        link.addEventListener('mouseleave', () => {
            gsap.to(link, {
                boxShadow: 'none',
                color: 'var(--navbar-text)',
                duration: 0.2,
                ease: 'power1.in'
            });
        });
    });
    
    // Special handling for logout button
    const logoutBtn = document.querySelector('.navbar-link.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('mouseenter', () => {
            gsap.to(logoutBtn, {
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                boxShadow: '0 3px 7px rgba(0, 0, 0, 0.15)',
                duration: 0.2,
                ease: 'power1.out'
            });
        });
        
        logoutBtn.addEventListener('mouseleave', () => {
            gsap.to(logoutBtn, {
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                duration: 0.2,
                ease: 'power1.in'
            });
        });
    }
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
            
            // If menu is active, ensure all elements are visible
            if (mobileMenu.classList.contains('active')) {
                // Force visibility of all menu items
                const menuItems = mobileMenu.querySelectorAll('*');
                menuItems.forEach(item => {
                    item.style.visibility = 'visible';
                    item.style.opacity = '1';
                    
                    // For text elements and icons, ensure they have color
                    if (item.tagName === 'I' || item.tagName === 'SPAN' || item.tagName === 'A') {
                        item.style.color = '#ffffff';
                    }
                });
                
                // Animate using GSAP if available
                if (typeof gsap !== 'undefined') {
                    gsap.from('.navbar-menu .navbar-link', {
                        y: 20,
                        opacity: 1, // Set to 1 to ensure visibility
                        stagger: 0.1,
                        duration: 0.4,
                        ease: 'power2.out'
                    });
                    
                    gsap.from('.navbar-menu .navbar-username', {
                        y: 20,
                        opacity: 1, // Set to 1 to ensure visibility
                        duration: 0.4,
                        ease: 'power2.out'
                    });
                }
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
