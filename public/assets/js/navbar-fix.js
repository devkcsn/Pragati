// Additional script to ensure navbar elements are visible
function fixNavbarVisibility() {
    // Force visibility of navbar elements
    const navbarLinks = document.querySelectorAll('.navbar-link');
    const usernames = document.querySelectorAll('.navbar-username');
    const icons = document.querySelectorAll('.navbar-link i, .navbar-username i');
    
    // Force visibility of navbar links
    navbarLinks.forEach(link => {
        link.style.opacity = '1';
        link.style.visibility = 'visible';
        link.style.color = '#ffffff';
        
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
}

// Run immediately on DOM load
document.addEventListener('DOMContentLoaded', function() {
    fixNavbarVisibility();
    
    // Run again after a short delay to catch any elements that might be manipulated by other scripts
    setTimeout(fixNavbarVisibility, 100);
    
    // Run once more after page is fully loaded
    window.addEventListener('load', fixNavbarVisibility);
});
