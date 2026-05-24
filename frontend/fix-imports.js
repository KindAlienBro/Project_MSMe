const fs = require('fs');
const path = require('path');

const directory = './src/components/ui';

fs.readdir(directory, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    files.forEach(file => {
        if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const filePath = path.join(directory, file);

            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading file ${file}:`, err);
                    return;
                }

                // Regex to match imports like: from "package@1.2.3" and replace with "package"
                // Also handles: import ... from 'package@1.2.3'
                // We look for @\d+\.\d+\.\d+ inside quotes after 'from'

                const updatedData = data.replace(/from\s+['"]([^'"]+)@\d+\.\d+\.\d+['"]/g, (match, packageName) => {
                    // Check if packageName starts with @ (scoped package) or not
                    // The regex captures the package name part before the @version
                    return `from "${packageName}"`;
                });

                // Also handle dynamic imports or require if any? Next.js code usually uses static imports.
                // Let's also handle the case where it might be `import("...")` although less likely in UI components.

                if (data !== updatedData) {
                    fs.writeFile(filePath, updatedData, 'utf8', (err) => {
                        if (err) {
                            console.error(`Error writing file ${file}:`, err);
                        } else {
                            console.log(`Updated imports in ${file}`);
                        }
                    });
                }
            });
        }
    });
});
