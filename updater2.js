const fs = require('fs');
const path = require('path');

const files = ['FrontPage.html', 'Registration.html', 'SLoginPage.html', 'ALoginPage.html'];
const dir = "d:\\DeathNote\\Pragati\\Front End";

for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove style tag entirely (with g flag)
        content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
        
        // Inject link rel if not already there
        if (!content.includes('href="style.css"')) {
            content = content.replace('</head>', '    <link rel="stylesheet" href="style.css">\n</head>');
        }
        
        // FrontPage updates
        if (file === 'FrontPage.html') {
            content = content.replace(/class="button"/g, 'class="portal-btn"');
        }
        
        fs.writeFileSync(filePath, content);
        console.log("Updated", file);
    }
}
