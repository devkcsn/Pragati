// Additional script to ensure navbar elements are visible and correctly positioned
function fixNavbarVisibility() {
    // Force visibility of navbar elements
    const navbarLinks = document.querySelectorAll('.navbar-link');
    const usernames = document.querySelectorAll('.navbar-username');
    const icons = document.querySelectorAll('.navbar-link i, .navbar-username i');
    
    // Force visibility and correct positioning of navbar links
    navbarLinks.forEach(link => {
        // Apply critical styles directly
        link.style.opacity = '1';
        link.style.visibility = 'visible';
        link.style.color = '#ffffff';
        link.style.transform = 'none';  // Prevent any transform displacement
        link.style.position = 'relative'; // Ensure positioning context
        
        // Also ensure children (icons and text) are visible
        Array.from(link.children).forEach(child => {
            child.style.opacity = '1';
            child.style.visibility = 'visible';
            if (child.tagName === 'I') {
                child.style.color = '#ffffff';
            }
        });
    });
    
    // Force visibility of username displays
    usernames.forEach(username => {
        username.style.opacity = '1';
        username.style.visibility = 'visible';
        username.style.color = '#ffffff';
        username.style.transform = 'none'; // Prevent any transform displacement
        
        // Also ensure children (icons and text) are visible
        Array.from(username.children).forEach(child => {
            child.style.opacity = '1';
            child.style.visibility = 'visible';
            if (child.tagName === 'I') {
                child.style.color = '#ffffff';
            }
        });
    });

    // Specifically target icons
    icons.forEach(icon => {
        icon.style.opacity = '1';
        icon.style.visibility = 'visible';
        icon.style.color = '#ffffff';
    });
    
    // Stop any ongoing GSAP animations that might be displacing elements
    if (typeof gsap !== 'undefined') {
        gsap.killTweensOf('.navbar-link');
        gsap.killTweensOf('.navbar-username');
        
        // Reset positioning of navbar elements
        gsap.set('.navbar-link, .navbar-username', {
            clearProps: 'transform',
            y: 0,
            transform: 'none'
        });
    }
}

// Run immediately on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Critical: Run immediately to prevent initial flicker
    fixNavbarVisibility();
    
    // Run again after short intervals to catch any delayed rendering
    setTimeout(fixNavbarVisibility, 50);
    setTimeout(fixNavbarVisibility, 100);
    setTimeout(fixNavbarVisibility, 300);
    
    // Run once more after page is fully loaded
    window.addEventListener('load', function() {
        fixNavbarVisibility();
        // One final check after everything is loaded
        setTimeout(fixNavbarVisibility, 500);
    });
});
