const fs = require('fs');
const path = require('path');

function processDirectory(directory) {
    fs.readdir(directory, { withFileTypes: true }, (err, entries) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        entries.forEach(entry => {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                processDirectory(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
                fs.readFile(fullPath, 'utf8', (err, data) => {
                    if (err) {
                        console.error(`Error reading file ${entry.name}:`, err);
                        return;
                    }

                    const updatedData = data.replace(/from\s+['"]([^'"]+)@\d+\.\d+\.\d+['"]/g, (match, packageName) => {
                        return `from "${packageName}"`;
                    });

                    if (data !== updatedData) {
                        fs.writeFile(fullPath, updatedData, 'utf8', (err) => {
                            if (err) {
                                console.error(`Error writing file ${entry.name}:`, err);
                            } else {
                                console.log(`Updated imports in ${fullPath}`);
                            }
                        });
                    }
                });
            }
        });
    });
}

// Process dashboard components
processDirectory('./src/components/dashboard');
// Process UI components again just in case
processDirectory('./src/components/ui');
