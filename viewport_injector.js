const fs = require('fs');
const path = require('path');

const files = ['FrontPage.html', 'Registration.html', 'SLoginPage.html', 'ALoginPage.html'];
const dir = "d:\\DeathNote\\Pragati\\Front End";

for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if viewport already exists
        if (!content.includes('name="viewport"')) {
            // Inject right after <head>
            content = content.replace(/<head>/gi, '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
            fs.writeFileSync(filePath, content);
            console.log("Injected viewport into", file);
        } else {
            console.log("Viewport already exists in", file);
        }
    }
}
