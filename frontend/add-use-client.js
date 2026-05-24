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

                    if (!data.includes('"use client"') && !data.includes("'use client'")) {
                        // Check if it has imports or exports, suggesting it's a module
                        // We'll just add it to all tsx files in imports
                        const updatedData = '"use client";\n' + data;
                        fs.writeFile(fullPath, updatedData, 'utf8', (err) => {
                            if (err) {
                                console.error(`Error writing file ${entry.name}:`, err);
                            } else {
                                console.log(`Added "use client" to ${fullPath}`);
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
// Also process UI components? Shadcn UI components usually have "use client" if needed.
// But I copied them from a Vite project where they didn't have "use client".
// Shadcn components often use hooks (e.g. useId, useState) or Radix primitives which need "use client".
// So I should process src/components/ui too!
processDirectory('./src/components/ui');
